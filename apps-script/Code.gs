/**
 * Datapad URL Shortener + Hosted Shares — Apps Script backend.
 *
 * Tabs:
 *   links       key | destination_url | active | created_at | expires_at
 *   clicks      timestamp | key | referrer | user_agent             (raw, 30d)
 *   daily_stats date | key | clicks                                  (rolled up nightly)
 *   shares      key | source | name | state | created_at | expires_at | views
 *
 * Endpoints:
 *   GET  ?action=map            → {key: url, ...}                    (redirect map)
 *   GET  ?action=get_share&key= → {ok, state, name, expires_at}
 *   POST {action:'log', ...}    → append a click row
 *   POST {action:'create_share', source, name, state} → {ok, key, url, expires_at}
 *
 * Setup once: paste, run setupTriggers(), deploy Web App (Me / Anyone).
 */

const LINKS_TAB  = 'links';
const CLICKS_TAB = 'clicks';
const STATS_TAB  = 'daily_stats';
const SHARES_TAB = 'shares';

const CACHE_TTL_SECONDS    = 50;
const DEFAULT_EXPIRY_DAYS  = 30;
const CLICK_RETENTION_DAYS = 30;
const SHARE_EXPIRY_DAYS    = 30;
const SHARE_KEY_LENGTH     = 5;
const SHARE_KEY_FALLBACK   = 6;
const SHARE_STATE_MAX      = 45000; // Sheet cell limit ~50k — leave headroom
const KEY_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // no 0/O/o/1/l/I

// ─── Web app endpoints ──────────────────────────────────────────────────

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'map';
  if (action === 'get_share') return getShare_(e.parameter.key);
  return getMap_();
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (_) {}
  const action = body.action || 'log';
  if (action === 'create_share') return createShare_(body);
  return logClick_(body);
}

// ─── /go redirect map ───────────────────────────────────────────────────

function getMap_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('map_v2');
  if (cached) return jsonOut_(cached);

  const sheet = SpreadsheetApp.getActive().getSheetByName(LINKS_TAB);
  if (!sheet) return jsonOut_('{}');

  const rows = sheet.getDataRange().getValues();
  const header = rows.shift().map(h => String(h).toLowerCase().trim());
  const ki = header.indexOf('key');
  const ui = header.indexOf('destination_url');
  const ai = header.indexOf('active');
  const ci = header.indexOf('created_at');
  const ei = header.indexOf('expires_at');

  const now = new Date();
  const map = {};
  rows.forEach(r => {
    const key = String(r[ki] || '').trim();
    const url = String(r[ui] || '').trim();
    const isActive = r[ai] === true || String(r[ai]).toUpperCase() === 'TRUE' || r[ai] === 1;
    if (!key || !url || !isActive || !/^https?:\/\//i.test(url)) return;
    const expiresAt = resolveExpiry_(r[ci], r[ei], DEFAULT_EXPIRY_DAYS);
    if (expiresAt && now > expiresAt) return;
    map[key] = url;
  });

  const out = JSON.stringify(map);
  cache.put('map_v2', out, CACHE_TTL_SECONDS);
  return jsonOut_(out);
}

function logClick_(body) {
  try {
    const key = String(body.key || '').slice(0, 64);
    const ref = String(body.ref || '').slice(0, 500);
    const ua  = String(body.ua  || '').slice(0, 500);
    if (!key) return json_({ ok: false });
    const sheet = ensureSheet_(CLICKS_TAB, ['timestamp', 'key', 'referrer', 'user_agent']);
    sheet.appendRow([new Date(), key, ref, ua]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ─── Hosted shares (Glimpse and other tools) ────────────────────────────

function createShare_(body) {
  try {
    const source = String(body.source || '').slice(0, 32);
    const name   = String(body.name   || '').slice(0, 200);
    const state  = String(body.state  || '');
    if (!source) return json_({ ok: false, error: 'missing source' });
    if (!state)  return json_({ ok: false, error: 'missing state' });
    if (state.length > SHARE_STATE_MAX) {
      return json_({ ok: false, error: 'state too large (' + state.length + ' > ' + SHARE_STATE_MAX + ')' });
    }

    const sheet = ensureSheet_(SHARES_TAB, ['key', 'source', 'name', 'state', 'created_at', 'expires_at', 'views']);
    const existing = collectKeys_(sheet);
    const key = generateUniqueKey_(existing);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SHARE_EXPIRY_DAYS * 86400000);

    sheet.appendRow([key, source, name, state, now, expiresAt, 0]);

    return json_({
      ok: true,
      key: key,
      expires_at: expiresAt.toISOString(),
      ttl_days: SHARE_EXPIRY_DAYS,
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function getShare_(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) return json_({ ok: false, error: 'missing key' });

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHARES_TAB);
  if (!sheet || sheet.getLastRow() < 2) return json_({ ok: false, error: 'not found' });

  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  const values = range.getValues();
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).toLowerCase().trim());
  const idx = { key: header.indexOf('key'), name: header.indexOf('name'), state: header.indexOf('state'),
                expires_at: header.indexOf('expires_at'), views: header.indexOf('views') };

  const now = new Date();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[idx.key]).trim() !== key) continue;
    const expiresAt = row[idx.expires_at] instanceof Date ? row[idx.expires_at] : null;
    if (expiresAt && now > expiresAt) return json_({ ok: false, error: 'expired' });
    // increment view counter (best-effort, no lock — race is acceptable here)
    try { sheet.getRange(i + 2, idx.views + 1).setValue((row[idx.views] || 0) + 1); } catch (_) {}
    return json_({
      ok: true,
      state: String(row[idx.state] || ''),
      name: String(row[idx.name] || ''),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    });
  }
  return json_({ ok: false, error: 'not found' });
}

