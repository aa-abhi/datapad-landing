import { useEffect, useRef, useState, useCallback } from 'react'

/* ─────────────────────────────────────────────
   ICONS  (inline SVG components, zero deps)
───────────────────────────────────────────── */
const Icon = {
  ArrowUpRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  ),
  ArrowUpRight16: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  CreditCard: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM1 10h22" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Monitor: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
    </svg>
  ),
  Chevron: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Mail: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  X: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
}

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const TOOLS = [
  {
    id: 'abt',
    name: 'A/B Test Calculator',
    desc: 'Statistical significance calculator with p-value, power analysis, and multi-variant support.',
    href: '/ab-test-calculator',
    label: 'Launch Calculator',
    features: [
      'Two-proportion Z-test with Wilson CIs',
      'Monte Carlo simulation (5,000 trials)',
      'Multi-variant A/B/C/D + Bonferroni',
      'Power analysis & MDE calculator',
      'SRM detection + Excel export',
    ],
  },
  {
    id: 'pp',
    name: 'Pre/Post Analyzer',
    desc: 'Measure the statistical impact of changes between sequential time periods.',
    href: '/pre-post-analyzer',
    label: 'Launch Analyzer',
    features: [
      'Two-proportion Z-test (Welch-corrected)',
      "Cohen's h effect size classification",
      'Wilson confidence intervals for rates',
      'Revenue per visitor & per conversion',
      'Side-by-side comparison + Excel export',
    ],
  },
  {
    id: 'json',
    name: 'JSON Studio',
    desc: 'Smart JSON toolkit with format, minify, auto-fix, diff, and extraction.',
    href: 'https://datapad-rosy.vercel.app/json-studio/',
    label: 'Launch Studio',
    features: [
      'Format & beautify JSON instantly',
      'Auto-fix common syntax errors',
      'Compare & diff two JSON objects',
      'Extract data using paths',
      'Convert JSON to CSV',
    ],
  },
]

const TRUST_ITEMS = [
  { icon: <Icon.Shield />,     label: 'No data leaves your browser' },
  { icon: <Icon.CreditCard />, label: 'No sign-up required' },
  { icon: <Icon.Clock />,      label: 'Instant results' },
  { icon: <Icon.Check />,      label: 'Completely free, forever' },
  { icon: <Icon.Monitor />,    label: 'Works offline' },
]

const FAQS = [
  {
    q: 'Is Datapad free to use?',
    a: 'Yes. All Datapad tools are completely free with no sign-up, no paywall, and no premium tier. Every feature is available to every user.',
  },
  {
    q: 'Does Datapad store or transmit my data?',
    a: 'No. All statistical computation runs entirely in your browser using JavaScript. Your data never leaves your device, and there are no analytics or telemetry calls on tool inputs.',
  },
  {
    q: 'How is statistical significance calculated?',
    a: "We use a two-proportion Z-test with pooled standard error. Confidence intervals use the Wilson method (more accurate than Wald for extreme rates or small samples). For multiple variants, Bonferroni correction is applied automatically.",
  },
  {
    q: 'What is the difference between A/B testing and pre/post analysis?',
    a: 'A/B tests use concurrent randomized groups and can establish causation. Pre/post analysis compares sequential time periods — it can show a change occurred but cannot prove your intervention caused it, as external factors (seasonality, marketing) may be responsible.',
  },
  {
    q: 'What sample size do I need for an A/B test?',
    a: 'It depends on your baseline conversion rate and the minimum effect size you want to detect. Use the Power Analysis tab in the A/B Test Calculator — it generates a full sample size table for MDEs from 0.5% to 10%, with required visitors per variant at 80% power.',
  },
  {
    q: 'What is a Sample Ratio Mismatch (SRM)?',
    a: 'An SRM occurs when the observed traffic split between variants deviates significantly from the expected ratio. It indicates a problem with randomization and can invalidate test results. The A/B Test Calculator automatically runs a chi-square SRM check on your data.',
  },
]

