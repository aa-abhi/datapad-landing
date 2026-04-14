import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import * as XLSX from "sheetjs";

// ─── Statistical Functions ───
function normalCDF(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return 0.5*(1+sign*y);
}
function normalPPF(p) {
  if(p<=0) return -Infinity; if(p>=1) return Infinity;
  if(p<0.5) return -normalPPF(1-p);
  const t=Math.sqrt(-2*Math.log(1-p));
  const c0=2.515517,c1=0.802853,c2=0.010328,d1=1.432788,d2=0.189269,d3=0.001308;
  return t-(c0+c1*t+c2*t*t)/(1+d1*t+d2*t*t+d3*t*t*t);
}
function calcPValue(visitors1,conversions1,visitors2,conversions2) {
  if(!visitors1||!visitors2) return 1;
  const p1=conversions1/visitors1, p2=conversions2/visitors2;
  const pPool=(conversions1+conversions2)/(visitors1+visitors2);
  const se=Math.sqrt(pPool*(1-pPool)*(1/visitors1+1/visitors2));
  if(se===0) return 1;
  const z=Math.abs(p1-p2)/se;
  return 2*(1-normalCDF(z));
}
function calcConfidenceInterval(visitors,conversions,confidence) {
  const p=conversions/visitors;
  const z=normalPPF(1-(1-confidence/100)/2);
  const se=Math.sqrt(p*(1-p)/visitors);
  return [Math.max(0,p-z*se),Math.min(1,p+z*se)];
}
function calcPower(visitors1,p1,visitors2,p2,alpha=0.05) {
  const se=Math.sqrt(p1*(1-p1)/visitors1+p2*(1-p2)/visitors2);
  if(se===0) return 0;
  const z=normalPPF(1-alpha/2);
  const effect=Math.abs(p2-p1)/se;
  return normalCDF(effect-z)+normalCDF(-effect-z);
}
function calcMDE(visitors1,visitors2,baselineRate,alpha=0.05,power=0.8) {
  const zAlpha=normalPPF(1-alpha/2);
  const zBeta=normalPPF(power);
  const se1=Math.sqrt(baselineRate*(1-baselineRate)/visitors1);
  const se2=Math.sqrt(baselineRate*(1-baselineRate)/visitors2);
  return (zAlpha+zBeta)*Math.sqrt(se1*se1+se2*se2);
}
function calcSampleSize(baselineRate,mde,alpha=0.05,power=0.8) {
  const zAlpha=normalPPF(1-alpha/2);
  const zBeta=normalPPF(power);
  const p1=baselineRate, p2=baselineRate+mde;
  return Math.ceil(Math.pow(zAlpha*Math.sqrt(2*p1*(1-p1))+zBeta*Math.sqrt(p1*(1-p1)+p2*(1-p2)),2)/Math.pow(p2-p1,2));
}
function runSimulation(visitors1,conv1,visitors2,conv2,numSims=10000) {
  const p1=conv1/visitors1, p2=conv2/visitors2;
  let wins=0, losses=0, inconclusive=0;
  const lifts=[];
  for(let i=0;i<numSims;i++){
    let s1=0,s2=0;
    for(let j=0;j<visitors1;j++) if(Math.random()<p1) s1++;
    for(let j=0;j<Math.min(visitors2,500);j++) if(Math.random()<p2) s2++;
    s2=Math.round(s2*visitors2/Math.min(visitors2,500));
    const sp1=s1/visitors1,sp2=s2/visitors2;
    const lift=(sp2-sp1)/sp1;
    lifts.push(lift);
    const pv=calcPValue(visitors1,s1,visitors2,s2);
    if(pv<0.05){if(sp2>sp1) wins++; else losses++;} else inconclusive++;
  }
  lifts.sort((a,b)=>a-b);
  return {
    winRate:wins/numSims*100,
    lossRate:losses/numSims*100,
    inconclusiveRate:inconclusive/numSims*100,
    liftP5:lifts[Math.floor(numSims*0.05)]*100,
    liftP25:lifts[Math.floor(numSims*0.25)]*100,
    liftP50:lifts[Math.floor(numSims*0.5)]*100,
    liftP75:lifts[Math.floor(numSims*0.75)]*100,
    liftP95:lifts[Math.floor(numSims*0.95)]*100,
  };
}

// ─── Formatting ───
const fmt=(n,d=2)=>isNaN(n)||!isFinite(n)?'—':n.toFixed(d);
const fmtPct=(n,d=2)=>isNaN(n)||!isFinite(n)?'—':(n*100).toFixed(d)+'%';
const fmtPctRaw=(n,d=2)=>isNaN(n)||!isFinite(n)?'—':n.toFixed(d)+'%';

// ─── Micro-chart: simple bar sparkline ───
function Sparkline({data,color='#00ff88',height=40,width=200}) {
  if(!data||data.length===0) return null;
  const max=Math.max(...data.map(Math.abs));
  const barW=Math.max(1,width/data.length-1);
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      {data.map((v,i)=>{
        const h=max===0?0:(Math.abs(v)/max)*(height-4);
        const y=v>=0?height-2-h:height/2;
        return <rect key={i} x={i*(barW+1)} y={v>=0?height-2-h:height/2} width={barW} height={Math.max(1,h)} fill={v>=0?color:'#ff4466'} rx={1} opacity={0.8}/>;
      })}
    </svg>
  );
}

