import { useState } from 'react'

const NAV_TOOLS = [
  { label: 'Pre/Post Analyzer', href: '/pre-post-analyzer' },
  { label: 'JSON Studio', href: 'https://datapad-rosy.vercel.app/json-studio/' },
]

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

function QuestionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function Header({ canExport, onExport, onGuide }) {
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="header-left">
        {/* Logo → home */}
        <a href="/" className="header-logo" aria-label="Datapad home">
          <img src="/logo.png" alt="Datapad" className="header-logo-img" />
          <span className="header-logo-name">Datapad</span>
        </a>

        {/* Divider */}
        <span className="header-divider" aria-hidden="true">/</span>

        {/* Current tool */}
        <div className="header-tool">
          <span className="header-tool-name">A/B Test Calculator</span>
          <span className="header-tool-badge">Beta</span>
        </div>
      </div>

      <div className="header-right">
        {/* Tools dropdown */}
        <div className="header-dropdown" onMouseLeave={() => setToolsOpen(false)}>
          <button
            className="hdr-btn hdr-btn-ghost"
            onMouseEnter={() => setToolsOpen(true)}
            onClick={() => setToolsOpen(o => !o)}
            aria-expanded={toolsOpen}
            aria-haspopup="true"
          >
            Other Tools <ChevronIcon />
          </button>
          {toolsOpen && (
            <div className="dropdown-menu" role="menu">
              {NAV_TOOLS.map(t => (
                <a key={t.href} href={t.href} className="dropdown-item" role="menuitem">
                  {t.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Guide */}
        <button className="hdr-btn hdr-btn-ghost" onClick={onGuide} aria-label="Open user guide">
          <QuestionIcon /> Guide
        </button>

        {/* Export */}
        <button
          className={`hdr-btn hdr-btn-primary${canExport ? '' : ' disabled'}`}
          onClick={canExport ? onExport : undefined}
          disabled={!canExport}
          aria-label="Export to Excel"
          aria-disabled={!canExport}
        >
          <DownloadIcon /> Export Excel
        </button>
      </div>
    </header>
  )
}