/* ─────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('revealed')
      }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.reveal, .product-card').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

function useCursorGlow() {
  const glowRef = useRef(null)
  useEffect(() => {
    let mx = 0, my = 0, gx = 0, gy = 0, raf
    const onMove = e => { mx = e.clientX; my = e.clientY }
    document.addEventListener('mousemove', onMove)
    const anim = () => {
      gx += (mx - gx) * 0.1
      gy += (my - gy) * 0.1
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${gx - 200}px, ${gy - 200}px)`
      }
      raf = requestAnimationFrame(anim)
    }
    raf = requestAnimationFrame(anim)
    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])
  return glowRef
}

/* ─────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────── */

/* Status dot */
function StatusDot() {
  return <span className="status-dot" aria-hidden="true" />
}

/* Nav */
function Header() {
  const handleSmoothScroll = useCallback((e, href) => {
    const target = document.querySelector(href)
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }) }
  }, [])

  return (
    <header>
      <div className="header-inner">
        <a href="/" className="logo" aria-label="Datapad Home">
          <img src="/logo.png" alt="Datapad Logo" className="enhanced-logo" />
          <span className="logo-name">Datapad</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#products" className="nav-link" onClick={e => handleSmoothScroll(e, '#products')}>Tools</a>
          <a href="#faq"      className="nav-link" onClick={e => handleSmoothScroll(e, '#faq')}>FAQ</a>
          <a href="#contact"  className="nav-link" onClick={e => handleSmoothScroll(e, '#contact')}>Contact</a>
          <div className="nav-status" role="status" aria-label="All systems online">
            <StatusDot />
            <span>All systems online</span>
          </div>
        </nav>
      </div>
    </header>
  )
}

/* Hero */
function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-grid-lines" />
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />
      </div>
      <div className="container">
        <div className="hero-inner">
          <div className="hero-eyebrow" aria-hidden="true">
            <StatusDot />
            Developer Power Tools
          </div>
          <h1 className="hero-title" id="hero-heading">
            <span className="line reveal-line">Analyse.</span>
            <span className="line reveal-line">Validate.</span>
            <span className="line reveal-line accent">Ship faster.</span>
          </h1>
          <p className="hero-desc">
            Free, browser-based tools for developers and growth teams. Statistical significance
            calculators, impact analyzers, and developer utilities — all running locally, zero tracking.
          </p>
          <div className="hero-cta">
            <a href="#products" className="btn-primary">
              Explore Tools <Icon.ArrowUpRight16 />
            </a>
            <a href="/ab-test-calculator" className="btn-ghost">Try A/B Calculator</a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Trust bar */
