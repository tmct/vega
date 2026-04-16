import partition from './partition.js';
import {Transform, ingest} from 'vega-dataflow';
import {accessorName, inherits} from 'vega-util';

/**
 * Compute (optionally weighted) Pearson correlation for one or more data
 * groups. Emits one output tuple per group containing the correlation
 * coefficient plus any groupby field values.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.x - An accessor for the first field.
 * @param {function(object): *} params.y - An accessor for the second field.
 * @param {function(object): *} [params.weight] - An optional accessor for a
 *   per-row weight. When omitted, each row is treated as having weight 1.
 *   Rows with negative weights are ignored with a warning.
 * @param {Array<function(object): *>} [params.groupby] - An array of
 *   accessors to groupby.
 * @param {Array<string>} [params.as] - Output field name for the correlation
 *   value. Defaults to ['corr'].
 */
export default function Correlation(params) {
  Transform.call(this, null, params);
}

Correlation.Definition = {
  'type': 'Correlation',
  'metadata': {'generates': true},
  'params': [
    { 'name': 'x',       'type': 'field',  'required': true },
    { 'name': 'y',       'type': 'field',  'required': true },
    { 'name': 'weight',  'type': 'field' },
    { 'name': 'groupby', 'type': 'field',  'array': true },
    { 'name': 'as',      'type': 'string', 'array': true, 'length': 1, 'default': ['corr'] }
  ]
};

inherits(Correlation, Transform, {
  transform(_, pulse) {
    const out = pulse.fork(pulse.NO_SOURCE | pulse.NO_FIELDS);

    if (!this.value || pulse.changed() || _.modified()) {
      const source = pulse.materialize(pulse.SOURCE).source,
            groups = partition(source, _.groupby),
            names = (_.groupby || []).map(accessorName),
            x = _.x,
            y = _.y,
            w = _.weight,
            as = (_.as && _.as.length) ? _.as : ['corr'],
            values = [];

      let warnedNeg = false;

      groups.forEach(g => {
        let Sw = 0, Swx = 0, Swy = 0, Swxx = 0, Swyy = 0, Swxy = 0, n = 0;

        for (const d of g) {
          const u = x(d), v = y(d), ww = w ? w(d) : 1;
          if (u == null || v == null || ww == null) continue;
          const du = +u, dv = +v, dw = +ww;
          if (!(du === du) || !(dv === dv) || !(dw === dw)) continue;
          if (dw < 0) {
            if (!warnedNeg) {
              pulse.dataflow.warn('Ignoring rows with negative weights in correlation transform.');
              warnedNeg = true;
            }
            continue;
          }
          Sw   += dw;
          Swx  += dw * du;
          Swy  += dw * dv;
          Swxx += dw * du * du;
          Swyy += dw * dv * dv;
          Swxy += dw * du * dv;
          ++n;
        }

        // Emit a row per group. When correlation is undefined (too little
        // data, zero total weight, or zero variance in x or y), emit null.
        let r = null;
        if (n > 1 && Sw > 0) {
          const mx = Swx / Sw,
                my = Swy / Sw,
                cov = Swxy / Sw - mx * my,
                vx  = Swxx / Sw - mx * mx,
                vy  = Swyy / Sw - my * my;
          if (vx > 0 && vy > 0) {
            r = cov / Math.sqrt(vx * vy);
          }
        }

        const t = {};
        for (let i = 0; i < names.length; ++i) {
          t[names[i]] = g.dims[i];
        }
        t[as[0]] = r;
        values.push(ingest(t));
      });

      if (this.value) out.rem = this.value;
      this.value = out.add = out.source = values;
    }

    return out;
  }
});
