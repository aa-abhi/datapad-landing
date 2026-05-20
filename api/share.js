export const config = { runtime: 'edge' };

const ALLOWED_SOURCES = new Set(['glimpse', 'ab-test', 'pre-post', 'rice', 'json-studio']);

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
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

async function readResponseSafely(res) {
  const text = await res.text();
  if (!text) return { parsed: null, raw: '', empty: true };
  try {
    return { parsed: JSON.parse(text), raw: text, empty: false };
  } catch {
    return { parsed: null, raw: text.slice(0, 200), empty: false };
  }
}

export default async function handler(req) {
  // CORS preflight — must answer 200 with the right headers or the browser
  // never sends the real POST. Even same-origin can preflight when the
  // request crosses Vercel preview hostnames or has a non-simple content-type.
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '*';
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      },
    });
  }

  const apiUrl = process.env.SHEETS_API_URL;
  if (!apiUrl) return json({ ok: false, error: 'not configured' }, 500);
  if (!checkOrigin(req)) return json({ ok: false, error: 'origin not allowed' }, 403);

  if (req.method === 'GET') {
    const key = (new URL(req.url).searchParams.get('key') || '').trim();
    if (!key) return json({ ok: false, error: 'missing key' }, 400);
    try {
      const upstream = await fetch(apiUrl + '?action=get_share&key=' + encodeURIComponent(key));
      const { parsed, raw, empty } = await readResponseSafely(upstream);
      if (empty) return json({ ok: false, error: 'upstream returned empty body', status: upstream.status }, 502);
      if (!parsed) return json({ ok: false, error: 'upstream returned non-JSON', preview: raw, status: upstream.status }, 502);
      return json(parsed, parsed.ok ? 200 : 404);
    } catch (e) {
      return json({ ok: false, error: 'upstream fetch failed: ' + (e.message || String(e)) }, 502);
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
      // Apps Script: POST → 302 → GET /usercontent (response is pre-computed
      // server-side from the POST body, so default redirect:follow is correct).
      const upstream = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'create_share', source, name, state }),
      });
      const { parsed, raw, empty } = await readResponseSafely(upstream);
      if (empty) return json({ ok: false, error: 'upstream returned empty body', status: upstream.status }, 502);
      if (!parsed) return json({ ok: false, error: 'upstream returned non-JSON', preview: raw, status: upstream.status }, 502);
      return json(parsed, parsed.ok ? 200 : 500);
    } catch (e) {
      return json({ ok: false, error: 'upstream fetch failed: ' + (e.message || String(e)) }, 502);
    }
  }

  return json({ ok: false, error: 'method not allowed' }, 405);
}