function TrustBar() {
  return (
    <div className="trust-bar" role="complementary" aria-label="Key features">
      <div className="trust-inner">
        {TRUST_ITEMS.map(({ icon, label }) => (
          <div key={label} className="trust-item">
            {icon}
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

/* Product card */
function ProductCard({ tool, index }) {
  return (
    <article
      className="product-card"
      role="listitem"
      aria-labelledby={`${tool.id}-name`}
      style={{ transitionDelay: `${index * 0.1}s` }}
    >
      <div className="card-shimmer" aria-hidden="true" />
      <div className="card-corner"  aria-hidden="true" />
      <div className="card-top-row">
        <div className="card-icon-wrap" aria-hidden="true">{'{ }'}</div>
        <span className="card-badge">
          <span className="badge-live-dot" aria-hidden="true" />
          Live
        </span>
      </div>
      <h3 className="card-name" id={`${tool.id}-name`}>{tool.name}</h3>
      <p className="card-desc">{tool.desc}</p>
      <ul className="card-features" aria-label="Features">
        {tool.features.map(f => (
          <li key={f}>
            <span className="feat-dot" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <a href={tool.href} className="card-action" aria-label={`Launch ${tool.name}`}>
        {tool.label}
        <Icon.ArrowUpRight />
      </a>
    </article>
  )
}

/* Products section */
function Products() {
  return (
    <section className="products-section" id="products" aria-labelledby="products-heading">
      <div className="container">
        <div className="reveal">
          <div className="section-tag">01 / Products</div>
          <h2 className="section-title" id="products-heading">Tools built for precision</h2>
          <p className="section-desc">
            Professional-grade calculators and analyzers that respect your time, privacy, and intelligence.
          </p>
        </div>
        <div className="products-grid" role="list">
          {TOOLS.map((tool, i) => (
            <ProductCard key={tool.id} tool={tool} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* FAQ item */
function FaqItem({ faq }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-item reveal${open ? ' open' : ''}`} role="listitem">
      <button
        className="faq-q"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {faq.q}
        <span className="faq-chevron" aria-hidden="true">
          <Icon.Chevron />
        </span>
      </button>
      <div className="faq-a" role="region">
        <div className="faq-a-inner">{faq.a}</div>
      </div>
    </div>
  )
}

/* FAQ section */
function FAQ() {
  return (
    <section className="faq-section" id="faq" aria-labelledby="faq-heading">
      <div className="container">
        <div className="reveal">
          <div className="section-tag">02 / FAQ</div>
          <h2 className="section-title" id="faq-heading">Common questions</h2>
          <p className="section-desc">Everything you need to know about Datapad tools.</p>
        </div>
        <div className="faq-grid" role="list">
          {FAQS.map(faq => (
            <FaqItem key={faq.q} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* About + Contact */
function About() {
  return (
    <section className="about-section" id="contact" aria-labelledby="about-heading">
      <div className="container">
        <div className="reveal">
          <div className="section-tag">03 / About</div>
          <h2 className="section-title" id="about-heading">Built for people who ship</h2>
        </div>
        <div className="about-grid">
          <div className="about-block reveal">
            <div className="block-eyebrow">Who we are</div>
            <h3 className="block-title">Browser-first. Privacy-first. Always free.</h3>
            <p className="block-body">
              Datapad is a growing suite of developer and analytics tools that run entirely in the
              browser. No cloud, no accounts, no hidden fees — just tools that work.
            </p>
            <div className="values-row">
              <div className="value-chip"><span className="value-chip-num">01</span>Speed</div>
              <div className="value-chip"><span className="value-chip-num">02</span>Privacy</div>
              <div className="value-chip"><span className="value-chip-num">03</span>Precision</div>
            </div>
          </div>
          <div className="contact-block reveal">
            <div className="block-eyebrow">Get in touch</div>
            <h3 className="block-title">We'd love to hear from you.</h3>
            <p className="block-body">
              Have feedback, a bug to report, or a tool idea? Reach out — we read everything.
            </p>
            <a href="mailto:abhishekpslko@gmail.com" className="contact-email" aria-label="Send email">
              <Icon.Mail />
              abhishekpslko@gmail.com
            </a>
            <a
              href="https://forms.gle/pZFitCFt6pfQNKEFA"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-feedback"
            >
              Share Feedback
              <Icon.ArrowUpRight />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Footer */
function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <p className="footer-copy">© 2026 Datapad. All rights reserved.</p>
        <nav className="footer-links" aria-label="Footer navigation">
          <a href="/ab-test-calculator">A/B Calculator</a>
          <a href="/pre-post-analyzer">Pre/Post Analyzer</a>
          <a href="https://datapad-rosy.vercel.app/json-studio/">JSON Studio</a>
          <a href="mailto:abhishekpslko@gmail.com">Contact</a>
        </nav>
      </div>
    </footer>
  )
}

/* ─────────────────────────────────────────────
   APP
───────────────────────────────────────────── */
export default function App() {
  const glowRef = useCursorGlow()
  useScrollReveal()

  return (
    <>
      {/* Cursor glow */}
      <div
        ref={glowRef}
        className="cursor-glow"
        aria-hidden="true"
        style={{
          position: 'fixed',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(var(--pri-rgb), 0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
          willChange: 'transform',
        }}
      />
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <Products />
        <FAQ />
        <About />
      </main>
      <Footer />
    </>
  )
}

/* ─────────────────────────────────────────────
   STYLES  (scoped to this file via <style> tag
   injected once – keeps things self-contained)
───────────────────────────────────────────── */
const styles = `
/* ── Header ── */
header {
  padding: 0 32px;
  border-bottom: 1px solid var(--brd);
  background: rgba(5, 5, 8, 0.9);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  position: sticky;
  top: 0;
  z-index: 100;
  height: 64px;
  display: flex;
  align-items: center;
}
.header-inner {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.logo {
  display: flex; align-items: center; gap: 12px;
  text-decoration: none; color: inherit;
}
.enhanced-logo {
  width: 50px; height: 50px;
  object-fit: contain;
  filter: contrast(1.2) brightness(1.1) saturate(1.2);
  transition: filter 0.2s;
}
.logo:hover .enhanced-logo { filter: contrast(1.3) brightness(1.15) saturate(1.3); }
.logo-name {
  font-family: var(--font);
  font-size: 22px; font-weight: 800; letter-spacing: 1px;
}
nav { display: flex; align-items: center; gap: 6px; }
.nav-link {
  padding: 7px 14px; border-radius: 8px;
  font-size: 13px; font-weight: 500; color: var(--t2);
  text-decoration: none; transition: all 0.2s;
  font-family: var(--body-font);
}
.nav-link:hover { color: var(--t1); background: rgba(255,255,255,0.04); }
.nav-status {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 12px; border-radius: 100px;
  border: 1px solid rgba(var(--pri-rgb),0.15);
  background: rgba(var(--pri-rgb),0.04);
  font-size: 11px; color: var(--t2); font-family: var(--body-font);
}
.status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--pri);
  box-shadow: 0 0 8px rgba(var(--pri-rgb),0.7);
  animation: pulse 2s infinite;
  display: inline-block;
}

/* ── Hero ── */
.hero {
  position: relative; min-height: 88vh;
  display: flex; align-items: center; overflow: hidden;
}
.hero-bg { position: absolute; inset: 0; z-index: 0; }
.hero-grid-lines {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
}
.hero-glow-1 {
  position: absolute; width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--pri-rgb),0.08) 0%, transparent 70%);
  top: -100px; left: -100px;
}
.hero-glow-2 {
  position: absolute; width: 500px; height: 500px; border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--acc-rgb),0.06) 0%, transparent 70%);
  bottom: -50px; right: 0;
}
.hero-inner { position: relative; z-index: 1; padding: 80px 0; }
.hero-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px;
  background: rgba(var(--pri-rgb),0.06);
  border: 1px solid rgba(var(--pri-rgb),0.15);
  border-radius: 100px;
  font-size: 11px; font-weight: 500; color: var(--pri);
  letter-spacing: 1.5px; text-transform: uppercase;
  margin-bottom: 28px; font-family: var(--mono);
}
.hero-title {
  font-family: var(--font);
  font-size: clamp(40px, 5.5vw, 72px);
  font-weight: 800; line-height: 1.05;
  letter-spacing: -2px; margin-bottom: 30px;
}
.hero-title .line { display: block; }
.hero-title .accent { color: var(--pri); }
.hero-desc {
  font-size: 17px; color: var(--t1);
  line-height: 1.75; max-width: 480px; margin-bottom: 40px;
}
.hero-cta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; background: var(--pri); color: var(--bg0);
  border-radius: 10px; font-size: 14px; font-weight: 700;
  text-decoration: none; font-family: var(--font);
  transition: all 0.25s var(--ease); border: 2px solid var(--pri);
}
.btn-primary:hover {
  background: transparent; color: var(--pri);
  box-shadow: 0 0 32px rgba(var(--pri-rgb),0.2);
}
.btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; background: transparent; color: var(--t1);
  border-radius: 10px; font-size: 14px; font-weight: 500;
  text-decoration: none; font-family: var(--body-font);
  border: 1px solid var(--brd); transition: all 0.25s var(--ease);
}
.btn-ghost:hover { border-color: rgba(255,255,255,0.15); color: var(--t0); background: rgba(255,255,255,0.03); }

/* Hero text animation */
.reveal-line {
  display: block; opacity: 0; transform: translateY(20px);
  animation: fadeSlideUp 0.7s var(--ease) forwards;
}
.reveal-line:nth-child(1) { animation-delay: 0.2s; }
.reveal-line:nth-child(2) { animation-delay: 0.6s; }
.reveal-line:nth-child(3) { animation-delay: 1s; }
.reveal-line.accent {
  animation: fadeSlideUp 0.7s var(--ease) forwards, glowPop 1.2s ease-out 1.2s forwards;
}

/* ── Trust Bar ── */
.trust-bar {
  border-top: 1px solid var(--brd); border-bottom: 1px solid var(--brd);
  padding: 16px 24px; background: rgba(255,255,255,0.015); overflow: hidden;
}
.trust-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; gap: 32px; flex-wrap: wrap;
}
.trust-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--t2); font-weight: 600; white-space: nowrap;
}
.trust-item svg { color: var(--pri); flex-shrink: 0; }

/* ── Products ── */
.products-section { padding: 100px 0; }
.section-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 11px; color: var(--t2);
  text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;
}
.section-tag::before { content: ''; display: block; width: 24px; height: 1px; background: var(--t2); }
.section-title {
  font-family: var(--font);
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 800; letter-spacing: -1.5px; margin-bottom: 12px; line-height: 1.1;
}
.section-desc { font-size: 16px; color: var(--t2); max-width: 520px; margin-bottom: 56px; line-height: 1.7; }
.products-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

