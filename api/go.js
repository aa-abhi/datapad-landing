export const config = { runtime: 'edge' };

const BOT_UA = /bot|crawler|spider|crawling|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|preview|curl|wget|python-requests|axios|node-fetch|httpie|postman/i;

const SAFE_URL = /^https?:\/\//i;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function fetchMap(apiUrl) {
  const res = await fetch(apiUrl, {
    cf: { cacheTtl: 60 },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Sheet API ${res.status}`);
  return res.json();
}

function notFound(key) {
  const body = `<!doctype html><meta charset="utf-8"><title>Link not found</title>
<meta http-equiv="refresh" content="3;url=/go/404.html">
<script>location.replace('/go/404.html?k=${encodeURIComponent(key)}');</script>
<p>Link not found. Redirecting…</p>`;
  return new Response(body, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function interstitial(key, dest, logUrl) {
  const destSafe = esc(dest);
  const destHost = (() => { try { return esc(new URL(dest).host); } catch { return destSafe; } })();
  const keyJ = JSON.stringify(key);
  const destJ = JSON.stringify(dest);
  const logJ = JSON.stringify(logUrl || '');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Redirecting… · Datapad</title>
<link rel="icon" href="/logo.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=DM+Mono:wght@500&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html,body{height:100%}
  body{font-family:'Outfit',system-ui,sans-serif;background:#050508;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:520px;width:100%;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:32px;text-align:center}
  .brand{font-size:13px;letter-spacing:.18em;color:#9aa;text-transform:uppercase;margin-bottom:18px}
  h1{font-size:22px;font-weight:600;margin-bottom:8px}
  .dest{font-family:'DM Mono',monospace;font-size:13px;color:#7df0b8;word-break:break-all;margin:12px 0 22px;padding:10px 12px;background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.18);border-radius:10px}
  .ring{position:relative;width:84px;height:84px;margin:6px auto 18px}
  .ring svg{transform:rotate(-90deg)}
  .ring circle{fill:none;stroke-width:6}
  .ring .bg{stroke:rgba(255,255,255,.08)}
  .ring .fg{stroke:#00ff88;stroke-linecap:round;stroke-dasharray:226;stroke-dashoffset:226;transition:stroke-dashoffset 1s linear}
  .count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;font-family:'DM Mono',monospace}
  .skip{appearance:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#fff;font:600 13px 'Outfit',sans-serif;padding:10px 18px;border-radius:999px;cursor:pointer;transition:all .2s}
  .skip:hover{background:rgba(0,255,136,.12);border-color:rgba(0,255,136,.4);color:#7df0b8}
  .ad{margin-top:24px;min-height:90px;display:flex;align-items:center;justify-content:center;color:#556;font-size:11px;border:1px dashed rgba(255,255,255,.08);border-radius:10px}
  .foot{margin-top:18px;font-size:11px;color:#667}
  .foot a{color:#9aa;text-decoration:none}
  .foot a:hover{color:#7df0b8}
</style>
</head><body>
<main class="card">
  <div class="brand">Datapad · Short Link</div>
  <h1>Taking you to</h1>
  <div class="dest" id="dest">${destHost}</div>
  <div class="ring">
    <svg width="84" height="84"><circle class="bg" cx="42" cy="42" r="36"/><circle class="fg" id="ring" cx="42" cy="42" r="36"/></svg>
    <div class="count" id="count">3</div>
  </div>
  <button class="skip" id="skip" type="button">Skip ahead →</button>
  <div class="ad" id="ad-slot" aria-hidden="true">Ad slot</div>
  <div class="foot">Powered by <a href="/">datapad.in</a> · Free URL shortener</div>
</main>
<script>
(function(){
  var key=${keyJ}, dest=${destJ}, logUrl=${logJ};
  var ring=document.getElementById('ring'), count=document.getElementById('count');
  var C=226, total=3, left=total;
  function tick(){
    count.textContent=left;
    ring.style.strokeDashoffset=(C*(total-left)/total);
    if(left<=0){ go(); return; }
    left--; setTimeout(tick,1000);
  }
  function go(){ window.location.replace(dest); }
  document.getElementById('skip').addEventListener('click',go);
  if(logUrl){
    try{
      var payload=new Blob([JSON.stringify({key:key,ref:document.referrer||'',ua:navigator.userAgent,ts:Date.now()})],{type:'application/json'});
      navigator.sendBeacon(logUrl,payload);
    }catch(e){}
  }
  tick();
})();
</script>
</body></html>`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const key = (url.searchParams.get('key') || '').trim();
  const apiUrl = process.env.SHEETS_API_URL;
  const logUrl = process.env.SHEETS_LOG_URL || '';

  if (!key) return notFound('');
  if (!apiUrl) {
    return new Response('SHEETS_API_URL not configured', { status: 500 });
  }

  let map;
  try {
    map = await fetchMap(apiUrl);
  } catch {
    return new Response('Upstream sheet unavailable', { status: 502, headers: { 'cache-control': 'no-store' } });
  }

  const dest = map && map[key];
  if (!dest || !SAFE_URL.test(dest)) return notFound(key);

  const ua = req.headers.get('user-agent') || '';
  const isBot = BOT_UA.test(ua);

  const headers = {
    'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
  };

  if (isBot) {
    return new Response(null, { status: 302, headers: { ...headers, location: dest } });
  }

  return new Response(interstitial(key, dest, logUrl), {
    status: 200,
    headers: { ...headers, 'content-type': 'text/html; charset=utf-8' },
  });
}