// ─── Distribution Viz ───
function NormalDistViz({p1,p2,se,width=320,height=120}) {
  if(!se||se===0) return null;
  const diff=p2-p1;
  const points=80;
  const range=4*se;
  const step=(2*range)/points;
  let path='';
  for(let i=0;i<=points;i++){
    const x=-range+i*step;
    const y=Math.exp(-0.5*Math.pow(x/se,2))/(se*Math.sqrt(2*Math.PI));
    const px=((x+range)/(2*range))*width;
    const py=height-10-(y*se*Math.sqrt(2*Math.PI))*(height-20);
    path+=(i===0?'M':'L')+px.toFixed(1)+','+py.toFixed(1);
  }
  const diffX=((diff+range)/(2*range))*width;
  const zeroX=((0+range)/(2*range))*width;
  return (
    <svg width={width} height={height} style={{display:'block',margin:'0 auto'}}>
      <defs>
        <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={path+'L'+width+','+(height-10)+'L0,'+(height-10)+'Z'} fill="url(#distGrad)"/>
      <path d={path} fill="none" stroke="#00ff88" strokeWidth="2" opacity="0.8"/>
      <line x1={zeroX} y1={10} x2={zeroX} y2={height-10} stroke="#555" strokeWidth="1" strokeDasharray="3,3"/>
      <line x1={diffX} y1={10} x2={diffX} y2={height-10} stroke={diff>0?'#00ff88':'#ff4466'} strokeWidth="2"/>
      <text x={zeroX} y={height-1} textAnchor="middle" fill="#666" fontSize="9" fontFamily="monospace">0</text>
      <text x={diffX} y={9} textAnchor="middle" fill={diff>0?'#00ff88':'#ff4466'} fontSize="9" fontFamily="monospace">Δ</text>
    </svg>
  );
}

// ─── Power Curve ───
function PowerCurve({baselineRate,visitors1,visitors2,currentMDE,width=320,height=140}) {
  const points=40;
  const maxMDE=baselineRate*0.5;
  const step=maxMDE/points;
  let path='';
  let dots=[];
  for(let i=0;i<=points;i++){
    const mde=i*step;
    const p2=baselineRate+mde;
    const pw=calcPower(visitors1,baselineRate,visitors2,p2)*100;
    const px=(i/points)*width;
    const py=height-10-(pw/100)*(height-20);
    path+=(i===0?'M':'L')+px.toFixed(1)+','+py.toFixed(1);
  }
  // 80% line
  const y80=height-10-(80/100)*(height-20);
  return (
    <svg width={width} height={height} style={{display:'block',margin:'0 auto'}}>
      <defs>
        <linearGradient id="pwGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <path d={path+'L'+width+','+(height-10)+'L0,'+(height-10)+'Z'} fill="url(#pwGrad)"/>
      <path d={path} fill="none" stroke="#00d4ff" strokeWidth="2" opacity="0.8"/>
      <line x1={0} y1={y80} x2={width} y2={y80} stroke="#00d4ff" strokeWidth="1" strokeDasharray="4,4" opacity="0.4"/>
      <text x={width-2} y={y80-4} textAnchor="end" fill="#00d4ff" fontSize="9" fontFamily="monospace" opacity="0.6">80%</text>
      <text x={width/2} y={height-1} textAnchor="middle" fill="#555" fontSize="9" fontFamily="monospace">MDE →</text>
    </svg>
  );
}

// ─── Gauge ───
function Gauge({value,label,color='#00ff88',size=90}) {
  const r=size/2-8;
  const circumference=Math.PI*r;
  const progress=Math.min(Math.max(value/100,0),1);
  const offset=circumference*(1-progress);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width={size} height={size/2+8} style={{display:'block'}}>
        <path d={`M ${8} ${size/2} A ${r} ${r} 0 0 1 ${size-8} ${size/2}`} fill="none" stroke="#1a1a24" strokeWidth="6" strokeLinecap="round"/>
        <path d={`M ${8} ${size/2} A ${r} ${r} 0 0 1 ${size-8} ${size/2}`} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{transition:'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)'}}/>
        <text x={size/2} y={size/2-4} textAnchor="middle" fill={color} fontSize="16" fontWeight="800" fontFamily="'Outfit',sans-serif">
          {fmtPctRaw(value,1)}
        </text>
      </svg>
      <span style={{fontSize:10,color:'#6e6e82',textTransform:'uppercase',letterSpacing:1}}>{label}</span>
    </div>
  );
}