.product-card {
  position: relative; border-radius: 20px;
  border: 1px solid var(--brd); background: var(--bg1);
  padding: 28px; overflow: hidden;
  display: flex; flex-direction: column;
  opacity: 0; transform: translateY(24px);
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease),
              box-shadow 0.4s var(--ease), border-color 0.3s;
}
.product-card.revealed { opacity: 1; transform: translateY(0); }
.product-card.revealed:hover {
  transform: translateY(-4px);
  box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(var(--pri-rgb),0.08);
  border-color: rgba(var(--pri-rgb),0.12);
}
.card-shimmer {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(var(--pri-rgb),0.03) 100%);
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.product-card:hover .card-shimmer { opacity: 1; }
.card-corner {
  position: absolute; top: 0; right: 0; width: 120px; height: 120px;
  background: radial-gradient(circle at top right, rgba(var(--pri-rgb),0.06), transparent 70%);
  pointer-events: none;
}
.card-top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.card-icon-wrap {
  width: 48px; height: 48px; border-radius: 14px;
  background: rgba(var(--pri-rgb),0.08); border: 1px solid rgba(var(--pri-rgb),0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-family: var(--mono); color: var(--pri);
}
.card-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 100px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
  background: rgba(var(--pri-rgb),0.08); border: 1px solid rgba(var(--pri-rgb),0.2); color: var(--pri);
}
.badge-live-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--pri); animation: pulse 2s infinite; display: inline-block;
}
.card-name { font-family: var(--font); font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 8px; }
.card-desc { font-size: 13px; color: var(--t2); line-height: 1.65; margin-bottom: 20px; }
.card-features { list-style: none; margin-bottom: 24px; flex: 1; }
.card-features li {
  font-size: 12px; color: var(--t1); padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  display: flex; align-items: center; gap: 8px;
}
.card-features li:last-child { border-bottom: none; }
.feat-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--pri); flex-shrink: 0; opacity: 0.7; }
.card-action {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 16px;
  background: rgba(var(--pri-rgb),0.06); border: 1px solid rgba(var(--pri-rgb),0.15);
  border-radius: 10px; color: var(--pri);
  text-decoration: none; font-size: 13px; font-weight: 600; font-family: var(--font);
  transition: all 0.25s var(--ease);
}
.card-action:hover {
  background: rgba(var(--pri-rgb),0.12);
  border-color: rgba(var(--pri-rgb),0.3);
  box-shadow: 0 0 20px rgba(var(--pri-rgb),0.1);
}