function collectKeys_(sheet) {
  if (sheet.getLastRow() < 2) return {};
  const keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const out = {};
  keys.forEach(r => { out[String(r[0]).trim()] = true; });
  return out;
}

function generateUniqueKey_(existing) {
  for (let i = 0; i < 5; i++) {
    const k = randomKey_(SHARE_KEY_LENGTH);
    if (!existing[k]) return k;
  }
  // collision storm — fall back to longer key
  for (let i = 0; i < 5; i++) {
    const k = randomKey_(SHARE_KEY_FALLBACK);
    if (!existing[k]) return k;
  }
  // last resort — timestamp-based
  return 'x' + Date.now().toString(36);
}

function randomKey_(len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += KEY_CHARS.charAt(Math.floor(Math.random() * KEY_CHARS.length));
  }
  return s;
}

// ─── Expiry resolution ──────────────────────────────────────────────────

function resolveExpiry_(createdAt, expiresAtRaw, defaultDays) {
  const raw = String(expiresAtRaw || '').trim().toLowerCase();
  if (raw === 'permanent' || raw === 'never') return null;
  if (expiresAtRaw instanceof Date) return expiresAtRaw;
  if (raw && !isNaN(Date.parse(raw))) return new Date(raw);
  if (createdAt instanceof Date) return new Date(createdAt.getTime() + defaultDays * 86400000);
  if (createdAt && !isNaN(Date.parse(createdAt))) {
    return new Date(new Date(createdAt).getTime() + defaultDays * 86400000);
  }
  return null;
}

// ─── Daily roll-up + purge ──────────────────────────────────────────────

function rollupDaily() {
  rollupClicks_();
  purgeExpiredShares_();
}

function rollupClicks_() {
  const ss = SpreadsheetApp.getActive();
  const clicks = ss.getSheetByName(CLICKS_TAB);
  if (!clicks || clicks.getLastRow() < 2) return;

  const stats = ensureSheet_(STATS_TAB, ['date', 'key', 'clicks']);

  const data = clicks.getRange(2, 1, clicks.getLastRow() - 1, 2).getValues();
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const counts = {};
  data.forEach(row => {
    const ts = row[0];
    const key = String(row[1] || '').trim();
    if (!key || !(ts instanceof Date)) return;
    if (ts < yesterday || ts >= today) return;
    const date = Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const k = date + '|' + key;
    counts[k] = (counts[k] || 0) + 1;
  });
  Object.keys(counts).forEach(k => {
    const [date, key] = k.split('|');
    stats.appendRow([date, key, counts[k]]);
  });

  const cutoff = new Date(now.getTime() - CLICK_RETENTION_DAYS * 86400000);
  const all = clicks.getRange(2, 1, clicks.getLastRow() - 1, clicks.getLastColumn()).getValues();
  const keep = all.filter(r => r[0] instanceof Date && r[0] >= cutoff);
  if (keep.length !== all.length) {
    clicks.getRange(2, 1, all.length, clicks.getLastColumn()).clearContent();
    if (keep.length) clicks.getRange(2, 1, keep.length, keep[0].length).setValues(keep);
  }
}

function purgeExpiredShares_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHARES_TAB);
  if (!sheet || sheet.getLastRow() < 2) return;

  const lastCol = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h).toLowerCase().trim());
  const ei = header.indexOf('expires_at');
  if (ei < 0) return;

  const all = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
  const now = new Date();
  const keep = all.filter(r => {
    const exp = r[ei];
    if (!(exp instanceof Date)) return true; // never expires
    return now <= exp;
  });
  if (keep.length === all.length) return;
  sheet.getRange(2, 1, all.length, lastCol).clearContent();
  if (keep.length) sheet.getRange(2, 1, keep.length, lastCol).setValues(keep);
}

// ─── One-time trigger setup ─────────────────────────────────────────────

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'rollupDaily') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rollupDaily').timeBased().atHour(1).everyDays(1).create();
}

// ─── helpers ────────────────────────────────────────────────────────────

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsonOut_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
