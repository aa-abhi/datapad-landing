export const config = { runtime: 'edge' };

const SAFE_URL = /^https?:\/\//i;

async function fetchMap(apiUrl) {
  const res = await fetch(apiUrl, { cf: { cacheTtl: 60 }, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Sheet API ${res.status}`);
  return res.json();
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200
        ? 'public, s-maxage=60, stale-while-revalidate=300'
        : 'public, s-maxage=30',
      ...(extra || {}),
    },
  });
}

export default async function handler(req) {
  const url = new URL(req.url);
  const key = (url.searchParams.get('key') || '').trim();
  if (!key) return json({ ok: false, error: 'missing key' }, 400);

  const apiUrl = process.env.SHEETS_API_URL;
  if (!apiUrl) return json({ ok: false, error: 'not configured' }, 500);

  let map;
  try {
    map = await fetchMap(apiUrl);
  } catch {
    return json({ ok: false, error: 'upstream' }, 502);
  }

  const dest = map && map[key];
  if (!dest || !SAFE_URL.test(dest)) return json({ ok: false, error: 'not found' }, 404);

  return json({ ok: true, url: dest }, 200);
}
