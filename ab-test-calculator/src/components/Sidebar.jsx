// ─────────────────────────────────────────────
// Sidebar — config controls + variant inputs
// ─────────────────────────────────────────────

function InfoTip({ content }) {
  return (
    <span className="info-wrap" tabIndex={0}>
      <span className="info-btn" aria-label="More info">i</span>
      <span className="info-tip" role="tooltip" dangerouslySetInnerHTML={{ __html: content }} />
    </span>
  )
}

function ToggleGroup({ options, value, onChange, label }) {
  return (
    <div className="toggle-row" role="group" aria-label={label}>
      {options.map(opt => (
        <button
          key={opt.value}
          className={`toggle-btn${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function VariantBox({ variant, index, mode, onChange }) {
  const isControl = index === 0
  const cols = mode === 'revenue' ? 'cols-3' : 'cols-2'

  return (
    <div
      className={`variant-box${isControl ? '' : ' var-active'}`}
      role="group"
      aria-label={`${variant.name} inputs`}
    >
      <div className="var-name" style={{ color: isControl ? 'var(--t1)' : 'var(--pri)' }}>
        {variant.name}
      </div>
      <div className={`var-inputs ${cols}`}>
        <div>
          <label className="input-label" htmlFor={`v${index}-visitors`}>Visitors</label>
          <input
            id={`v${index}-visitors`}
            className="input-field"
            type="number"
            min="0"
            step="1"
            value={variant.visitors}
            placeholder="10000"
            onChange={e => onChange(index, 'visitors', e.target.value)}
            aria-label={`${variant.name} visitors`}
          />
        </div>
        <div>
          <label className="input-label" htmlFor={`v${index}-conv`}>Conversions</label>
          <input
            id={`v${index}-conv`}
            className="input-field"
            type="number"
            min="0"
            step="1"
            value={variant.conversions}
            placeholder="450"
            onChange={e => onChange(index, 'conversions', e.target.value)}
            aria-label={`${variant.name} conversions`}
          />
        </div>
        {mode === 'revenue' && (
          <div>
            <label className="input-label" htmlFor={`v${index}-rev`}>Revenue (₹)</label>
            <input
              id={`v${index}-rev`}
              className="input-field"
              type="number"
              min="0"
              step="1"
              value={variant.revenue}
              placeholder="22500"
              onChange={e => onChange(index, 'revenue', e.target.value)}
              aria-label={`${variant.name} revenue`}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Sidebar({
  mode, setMode,
  numVariants, setNumVariants,
  confidence, setConfidence,
  hypothesis, setHypothesis,
  variants, updateVariant,
  warnings,
}) {
  const hypExplain =
    hypothesis === 'two'
      ? '<strong>Two-sided</strong> — Tests if variant differs in either direction. Safer default.'
      : '<strong>One-sided</strong> — Tests only if variant is <em>better</em>. Only use when harm is impossible.'

  return (
    <aside className="sidebar" aria-label="Test configuration">
      <div className="sec-label">Configuration</div>

      {/* Test type */}
      <div className="input-group">
        <div className="input-label">
          Test Type
          <InfoTip content="<strong>Conversion:</strong> Measures rate of a binary action.<br><strong>Revenue:</strong> Also compares revenue per visitor." />
        </div>
        <ToggleGroup
          label="Test type"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'conversion', label: 'Conversion' },
            { value: 'revenue',    label: 'Revenue' },
          ]}
        />
      </div>

      {/* Variants */}
      <div className="input-group">
        <div className="input-label">
          Variants
          <InfoTip content="A/B tests two versions. A/B/C and A/B/C/D compare multiple treatments against control. <strong>Bonferroni correction</strong> is applied automatically for 3+ variants." />
        </div>
        <ToggleGroup
          label="Variants"
          value={numVariants}
          onChange={v => setNumVariants(Number(v))}
          options={[
            { value: 2, label: 'A/B' },
            { value: 3, label: 'A/B/C' },
            { value: 4, label: 'A/B/C/D' },
          ]}
        />
      </div>

      {/* Confidence */}
      <div className="input-group">
        <div className="input-label">
          Confidence Level: <strong style={{ color: 'var(--pri)', marginLeft: 4 }}>{confidence}%</strong>
          <InfoTip content="How certain you need to be that the result is real. Alpha (α) = 1 − confidence level.<br><br>✓ Standard: 95% · ✓ Conservative: 99% · ✓ Exploratory: 90%" />
        </div>
        <input
          type="range"
          min="80"
          max="99"
          step="1"
          value={confidence}
          onChange={e => setConfidence(Number(e.target.value))}
          aria-label="Confidence level"
          aria-valuemin={80}
          aria-valuemax={99}
          aria-valuenow={confidence}
          style={{ width: '100%', accentColor: 'var(--pri)', cursor: 'pointer', marginTop: 6 }}
        />
        <div className="conf-labels" aria-hidden="true">
          <span>80%</span><span>90%</span><span>95%</span><span>99%</span>
        </div>
      </div>

      {/* Hypothesis */}
      <div className="input-group">
        <div className="input-label">
          Hypothesis
          <InfoTip content="<strong>Two-sided:</strong> Tests if variant is different — better OR worse. Recommended.<br><br><strong>One-sided:</strong> Tests only if variant is better. Easier to reach significance but ignores harmful outcomes." />
        </div>
        <ToggleGroup
          label="Hypothesis"
          value={hypothesis}
          onChange={setHypothesis}
          options={[
            { value: 'two', label: 'Two-sided' },
            { value: 'one', label: 'One-sided' },
          ]}
        />
        <div
          className="hyp-explain"
          dangerouslySetInnerHTML={{ __html: hypExplain }}
        />
      </div>

      <div className="divider" role="separator" />
      <div className="sec-label">Input Data</div>

      {/* Variant inputs */}
      {variants.slice(0, numVariants).map((v, i) => (
        <VariantBox
          key={i}
          variant={v}
          index={i}
          mode={mode}
          onChange={updateVariant}
        />
      ))}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="warn-box" role="alert">
          {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      <div className="tip-box">
        <span style={{ color: 'var(--acc)', fontWeight: 700 }}>Tip:</span>{' '}
        Pre-filled with sample data. All computation runs locally — no data leaves your browser.
      </div>
    </aside>
  )
}