export const config = { runtime: 'edge' };

const BOT_UA = /bot|crawler|spider|crawling|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|preview|curl|wget|python-requests|axios|node-fetch|httpie|postman/i;
const SAFE_URL = /^https?:\/\//i;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shell(key, logUrl) {
  const keyJ = JSON.stringify(key);
  const keySafe = esc(key);
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
  .dest{font-family:'DM Mono',monospace;font-size:13px;color:#7df0b8;word-break:break-all;margin:12px 0 22px;padding:10px 12px;background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.18);border-radius:10px;min-height:38px;display:flex;align-items:center;justify-content:center;transition:opacity .25s}
  .dest.loading{color:#9aa;background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.08)}
  .dots::after{content:'';animation:dots 1.2s steps(4,end) infinite}
  @keyframes dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
  .ring{position:relative;width:84px;height:84px;margin:6px auto 18px}
  .ring svg{transform:rotate(-90deg)}
  .ring circle{fill:none;stroke-width:6}
  .ring .bg{stroke:rgba(255,255,255,.08)}
  .ring .fg{stroke:#00ff88;stroke-linecap:round;stroke-dasharray:226;stroke-dashoffset:226;transition:stroke-dashoffset 1s linear}
  .count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;font-family:'DM Mono',monospace}
  .skip{appearance:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#fff;font:600 13px 'Outfit',sans-serif;padding:10px 18px;border-radius:999px;cursor:pointer;transition:all .2s}
  .skip:hover:not(:disabled){background:rgba(0,255,136,.12);border-color:rgba(0,255,136,.4);color:#7df0b8}
  .skip:disabled{opacity:.4;cursor:not-allowed}
  .ad{margin-top:24px;min-height:90px;display:flex;align-items:center;justify-content:center;color:#556;font-size:11px;border:1px dashed rgba(255,255,255,.08);border-radius:10px}
  .foot{margin-top:18px;font-size:11px;color:#667}
  .foot a{color:#9aa;text-decoration:none}
  .foot a:hover{color:#7df0b8}
</style>
</head><body>
<main class="card">
  <div class="brand">Datapad · Short Link</div>
  <h1>Taking you to</h1>
  <div class="dest loading" id="dest"><span class="dots">Resolving</span></div>
  <div class="ring">
    <svg width="84" height="84"><circle class="bg" cx="42" cy="42" r="36"/><circle class="fg" id="ring" cx="42" cy="42" r="36"/></svg>
    <div class="count" id="count">3</div>
  </div>
  <button class="skip" id="skip" type="button" disabled>Skip ahead →</button>
  <div class="ad" id="ad-slot" aria-hidden="true">Ad slot</div>
  <div class="foot">Powered by <a href="/">datapad.in</a> · Free URL shortener</div>
</main>
<script>
(function(){
  var key=${keyJ}, logUrl=${logJ};
  var ring=document.getElementById('ring'), count=document.getElementById('count');
  var destEl=document.getElementById('dest'), skipBtn=document.getElementById('skip');
  var C=226, total=3, left=total, countdownDone=false, dest=null;
  function tick(){
    count.textContent=Math.max(0,left);
    ring.style.strokeDashoffset=(C*(total-Math.max(0,left))/total);
    if(left<=0){ countdownDone=true; maybeGo(); return; }
    left--; setTimeout(tick,1000);
  }
  function maybeGo(){ if(countdownDone && dest){ window.location.replace(dest); } }
  function go(){ if(dest){ window.location.replace(dest); } }
  function fail(){ window.location.replace('/go/404.html?k=' + encodeURIComponent(key)); }
  skipBtn.addEventListener('click',go);
  fetch('/api/resolve?key=' + encodeURIComponent(key), { cache: 'no-store' })
    .then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(j){
      if(!j || !j.url){ fail(); return; }
      dest=j.url;
      try{ var h=new URL(j.url).host; destEl.textContent=h; }catch(e){ destEl.textContent=j.url; }
      destEl.classList.remove('loading');
      skipBtn.disabled=false;
      if(logUrl){
        try{
          var payload=new Blob([JSON.stringify({key:key,ref:document.referrer||'',ua:navigator.userAgent,ts:Date.now()})],{type:'application/json'});
          navigator.sendBeacon(logUrl,payload);
        }catch(e){}
      }
      maybeGo();
    })
    .catch(function(){ fail(); });
  tick();
})();
</script>
</body></html>`;
}

async function fetchMap(apiUrl) {
  const res = await fetch(apiUrl, { cf: { cacheTtl: 60 }, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Sheet API ${res.status}`);
  return res.json();
}

export default async function handler(req) {
  const url = new URL(req.url);
  const key = (url.searchParams.get('key') || '').trim();
  const logUrl = process.env.SHEETS_LOG_URL || '';

  if (!key) {
    return Response.redirect(new URL('/go/404.html', req.url), 302);
  }

  const ua = req.headers.get('user-agent') || '';
  const isBot = BOT_UA.test(ua);

  if (isBot) {
    const apiUrl = process.env.SHEETS_API_URL;
    if (!apiUrl) return new Response('SHEETS_API_URL not configured', { status: 500 });
    try {
      const map = await fetchMap(apiUrl);
      const dest = map && map[key];
      if (!dest || !SAFE_URL.test(dest)) {
        return Response.redirect(new URL('/go/404.html?k=' + encodeURIComponent(key), req.url), 302);
      }
      return new Response(null, {
        status: 302,
        headers: { location: dest, 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' },
      });
    } catch {
      return new Response('Upstream sheet unavailable', { status: 502 });
    }
  }

  return new Response(shell(key, logUrl), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
