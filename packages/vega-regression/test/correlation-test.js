import tape from 'tape';
import { field } from 'vega-util';
import { Dataflow, changeset } from 'vega-dataflow';
import { collect as Collect } from 'vega-transforms';
import { correlation as Correlation } from '../index.js';

function close(t, a, b, tol, msg) {
  tol = tol == null ? 1e-9 : tol;
  t.ok(Math.abs(a - b) < tol, (msg || 'close') + ' (got ' + a + ', expected ' + b + ')');
}

// Reference weighted Pearson correlation computed from raw sums. Used as a
// ground-truth oracle for the transform's output.
function weightedPearson(rows, xk, yk, wk) {
  let Sw = 0, Swx = 0, Swy = 0, Swxx = 0, Swyy = 0, Swxy = 0;
  for (const d of rows) {
    const w = wk == null ? 1 : d[wk];
    Sw += w;
    Swx += w * d[xk];
    Swy += w * d[yk];
    Swxx += w * d[xk] * d[xk];
    Swyy += w * d[yk] * d[yk];
    Swxy += w * d[xk] * d[yk];
  }
  const mx = Swx / Sw, my = Swy / Sw;
  const cov = Swxy / Sw - mx * my;
  const vx = Swxx / Sw - mx * mx;
  const vy = Swyy / Sw - my * my;
  return cov / Math.sqrt(vx * vy);
}

tape('Correlation computes unweighted Pearson by default', t => {
  const data = [
    {u: 1, v: 2}, {u: 2, v: 3}, {u: 3, v: 5},
    {u: 4, v: 4}, {u: 5, v: 6}
  ];

  const df = new Dataflow(),
        col = df.add(Collect),
        cor = df.add(Correlation, {x: field('u'), y: field('v'), pulse: col}),
        out = df.add(Collect, {pulse: cor});

  df.pulse(col, changeset().insert(data)).run();
  const d = out.value;
  t.equal(d.length, 1);
  close(t, d[0].corr, weightedPearson(data, 'u', 'v'), 1e-12, 'matches oracle');
  t.end();
});

tape('Correlation with uniform weights equals unweighted', t => {
  const data = [
    {u: 1, v: 2, w: 1}, {u: 2, v: 3, w: 1}, {u: 3, v: 5, w: 1},
    {u: 4, v: 4, w: 1}, {u: 5, v: 6, w: 1}
  ];

  const df = new Dataflow(),
        col = df.add(Collect),
        cor = df.add(Correlation, {
          x: field('u'), y: field('v'), weight: field('w'), pulse: col
        }),
        out = df.add(Collect, {pulse: cor});

  df.pulse(col, changeset().insert(data)).run();
  close(t, out.value[0].corr, weightedPearson(data, 'u', 'v'), 1e-12);
  t.end();
});

tape('Correlation honors non-uniform weights', t => {
  const data = [
    {u: 1, v: 1, w: 1},
    {u: 2, v: 5, w: 10},
    {u: 3, v: 3, w: 1},
    {u: 4, v: 9, w: 10},
    {u: 5, v: 2, w: 1}
  ];
  const expected = weightedPearson(data, 'u', 'v', 'w');

  const df = new Dataflow(),
        col = df.add(Collect),
        cor = df.add(Correlation, {
          x: field('u'), y: field('v'), weight: field('w'), pulse: col
        }),
        out = df.add(Collect, {pulse: cor});

  df.pulse(col, changeset().insert(data)).run();
  close(t, out.value[0].corr, expected, 1e-12);
  t.end();
});

tape('Correlation splits by groupby', t => {
  const data = [
    {k: 'a', u: 1, v: 1}, {k: 'a', u: 2, v: 2}, {k: 'a', u: 3, v: 3},
    {k: 'b', u: 1, v: 3}, {k: 'b', u: 2, v: 2}, {k: 'b', u: 3, v: 1}
  ];

  const df = new Dataflow(),
        col = df.add(Collect),
        cor = df.add(Correlation, {
          x: field('u'), y: field('v'), groupby: [field('k')], pulse: col
        }),
        out = df.add(Collect, {pulse: cor});

  df.pulse(col, changeset().insert(data)).run();
  const byKey = Object.fromEntries(out.value.map(o => [o.k, o.corr]));
  close(t, byKey.a, 1, 1e-12);
  close(t, byKey.b, -1, 1e-12);
  t.end();
});

tape('Correlation emits null for degenerate groups', t => {
  const data = [
    {u: 1, v: 1}, {u: 1, v: 2}, {u: 1, v: 3}  // variance in x is zero
  ];

  const df = new Dataflow(),
        col = df.add(Collect),
        cor = df.add(Correlation, {x: field('u'), y: field('v'), pulse: col}),
        out = df.add(Collect, {pulse: cor});

  df.pulse(col, changeset().insert(data)).run();
  t.equal(out.value.length, 1);
  t.equal(out.value[0].corr, null);
  t.end();
});

tape('Correlation honors custom output field name', t => {
  const data = [{u: 1, v: 2}, {u: 2, v: 3}, {u: 3, v: 5}];

  const df = new Dataflow(),
        col = df.add(Collect),
        cor = df.add(Correlation, {
          x: field('u'), y: field('v'), as: ['r'], pulse: col
        }),
        out = df.add(Collect, {pulse: cor});

  df.pulse(col, changeset().insert(data)).run();
  t.ok(typeof out.value[0].r === 'number', 'emits r field');
  t.equal(out.value[0].corr, undefined, 'does not emit default corr field');
  t.end();
});

tape('Correlation ignores rows with negative weights', t => {
  // negative-weight rows must not contribute; result should equal the
  // correlation computed over the non-negative rows only
  const keep = [
    {u: 1, v: 2, w: 1}, {u: 2, v: 3, w: 2}, {u: 3, v: 5, w: 1},
    {u: 4, v: 4, w: 3}, {u: 5, v: 6, w: 1}
  ];
  const data = keep.concat([
    {u: 100, v: -100, w: -5},
    {u: -50, v: 50, w: -1}
  ]);

  const df = new Dataflow(),
        col = df.add(Collect),
        cor = df.add(Correlation, {
          x: field('u'), y: field('v'), weight: field('w'), pulse: col
        }),
        out = df.add(Collect, {pulse: cor});

  let warned = false;
  df.warn = () => { warned = true; return df; };

  df.pulse(col, changeset().insert(data)).run();
  t.equal(out.value.length, 1);
  close(t, out.value[0].corr, weightedPearson(keep, 'u', 'v', 'w'), 1e-12,
    'matches oracle over non-negative rows');
  t.ok(warned, 'emits warning for negative weights');
  t.end();
});
