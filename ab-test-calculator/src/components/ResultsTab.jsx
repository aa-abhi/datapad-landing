import { fmt, fmtPct, fmtRaw, getVerdict } from '../utils/stats.js'

function InfoTip({ content }) {
  return (
    <span className="info-wrap" tabIndex={0}>
      <span className="info-btn">i</span>
      <span className="info-tip" role="tooltip" dangerouslySetInnerHTML={{ __html: content }} />
    </span>
  )
}

function Gauge({ value, label, color, tip }) {
  const size = 90
  const r = size / 2 - 8
  const circ = Math.PI * r
  const progress = Math.min(Math.max(value / 100, 0), 1)
  const offset = circ * (1 - progress)
  const display = isFinite(value) ? fmtRaw(value, 1) : '—'

  return (
    <div className="gauge">
      <svg width={size} height={size / 2 + 14} aria-hidden="true">
        <path
          d={`M 8 ${size / 2} A ${r} ${r} 0 0 1 ${size - 8} ${size / 2}`}
          fill="none" stroke="var(--bg3)" strokeWidth="6" strokeLinecap="round"
        />
        <path
          d={`M 8 ${size / 2} A ${r} ${r} 0 0 1 ${size - 8} ${size / 2}`}
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .6s var(--ease)' }}
        />
        <text
          x={size / 2} y={size / 2 - 2}
          textAnchor="middle" fill={color}
          fontSize="15" fontWeight="800" fontFamily="var(--font)"
        >
          {display}
        </text>
      </svg>
      <span className="gauge-label">
        {label} {tip && <InfoTip content={tip} />}
      </span>
    </div>
  )
}

function DistSVG({ p1, p2, se }) {
  if (!se || se === 0) return null
  const w = 300, h = 90, pts = 100
  const range = 4.5 * se
  const step = (2 * range) / pts
  const maxY = 1 / (se * Math.sqrt(2 * Math.PI))
  let path = ''
  const diff = p2 - p1

  for (let i = 0; i <= pts; i++) {
    const x = -range + i * step
    const y = Math.exp(-0.5 * Math.pow(x / se, 2)) / (se * Math.sqrt(2 * Math.PI))
    const px = ((x + range) / (2 * range)) * w
    const py = h - 10 - (y / maxY) * (h - 20)
    path += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1)
  }

  const diffX = Math.min(Math.max(((diff + range) / (2 * range)) * w, 4), w - 4)
  const zeroX = ((0 + range) / (2 * range)) * w
  const dc = diff >= 0 ? 'var(--pri)' : 'var(--red)'

  return (
    <svg
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block', width: '100%', maxWidth: w, margin: '0 auto' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--pri)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--pri)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={`${path}L${w},${h - 10}L0,${h - 10}Z`} fill="url(#dg)" />
      <path d={path} fill="none" stroke="var(--pri)" strokeWidth="1.5" opacity="0.85" />
      <line x1={zeroX} y1="6" x2={zeroX} y2={h - 10} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
      <line x1={diffX} y1="6" x2={diffX} y2={h - 10} stroke={dc} strokeWidth="2" />
      <text x={zeroX} y={h} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="var(--mono)">0</text>
      <text x={Math.min(diffX + 4, w - 16)} y="16" textAnchor="start" fill={dc} fontSize="9" fontFamily="var(--mono)">Δ</text>
    </svg>
  )
}

