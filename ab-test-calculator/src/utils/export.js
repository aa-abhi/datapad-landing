import * as XLSX from 'xlsx'
import { fmt, fmtPct, fmtRaw, fmtNum, calcSampleSize } from './stats.js'

export function doExport(R, S) {
  if (!R || !R.variantResults.length) return

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Summary ──
  const summary = [
    ['A/B Test Analysis — Datapad'],
    ['Generated', new Date().toLocaleString()],
    ['Confidence', S.confidence + '%'],
    ['Hypothesis', S.hypothesis === 'two' ? 'Two-sided' : 'One-sided'],
    ['Mode', S.mode === 'revenue' ? 'Conversion + Revenue' : 'Conversion'],
    ['CI Method', 'Wilson'],
    ['Correction', R.numComparisons > 1 ? `Bonferroni (alpha = ${fmt(R.alphaAdj, 4)})` : 'None'],
    ['SRM Check', R.srm.ok ? `Passed (p = ${fmt(R.srm.pValue, 4)})` : `FAILED (p = ${fmt(R.srm.pValue, 4)})`],
    [],
    ['Metric', 'Control', ...R.variantResults.map(v => v.name)],
    ['Visitors', R.ctrl.visitors, ...R.variantResults.map(v => v.visitors)],
    ['Conversions', R.ctrl.conversions, ...R.variantResults.map(v => v.conversions)],
    ['Conversion Rate', fmtPct(R.baseRate), ...R.variantResults.map(v => fmtPct(v.rate))],
    ['Relative Lift', '—', ...R.variantResults.map(v => isFinite(v.lift) ? fmtRaw(v.lift * 100) : 'N/A')],
    ['Absolute Diff', '—', ...R.variantResults.map(v => fmtPct(v.absDiff))],
    ['P-Value', '—', ...R.variantResults.map(v => fmt(v.pValue, 6))],
    ['Significant?', '—', ...R.variantResults.map(v => v.isSignificant ? 'YES' : 'NO')],
    ['Power', '—', ...R.variantResults.map(v => fmtRaw(v.power))],
    ['MDE', '—', ...R.variantResults.map(v => fmtPct(v.mde))],
    ['CI Lower (Wilson)', fmtPct(R.variantResults[0]?.ciCtrl[0] ?? 0), ...R.variantResults.map(v => fmtPct(v.ci[0]))],
    ['CI Upper (Wilson)', fmtPct(R.variantResults[0]?.ciCtrl[1] ?? 0), ...R.variantResults.map(v => fmtPct(v.ci[1]))],
    ['Sample Needed/Variant', '—', ...R.variantResults.map(v => isFinite(v.sampleNeeded) ? v.sampleNeeded : 'N/A')],
  ]

  if (S.mode === 'revenue') {
    summary.push([], ['Revenue Metrics'])
    summary.push(['Rev/Visitor (Ctrl)', '', ...R.variantResults.map(v => fmt(v.rvc))])
    summary.push(['Rev/Visitor (Var)', '', ...R.variantResults.map(v => fmt(v.rvv))])
    summary.push(['Revenue Lift', '', ...R.variantResults.map(v => fmtRaw(v.revLift * 100))])
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summary)
  ws1['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

  // ── Sheet 2: Insights ──
  const insights = [['Insights & Recommendations'], []]
  R.variantResults.forEach(v => {
    insights.push([v.name])
    insights.push(['Status', v.isSignificant ? 'Significant' : 'Not Significant'])
    insights.push([
      'Recommendation',
      v.isSignificant && v.lift > 0
        ? `Deploy. ${fmtRaw(v.lift * 100, 2)} lift (p=${fmt(v.pValue, 4)}).`
        : v.power < 80
        ? `Continue collecting. Power = ${fmtRaw(v.power)}. Need ~${isFinite(v.sampleNeeded) ? fmtNum(v.sampleNeeded) : 'N/A'} visitors/variant.`
        : `No meaningful difference. MDE = ${fmtPct(v.mde)}.`,
    ])
    insights.push([])
  })
  const ws2 = XLSX.utils.aoa_to_sheet(insights)
  ws2['!cols'] = [{ wch: 24 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Insights')

  // ── Sheet 3: Simulation (if run) ──
  if (S.simResult) {
    const sim = S.simResult
    const simData = [
      ['Monte Carlo Simulation (5,000 trials)'], [],
      ['Metric', 'Value'],
      ['Win Rate', fmtRaw(sim.winRate)],
      ['Loss Rate', fmtRaw(sim.lossRate)],
      ['Inconclusive', fmtRaw(sim.incRate)],
      [],
      ['Lift Percentiles'],
      ['P5', fmtRaw(sim.p5)],
      ['P25', fmtRaw(sim.p25)],
      ['Median', fmtRaw(sim.p50)],
      ['P75', fmtRaw(sim.p75)],
      ['P95', fmtRaw(sim.p95)],
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(simData)
    ws3['!cols'] = [{ wch: 24 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Simulation')
  }

  // ── Sheet 4: Power Analysis ──
  const powerData = [['MDE (%)', 'Per Variant', 'Total']]
  ;[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10].forEach(m => {
    const n = calcSampleSize(R.baseRate, m / 100, R.alphaAdj)
    powerData.push([
      m + '%',
      isFinite(n) ? n : 'N/A',
      isFinite(n) ? n * S.numVariants : 'N/A',
    ])
  })
  const ws4 = XLSX.utils.aoa_to_sheet(powerData)
  ws4['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws4, 'Power Analysis')

  XLSX.writeFile(wb, `AB_Test_Analysis_Datapad_${new Date().toISOString().slice(0, 10)}.xlsx`)
}