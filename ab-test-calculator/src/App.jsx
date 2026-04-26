import { useState } from 'react'
import { useCalculator } from './hooks/useCalculator.js'
import { doExport } from './utils/export.js'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Sidebar from './components/Sidebar.jsx'
import ResultsTab from './components/ResultsTab.jsx'
import PowerTab from './components/PowerTab.jsx'
import SimulationTab from './components/SimulationTab.jsx'
import InsightsTab from './components/InsightsTab.jsx'

const TABS = [
  { id: 'results',  label: 'Results' },
  { id: 'power',    label: 'Power Analysis' },
  { id: 'sim',      label: 'Simulation' },
  { id: 'insights', label: 'Insights' },
]

function GuideModal({ onClose }) {
  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="guideTitle" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose} aria-label="Close guide">✕</button>
        <h2 id="guideTitle">How to Use This Calculator</h2>
        <h3>1. Enter Your Data</h3>
        <p>Input <strong>visitors</strong> and <strong>conversions</strong> for control and at least one variant. For revenue tests, enable Revenue mode and enter total revenue per variant.</p>
        <h3>2. Configure Settings</h3>
        <p>Set confidence level (default 95%), hypothesis type (two-sided recommended), and variant count.</p>
        <h3>3. Read Your Results</h3>
        <p>The Results tab shows verdict, lift, p-value, power, Wilson confidence intervals, distribution chart, and SRM check. Bonferroni correction is automatic for multi-variant tests.</p>
        <h3>4. Go Deeper</h3>
        <p><strong>Power Analysis:</strong> Required sample sizes and a visual power curve.<br />
        <strong>Monte Carlo Simulation:</strong> 5,000 randomized trials for probabilistic outcomes.<br />
        <strong>Insights:</strong> Plain-English recommendations with projected business impact.</p>
        <h3>5. Export</h3>
        <p>Download a multi-sheet Excel report with Summary, Insights, Simulation, and Power Analysis.</p>
        <h3>Statistical Methodology</h3>
        <p><strong>Test:</strong> Two-proportion Z-test with signed z-statistic.</p>
        <p><strong>CIs:</strong> Wilson interval (more accurate for small samples and extreme rates).</p>
        <p><strong>Power:</strong> Single-term non-central normal approximation.</p>
        <p><strong>Multiple comparisons:</strong> Bonferroni correction for 3+ variants.</p>
        <p><strong>SRM:</strong> Chi-square test for sample ratio mismatch detection.</p>
        <p><strong>Simulation:</strong> True binomial Monte Carlo, 5,000 trials.</p>
      </div>
    </div>
  )
}

export default function App() {
  const calc = useCalculator()
  const [guideOpen, setGuideOpen] = useState(false)

  const handleExport = () => doExport(calc.results, calc.S)

  return (
    <div className="app-root">
      <Header
        canExport={calc.canExport}
        onExport={handleExport}
        onGuide={() => setGuideOpen(true)}
      />

      <div className="app-body">
        <Sidebar
          mode={calc.mode}             setMode={calc.setMode}
          numVariants={calc.numVariants} setNumVariants={calc.setNumVariants}
          confidence={calc.confidence}  setConfidence={calc.setConfidence}
          hypothesis={calc.hypothesis}  setHypothesis={calc.setHypothesis}
          variants={calc.variants}      updateVariant={calc.updateVariant}
          warnings={calc.warnings}
        />

        <main className="main-panel" aria-label="Analysis results">
          {/* Tab bar */}
          <nav className="tab-bar" role="tablist" aria-label="Result tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn${calc.activeTab === tab.id ? ' active' : ''}`}
                role="tab"
                aria-selected={calc.activeTab === tab.id}
                onClick={() => calc.setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div role="tabpanel">
            {calc.activeTab === 'results' && (
              <ResultsTab R={calc.results} mode={calc.mode} confidence={calc.confidence} />
            )}
            {calc.activeTab === 'power' && (
              <PowerTab R={calc.results} numVariants={calc.numVariants} confidence={calc.confidence} />
            )}
            {calc.activeTab === 'sim' && (
              <SimulationTab
                R={calc.results}
                simResult={calc.simResult}
                simRunning={calc.simRunning}
                onRun={calc.runSim}
              />
            )}
            {calc.activeTab === 'insights' && (
              <InsightsTab R={calc.results} />
            )}
          </div>
        </main>
      </div>

      <Footer />

      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  )
}