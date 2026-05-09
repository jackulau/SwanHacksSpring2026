/**
 * Sakoe-Chiba-banded Dynamic Time Warping for equal-width feature sequences.
 * Length-normalized output so sequences of different lengths compare on the
 * same scale.
 *
 * `a` and `b` are arrays of Float32Array rows, each row of length `dim`.
 */

export function dtwDistance(
  a: Float32Array[],
  b: Float32Array[],
  windowSize: number | null = 16,
): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;
  const dim = a[0].length;
  if (dim !== b[0].length) {
    throw new Error(
      `DTW width mismatch: a[0]=${dim}, b[0]=${b[0].length}`,
    );
  }

  // (n+1) x (m+1) cost grid, row-major.
  const W = m + 1;
  const cost = new Float64Array((n + 1) * W);
  cost.fill(Infinity);
  cost[0] = 0;

  const ratio = m / n;
  for (let i = 1; i <= n; i++) {
    let jLo = 1;
    let jHi = m;
    if (windowSize !== null) {
      const center = Math.floor(i * ratio);
      jLo = Math.max(1, center - windowSize);
      jHi = Math.min(m, center + windowSize);
    }
    const aRow = a[i - 1];
    for (let j = jLo; j <= jHi; j++) {
      const bRow = b[j - 1];
      let s = 0;
      for (let k = 0; k < dim; k++) {
        const diff = aRow[k] - bRow[k];
        s += diff * diff;
      }
      const local = Math.sqrt(s);
      const above = cost[(i - 1) * W + j];
      const left = cost[i * W + j - 1];
      const diag = cost[(i - 1) * W + j - 1];
      const min = above < left ? (above < diag ? above : diag) : left < diag ? left : diag;
      cost[i * W + j] = local + min;
    }
  }
  const final = cost[n * W + m];
  if (!isFinite(final)) return Infinity;
  return final / (n + m);
}
