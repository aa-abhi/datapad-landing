import { calcSampleSize, calcPower, fmt, fmtPct, fmtRaw, fmtNum, normalPPF } from '../utils/stats.js'

function PowerCurveSVG({ baseRate, n1, n2, confidence }) {
  const w = 560, h = 150, pts = 60
  const maxMDE = Math.max(baseRate * 0.5, 0.02)
  let path = ''

  for (let i = 0; i <= pts; i++) {
    const mde = (i / pts) * maxMDE
    const p2 = Math.min(baseRate + mde, 0.9999)
    const pw = calcPower(n1, baseRate, n2, p2, confidence) * 100
    const px = (i / pts) * w
    const py = h - 10 - (Math.min(pw, 100) / 100) * (h - 20)
    path += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1)
  }

  const y80 = h - 10 - 0.8 * (h - 20)

  return (
    <svg
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', width: '100%', maxWidth: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--acc)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--acc)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={`${path}L${w},${h - 10}L0,${h - 10}Z`} fill="url(#pg)" />
      <path d={path} fill="none" stroke="var(--acc)" strokeWidth="2" opacity="0.9" />
      <line x1="0" y1={y80} x2={w} y2={y80} stroke="rgba(0,212,255,0.3)" strokeWidth="1" strokeDasharray="4,4" />
      <text x={w - 4} y={y80 - 4} textAnchor="end" fill="rgba(0,212,255,0.5)" fontSize="9" fontFamily="var(--mono)">80% power</text>
      <text x={w / 2} y={h} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="var(--mono)">Effect size (absolute) →</text>
    </svg>
  )
}

export default function PowerTab({ R, numVariants, confidence }) {
  if (!R || !R.variantResults.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">📈</div>
        <div className="empty-title">Enter Test Data First</div>
        <div className="empty-desc">Add your visitor and conversion numbers to see power analysis.</div>
      </div>
    )
  }

  const v0 = R.variantResults[0]
  const n1 = +R.ctrl.visitors
  const n2 = v0.visitors
  const mdePcts = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10]

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Power Curve</h2>
        </div>
        <PowerCurveSVG baseRate={R.baseRate} n1={n1} n2={n2} confidence={confidence} />
        <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
          Power vs. absolute effect size at current sample sizes
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Sample Size Table</h2>
          <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>
            Visitors per variant needed to detect each MDE with 80% power at {confidence}% confidence.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>MDE</th>
                <th>Per Variant</th>
                <th>Total (all variants)</th>
                <th>Power at current n</th>
              </tr>
            </thead>
            <tbody>
              {mdePcts.map(mde => {
                const n = calcSampleSize(R.baseRate, mde / 100, R.alphaAdj)
                const pw = calcPower(n, R.baseRate, n, R.baseRate + mde / 100, confidence) * 100
                const isCurrent = Math.abs(v0.absDiff * 100) >= mde - 0.01
                return (
                  <tr key={mde} style={isCurrent ? { background: 'rgba(0,255,136,0.04)' } : {}}>
                    <td>{mde}%</td>
                    <td>{isFinite(n) ? n.toLocaleString() : '∞'}</td>
                    <td>{isFinite(n) ? (n * numVariants).toLocaleString() : '∞'}</td>
                    <td style={{ color: pw >= 80 ? 'var(--pri)' : 'var(--warn)' }}>
                      {fmtRaw(pw, 1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ background: 'rgba(0,212,255,0.03)', borderColor: 'rgba(0,212,255,0.1)' }}>
        <p style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1.9 }}>
          With <strong style={{ color: 'var(--t0)' }}>{fmtNum(n1)}</strong> visitors/variant and baseline{' '}
          <strong style={{ color: 'var(--pri)' }}>{fmtPct(R.baseRate)}</strong>, your current MDE is{' '}
          <strong style={{ color: 'var(--acc)' }}>{fmtPct(v0.mde)}</strong>. Effects this size or larger can be detected with 80% power.
        </p>
      </div>
    </div>
  )
}