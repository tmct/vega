import tape from 'tape';
import { field } from 'vega-util';
import { Dataflow, changeset } from 'vega-dataflow';
import { collect as Collect } from 'vega-transforms';
import { regression as Regression } from '../index.js';

tape('Regression fits constant regression model', t => {
  const data = [
    {k: 'a', u: 2, v: 2}, {k: 'a', u: 1, v: 1},
    {k: 'b', u: 3, v: 2}, {k: 'b', u: 2, v: 1}
  ];

  var k = field('k'),
      u = field('u'),
      v = field('v'),
      df = new Dataflow(),
      col = df.add(Collect),
      reg = df.add(Regression, {
        method: 'constant',
        groupby: [k],
        x: u,
        y: v,
        pulse: col
      }),
      out = df.add(Collect, {pulse: reg});

  // -- test adds
  df.pulse(col, changeset().insert(data)).run();
  const d = out.value;
  t.equal(d.length, 4);

  t.equal(d[0].k, 'a');
  t.equal(d[0].u, 1);
  t.equal(d[0].v, 1.5);

  t.equal(d[1].k, 'a');
  t.equal(d[1].u, 2);
  t.equal(d[1].v, 1.5);

  t.equal(d[2].k, 'b');
  t.equal(d[2].u, 2);
  t.equal(d[2].v, 1.5);

  t.equal(d[3].k, 'b');
  t.equal(d[3].u, 3);
  t.equal(d[3].v, 1.5);

  t.end();
});

tape('Regression fits linear regression model', t => {
  const data = [
    {k: 'a', u: 2, v: 2}, {k: 'a', u: 1, v: 1},
    {k: 'b', u: 3, v: 2}, {k: 'b', u: 2, v: 1}
  ];

  var k = field('k'),
      u = field('u'),
      v = field('v'),
      df = new Dataflow(),
      col = df.add(Collect),
      reg = df.add(Regression, {
        method: 'linear',
        groupby: [k],
        x: u,
        y: v,
        pulse: col
      }),
      out = df.add(Collect, {pulse: reg});

  // -- test adds
  df.pulse(col, changeset().insert(data)).run();
  const d = out.value;
  t.equal(d.length, 4);

  t.equal(d[0].k, 'a');
  t.equal(d[0].u, 1);
  t.equal(d[0].v, 1);

  t.equal(d[1].k, 'a');
  t.equal(d[1].u, 2);
  t.equal(d[1].v, 2);

  t.equal(d[2].k, 'b');
  t.equal(d[2].u, 2);
  t.equal(d[2].v, 1);

  t.equal(d[3].k, 'b');
  t.equal(d[3].u, 3);
  t.equal(d[3].v, 2);

  t.end();
});

tape('Regression fits quadratic regression model', t => {
  var data = [0, 1, 2, 3].map(x => ({x: x, y: 1 + x*x})),
      x = field('x'),
      y = field('y'),
      df = new Dataflow(),
      col = df.add(Collect),
      reg = df.add(Regression, {method: 'quad', x: x, y: y, pulse: col}),
      out = df.add(Collect, {pulse: reg});

  // -- test adds
  df.pulse(col, changeset().insert(data)).run();
  const d = out.value;
  t.equal(d[0].x, 0);
  t.equal(d[0].y, 1);
  t.equal(d[d.length-1].x, 3);
  t.equal(d[d.length-1].y, 10);

  t.end();
});

tape('Regression outputs model parameters', t => {
  var data = [0, 1, 2, 3].map(x => ({x: x, y: 1 + x*x})),
      x = field('x'),
      y = field('y'),
      df = new Dataflow(),
      col = df.add(Collect),
      reg = df.add(Regression, {method: 'quad', params: true, x: x, y: y, pulse: col}),
      out = df.add(Collect, {pulse: reg});

  // -- test adds
  df.pulse(col, changeset().insert(data)).run();
  const d = out.value;
  t.equal(d.length, 1);
  t.deepEqual(d[0].coef, [1, 0, 1]);
  t.equal(d[0].rSquared, 1);

  t.end();
});

tape('Weighted linear regression with uniform weights matches unweighted', t => {
  const data = [0, 1, 2, 3, 4].map(i => ({x: i, y: 2 * i + 1, w: 1}));

  const df = new Dataflow(),
        col = df.add(Collect),
        reg = df.add(Regression, {
          method: 'linear', params: true,
          x: field('x'), y: field('y'), weight: field('w'),
          pulse: col
        }),
        out = df.add(Collect, {pulse: reg});

  df.pulse(col, changeset().insert(data)).run();
  const d = out.value[0];
  t.ok(Math.abs(d.coef[0] - 1) < 1e-12, 'intercept');
  t.ok(Math.abs(d.coef[1] - 2) < 1e-12, 'slope');
  t.ok(Math.abs(d.rSquared - 1) < 1e-12, 'rSquared');
  t.end();
});

