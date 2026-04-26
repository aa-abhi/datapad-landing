// ─────────────────────────────────────────────
// CORE STATISTICAL FUNCTIONS
// All pure — no side effects, no React deps
// ─────────────────────────────────────────────

/** Rational approximation to normalCDF (Abramowitz & Stegun 26.2.17) */
export function normalCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422820 * Math.exp((-x * x) / 2)
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))))
  return x > 0 ? 1 - p : p
}

/** Peter Acklam's rational approximation to inverse normal */
export function normalPPF(p) {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p < 0.5) return -normalPPF(1 - p)
  const q = p - 0.5
  const r = q * q
  const num =
    q *
    (2.5090809287301226727e3 +
      r *
        (3.3430575583588128105e4 +
          r *
            (6.7265770927008700853e4 +
              r *
                (4.5921953931549871457e4 +
                  r *
                    (1.3731693765509461125e4 +
                      r *
                        (1.9715909503065514427e3 +
                          r * (1.3314349742930454610e2 + r * 3.3871328727963666080)))))))
  const den =
    2.5090809287301226727e3 +
    r *
      (2.0440107817814567588e4 +
        r *
          (4.3548959706765579462e4 +
            r *
              (2.8862383475678374638e4 +
                r *
                  (8.3050093638376789974e3 +
                    r *
                      (1.0823038792095716174e3 +
                        r * (5.5706694245767834917e1 + r))))))
  return num / den
}

/**
 * Two-proportion Z-test (signed z for correct one-sided direction)
 * hypothesis: 'two' | 'one'
 */
export function calcPValue(n1, c1, n2, c2, hypothesis = 'two') {
  if (!n1 || !n2 || n1 <= 0 || n2 <= 0) return 1
  const p1 = c1 / n1
  const p2 = c2 / n2
  const pooled = (c1 + c2) / (n1 + n2)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
  if (se === 0) return 1
  const z = (p2 - p1) / se
  if (hypothesis === 'one') return z > 0 ? 1 - normalCDF(z) : 1
  return 2 * (1 - normalCDF(Math.abs(z)))
}