/* ── FAQ ── */
.faq-section { padding: 90px 0 110px; border-top: 1px solid var(--brd); }
.faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 48px; align-items: start; }
.faq-item {
  background: var(--bg1); border: 1px solid var(--brd);
  border-radius: 14px; overflow: hidden; transition: all 0.25s var(--ease);
}
.faq-item:hover { border-color: rgba(var(--pri-rgb),0.2); background: rgba(255,255,255,0.015); }
.faq-item.open { border-color: rgba(var(--pri-rgb),0.35); box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
.faq-q {
  width: 100%; padding: 20px 22px; background: none; border: none;
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; text-align: left; color: var(--t0);
  font-size: 14px; font-weight: 600; font-family: var(--body-font);
  gap: 12px; transition: background 0.2s;
}
.faq-q:hover { background: rgba(255,255,255,0.02); }
.faq-chevron {
  width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--brd);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform 0.3s var(--ease), border-color 0.2s; color: var(--t2);
}
.faq-item.open .faq-chevron { transform: rotate(180deg); border-color: rgba(var(--pri-rgb),0.4); color: var(--pri); }
.faq-a {
  max-height: 0; overflow: hidden;
  transition: max-height 0.35s var(--ease), opacity 0.2s;
  font-size: 13px; color: var(--t2); line-height: 1.75; opacity: 0;
}
.faq-item.open .faq-a { max-height: 500px; opacity: 1; }
.faq-a-inner { padding: 0 22px 20px; }