tape('Weighted linear regression fits closed-form WLS', t => {
  // Two points with weight=10 anchoring y=x exactly, plus a heavy outlier
  // with tiny weight that should barely shift the fit.
  const data = [
    {x: 0, y: 0,  w: 10},
    {x: 1, y: 1,  w: 10},
    {x: 2, y: 2,  w: 10},
    {x: 3, y: 30, w: 0.01}
  ];

  // Closed-form WLS over the same rows.
  let Sw = 0, Swx = 0, Swy = 0, Swxx = 0, Swxy = 0;
  for (const d of data) {
    Sw += d.w; Swx += d.w * d.x; Swy += d.w * d.y;
    Swxx += d.w * d.x * d.x; Swxy += d.w * d.x * d.y;
  }
  const expectedSlope = (Sw * Swxy - Swx * Swy) / (Sw * Swxx - Swx * Swx);
  const expectedIntercept = (Swy - expectedSlope * Swx) / Sw;

  const df = new Dataflow(),
        col = df.add(Collect),
        reg = df.add(Regression, {
          method: 'linear', params: true,
          x: field('x'), y: field('y'), weight: field('w'),
          pulse: col
        }),
        out = df.add(Collect, {pulse: reg});

  df.pulse(col, changeset().insert(data)).run();
  const d = out.value[0];
  t.ok(Math.abs(d.coef[0] - expectedIntercept) < 1e-10, 'intercept matches WLS');
  t.ok(Math.abs(d.coef[1] - expectedSlope) < 1e-10, 'slope matches WLS');
  // With a near-zero-weight outlier, slope should be close to 1.
  t.ok(Math.abs(d.coef[1] - 1) < 0.05, 'fit is dominated by weighted anchors');
  t.end();
});

tape('Weighted regression rejects unsupported methods', async t => {
  const data = [{x: 0, y: 1, w: 1}, {x: 1, y: 2, w: 1}, {x: 2, y: 5, w: 1}];
  const df = new Dataflow(),
        col = df.add(Collect);
  df.add(Regression, {
    method: 'poly', params: true,
    x: field('x'), y: field('y'), weight: field('w'),
    pulse: col
  });

  let errMsg = null;
  df.error = function(e) { errMsg = e.message; };

  df.pulse(col, changeset().insert(data));
  await df.runAsync();
  t.ok(errMsg && /Weighted regression is only supported/.test(errMsg), 'error raised');
  t.end();
});

tape('Weighted constant regression returns weighted mean', t => {
  const data = [
    {x: 0, y: 10, w: 1},
    {x: 1, y: 20, w: 3},
    {x: 2, y: 30, w: 0}
  ];
  // weighted mean = (10*1 + 20*3 + 30*0) / (1+3+0) = 70/4 = 17.5
  const df = new Dataflow(),
        col = df.add(Collect),
        reg = df.add(Regression, {
          method: 'constant', params: true,
          x: field('x'), y: field('y'), weight: field('w'),
          pulse: col
        }),
        out = df.add(Collect, {pulse: reg});

  df.pulse(col, changeset().insert(data)).run();
  const d = out.value[0];
  t.ok(Math.abs(d.coef[0] - 17.5) < 1e-12, 'weighted mean');
  t.end();
});

tape('Weighted linear regression ignores rows with negative weights', t => {
  // perfect line y = 2x + 1 plus a wild outlier with negative weight;
  // the outlier must not contribute, so the fit stays exact
  const data = [0, 1, 2, 3, 4].map(i => ({x: i, y: 2 * i + 1, w: 1}))
    .concat([{x: 100, y: -1000, w: -5}]);

  const df = new Dataflow(),
        col = df.add(Collect),
        reg = df.add(Regression, {
          method: 'linear', params: true,
          x: field('x'), y: field('y'), weight: field('w'),
          pulse: col
        }),
        out = df.add(Collect, {pulse: reg});

  let warned = false;
  df.warn = () => { warned = true; return df; };

  df.pulse(col, changeset().insert(data)).run();
  const d = out.value[0];
  t.ok(Math.abs(d.coef[0] - 1) < 1e-12, 'intercept unaffected by negative-weight row');
  t.ok(Math.abs(d.coef[1] - 2) < 1e-12, 'slope unaffected by negative-weight row');
  t.ok(warned, 'emits warning for negative weights');
  t.end();
});
