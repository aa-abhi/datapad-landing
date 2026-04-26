import { fmt, fmtPct, fmtRaw, fmtNum, getVerdict } from '../utils/stats.js'

function VariantInsight({ v, R }) {
  const vd = getVerdict(v)
  const winner = v.isSignificant && v.lift > 0
  const loser  = v.isSignificant && v.lift < 0
  const lowPow = v.power < 80

  let advice
  if (winner) {
    const proj = isFinite(v.lift) ? Math.round(100000 * Math.abs(v.lift)).toLocaleString() : 'significant'
    advice = (
      <>
        <p><strong style={{ color: 'var(--pri)' }}>✅ Deploy this variant.</strong></p>
        <p>
          {v.name} shows a significant <strong>{v.lift >= 0 ? '+' : ''}{fmtRaw(v.lift * 100, 2)}</strong> improvement
          (p = {fmt(v.pValue, 4)}, power = {fmtRaw(v.power)}). Wilson CI: [{fmtPct(v.ci[0])} – {fmtPct(v.ci[1])}].
          {R.numComparisons > 1 ? ` Bonferroni-adjusted α = ${fmt(R.alphaAdj, 4)}.` : ''}
        </p>
        <p style={{ marginTop: 8, color: 'var(--t2)' }}>
          📈 Projected: If baseline yields 100,000 conversions/year, this lift adds roughly{' '}
          <strong style={{ color: 'var(--t1)' }}>+{proj}</strong> conversions annually.
        </p>
      </>
    )
  } else if (loser) {
    advice = (
      <>
        <p><strong style={{ color: 'var(--red)' }}>❌ Do NOT deploy.</strong></p>
        <p>{v.name} is significantly worse (<strong>{fmtRaw(v.lift * 100, 2)}</strong>, p = {fmt(v.pValue, 4)}). Revert to control and investigate why.</p>
      </>
    )
  } else if (!v.isSignificant && lowPow) {
    const periods = v.sampleNeeded > 0 && isFinite(v.sampleNeeded)
      ? Math.ceil(v.sampleNeeded / (+R.ctrl.visitors || 1))
      : '?'
    advice = (
      <>
        <p><strong style={{ color: 'var(--warn)' }}>⏳ Continue collecting data.</strong></p>
        <p>
          Not significant (p = {fmt(v.pValue, 4)}) and power is only {fmtRaw(v.power)} (below 80%).
          Need ~<strong>{isFinite(v.sampleNeeded) ? fmtNum(v.sampleNeeded) : '∞'}</strong> visitors/variant.
          At current traffic, that is approximately <strong>{periods}</strong> more collection periods.
        </p>
      </>
    )
  } else {
    advice = (
      <>
        <p><strong style={{ color: 'var(--acc)' }}>🔄 No meaningful difference detected.</strong></p>
        <p>
          Sufficient power ({fmtRaw(v.power)}) but no significant result.
          The true effect is likely smaller than the MDE of {fmtPct(v.mde)}.
          Consider whether an effect that small would be business-relevant before running a larger test.
        </p>
      </>
    )
  }

  return (
    <article className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{v.name}</h2>
        <span
          className="verdict"
          style={{ background: vd.bg, color: vd.color, border: `1px solid ${vd.color}22` }}
        >
          {vd.text}
        </span>
      </div>
      <div style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 2 }}>{advice}</div>
    </article>
  )
}

export default function InsightsTab({ R }) {
  if (!R || !R.variantResults.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">💡</div>
        <div className="empty-title">Enter Test Data First</div>
        <div className="empty-desc">Add visitor and conversion data to see actionable insights.</div>
      </div>
    )
  }

  return (
    <div>
      {R.variantResults.map(v => (
        <VariantInsight key={v.idx} v={v} R={R} />
      ))}

      {/* Methodology */}
      <div className="card" style={{ background: 'rgba(0,212,255,0.03)', borderColor: 'rgba(0,212,255,0.1)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--acc)', marginBottom: 10 }}>📐 Methodology</div>
        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 2 }}>
          <strong>Test:</strong> Two-proportion Z-test with signed z-statistic.<br />
          <strong>CIs:</strong> Wilson interval (superior to Wald for small samples and rates near 0%/100%).<br />
          <strong>Power:</strong> Single-term non-central normal approximation with unpooled variance.<br />
          <strong>Multiple testing:</strong> Bonferroni correction applied automatically for 3+ variants.<br />
          <strong>SRM:</strong> Chi-square test (Wilson-Hilferty approximation).<br />
          <strong>Simulation:</strong> True binomial Monte Carlo — Box-Muller for n &gt; 500, exact for small samples. 5,000 trials.<br />
          <strong>Privacy:</strong> 100% client-side. No data transmitted to any server.
        </div>
      </div>
    </div>
  )
}