// ─── Main Component ───
export default function ABTestCalculator() {
  // ─ State ─
  const [mode, setMode] = useState('conversion'); // conversion | revenue
  const [numVariants, setNumVariants] = useState(2);
  const [confidence, setConfidence] = useState(95);
  const [hypothesis, setHypothesis] = useState('two-sided');

  const [variants, setVariants] = useState([
    { name: 'Control (A)', visitors: 10000, conversions: 450, revenue: 22500 },
    { name: 'Variant B', visitors: 10000, conversions: 520, revenue: 28600 },
    { name: 'Variant C', visitors: '', conversions: '', revenue: '' },
    { name: 'Variant D', visitors: '', conversions: '', revenue: '' },
  ]);

  const [simResult, setSimResult] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('results');
  const [showGuide, setShowGuide] = useState(false);

  const updateVariant = (idx, field, val) => {
    const v = [...variants];
    v[idx] = { ...v[idx], [field]: val === '' ? '' : Number(val) };
    setVariants(v);
  };

  // ─ Computations ─
  const results = useMemo(() => {
    const ctrl = variants[0];
    if (!ctrl.visitors || !ctrl.conversions) return null;
    const baseRate = ctrl.conversions / ctrl.visitors;

    const variantResults = [];
    for (let i = 1; i < numVariants; i++) {
      const v = variants[i];
      if (!v.visitors || !v.conversions) continue;
      const rate = v.conversions / v.visitors;
      const lift = (rate - baseRate) / baseRate;
      const pValue = calcPValue(ctrl.visitors, ctrl.conversions, v.visitors, v.conversions);
      const ci = calcConfidenceInterval(v.visitors, v.conversions, confidence);
      const ciCtrl = calcConfidenceInterval(ctrl.visitors, ctrl.conversions, confidence);
      const power = calcPower(ctrl.visitors, baseRate, v.visitors, rate);
      const mde = calcMDE(ctrl.visitors, v.visitors, baseRate);
      const se = Math.sqrt(baseRate * (1 - baseRate) / ctrl.visitors + rate * (1 - rate) / v.visitors);
      const absDiff = rate - baseRate;
      const isSignificant = pValue < (1 - confidence / 100);
      const sampleNeeded = calcSampleSize(baseRate, Math.abs(absDiff) || 0.01);

      // Revenue metrics
      let revPerVisitorCtrl = 0, revPerVisitorVar = 0, revLift = 0;
      if (mode === 'revenue' && ctrl.revenue && v.revenue) {
        revPerVisitorCtrl = ctrl.revenue / ctrl.visitors;
        revPerVisitorVar = v.revenue / v.visitors;
        revLift = (revPerVisitorVar - revPerVisitorCtrl) / revPerVisitorCtrl;
      }

      variantResults.push({
        name: v.name, idx: i,
        visitors: v.visitors, conversions: v.conversions,
        rate, lift, pValue, ci, ciCtrl, power: power * 100,
        mde, se, absDiff, isSignificant, sampleNeeded,
        revPerVisitorCtrl, revPerVisitorVar, revLift,
      });
    }
    return { baseRate, variantResults, ctrl };
  }, [variants, numVariants, confidence, mode]);

  // ─ Run Simulation ─
  const runSim = useCallback(() => {
    if (!results || results.variantResults.length === 0) return;
    setSimRunning(true);
    setTimeout(() => {
      const v = results.variantResults[0];
      const sim = runSimulation(
        results.ctrl.visitors, results.ctrl.conversions,
        v.visitors, v.conversions, 5000
      );
      setSimResult(sim);
      setSimRunning(false);
    }, 100);
  }, [results]);

  // ─ Excel Export ─
  const exportExcel = useCallback(() => {
    if (!results) return;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['A/B Test Analysis Report — Datapad'],
      ['Generated', new Date().toLocaleString()],
      ['Confidence Level', confidence + '%'],
      ['Hypothesis', hypothesis],
      ['Mode', mode],
      [],
      ['Metric', 'Control', ...results.variantResults.map(v => v.name)],
      ['Visitors', results.ctrl.visitors, ...results.variantResults.map(v => v.visitors)],
      ['Conversions', results.ctrl.conversions, ...results.variantResults.map(v => v.conversions)],
      ['Conversion Rate', fmtPct(results.baseRate), ...results.variantResults.map(v => fmtPct(v.rate))],
      ['Relative Lift', '—', ...results.variantResults.map(v => fmtPctRaw(v.lift * 100) )],
      ['Absolute Difference', '—', ...results.variantResults.map(v => fmtPct(v.absDiff))],
      ['P-Value', '—', ...results.variantResults.map(v => fmt(v.pValue, 6))],
      ['Significant?', '—', ...results.variantResults.map(v => v.isSignificant ? 'YES ✓' : 'NO')],
      ['Statistical Power', '—', ...results.variantResults.map(v => fmtPctRaw(v.power))],
      ['MDE', '—', ...results.variantResults.map(v => fmtPct(v.mde))],
      ['CI Lower', fmtPct(results.variantResults[0]?.ciCtrl?.[0]), ...results.variantResults.map(v => fmtPct(v.ci[0]))],
      ['CI Upper', fmtPct(results.variantResults[0]?.ciCtrl?.[1]), ...results.variantResults.map(v => fmtPct(v.ci[1]))],
      ['Sample Size Needed', '—', ...results.variantResults.map(v => v.sampleNeeded.toLocaleString())],
    ];
    if (mode === 'revenue') {
      summaryData.push(
        ['Rev/Visitor (Control)', '$' + fmt(results.variantResults[0]?.revPerVisitorCtrl)],
        ['Rev/Visitor (Variant)', '—', ...results.variantResults.map(v => '$' + fmt(v.revPerVisitorVar))],
        ['Revenue Lift', '—', ...results.variantResults.map(v => fmtPctRaw(v.revLift * 100))],
      );
    }
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // Insights sheet
    const insights = [
      ['Insights & Recommendations'],
      [],
    ];
    results.variantResults.forEach(v => {
      const winner = v.isSignificant && v.lift > 0;
      insights.push([v.name + ' Analysis']);
      insights.push(['Status', v.isSignificant ? 'Statistically Significant' : 'Not Significant']);
      insights.push(['Recommendation',
        winner
          ? `${v.name} shows a ${fmtPctRaw(v.lift*100)} lift with p=${fmt(v.pValue,4)}. Consider deploying.`
          : v.power < 80
            ? `Insufficient power (${fmtPctRaw(v.power)}). Need ~${v.sampleNeeded.toLocaleString()} visitors per variant.`
            : `No significant difference detected. The true effect may be smaller than MDE of ${fmtPct(v.mde)}.`
      ]);
      insights.push([]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(insights);
    ws2['!cols'] = [{ wch: 22 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Insights');

    // Simulation sheet
    if (simResult) {
      const simData = [
        ['Monte Carlo Simulation Results (5,000 runs)'],
        [],
        ['Metric', 'Value'],
        ['Win Rate', fmtPctRaw(simResult.winRate)],
        ['Loss Rate', fmtPctRaw(simResult.lossRate)],
        ['Inconclusive Rate', fmtPctRaw(simResult.inconclusiveRate)],
        [],
        ['Lift Distribution'],
        ['5th Percentile', fmtPctRaw(simResult.liftP5)],
        ['25th Percentile', fmtPctRaw(simResult.liftP25)],
        ['Median (50th)', fmtPctRaw(simResult.liftP50)],
        ['75th Percentile', fmtPctRaw(simResult.liftP75)],
        ['95th Percentile', fmtPctRaw(simResult.liftP95)],
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(simData);
      ws3['!cols'] = [{ wch: 22 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Simulation');
    }

    // Power Analysis sheet
    const powerData = [['MDE (%)', 'Sample Size per Variant']];
    [0.5,1,1.5,2,2.5,3,4,5,7,10].forEach(mde => {
      powerData.push([mde + '%', calcSampleSize(results.baseRate, mde / 100)]);
    });
    const ws4 = XLSX.utils.aoa_to_sheet(powerData);
    ws4['!cols'] = [{ wch: 14 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Power Analysis');

    XLSX.writeFile(wb, `AB_Test_Analysis_${new Date().toISOString().slice(0,10)}.xlsx`);
  }, [results, simResult, confidence, hypothesis, mode]);

  // ─ Verdict ─
  const getVerdict = (v) => {
    if (!v) return { text: 'Enter data', color: '#6e6e82', bg: 'rgba(110,110,130,0.08)' };
    if (v.isSignificant && v.lift > 0) return { text: '🏆 Winner', color: '#00ff88', bg: 'rgba(0,255,136,0.08)' };
    if (v.isSignificant && v.lift < 0) return { text: '📉 Loser', color: '#ff4466', bg: 'rgba(255,68,102,0.08)' };
    if (v.power < 80) return { text: '⏳ Need More Data', color: '#ffaa00', bg: 'rgba(255,170,0,0.08)' };
    return { text: '🔄 No Difference', color: '#00d4ff', bg: 'rgba(0,212,255,0.08)' };
  };

  const tabs = [
    { id: 'results', label: 'Results' },
    { id: 'power', label: 'Power Analysis' },
    { id: 'simulation', label: 'Simulation' },
    { id: 'insights', label: 'Insights' },
  ];

  // ─── Styles ───
  const s = {
    root: { background: '#050508', color: '#fff', minHeight: '100vh', fontFamily: "'Outfit',sans-serif", position: 'relative' },
    header: { padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
    logoIcon: { width: 40, height: 40, background: '#111118', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#00ff88', fontWeight: 800, fontFamily: "'Fira Code',monospace" },
    title: { fontSize: 18, fontWeight: 800, letterSpacing: -0.3 },
    subtitle: { fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 2 },
    headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
    btn: { padding: '8px 16px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 8, color: '#00ff88', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 },
    btnPrimary: { padding: '8px 18px', background: '#00ff88', border: '2px solid #00ff88', borderRadius: 8, color: '#050508', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 },
    body: { display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 'calc(100vh - 70px)' },
    sidebar: { borderRight: '1px solid rgba(255,255,255,0.06)', padding: '24px', overflowY: 'auto', background: '#0a0a0f' },
    main: { padding: '24px', overflowY: 'auto' },
    sectionLabel: { fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, fontWeight: 600 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 12, color: '#888', marginBottom: 4, display: 'block', fontWeight: 500 },
    input: { width: '100%', padding: '10px 12px', background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: "'Fira Code',monospace", outline: 'none', transition: 'border-color 0.2s' },
    select: { width: '100%', padding: '10px 12px', background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', appearance: 'none' },
    card: { background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '24px', marginBottom: 16 },
    variantBox: { background: '#0d0d14', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px', marginBottom: 12 },
    tabBar: { display: 'flex', gap: 4, marginBottom: 24, background: '#0a0a0f', borderRadius: 10, padding: 4, border: '1px solid rgba(255,255,255,0.06)' },
    tab: (active) => ({ padding: '10px 18px', borderRadius: 8, border: 'none', background: active ? 'rgba(0,255,136,0.1)' : 'transparent', color: active ? '#00ff88' : '#6e6e82', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', flex: 1, textAlign: 'center' }),
    metric: { display: 'flex', flexDirection: 'column', gap: 2 },
    metricValue: { fontSize: 28, fontWeight: 800, letterSpacing: -1, fontFamily: "'Outfit',sans-serif" },
    metricLabel: { fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 },
    verdictBadge: (v) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100, background: v.bg, color: v.color, fontSize: 13, fontWeight: 700, border: `1px solid ${v.color}22` }),
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
    grid4: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 },
    divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '20px 0' },
    guideOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    guideBox: { background: '#0a0a0f', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 16, padding: '40px', maxWidth: 640, maxHeight: '80vh', overflowY: 'auto', color: '#c8c8d4', fontSize: 14, lineHeight: 1.8 },
  };

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoIcon}>AB</div>
          <div>
            <div style={s.title}>A/B Test Calculator</div>
            <div style={s.subtitle}>by Datapad</div>
          </div>
        </div>
        <div style={s.headerRight}>
          <button style={s.btn} onClick={() => setShowGuide(true)}>
            <span>?</span> Guide
          </button>
          <button style={{ ...s.btnPrimary, opacity: results ? 1 : 0.4, pointerEvents: results ? 'auto' : 'none' }} onClick={exportExcel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Export Excel
          </button>
        </div>
      </div>

      <div style={s.body}>
        {/* ─── Sidebar: Inputs ─── */}
        <div style={s.sidebar}>
          <div style={s.sectionLabel}>Configuration</div>

          {/* Mode */}
          <div style={s.inputGroup}>
            <label style={s.label}>Test Type</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {['conversion','revenue'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: mode === m ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)', background: mode === m ? 'rgba(0,255,136,0.08)' : '#111118', color: mode === m ? '#00ff88' : '#6e6e82', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div style={s.inputGroup}>
            <label style={s.label}>Number of Variants</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => setNumVariants(n)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: numVariants === n ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)', background: numVariants === n ? 'rgba(0,255,136,0.08)' : '#111118', color: numVariants === n ? '#00ff88' : '#6e6e82', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {n === 2 ? 'A/B' : n === 3 ? 'A/B/C' : 'A/B/C/D'}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div style={s.inputGroup}>
            <label style={s.label}>Confidence Level: {confidence}%</label>
            <input type="range" min="80" max="99" step="1" value={confidence} onChange={e => setConfidence(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#00ff88' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginTop: 4 }}>
              <span>80%</span><span>90%</span><span>95%</span><span>99%</span>
            </div>
          </div>

          {/* Hypothesis */}
          <div style={s.inputGroup}>
            <label style={s.label}>Hypothesis</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{v:'two-sided',l:'Two-sided'},{v:'one-sided',l:'One-sided'}].map(h => (
                <button key={h.v} onClick={() => setHypothesis(h.v)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: hypothesis === h.v ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)', background: hypothesis === h.v ? 'rgba(0,255,136,0.08)' : '#111118', color: hypothesis === h.v ? '#00ff88' : '#6e6e82', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {h.l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...s.divider, margin: '20px 0' }}/>
          <div style={s.sectionLabel}>Input Data</div>

          {/* Variant Inputs */}
          {variants.slice(0, numVariants).map((v, i) => (
            <div key={i} style={{ ...s.variantBox, borderLeft: i === 0 ? '3px solid #6e6e82' : '3px solid rgba(0,255,136,0.3)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: i === 0 ? '#c8c8d4' : '#00ff88' }}>
                {v.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: mode === 'revenue' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ ...s.label, fontSize: 10 }}>Visitors</label>
                  <input type="number" value={v.visitors} onChange={e => updateVariant(i, 'visitors', e.target.value)} placeholder="10000" style={s.input}
                    onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.3)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}/>
                </div>
                <div>
                  <label style={{ ...s.label, fontSize: 10 }}>Conversions</label>
                  <input type="number" value={v.conversions} onChange={e => updateVariant(i, 'conversions', e.target.value)} placeholder="450" style={s.input}
                    onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.3)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}/>
                </div>
                {mode === 'revenue' && (
                  <div>
                    <label style={{ ...s.label, fontSize: 10 }}>Revenue ($)</label>
                    <input type="number" value={v.revenue} onChange={e => updateVariant(i, 'revenue', e.target.value)} placeholder="22500" style={s.input}
                      onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.3)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}/>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Quick tip */}
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 10, fontSize: 11, color: '#6e6e82', lineHeight: 1.7 }}>
            <span style={{ color: '#00d4ff', fontWeight: 700 }}>Tip:</span> Pre-filled with sample data. Replace with your own numbers to see real-time results.
          </div>
        </div>

        {/* ─── Main Panel ─── */}
        <div style={s.main}>
          {/* Tabs */}
          <div style={s.tabBar}>
            {tabs.map(t => (
              <button key={t.id} style={s.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── RESULTS TAB ── */}
          {activeTab === 'results' && results && (
            <div>
              {results.variantResults.map((v, vi) => {
                const verdict = getVerdict(v);
                return (
                  <div key={vi} style={{ ...s.card, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 20, fontWeight: 800 }}>{v.name}</span>
                        <span style={{ fontSize: 12, color: '#6e6e82' }}>vs Control</span>
                      </div>
                      <span style={s.verdictBadge(verdict)}>{verdict.text}</span>
                    </div>

                    {/* Gauges Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                      <Gauge value={(1 - v.pValue) * 100} label="Confidence" color={v.isSignificant ? '#00ff88' : '#ff4466'} />
                      <Gauge value={v.power} label="Power" color={v.power >= 80 ? '#00d4ff' : '#ffaa00'} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: v.lift >= 0 ? '#00ff88' : '#ff4466', letterSpacing: -1, fontFamily: "'Outfit',sans-serif" }}>
                          {v.lift >= 0 ? '+' : ''}{fmtPctRaw(v.lift * 100)}
                        </div>
                        <span style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1 }}>Relative Lift</span>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div style={s.grid4}>
                      <div style={{ ...s.card, padding: 14, marginBottom: 0 }}>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>P-Value</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Fira Code',monospace", color: v.pValue < 0.05 ? '#00ff88' : '#ff4466' }}>{fmt(v.pValue, 4)}</div>
                      </div>
                      <div style={{ ...s.card, padding: 14, marginBottom: 0 }}>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Conv. Rate</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Fira Code',monospace" }}>{fmtPct(v.rate)}</div>
                      </div>
                      <div style={{ ...s.card, padding: 14, marginBottom: 0 }}>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Abs. Diff</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Fira Code',monospace", color: v.absDiff >= 0 ? '#00ff88' : '#ff4466' }}>{fmtPct(v.absDiff)}</div>
                      </div>
                      <div style={{ ...s.card, padding: 14, marginBottom: 0 }}>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>MDE</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Fira Code',monospace" }}>{fmtPct(v.mde)}</div>
                      </div>
                    </div>

                    {/* CI + Distribution */}
                    <div style={{ ...s.grid2, marginTop: 16 }}>
                      <div style={{ ...s.card, padding: 16, marginBottom: 0 }}>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{confidence}% Confidence Interval</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 14, color: '#00d4ff' }}>{fmtPct(v.ci[0])}</span>
                          <div style={{ flex: 1, height: 6, background: '#1a1a24', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', left: `${(v.ci[0]/Math.max(v.ci[1],0.001))*40}%`, right: `${100-95}%`, top: 0, bottom: 0, background: 'linear-gradient(90deg, #00d4ff44, #00ff8844)', borderRadius: 3 }}/>
                          </div>
                          <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 14, color: '#00ff88' }}>{fmtPct(v.ci[1])}</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#555', marginTop: 6, textAlign: 'center' }}>
                          Control: {fmtPct(v.ciCtrl[0])} – {fmtPct(v.ciCtrl[1])}
                        </div>
                      </div>
                      <div style={{ ...s.card, padding: 16, marginBottom: 0 }}>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Distribution of Difference</div>
                        <NormalDistViz p1={results.baseRate} p2={v.rate} se={v.se} width={280} height={90}/>
                      </div>
                    </div>

                    {/* Revenue row */}
                    {mode === 'revenue' && (
                      <div style={{ ...s.grid3, marginTop: 16 }}>
                        <div style={{ ...s.card, padding: 14, marginBottom: 0 }}>
                          <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Rev/Visitor (Ctrl)</div>
                          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Fira Code',monospace" }}>${fmt(v.revPerVisitorCtrl)}</div>
                        </div>
                        <div style={{ ...s.card, padding: 14, marginBottom: 0 }}>
                          <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Rev/Visitor (Var)</div>
                          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Fira Code',monospace" }}>${fmt(v.revPerVisitorVar)}</div>
                        </div>
                        <div style={{ ...s.card, padding: 14, marginBottom: 0 }}>
                          <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Revenue Lift</div>
                          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Fira Code',monospace", color: v.revLift >= 0 ? '#00ff88' : '#ff4466' }}>{v.revLift >= 0 ? '+' : ''}{fmtPctRaw(v.revLift * 100)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {activeTab === 'results' && !results && (
            <div style={{ ...s.card, textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Enter Your Test Data</div>
              <div style={{ fontSize: 14, color: '#6e6e82' }}>Fill in visitors and conversions on the left panel to see results.</div>
            </div>
          )}

          {/* ── POWER ANALYSIS TAB ── */}
          {activeTab === 'power' && results && (
            <div>
              <div style={s.card}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Power Curve</div>
                <PowerCurve baselineRate={results.baseRate} visitors1={results.ctrl.visitors} visitors2={results.variantResults[0]?.visitors || 10000} currentMDE={results.variantResults[0]?.mde} width={600} height={180}/>
                <div style={{ marginTop: 12, fontSize: 11, color: '#555', textAlign: 'center' }}>
                  Statistical power across different minimum detectable effects (MDE)
                </div>
              </div>
              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Sample Size Table</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6e6e82', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>MDE</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6e6e82', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Sample / Variant</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6e6e82', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Total Sample</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6e6e82', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Power</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0.5,1,1.5,2,3,5,7,10].map(mde => {
                        const n = calcSampleSize(results.baseRate, mde / 100);
                        const pw = calcPower(n, results.baseRate, n, results.baseRate + mde / 100) * 100;
                        return (
                          <tr key={mde} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '10px 12px', fontFamily: "'Fira Code',monospace" }}>{mde}%</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'Fira Code',monospace" }}>{n.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'Fira Code',monospace" }}>{(n * numVariants).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'Fira Code',monospace", color: pw >= 80 ? '#00ff88' : '#ffaa00' }}>{fmtPctRaw(pw, 1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Your Current Test</div>
                <div style={{ fontSize: 13, color: '#6e6e82', lineHeight: 1.8 }}>
                  With <span style={{ color: '#fff', fontWeight: 600 }}>{results.ctrl.visitors.toLocaleString()}</span> visitors per variant and a baseline conversion rate of <span style={{ color: '#00ff88', fontWeight: 600 }}>{fmtPct(results.baseRate)}</span>, your minimum detectable effect is <span style={{ color: '#00d4ff', fontWeight: 600 }}>{fmtPct(results.variantResults[0]?.mde)}</span>. This means you can reliably detect changes of this size or larger with 80% power.
                </div>
              </div>
            </div>
          )}

          {/* ── SIMULATION TAB ── */}
          {activeTab === 'simulation' && (
            <div>
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>Monte Carlo Simulation</div>
                    <div style={{ fontSize: 12, color: '#6e6e82', marginTop: 2 }}>5,000 randomized trials to estimate true outcome distribution</div>
                  </div>
                  <button onClick={runSim} disabled={simRunning || !results} style={{ ...s.btnPrimary, opacity: (simRunning || !results) ? 0.4 : 1 }}>
                    {simRunning ? 'Running…' : 'Run Simulation'}
                  </button>
                </div>
                {simResult && (
                  <div>
                    <div style={s.grid3}>
                      <div style={{ ...s.card, padding: 16, marginBottom: 0, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#00ff88' }}>{fmtPctRaw(simResult.winRate, 1)}</div>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1 }}>Win Rate</div>
                      </div>
                      <div style={{ ...s.card, padding: 16, marginBottom: 0, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#ff4466' }}>{fmtPctRaw(simResult.lossRate, 1)}</div>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1 }}>Loss Rate</div>
                      </div>
                      <div style={{ ...s.card, padding: 16, marginBottom: 0, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#ffaa00' }}>{fmtPctRaw(simResult.inconclusiveRate, 1)}</div>
                        <div style={{ fontSize: 10, color: '#6e6e82', textTransform: 'uppercase', letterSpacing: 1 }}>Inconclusive</div>
                      </div>
                    </div>
                    <div style={{ ...s.card, marginTop: 16, marginBottom: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Lift Distribution (Percentiles)</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        {[
                          { label: 'P5', val: simResult.liftP5 },
                          { label: 'P25', val: simResult.liftP25 },
                          { label: 'Median', val: simResult.liftP50 },
                          { label: 'P75', val: simResult.liftP75 },
                          { label: 'P95', val: simResult.liftP95 },
                        ].map(p => (
                          <div key={p.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Fira Code',monospace", color: p.val >= 0 ? '#00ff88' : '#ff4466' }}>{p.val >= 0 ? '+' : ''}{fmtPctRaw(p.val, 1)}</div>
                            <div style={{ fontSize: 10, color: '#6e6e82', marginTop: 2 }}>{p.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {!simResult && !simRunning && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#6e6e82' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🎲</div>
                    <div style={{ fontSize: 14 }}>Click "Run Simulation" to see probabilistic outcomes</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── INSIGHTS TAB ── */}
          {activeTab === 'insights' && results && (
            <div>
              {results.variantResults.map((v, vi) => {
                const verdict = getVerdict(v);
                const winner = v.isSignificant && v.lift > 0;
                const loser = v.isSignificant && v.lift < 0;
                const lowPower = v.power < 80;
                return (
                  <div key={vi} style={s.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{v.name}</span>
                      <span style={s.verdictBadge(verdict)}>{verdict.text}</span>
                    </div>
                    <div style={{ fontSize: 14, color: '#c8c8d4', lineHeight: 2 }}>
                      {winner && (
                        <>
                          <p><strong style={{ color: '#00ff88' }}>✅ Recommendation: Deploy this variant.</strong></p>
                          <p>{v.name} shows a statistically significant improvement of <strong>{fmtPctRaw(v.lift * 100)}</strong> over the control (p = {fmt(v.pValue, 4)}). With {fmtPctRaw(v.power)} statistical power, this result is reliable. The {confidence}% confidence interval for the conversion rate is [{fmtPct(v.ci[0])} – {fmtPct(v.ci[1])}].</p>
                          <p style={{ marginTop: 8, color: '#6e6e82' }}>Projected annual impact: If your baseline generates 100K conversions/year, this lift would add ~{Math.round(100000 * v.lift).toLocaleString()} additional conversions.</p>
                        </>
                      )}
                      {loser && (
                        <>
                          <p><strong style={{ color: '#ff4466' }}>❌ Recommendation: Do NOT deploy.</strong></p>
                          <p>{v.name} performs significantly worse than the control with a {fmtPctRaw(v.lift * 100)} decline (p = {fmt(v.pValue, 4)}). Revert to control immediately.</p>
                        </>
                      )}
                      {!v.isSignificant && lowPower && (
                        <>
                          <p><strong style={{ color: '#ffaa00' }}>⏳ Recommendation: Continue the test.</strong></p>
                          <p>The test has not reached statistical significance (p = {fmt(v.pValue, 4)}) and the statistical power is only {fmtPctRaw(v.power)} (below the recommended 80%). You need approximately <strong>{v.sampleNeeded.toLocaleString()}</strong> visitors per variant to detect the current observed effect reliably.</p>
                          <p style={{ marginTop: 8, color: '#6e6e82' }}>At your current traffic rate, this would require ~{Math.ceil(v.sampleNeeded / (results.ctrl.visitors || 1))} more collection periods of equal duration.</p>
                        </>
                      )}
                      {!v.isSignificant && !lowPower && (
                        <>
                          <p><strong style={{ color: '#00d4ff' }}>🔄 Recommendation: No action needed.</strong></p>
                          <p>With adequate power ({fmtPctRaw(v.power)}), the test shows no statistically significant difference. The true effect is likely smaller than the MDE of {fmtPct(v.mde)}. Consider whether this small an effect matters for your business case before running a larger test.</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Methodology note */}
              <div style={{ ...s.card, background: 'rgba(0,212,255,0.03)', borderColor: 'rgba(0,212,255,0.1)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff', marginBottom: 8 }}>📐 Methodology</div>
                <div style={{ fontSize: 12, color: '#6e6e82', lineHeight: 1.9 }}>
                  This calculator uses a two-proportion Z-test (frequentist approach) with pooled standard error. P-values are calculated using the normal approximation to the binomial distribution. Statistical power is computed via the non-central normal distribution. Confidence intervals use the Wald method. Monte Carlo simulations draw from the observed conversion rates to estimate outcome distributions across 5,000 trials.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Guide Modal ── */}
      {showGuide && (
        <div style={s.guideOverlay} onClick={() => setShowGuide(false)}>
          <div style={s.guideBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>How to Use</span>
              <button onClick={() => setShowGuide(false)} style={{ background: 'none', border: 'none', color: '#6e6e82', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ lineHeight: 2, fontSize: 14 }}>
              <p style={{ color: '#00ff88', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>1. Enter Your Data</p>
              <p>Input the number of <strong>visitors</strong> (sample size) and <strong>conversions</strong> (successes) for your control group (A) and at least one variant. For revenue tests, also enter total revenue per variant.</p>

              <p style={{ color: '#00ff88', fontWeight: 700, fontSize: 16, marginBottom: 8, marginTop: 20 }}>2. Configure Settings</p>
              <p><strong>Confidence Level:</strong> How sure you want to be (95% is standard). Higher confidence = harder to reach significance.</p>
              <p><strong>Hypothesis:</strong> Two-sided tests if the variant could be better OR worse. One-sided if you only care about improvements.</p>
              <p><strong>Variants:</strong> Support A/B, A/B/C, or A/B/C/D multivariate tests.</p>

              <p style={{ color: '#00ff88', fontWeight: 700, fontSize: 16, marginBottom: 8, marginTop: 20 }}>3. Read Your Results</p>
              <p><strong>P-Value:</strong> Probability this result happened by chance. Below 0.05 = significant.</p>
              <p><strong>Statistical Power:</strong> Probability of detecting a real effect. Aim for ≥80%.</p>
              <p><strong>MDE:</strong> Minimum Detectable Effect — the smallest change your test can reliably detect.</p>
              <p><strong>Confidence Interval:</strong> The range where the true conversion rate likely falls.</p>

              <p style={{ color: '#00ff88', fontWeight: 700, fontSize: 16, marginBottom: 8, marginTop: 20 }}>4. Advanced Features</p>
              <p><strong>Power Analysis:</strong> See how much traffic you need for various effect sizes.</p>
              <p><strong>Monte Carlo Simulation:</strong> Run 5,000 randomized trials to estimate outcome probability.</p>
              <p><strong>Excel Export:</strong> Download a complete analysis report with all metrics, insights, and power tables.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}