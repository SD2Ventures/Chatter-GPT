
# chatter-live (REAL data, ready to launch)

Serverless API for **highest chatter** on **stocks** and **crypto** using **Reddit** (real data) + optional SEC poller.
Perfect for a **Shareable GPT** with Actions. Deploys on **Vercel**, stores state in **Neon Postgres**.

---

## 0) What you’ll get

- `/api/top` — highest chatter list (stocks or crypto)
- `/api/explain` — explain why a symbol ranked high (signals + evidence links)
- Cron jobs (every minute) that ingest Reddit posts from your target subreddits
- One-time `/api/admin/init` to create tables
- Ready OpenAPI snippet for GPT Actions

> Chatter is computed from **new cashtag mentions** per minute vs a rolling EMA baseline. Evidence are permalinks to real Reddit posts.

---

## 1) Create your cloud resources (no local installs)

### A. Neon Postgres (database)
1. Go to **https://neon.tech** → Create a project.
2. Copy the **connection string** (starts with `postgres://`).
3. You will paste this as `DATABASE_URL` in Vercel.

### B. Reddit API (real data)
1. Go to **https://www.reddit.com/prefs/apps** → “Create App” → type: **script**.
2. Note your **client_id** and **client_secret**.
3. Set `REDDIT_USERNAME`, `REDDIT_PASSWORD` for the server to use (password grant).
4. Use a descriptive **User-Agent** (e.g., `chatter-live/1.0 by you`).

### C. Vercel (hosting + cron)
1. Create a **New Project** in Vercel and import this repo.
2. `vercel.json` includes cron schedules for Reddit + SEC (stub).

---

## 2) Environment variables (Vercel → Project → Settings → Environment Variables)

Required:
- `DATABASE_URL` = from Neon (include SSL params)
- `REDDIT_CLIENT_ID`
- `REDDIT_SECRET`
- `REDDIT_USERNAME`
- `REDDIT_PASSWORD`
- `REDDIT_USER_AGENT` = `chatter-live/1.0 by you`
- `ADMIN_INIT_TOKEN` =

Optional (sensible defaults):
- `SUBS_STOCKS` = `stocks+wallstreetbets+investing`
- `SUBS_CRYPTO` = `cryptocurrency+bitcoin+ethfinance+solana`
- `EMA_ALPHA` = `0.2`
- `SEC_UA` = `chatter-live/1.0 (your-email@example.com)`

---

## 3) Deploy + initialize the database

1. **Deploy** on Vercel (Production).
2. Hit the one-time initializer:
   ```
   https://YOUR-PROJECT.vercel.app/api/admin/init?token=
   ```
   You should see:
   ```json
   { "ok": true, "msg": "Schema created/verified" }
   ```

---

## 4) Verify ingestion & endpoints

- Cron calls (every minute): `/api/cron/reddit?domain=stocks`, `/api/cron/reddit?domain=crypto`  
- Check in Vercel → Functions logs. In 1–3 minutes you should have data.

Endpoints to test:
- `GET /api/top?domain=stocks&window_min=60`
- `GET /api/top?domain=crypto&window_min=60`
- `GET /api/explain?domain=stocks&symbol=NVDA`
- `GET /api/explain?domain=crypto&symbol=BTC`

---

## 5) GPT Actions (OpenAPI to paste into GPT Builder)

```yaml
openapi: 3.1.0
info:
  title: Chatter Live API
  version: "1.0"
servers:
  - url: https://YOUR-PROJECT.vercel.app
paths:
  /api/top:
    get:
      summary: Get highest chatter rankings
      description: Returns top items by chatter score for a domain (stocks or crypto) within a window.
      parameters:
        - in: query
          name: domain
          required: true
          schema: {{ type: string, enum: [stocks, crypto] }}
        - in: query
          name: window_min
          required: false
          schema: {{ type: integer, default: 60, minimum: 5, maximum: 1440 }}
      responses: {{ "200": {{ "description": "OK" }} }}
  /api/explain:
    get:
      summary: Explain a symbol's chatter ranking
      parameters:
        - in: query
          name: domain
          required: true
          schema: {{ type: string, enum: [stocks, crypto] }}
        - in: query
          name: symbol
          required: true
          schema: {{ type: string, minLength: 1, maxLength: 10 }}
      responses: {{ "200": {{ "description": "OK" }} }}
components: {{}}
```

**GPT Instructions (paste into GPT → Configure → Instructions):**
> **Role**: You are **Chatter Live** — find the highest chatter in **stocks** or **crypto** and show the proof.  
> **Behavior**:  
> 1) For “highest chatter…”, call **/api/top** with `domain` (infer; default stocks) and `window_min=30` unless specified.  
> 2) Present a short ranked list (3–8): **Rank. Ticker — Score** · one-sentence reason · **time (CT)** · evidence links.  
> 3) For “why $SYMBOL?”, call **/api/explain** and show signals + last_seen + evidence links.  
> 4) If empty, suggest wider window (120 min) or switching domains.  
> 5) One screen. Add: *“Informational only, not investment advice.”*  
> **Formatting**: bold tickers; convert times to **America/Chicago**.  
> **Safety**: never invent symbols or scores; only show what Actions return.

---

## 6) Notes
- Reddit rate limits apply; keep a descriptive user agent.  
- This starter reads **posts** (titles/body). You can extend it to comments similarly.  
- SEC cron is a **stub**; extend it to parse Atom + map tickers for event boosts.
