import { useState, useCallback } from 'react'
import {
  calcPValue, calcCI, calcPower, calcMDE,
  calcSampleSize, checkSRM, runSimulation,
} from '../utils/stats.js'

const DEFAULT_VARIANTS = [
  { name: 'Control (A)', visitors: 10000, conversions: 450, revenue: 22500 },
  { name: 'Variant B',   visitors: 10000, conversions: 520, revenue: 28600 },
  { name: 'Variant C',   visitors: '',    conversions: '',  revenue: '' },
  { name: 'Variant D',   visitors: '',    conversions: '',  revenue: '' },
]

function computeResults(variants, numVariants, confidence, hypothesis, mode) {
  const ctrl = variants[0]
  if (!ctrl.visitors || !ctrl.conversions || +ctrl.visitors <= 0) return null

  const baseRate = +ctrl.conversions / +ctrl.visitors
  const numComparisons = numVariants - 1
  const alphaRaw = 1 - confidence / 100
  const alphaAdj = numComparisons > 1 ? alphaRaw / numComparisons : alphaRaw

  const srmVisitors = [+ctrl.visitors]
  const variantResults = []

  for (let i = 1; i < numVariants; i++) {
    const v = variants[i]
    if (!v.visitors || !v.conversions || +v.visitors <= 0) continue

    const n2 = +v.visitors
    const c2 = +v.conversions
    const rate = c2 / n2
    const lift = baseRate === 0 ? (rate > 0 ? Infinity : 0) : (rate - baseRate) / baseRate
    const pValue = calcPValue(+ctrl.visitors, +ctrl.conversions, n2, c2, hypothesis)
    const ci = calcCI(n2, c2, confidence)
    const ciCtrl = calcCI(+ctrl.visitors, +ctrl.conversions, confidence)
    const power = calcPower(+ctrl.visitors, baseRate, n2, rate, confidence) * 100
    const mdeVal = calcMDE(+ctrl.visitors, n2, baseRate, alphaAdj)
    const absDiff = rate - baseRate
    const se = Math.sqrt(
      (baseRate * (1 - baseRate)) / +ctrl.visitors +
      (rate * (1 - rate)) / n2
    )
    const isSignificant = pValue < alphaAdj
    const sampleNeeded = calcSampleSize(baseRate, Math.max(Math.abs(absDiff), 0.001), alphaAdj)

    srmVisitors.push(n2)

    let rvc = 0, rvv = 0, revLift = 0
    if (mode === 'revenue' && ctrl.revenue && v.revenue) {
      rvc = +ctrl.revenue / +ctrl.visitors
      rvv = +v.revenue / n2
      revLift = rvc === 0 ? 0 : (rvv - rvc) / rvc
    }

    variantResults.push({
      name: v.name, idx: i,
      visitors: n2, conversions: c2,
      rate, lift, pValue, ci, ciCtrl,
      power, mde: mdeVal, se, absDiff,
      isSignificant, sampleNeeded,
      rvc, rvv, revLift,
    })
  }

  return {
    baseRate,
    variantResults,
    ctrl,
    srm: checkSRM(srmVisitors),
    alphaAdj,
    numComparisons,
  }
}

export function useCalculator() {
  const [mode, setMode]           = useState('conversion')
  const [numVariants, setNumVariants] = useState(2)
  const [confidence, setConfidence]   = useState(95)
  const [hypothesis, setHypothesis]   = useState('two')
  const [activeTab, setActiveTab]     = useState('results')
  const [variants, setVariants]       = useState(DEFAULT_VARIANTS)
  const [simResult, setSimResult]     = useState(null)
  const [simRunning, setSimRunning]   = useState(false)

  // Derived results — recomputed on every relevant state change
  const results = computeResults(variants, numVariants, confidence, hypothesis, mode)

  const updateVariant = useCallback((idx, field, rawValue) => {
    setVariants(prev => {
      const next = prev.map((v, i) => {
        if (i !== idx) return v
        const value = rawValue === '' ? '' : Math.max(0, Math.floor(Number(rawValue)))
        return { ...v, [field]: rawValue === '' ? '' : value }
      })
      return next
    })
    // clear sim cache when inputs change
    setSimResult(null)
  }, [])

  const runSim = useCallback(() => {
    if (!results || !results.variantResults.length) return
    const v0 = results.variantResults[0]
    setSimRunning(true)
    setTimeout(() => {
      const sim = runSimulation(
        +results.ctrl.visitors,
        +results.ctrl.conversions,
        v0.visitors,
        v0.conversions,
        confidence,
      )
      setSimResult(sim)
      setSimRunning(false)
    }, 16)
  }, [results, confidence])

  // Validation warnings
  const warnings = []
  const ctrl = variants[0]
  if (ctrl.visitors !== '' && ctrl.conversions !== '' && +ctrl.conversions > +ctrl.visitors)
    warnings.push('Control: conversions exceed visitors.')
  if (ctrl.visitors !== '' && +ctrl.visitors > 0 && +ctrl.visitors < 30)
    warnings.push('Control: sample < 30 — results unreliable.')
  for (let i = 1; i < numVariants; i++) {
    const v = variants[i]
    if (v.visitors !== '' && v.conversions !== '' && +v.conversions > +v.visitors)
      warnings.push(`${v.name}: conversions exceed visitors.`)
    if (v.visitors !== '' && +v.visitors > 0 && +v.visitors < 30)
      warnings.push(`${v.name}: sample < 30 — results unreliable.`)
  }

  return {
    // state
    mode, setMode,
    numVariants, setNumVariants,
    confidence, setConfidence,
    hypothesis, setHypothesis,
    activeTab, setActiveTab,
    variants, updateVariant,
    simResult, simRunning, runSim,
    warnings,
    // derived
    results,
    canExport: !!(results && results.variantResults.length > 0),
    // expose raw S-shape for export util
    S: { mode, numVariants, confidence, hypothesis, simResult },
  }
}