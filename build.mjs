// ─────────────────────────────────────────────────────────────────────
// DataPad build step — obfuscates glimpse/index.html for production.
//
// IMPORTANT: this script is a NO-OP locally. It only runs the obfuscator
// when Vercel sets VERCEL=1 (during CI builds). Your source file stays
// readable in the repo — you never have to worry about accidentally
// committing a mangled version.
//
// To test the obfuscated output locally:
//   FORCE_OBFUSCATE=1 npm run build
// or
//   npm run build:local
//
// What it does:
//   1. Reads glimpse/index.html
//   2. Finds the biggest inline <script> block (the main app — not the
//      Google Analytics snippets or the JSON-LD blob)
//   3. Runs javascript-obfuscator with settings tuned for this codebase
//   4. Writes the obfuscated HTML back to glimpse/index.html IN PLACE
//      (Vercel deploys whatever's in the workspace after this step runs)
//
// What it does NOT do:
//   - Touch any other project (csv-merger, json-studio, etc.)
//   - Modify your source-control state — Vercel runs in an ephemeral
//     workspace, so the in-place write only affects the deployed copy
// ─────────────────────────────────────────────────────────────────────

import fs from 'node:fs';
import JavaScriptObfuscator from 'javascript-obfuscator';

const TARGET = 'glimpse/index.html';

const onVercel = !!process.env.VERCEL;
const forced   = !!process.env.FORCE_OBFUSCATE;

if (!onVercel && !forced) {
  console.log('[build] Not on Vercel — skipping obfuscation.');
  console.log('[build] To test locally:  FORCE_OBFUSCATE=1 npm run build');
  process.exit(0);
}

if (!fs.existsSync(TARGET)) {
  console.error('[build] Target file not found: ' + TARGET);
  process.exit(1);
}

console.log('[build] Reading ' + TARGET);
const html = fs.readFileSync(TARGET, 'utf8');

// Pick the LARGEST inline <script> — skips the GA loader, JSON-LD, and any
// other small inline snippets. Only the main app (~470KB) gets obfuscated.
const inlineScriptRegex = /<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/ld\+json["'])([^>]*)>([\s\S]*?)<\/script>/g;
const matches = [...html.matchAll(inlineScriptRegex)];
if (!matches.length) {
  console.error('[build] No inline <script> blocks found — aborting.');
  process.exit(1);
}
const main = matches.reduce((a, b) => (b[2].length > a[2].length ? b : a));

const beforeBytes = Buffer.byteLength(main[2], 'utf8');
console.log('[build] Obfuscating ' + beforeBytes.toLocaleString() + ' bytes of inline JS…');

// Wrap the obfuscator call so we can post-process its output below.
const obfuscatedRaw = JavaScriptObfuscator.obfuscate(main[2], {
  // Safe defaults: compact output, string array with base64 encoding,
  // mangled identifier names. Anti-reformat self-defense ON.
  compact: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  identifierNamesGenerator: 'mangled',
  selfDefending: true,
  splitStrings: false,
  unicodeEscapeSequence: false,

  // CRITICAL: must stay FALSE. The codebase has hundreds of inline
  //   onclick="someFunctionName()"  HTML attributes.
  // The obfuscator can't see those strings, so renaming globals or
  // transforming object keys would silently break every button.
  renameGlobals: false,
  transformObjectKeys: false,

  // Skipped — both are 10x slower with 9000+ lines and bloat the
  // bundle by 2-3×. Without them we still get ~90% of the deterrent
  // effect at sane performance cost.
  controlFlowFlattening: false,
  deadCodeInjection: false,

  // Don't disable console output — helpful for debugging if anything
  // breaks in production. We're hiding code, not telemetry.
  disableConsoleOutput: false
}).getObfuscatedCode();

// Escape any literal `</script` (and `<!--`) that the obfuscator's
// selfDefending template may emit inside string literals. The browser's
// HTML parser would otherwise terminate the surrounding <script> tag,
// dumping the rest of the bundle into the DOM as text. JS treats `</`
// and `<\/` identically inside strings, so this is a safe no-op for
// runtime behavior.
const obfuscated = obfuscatedRaw
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--');

const afterBytes = Buffer.byteLength(obfuscated, 'utf8');
const newHtml = html.replace(main[0], '<script' + main[1] + '>' + obfuscated + '</script>');

fs.writeFileSync(TARGET, newHtml);

const delta = ((afterBytes / beforeBytes - 1) * 100).toFixed(1);
console.log('[build] ✓ Wrote ' + TARGET);
console.log('[build]   ' + beforeBytes.toLocaleString() + ' → ' + afterBytes.toLocaleString() + ' bytes (' + (delta >= 0 ? '+' : '') + delta + '%)');
