# Memecoin Intelligence

An autonomous Solana memecoin research system. It discovers tokens by itself,
throws away the obvious garbage, scores what is left, and records what it
believed at the moment it believed it.

**It never trades.** There is no wallet, no signing, no execution path. Paper
trades are simulated positions used to measure whether the scoring is any good.

The score it produces is a **research ranking, not a prediction**. Whether an 85
actually performs better than a 65 is an open question — answering it is the
entire reason every score is stored with its inputs.

---

## What works today (phase 1)

- **Discovery** — finds live Solana pairs through DexScreener, including tokens
  currently buying visibility. No API key needed.
- **Market data** — price, market cap, FDV, liquidity, volume over 5m/1h/6h/24h,
  price change, buys vs sells, transaction counts, pair age, plus derived
  ratios (volume/liquidity, liquidity/market cap, buy share).
- **Deterministic filters** — liquidity, volume, transactions, market cap, age,
  turnover plausibility and sell pressure, all configurable in one file.
- **Risk engine** — structural risk checks with explicit flags and a 0-100 score.
- **Scoring engine** — a weighted 0-100 opportunity score with a full component
  breakdown, versioned so old scores stay interpretable.
- **Dashboard** — overview, sortable scanner, ranked opportunities, a per-token
  intelligence page and a settings view of the live configuration.
- **Scheduled scanning** — a Vercel cron entry every 15 minutes.
- **Runs without a database** — in limited mode, with a visible warning.

## What does not work yet

| Area | Phase |
|---|---|
| Paper trading and trade tracking | 2 |
| Performance analytics | 2 |
| Pump.fun launches and migrations | 3 |
| On-chain: holders, dev wallets, mint/freeze authority, LP status | 3 |
| X / social intelligence | 4 |
| AI research inside the scanner pipeline | 5 |
| Alerts (Telegram, Discord, email) | 5 |

Those categories contribute **zero points** to the score right now, and the UI
labels them as having no data source rather than quietly scoring them as zero.

---

## Setup

You do not need to install anything on your computer. Everything below happens
in a browser.

### 1. GitHub

The code is already in this repository. Nothing to do.

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**.
2. Import this repository.
3. Click **Deploy**. Add no environment variables yet.

It will deploy successfully with nothing configured. Open the URL: the
dashboard loads and shows an orange banner saying no database is configured.
That is expected.

### 3. Protect the scanner endpoint (do this early)

`/api/scan` hits several providers on every call. Without a secret, anyone who
finds the URL can trigger it.

1. Invent a long random string (e.g. from a password generator).
2. Vercel → Project → **Settings → Environment Variables**.
3. Add `CRON_SECRET` with that value.
4. **Redeploy** (Deployments → ⋯ → Redeploy). Environment variables only take
   effect on a new deployment.

Vercel Cron sends this automatically. The overview page shows whether the
endpoint is protected.

### 4. Persistent database (optional, needed for phases 2+)

Without it, the scanner works and the dashboard shows results, but nothing
survives — no history, no paper trades, no performance statistics.

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase/migrations/001_initial.sql`, click Run.
3. Do the same with `supabase/migrations/002_scanner.sql`.
4. From **Project Settings → API**, copy the project URL and the
   **service_role** key.
5. Add both in Vercel as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
6. Redeploy.

The banner turns green once it connects.

> The service role key bypasses all row-level security. It is only ever read on
> the server. Never put it in a variable starting with `NEXT_PUBLIC_`.

### 5. AI research (optional)

Add `OPENAI_API_KEY`, and optionally `OPENAI_MODEL` (default `gpt-5.5`).
Without it everything else keeps working and the AI panel says the research is
unavailable.

### 6. On-chain and social (not used yet)

`HELIUS_API_KEY`, `BIRDEYE_API_KEY` and `X_BEARER_TOKEN` are read by the status
page so you can see what is connected, but nothing consumes them before phases
3 and 4. There is no reason to buy them yet.

---

## Verifying that it runs

1. Open `/scanner` and press **Run scan**. Within a few seconds the table fills
   and the header shows how many tokens were found, filtered and scored.
2. Below the table, **Why tokens were rejected** shows which rule removed how
   many. If almost everything is rejected, the filters in
   `lib/config/scanner.ts` are too tight for current market conditions.
3. Open `/` — "Last scan" should show a recent time.
4. For the scheduled run: Vercel → Project → **Cron Jobs** lists `/api/scan`
   with its last execution. Vercel's Hobby plan runs crons roughly daily; a
   paid plan is needed for the 15-minute schedule in `vercel.json`.

## Troubleshooting

**The dashboard is empty and "Run scan" finds nothing.**
DexScreener may be rate limiting. Wait a minute and try again. The scan report
lists any provider errors.

**Everything gets rejected by the filters.**
Open `/settings` to see the live thresholds, then loosen them in
`lib/config/scanner.ts` and redeploy. `minLiquidityUsd` and `minVolumeH24Usd`
are the two that matter most.

**Scores never go above 65.**
Expected. Three of six scoring categories have no data source until phases 3
and 4, and risk deductions apply on top. A high score should be rare.

**"Persistent database not configured" will not go away.**
Both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set, and you must
redeploy afterwards.

**The AI panel says research is unavailable.**
`OPENAI_API_KEY` is missing, out of credits, or the model name in
`OPENAI_MODEL` does not exist for your account.

**A cron run returns 401.**
`CRON_SECRET` was changed without redeploying, or it was set for the wrong
environment (it must exist for Production).

---

## Architecture

```
app/                     Next.js routes — pages and API
  api/scan               one scanner pass (cron-protected)
  api/tokens             stored tokens, scans on demand when empty
  api/token/[contract]   full intelligence for one token
  api/status             storage mode, last run, provider status
  api/analyze            free-text single-token research (original feature)
components/              dashboard UI
lib/
  config/scanner.ts      every threshold and weight, in one place
  providers/             one file per external API, all behind interfaces
    http.ts              retries, timeouts, per-host rate limiting
    dexscreener.ts       discovery + market data (no key needed)
    openai.ts            AI research (optional)
  engine/
    filters.ts           cheap deterministic rejection
    risk.ts              structural risk checks
    scoring.ts           weighted opportunity score
    scan.ts              orchestrates one run
  db/                    storage abstraction: supabase | in-memory
supabase/migrations/     schema
```

### Principles the code actually follows

**Data first, AI second.** The model never produces a number. It receives what
the deterministic services collected and is told explicitly not to add to it.

**Missing is not zero.** A token with no holder count is `null`, never `0`.
Filters never reject on missing data, because that would silently bias the
dataset toward tokens whose data happened to load.

**Cheap before expensive.** Hundreds of candidates go through free filters,
dozens through risk and scoring, and only a handful would ever reach the AI.

**Timestamp everything.** Snapshots, risk assessments and scores are
append-only, so a signal can be evaluated against what was knowable at the time
rather than what is known now.

**Graceful failure.** One dead provider is logged and skipped. It does not stop
a scan, and it does not take down the dashboard.

---

## Not financial advice

This is a research tool. It produces rankings from public market data, and
those rankings are unvalidated. Memecoins routinely go to zero.
