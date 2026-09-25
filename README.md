# Trading Research Agent — GitHub + Vercel + Supabase

Personal crypto/memecoin research agent. It uses live DexScreener data, OpenAI web research and a Supabase research journal. It does **not** place trades.

## Architecture

Browser → Next.js on Vercel → DexScreener + OpenAI → Supabase

- **GitHub**: source control
- **Vercel**: Next.js app + server API routes
- **Supabase**: persistent analysis/history database
- **OpenAI**: reasoning + live web research
- **DexScreener**: DEX market data

## 1. Put it on GitHub

Create a blank GitHub repository, then from this folder:

```bash
git init
git add .
git commit -m "Initial trading research agent"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/trading-research-agent.git
git push -u origin main
```

If you cannot use a terminal, create the repo on github.com and use **Add file → Upload files**.

## 2. Create Supabase

Create a Supabase project. Open **SQL Editor**, paste `supabase/migrations/001_initial.sql`, then Run.

Get these values from the Supabase project settings/connect dialog:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service role key in browser code or prefix it with `NEXT_PUBLIC_`.

## 3. Deploy on Vercel

1. In Vercel choose **Add New → Project**.
2. Import the GitHub repository.
3. Add Environment Variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` = `gpt-5.5`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy.

Vercel automatically detects Next.js.

## 4. Local development (optional)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open `http://localhost:3000`.

## Security

- API keys stay server-side.
- Supabase RLS is enabled with no public policies.
- Never commit `.env.local`.
- No exchange keys are needed in this version.
- Keep real-money execution disabled until the research system has a measurable paper-trading track record.

## Next build steps

1. `paper_trades` table with exact simulated entry, stop, targets and outcome.
2. Automated price snapshots so we can calculate MFE/MAE and true PnL.
3. Scanner for new/migrated Solana pairs rather than manual token input.
4. X/social signal ingestion.
5. On-chain risk module: top holders, mint/freeze authority, wallet clusters and dev wallets.
6. Opportunity feed + filters + alerts.
7. User auth if the dashboard ever becomes multi-user.
