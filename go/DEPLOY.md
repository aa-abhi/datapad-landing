# Datapad URL Shortener — Deployment

Serverless short links at `datapad.in/go/<key>` powered by Vercel Edge + Google Sheets.

## Architecture

```
Browser → /go/<key>
   ↓ (Vercel rewrite)
/api/go?key=<key>  ← Edge Function
   ↓
Bot UA?
   ├─ Yes → fetch map → 302 to destination
   └─ No  → return interstitial HTML INSTANTLY (no Sheet call)
              ↓
            JS in page calls /api/resolve?key=<key>
              ↓ (cached 60s at edge)
            Apps Script doGet → "links" tab (filters by active + expires_at)
              ↓
            destination returned → countdown finishes → redirect
            sendBeacon → Apps Script doPost → "clicks" tab

Nightly: rollupDaily trigger → aggregates "clicks" into "daily_stats", purges old rows
```

## One-time setup (per environment)

You need **two Sheets** — one for Preview, one for Production.

### 1. Create the Google Sheet

Add a tab named `links` with this header row:

| key     | destination_url        | active | created_at | expires_at |
| ------- | ---------------------- | ------ | ---------- | ---------- |
| abc123  | https://example.com    | TRUE   | 2026-05-20 |            |
| docs    | https://docs.foo.com   | TRUE   | 2026-05-20 | permanent  |
| promo   | https://shop.foo.com   | TRUE   | 2026-05-20 | 2026-06-30 |

**`expires_at` rules:**
- blank → defaults to `created_at + 30 days`
- `permanent` or `never` → no expiry
- a date → use that date

The `clicks` and `daily_stats` tabs are auto-created.

### 2. Deploy the Apps Script

1. In the Sheet: **Extensions → Apps Script**
2. Paste contents of [`apps-script/Code.gs`](../apps-script/Code.gs)
3. In the editor, select function `setupTriggers` and click **Run** once (grant permissions). This installs the nightly roll-up trigger.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL (looks like `https://script.google.com/macros/s/.../exec`)

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

- **Real browsers** see the interstitial **instantly** (no Sheet wait). The page renders, then JS fetches the destination from `/api/resolve` in the background. Countdown runs in parallel; redirect happens when both finish.
- **Bots/crawlers** (`facebookexternalhit`, `slackbot`, `curl`, etc.) get a clean 302 so social unfurls and link checkers keep working.
- **Invalid/inactive/expired keys** → `/go/404.html` styled in Datapad's theme.

## Caching

- Interstitial HTML: cached 1h at edge (no per-key data in it)
- `/api/resolve` JSON: cached 60s at edge (`s-maxage=60`, `stale-while-revalidate=300`)
- Apps Script cache: 50s (avoids stale-chain on edge refresh)
- Sheet change → live within ~60s

## Expiry

- Default: links expire 30 days after `created_at`
- Set `expires_at = permanent` (or `never`) to disable expiry
- Set `expires_at` to a date to override the default
- Expired links are filtered out in Apps Script, so they immediately 404 (after cache refresh)

## Daily roll-up

A nightly trigger (`rollupDaily`, set up by `setupTriggers`) runs at ~01:00:

1. Aggregates yesterday's rows from `clicks` into `daily_stats` (date, key, clicks)
2. Purges rows from `clicks` older than 30 days

So `clicks` stays small (rolling 30-day raw log) and `daily_stats` is your long-term analytics surface.

## Click tracking

Each interstitial fires `navigator.sendBeacon` to `SHEETS_LOG_URL` with `{key, ref, ua, ts}`. Apps Script appends to the `clicks` tab.

**Quota note**: Apps Script free tier allows ~20k writes/day. If a link goes viral, some clicks will silently drop — acceptable for MVP.

## Limitations

- Sheet API latency dominates cold requests (~1–2s); the 60s edge cache absorbs this for warm traffic.
- Apps Script web apps need to be redeployed (new deployment URL) if you edit the script — or use "Manage deployments → edit → version: New" to keep the same URL.
- No collision detection on key entry — Sheet's data validation can enforce it if needed.
