// Weighted least-squares linear regression. Returns the same
// {coef, predict, rSquared} shape as the unweighted linear regression
// so it is a drop-in substitute when a weight accessor is supplied.
// Rows with negative weights are ignored.
export default function(data, x, y, w) {
  let Sw = 0, Swx = 0, Swy = 0, Swxx = 0, Swyy = 0, Swxy = 0;

  for (const d of data) {
    const u = x(d), v = y(d), ww = w(d);
    if (u == null || v == null || ww == null) continue;
    const du = +u, dv = +v, dw = +ww;
    if (!(du === du) || !(dv === dv) || !(dw === dw) || dw < 0) continue;
    Sw   += dw;
    Swx  += dw * du;
    Swy  += dw * dv;
    Swxx += dw * du * du;
    Swyy += dw * dv * dv;
    Swxy += dw * du * dv;
  }

  const denom = Sw * Swxx - Swx * Swx,
        slope = Math.abs(denom) < 1e-24 ? 0 : (Sw * Swxy - Swx * Swy) / denom,
        intercept = Sw > 0 ? (Swy - slope * Swx) / Sw : 0,
        coef = [intercept, slope],
        predict = x => coef[0] + coef[1] * x;

  // Weighted coefficient of determination.
  const SStot = Swyy - (Sw > 0 ? Swy * Swy / Sw : 0),
        SSres = Swyy - intercept * Swy - slope * Swxy,
        rSquared = Math.abs(SStot) < 1e-24 ? 0 : 1 - SSres / SStot;

  return {coef, predict, rSquared};
}
