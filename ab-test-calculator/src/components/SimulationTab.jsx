import { fmtRaw } from '../utils/stats.js'

function InfoTip({ content }) {
  return (
    <span className="info-wrap" tabIndex={0}>
      <span className="info-btn">i</span>
      <span className="info-tip" role="tooltip">{content}</span>
    </span>
  )
}

export default function SimulationTab({ R, simResult, simRunning, onRun }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800 }}>Monte Carlo Simulation</h2>
            <InfoTip content="Runs 5,000 independent A/B trials using true binomial sampling at your observed rates." />
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
            5,000 trials · true binomial (Box-Muller for large n)
          </div>
        </div>
        <button
          className="hdr-btn hdr-btn-primary"
          onClick={onRun}
          disabled={!R || simRunning}
          aria-label="Run Monte Carlo simulation"
          style={{ opacity: (!R || simRunning) ? 0.5 : 1 }}
        >
          {simRunning ? '⏳ Running…' : '▶ Run Simulation'}
        </button>
      </div>

      {!simResult ? (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <div className="empty-icon" aria-hidden="true">🎲</div>
          <div className="empty-title">Run the Simulation</div>
          <div className="empty-desc">Click above to run 5,000 randomised binomial trials against your test data.</div>
        </div>
      ) : (
        <>
          <div className="mg mg3">
            {[
              { label: 'Win Rate',     value: simResult.winRate,  color: 'var(--pri)', tip: 'Trials where variant was significantly better.' },
              { label: 'Loss Rate',    value: simResult.lossRate, color: 'var(--red)', tip: 'Trials where variant was significantly worse.' },
              { label: 'Inconclusive', value: simResult.incRate,  color: 'var(--warn)', tip: 'Trials with no significant result. High = need more data.' },
            ].map(({ label, value, color, tip }) => (
              <div key={label} className="metric-card" style={{ textAlign: 'center' }}>
                <div className="metric-val" style={{ fontSize: 26, color }}>{fmtRaw(value, 1)}</div>
                <div className="metric-label" style={{ justifyContent: 'center', marginTop: 4 }}>
                  {label} <InfoTip content={tip} />
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 12, marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Lift Percentile Distribution</span>
              <InfoTip content="Lift distribution across 5,000 simulated trials. If P5 > 0, the variant is almost certainly improving results." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              {[
                { l: 'P5',     v: simResult.p5 },
                { l: 'P25',    v: simResult.p25 },
                { l: 'Median', v: simResult.p50 },
                { l: 'P75',    v: simResult.p75 },
                { l: 'P95',    v: simResult.p95 },
              ].map(({ l, v }) => (
                <div key={l} style={{ textAlign: 'center', flex: 1, minWidth: 60, padding: '10px 8px', background: 'var(--bg2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--mono)', color: v >= 0 ? 'var(--pri)' : 'var(--red)' }}>
                    {v >= 0 ? '+' : ''}{fmtRaw(v, 1)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}