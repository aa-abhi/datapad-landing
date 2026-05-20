/**
 * Datapad URL Shortener — Apps Script backend.
 *
 * Sheet schema:
 *   Tab "links":   key | destination_url | active | created_at
 *   Tab "clicks":  timestamp | key | referrer | user_agent
 *
 * Deploy as Web App (Execute as: Me, Access: Anyone).
 * GET  → returns active key→url map as JSON
 * POST → appends a click row (fire-and-forget)
 */

const LINKS_TAB = 'links';
const CLICKS_TAB = 'clicks';
const CACHE_TTL_SECONDS = 50; // a bit less than edge cache to avoid stale chains

function doGet(e) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('map');
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

  const map = {};
  rows.forEach(r => {
    const key = String(r[ki] || '').trim();
    const url = String(r[ui] || '').trim();
    const active = r[ai];
    const isActive = active === true || String(active).toUpperCase() === 'TRUE' || active === 1;
    if (key && url && isActive && /^https?:\/\//i.test(url)) {
      map[key] = url;
    }
  });

  const out = JSON.stringify(map);
  cache.put('map', out, CACHE_TTL_SECONDS);
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
