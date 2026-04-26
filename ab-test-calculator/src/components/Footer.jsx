export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <span className="footer-copy">
          © 2026 <a href="/">Datapad</a>. All rights reserved.
        </span>
        <nav className="footer-links" aria-label="Footer navigation">
          <a href="/">Home</a>
          <a href="/pre-post-analyzer">Pre/Post Analyzer</a>
          <a href="https://datapad-rosy.vercel.app/json-studio/">JSON Studio</a>
          <a href="mailto:abhishekpslko@gmail.com">Contact</a>
        </nav>
      </div>
    </footer>
  )
}