/* ── About ── */
.about-section { padding: 80px 0 100px; border-top: 1px solid var(--brd); }
.about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px; }
.about-block, .contact-block {
  background: var(--bg1); border: 1px solid var(--brd); border-radius: 20px; padding: 36px;
}
.block-eyebrow { font-family: var(--mono); font-size: 10px; color: var(--t2); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; }
.block-title { font-family: var(--font); font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 14px; line-height: 1.3; }
.block-body { font-size: 14px; color: var(--t2); line-height: 1.75; margin-bottom: 24px; }
.values-row { display: flex; gap: 12px; }
.value-chip {
  flex: 1; padding: 10px 12px; background: var(--bg2); border: 1px solid var(--brd);
  border-radius: 8px; text-align: center; font-size: 11px; font-weight: 600; color: var(--t1);
}
.value-chip-num { display: block; font-family: var(--mono); font-size: 9px; color: var(--t2); margin-bottom: 3px; }
.contact-email {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 16px; background: var(--bg2); border: 1px solid var(--brd);
  border-radius: 10px; color: var(--t1); text-decoration: none;
  font-size: 13px; font-family: var(--mono); transition: all 0.2s; margin-bottom: 12px;
}
.contact-email:hover { border-color: rgba(var(--pri-rgb),0.2); color: var(--t0); }
.btn-feedback {
  width: 100%; padding: 12px; background: transparent;
  border: 1px solid rgba(var(--pri-rgb),0.2); border-radius: 10px;
  color: var(--pri); font-size: 13px; font-weight: 600;
  font-family: var(--font); display: flex; align-items: center;
  justify-content: center; gap: 8px; transition: all 0.25s var(--ease);
  cursor: pointer; text-decoration: none;
}
.btn-feedback:hover { background: rgba(var(--pri-rgb),0.08); border-color: rgba(var(--pri-rgb),0.3); }

/* ── Footer ── */
footer { border-top: 1px solid var(--brd); padding: 32px; background: rgba(255,255,255,0.005); }
.footer-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
}
.footer-copy { font-size: 12px; color: var(--t2); }
.footer-links { display: flex; gap: 20px; }
.footer-links a { font-size: 12px; color: var(--t2); text-decoration: none; transition: color 0.2s; }
.footer-links a:hover { color: var(--pri); }

/* ── Responsive ── */
@media (max-width: 1024px) { .products-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 768px) {
  .hero-inner { padding: 60px 0; }
  .products-grid { grid-template-columns: 1fr; }
  .faq-grid { grid-template-columns: 1fr; }
  .about-grid { grid-template-columns: 1fr; }
  nav .nav-link { display: none; }
}
@media (max-width: 480px) {
  header { padding: 0 16px; }
  .hero-title { font-size: 36px; }
  .hero-desc { font-size: 15px; }
}
`

/* Inject styles once */
if (typeof document !== 'undefined' && !document.getElementById('datapad-styles')) {
  const tag = document.createElement('style')
  tag.id = 'datapad-styles'
  tag.textContent = styles
  document.head.appendChild(tag)
}