function VariantCard({ v, R, mode, confidence }) {
  const vd = getVerdict(v)
  const liftColor = v.lift >= 0 ? 'var(--pri)' : 'var(--red)'
  const pvColor = v.isSignificant ? 'var(--pri)' : 'var(--red)'
  const pwColor = v.power >= 80 ? 'var(--acc)' : 'var(--warn)'
  const liftDisplay = isFinite(v.lift) ? (v.lift >= 0 ? '+' : '') + fmtRaw(v.lift * 100, 2) : 'N/A'
  const ciBarW = Math.min(95, Math.max(15, ((v.ci[1] - v.ci[0]) / Math.max(v.rate + 0.05, 0.1)) * 100))

  return (
    <article className="card">
      {/* Header */}
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="card-title">{v.name}</h2>
          <span style={{ fontSize: 12, color: 'var(--t2)' }}>vs Control</span>
        </div>
        <span
          className="verdict"
          style={{ background: vd.bg, color: vd.color, border: `1px solid ${vd.color}22` }}
          role="status"
        >
          {vd.text}
        </span>
      </div>

      {/* Gauges */}
      <div className="gauge-row" role="img" aria-label={`Key metrics for ${v.name}`}>
        <Gauge
          value={(1 - v.pValue) * 100}
          label="Certainty (1−p)"
          color={v.isSignificant ? 'var(--pri)' : 'var(--red)'}
          tip={`How strongly data argues against no difference. Goal: ≥${confidence}%`}
        />
        <Gauge
          value={v.power}
          label="Power"
          color={pwColor}
          tip="Probability of detecting a real effect. ✓ Good: ≥ 80%"
        />
        <div className="gauge">
          <div style={{ fontSize: 28, fontWeight: 900, color: liftColor, letterSpacing: -1 }}>
            {liftDisplay}
          </div>
          <span className="gauge-label">
            Relative Lift{' '}
            <InfoTip content="(Variant Rate − Control Rate) ÷ Control Rate × 100" />
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mg mg4">
        <div className="metric-card">
          <div className="metric-label">P-Value <InfoTip content={`Probability of seeing this result by chance. Significant: &lt; ${fmt(R.alphaAdj, 4)}`} /></div>
          <div className="metric-val" style={{ color: pvColor }}>{fmt(v.pValue, 4)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Conv. Rate</div>
          <div className="metric-val">{fmtPct(v.rate)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Abs. Diff <InfoTip content="Variant Rate − Control Rate in percentage points." /></div>
          <div className="metric-val" style={{ color: liftColor }}>
            {v.absDiff >= 0 ? '+' : ''}{fmtPct(v.absDiff)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">MDE <InfoTip content="Smallest difference detectable with 80% power at current sample size." /></div>
          <div className="metric-val">{fmtPct(v.mde)}</div>
        </div>
      </div>

      {/* CI + Distribution */}
      <div className="mg mg2" style={{ marginTop: 12 }}>
        <div className="metric-card">
          <div className="metric-label">
            {confidence}% CI (Wilson){' '}
            <InfoTip content="Range where the true conversion rate most likely falls. Wilson method is more accurate for small samples." />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--acc)' }}>{fmtPct(v.ci[0])}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,rgba(0,212,255,0.35),rgba(0,255,136,0.35))', borderRadius: 3, width: `${ciBarW}%` }} />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--pri)' }}>{fmtPct(v.ci[1])}</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6, textAlign: 'center' }}>
            Control: {fmtPct(v.ciCtrl[0])} – {fmtPct(v.ciCtrl[1])}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            Distribution <InfoTip content="Bell curve centred on zero. Δ marks the observed difference. Δ far from centre = strong evidence." />
          </div>
          <div style={{ marginTop: 8 }}>
            <DistSVG p1={R.baseRate} p2={v.rate} se={v.se} />
          </div>
        </div>
      </div>

      {/* Revenue */}
      {mode === 'revenue' && v.rvc > 0 && (
        <div className="mg mg3" style={{ marginTop: 12 }}>
          <div className="metric-card">
            <div className="metric-label">Rev/Visitor (Ctrl)</div>
            <div className="metric-val">₹{fmt(v.rvc)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Rev/Visitor (Var)</div>
            <div className="metric-val">₹{fmt(v.rvv)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Revenue Lift</div>
            <div className="metric-val" style={{ color: v.revLift >= 0 ? 'var(--pri)' : 'var(--red)' }}>
              {v.revLift >= 0 ? '+' : ''}{fmtRaw(v.revLift * 100)}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export default function ResultsTab({ R, mode, confidence }) {
  if (!R || !R.variantResults.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">📊</div>
        <div className="empty-title">Enter Your Test Data</div>
        <div className="empty-desc">Fill in visitors and conversions on the left to see results.</div>
      </div>
    )
  }

  return (
    <div>
      {/* SRM */}
      {R.srm && !R.srm.ok && (
        <div className="srm-warn" role="alert">
          ⚠️ <strong>Sample Ratio Mismatch detected</strong> (χ² p = {fmt(R.srm.pValue, 4)}).
          Traffic split is uneven — this may invalidate results. Check your randomisation setup.
        </div>
      )}
      {R.srm && R.srm.ok && R.variantResults.length > 0 && (
        <div className="srm-ok">
          ✓ <strong>SRM Check Passed</strong> — Traffic split is balanced (χ² p = {fmt(R.srm.pValue, 3)})
        </div>
      )}

      {/* Bonferroni notice */}
      {R.numComparisons > 1 && (
        <div className="bonf-badge">
          ⚡ Bonferroni correction active — α adjusted to {fmt(R.alphaAdj, 4)} for {R.numComparisons} comparisons
        </div>
      )}

      {R.variantResults.map(v => (
        <VariantCard key={v.idx} v={v} R={R} mode={mode} confidence={confidence} />
      ))}
    </div>
  )
}