/** Wilson confidence interval — handles small samples & extreme rates better than Wald */
export function calcCI(n, c, conf) {
  if (!n || n <= 0) return [0, 0]
  const p = c / n
  const z = normalPPF(1 - (1 - conf / 100) / 2)
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

/** Statistical power — single non-central normal approximation */
export function calcPower(n1, p1, n2, p2, confidence = 95) {
  const alpha = 1 - confidence / 100
  const se = Math.sqrt(
    (p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2
  )
  if (se === 0) return p1 !== p2 ? 1 : 0
  const zAlpha = normalPPF(1 - alpha / 2)
  const ncp = Math.abs(p2 - p1) / se
  return normalCDF(ncp - zAlpha) + normalCDF(-ncp - zAlpha)
}

/** Minimum detectable effect given current sample sizes */
export function calcMDE(n1, n2, baseRate, alphaAdj, power = 0.8) {
  const za = normalPPF(1 - alphaAdj / 2)
  const zb = normalPPF(power)
  return (
    (za + zb) *
    Math.sqrt(baseRate * (1 - baseRate) * (1 / n1 + 1 / n2))
  )
}

/** Required sample size per variant for a given absolute MDE */
export function calcSampleSize(baseRate, absMDE, alphaAdj, power = 0.8) {
  if (Math.abs(absMDE) < 1e-10) return Infinity
  const za = normalPPF(1 - alphaAdj / 2)
  const zb = normalPPF(power)
  let p2 = Math.min(Math.max(baseRate + absMDE, 0.001), 0.999)
  return Math.ceil(
    Math.pow(
      za * Math.sqrt(2 * baseRate * (1 - baseRate)) +
        zb * Math.sqrt(baseRate * (1 - baseRate) + p2 * (1 - p2)),
      2
    ) / Math.pow(absMDE, 2)
  )
}

/** Binomial sample — Box-Muller for large n, exact for small */
function binomialSample(n, p) {
  if (n <= 0) return 0
  if (n > 500) {
    const mu = n * p
    const sigma = Math.sqrt(n * p * (1 - p))
    if (sigma < 1e-10) return Math.round(mu)
    const u1 = Math.random()
    const u2 = Math.random()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return Math.min(n, Math.max(0, Math.round(mu + sigma * z)))
  }
  let x = 0
  for (let i = 0; i < n; i++) if (Math.random() < p) x++
  return x
}

/** Monte Carlo simulation — 5,000 binomial trials */
export function runSimulation(n1, c1, n2, c2, confidence = 95, numSims = 5000) {
  const p1 = c1 / n1
  const p2 = c2 / n2
  const alpha = 1 - confidence / 100
  let wins = 0, losses = 0, inc = 0
  const lifts = new Array(numSims)

  for (let i = 0; i < numSims; i++) {
    const s1 = binomialSample(n1, p1)
    const s2 = binomialSample(n2, p2)
    const sp1 = s1 / n1
    const sp2 = s2 / n2
    const lift = sp1 === 0 ? (sp2 > 0 ? 1 : 0) : (sp2 - sp1) / sp1
    lifts[i] = lift
    const pv = calcPValue(n1, s1, n2, s2)
    if (pv < alpha) {
      sp2 > sp1 ? wins++ : losses++
    } else {
      inc++
    }
  }

  lifts.sort((a, b) => a - b)
  const pctl = (p) => lifts[Math.min(numSims - 1, Math.floor(numSims * p))] * 100

  return {
    winRate: (wins / numSims) * 100,
    lossRate: (losses / numSims) * 100,
    incRate: (inc / numSims) * 100,
    p5: pctl(0.05),
    p25: pctl(0.25),
    p50: pctl(0.5),
    p75: pctl(0.75),
    p95: pctl(0.95),
  }
}

/** SRM via chi-square (Wilson-Hilferty normal approximation) */
export function checkSRM(visitors) {
  const total = visitors.reduce((a, b) => a + b, 0)
  if (total === 0) return { ok: true, pValue: 1 }
  const expected = total / visitors.length
  const chiSq = visitors.reduce((sum, v) => sum + Math.pow(v - expected, 2) / expected, 0)
  const df = visitors.length - 1
  if (df <= 0) return { ok: true, pValue: 1 }
  const wh = Math.pow(chiSq / df, 1 / 3) - (1 - 2 / (9 * df))
  const whSE = Math.sqrt(2 / (9 * df))
  const z = wh / whSE
  const pValue = Math.max(0, Math.min(1, 1 - normalCDF(z)))
  return { ok: pValue > 0.01, pValue, chiSq }
}

// ─────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────
export const fmt    = (n, d = 2) => (isNaN(n) || !isFinite(n)) ? '—' : n.toFixed(d)
export const fmtPct = (n, d = 2) => (isNaN(n) || !isFinite(n)) ? '—' : (n * 100).toFixed(d) + '%'
export const fmtRaw = (n, d = 2) => (isNaN(n) || !isFinite(n)) ? '—' : n.toFixed(d) + '%'
export const fmtNum = (n)        => (isNaN(n) || !isFinite(n)) ? '—' : Math.round(n).toLocaleString()

/** Verdict for a variant result */
export function getVerdict(v) {
  if (!v) return { text: 'Enter data', color: 'var(--t2)', bg: 'rgba(110,110,130,0.08)' }
  if (v.isSignificant && v.lift > 0) return { text: '🏆 Winner',        color: 'var(--pri)', bg: 'rgba(0,255,136,0.08)' }
  if (v.isSignificant && v.lift < 0) return { text: '📉 Loser',         color: 'var(--red)', bg: 'rgba(255,68,102,0.08)' }
  if (v.power < 80)                  return { text: '⏳ Need More Data', color: 'var(--warn)', bg: 'rgba(255,170,0,0.08)' }
  return                                    { text: '🔄 No Difference',  color: 'var(--acc)', bg: 'rgba(0,212,255,0.08)' }
}