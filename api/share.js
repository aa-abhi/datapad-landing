export const config = { runtime: 'edge' };

// Allowed sources — gate which Datapad tools can create shares.
const ALLOWED_SOURCES = new Set(['glimpse', 'ab-test', 'pre-post', 'rice', 'json-studio']);

// Same-origin only: the request must come from the same host that's serving
// this endpoint. Cross-site form attacks blocked; any deploy talks to itself.

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(extra || {}),
    },
  });
}

function checkOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // server-to-server / curl / same-tab navigations
  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(req.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export default async function handler(req) {
  const apiUrl = process.env.SHEETS_API_URL;
  if (!apiUrl) return json({ ok: false, error: 'not configured' }, 500);

  if (!checkOrigin(req)) return json({ ok: false, error: 'origin not allowed' }, 403);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const key = (url.searchParams.get('key') || '').trim();
    if (!key) return json({ ok: false, error: 'missing key' }, 400);

    try {
      const upstream = await fetch(apiUrl + '?action=get_share&key=' + encodeURIComponent(key));
      const data = await upstream.json();
      return json(data, data && data.ok ? 200 : 404);
    } catch {
      return json({ ok: false, error: 'upstream' }, 502);
    }
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid body' }, 400); }

    const source = String(body.source || '').toLowerCase();
    if (!ALLOWED_SOURCES.has(source)) return json({ ok: false, error: 'source not allowed' }, 400);

    const state = String(body.state || '');
    const name = String(body.name || '').slice(0, 200);
    if (!state) return json({ ok: false, error: 'missing state' }, 400);
    if (state.length > 45000) return json({ ok: false, error: 'state too large' }, 413);

    try {
      const upstream = await fetch(apiUrl, {
        method: 'POST',
        // text/plain dodges Apps Script CORS preflight (irrelevant for server-to-server, harmless).
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'create_share', source, name, state }),
      });
      const data = await upstream.json();
      return json(data, data && data.ok ? 200 : 500);
    } catch {
      return json({ ok: false, error: 'upstream' }, 502);
    }
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
}
