# Datapad URL Shortener — Deployment

Serverless short links at `datapad.in/go/<key>` powered by Vercel Edge + Google Sheets.

## Architecture

```
Browser → /go/<key>
   ↓ (Vercel rewrite)
/api/go?key=<key>  ← Edge Function (api/go.js)
   ↓ fetches map (cached 60s at edge)
Apps Script Web App (doGet) → Google Sheet "links" tab
   ↓
Bot UA → 302 to destination
Browser → interstitial HTML (3s countdown + ad slot + skip)
   ↓ sendBeacon to Apps Script (doPost) → "clicks" tab
```

## One-time setup (per environment)

You need **two Sheets** — one for Preview, one for Production.

### 1. Create the Google Sheet

Add a tab named `links` with this header row:

| key     | destination_url        | active | created_at |
| ------- | ---------------------- | ------ | ---------- |
| abc123  | https://example.com    | TRUE   | 2026-05-20 |

The `clicks` tab is auto-created on first click.

### 2. Deploy the Apps Script

1. In the Sheet: **Extensions → Apps Script**
2. Paste contents of [`apps-script/Code.gs`](../apps-script/Code.gs)
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the deployment URL (looks like `https://script.google.com/macros/s/.../exec`)

Repeat for the second (Production) sheet.

### 3. Configure Vercel env vars

In Vercel project settings → Environment Variables:

| Name              | Preview value                  | Production value               |
| ----------------- | ------------------------------ | ------------------------------ |
| `SHEETS_API_URL`  | Preview Apps Script `/exec`    | Prod Apps Script `/exec`       |
| `SHEETS_LOG_URL`  | Same as above (or separate)    | Same as above (or separate)    |

`SHEETS_LOG_URL` is optional — if blank, click tracking is silently skipped.

### 4. Deploy

```bash
git add api/ go/ apps-script/ vercel.json
git commit -m "feat(go): serverless URL shortener"
git push
```

Vercel builds and exposes `/go/:key`.

## Adding a link

1. Open the Sheet
2. Add a row: `mylink | https://destination.com | TRUE | 2026-05-20`
3. Wait up to 60s (edge cache) — or hard-refresh `/go/mylink`

## How redirects work

- **Real browsers** see a 3-second branded interstitial with a "Skip ahead" button (ad slot reserved on the page).
- **Bots/crawlers** (`facebookexternalhit`, `slackbot`, `curl`, etc.) get a clean 302 so social unfurls and link checkers keep working.
- **Invalid/inactive keys** → `/go/404.html` styled in Datapad's theme.

## Caching

- Edge cache: 60s (`s-maxage=60`, `stale-while-revalidate=300`)
- Apps Script cache: 50s (avoids stale-chain on edge refresh)
- Sheet change → live within ~60s

## Click tracking

Each interstitial fires `navigator.sendBeacon` to `SHEETS_LOG_URL` with `{key, ref, ua, ts}`. Apps Script appends to the `clicks` tab.

**Quota note**: Apps Script free tier allows ~20k writes/day. If a link goes viral, some clicks will silently drop — acceptable for MVP.

## Limitations

- Sheet API latency dominates cold requests (~1–2s); the 60s edge cache absorbs this for warm traffic.
- Apps Script web apps need to be redeployed (new deployment URL) if you edit the script — or use "Manage deployments → edit → version: New" to keep the same URL.
- No collision detection on key entry — Sheet's data validation can enforce it if needed.
