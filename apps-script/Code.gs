/**
 * Datapad URL Shortener — Apps Script backend.
 *
 * Sheet schema:
 *   Tab "links":       key | destination_url | active | created_at | expires_at
 *     expires_at:  blank   → defaults to created_at + 30 days
 *                  "permanent" / "never" → no expiry
 *                  date    → use that date
 *
 *   Tab "clicks":      timestamp | key | referrer | user_agent       (raw, last 30 days only)
 *   Tab "daily_stats": date | key | clicks                           (rolled up nightly)
 *
 * Setup (one-time, per sheet):
 *   1. Paste this file in Extensions → Apps Script
 *   2. Run setupTriggers() once (Run → setupTriggers, grant permissions)
 *   3. Deploy → New deployment → Web app (Execute as: Me, Access: Anyone)
 */

const LINKS_TAB = 'links';
const CLICKS_TAB = 'clicks';
const STATS_TAB = 'daily_stats';
const CACHE_TTL_SECONDS = 50;
const DEFAULT_EXPIRY_DAYS = 30;
const CLICK_RETENTION_DAYS = 30;

// ----- Web app endpoints --------------------------------------------------

function doGet(e) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('map_v2');
  if (cached) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName(LINKS_TAB);
  if (!sheet) return json_({});

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
    const active = r[ai];
    const isActive = active === true || String(active).toUpperCase() === 'TRUE' || active === 1;
    if (!key || !url || !isActive || !/^https?:\/\//i.test(url)) return;

    const expiresAt = resolveExpiry_(r[ci], r[ei]);
    if (expiresAt && now > expiresAt) return;

    map[key] = url;
  });

  const out = JSON.stringify(map);
  cache.put('map_v2', out, CACHE_TTL_SECONDS);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const key = String(body.key || '').slice(0, 64);
    const ref = String(body.ref || '').slice(0, 500);
    const ua = String(body.ua || '').slice(0, 500);
    if (!key) return json_({ ok: false });

    let sheet = SpreadsheetApp.getActive().getSheetByName(CLICKS_TAB);
    if (!sheet) {
      sheet = SpreadsheetApp.getActive().insertSheet(CLICKS_TAB);
      sheet.appendRow(['timestamp', 'key', 'referrer', 'user_agent']);
    }
    sheet.appendRow([new Date(), key, ref, ua]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ----- Expiry resolution --------------------------------------------------

function resolveExpiry_(createdAt, expiresAtRaw) {
  const raw = String(expiresAtRaw || '').trim().toLowerCase();
  if (raw === 'permanent' || raw === 'never') return null;

  if (expiresAtRaw instanceof Date) return expiresAtRaw;
  if (raw && !isNaN(Date.parse(raw))) return new Date(raw);

  // blank → default = created_at + 30 days
  if (createdAt instanceof Date) {
    return new Date(createdAt.getTime() + DEFAULT_EXPIRY_DAYS * 86400000);
  }
  if (createdAt && !isNaN(Date.parse(createdAt))) {
    return new Date(new Date(createdAt).getTime() + DEFAULT_EXPIRY_DAYS * 86400000);
  }
  // no created_at either → no expiry (don't accidentally hide links)
  return null;
}

// ----- Daily roll-up + purge ---------------------------------------------

function rollupDaily() {
  const ss = SpreadsheetApp.getActive();
  const clicks = ss.getSheetByName(CLICKS_TAB);
  if (!clicks || clicks.getLastRow() < 2) return;

  let stats = ss.getSheetByName(STATS_TAB);
  if (!stats) {
    stats = ss.insertSheet(STATS_TAB);
    stats.appendRow(['date', 'key', 'clicks']);
  }

  const data = clicks.getRange(2, 1, clicks.getLastRow() - 1, 2).getValues(); // timestamp, key
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // aggregate yesterday's rows: { "YYYY-MM-DD|key" : count }
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

  // purge rows older than retention window
  const cutoff = new Date(now.getTime() - CLICK_RETENTION_DAYS * 86400000);
  const all = clicks.getRange(2, 1, clicks.getLastRow() - 1, clicks.getLastColumn()).getValues();
  const keep = all.filter(r => r[0] instanceof Date && r[0] >= cutoff);
  if (keep.length !== all.length) {
    clicks.getRange(2, 1, all.length, clicks.getLastColumn()).clearContent();
    if (keep.length) {
      clicks.getRange(2, 1, keep.length, keep[0].length).setValues(keep);
    }
  }
}

// ----- One-time trigger setup --------------------------------------------

function setupTriggers() {
  // Remove existing rollup triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'rollupDaily') ScriptApp.deleteTrigger(t);
  });
  // Run daily at 01:00 in script timezone
  ScriptApp.newTrigger('rollupDaily').timeBased().atHour(1).everyDays(1).create();
}

// ----- helpers ------------------------------------------------------------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
