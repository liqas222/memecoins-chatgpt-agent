-- Scanner storage.
--
-- Snapshots, risk assessments and scores are APPEND-ONLY. We need to know what
-- the system believed at the moment it believed it, not only its latest
-- opinion — otherwise no signal can ever be evaluated after the fact.
--
-- Dead and failed tokens are never deleted. Removing them would leave a
-- dataset of survivors only, and every statistic computed from it would be
-- wrong in the same optimistic direction.

create extension if not exists pgcrypto;

-- ── Tokens: one row per contract, updated in place ────────────────────────
create table if not exists public.tokens (
  id               text primary key,          -- "solana:<contract>"
  chain            text not null default 'solana',
  contract         text not null,
  symbol           text,
  name             text,
  pair_address     text,
  dex              text,
  pair_created_at  timestamptz,
  discovered_at    timestamptz not null default now(),
  discovery_source text not null,
  image_url        text,
  website          text,
  twitter          text,
  telegram         text,
  unique (chain, contract)
);

create index if not exists tokens_discovered_idx on public.tokens(discovered_at desc);
create index if not exists tokens_contract_idx   on public.tokens(contract);
create index if not exists tokens_chain_idx      on public.tokens(chain);

-- ── Market snapshots: the time series ─────────────────────────────────────
create table if not exists public.token_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  token_id            text not null references public.tokens(id) on delete cascade,
  captured_at         timestamptz not null default now(),
  source              text not null,
  price_usd           double precision,
  market_cap          double precision,
  fdv                 double precision,
  liquidity_usd       double precision,
  volume_m5           double precision,
  volume_h1           double precision,
  volume_h6           double precision,
  volume_h24          double precision,
  change_m5_pct       double precision,
  change_h1_pct       double precision,
  change_h6_pct       double precision,
  change_h24_pct      double precision,
  buys_h1             integer,
  sells_h1            integer,
  buys_h24            integer,
  sells_h24           integer,
  txns_h1             integer,
  txns_h24            integer,
  pair_age_hours      double precision,
  volume_to_liquidity double precision,
  liquidity_to_mcap   double precision,
  buy_ratio_h1        double precision
);

create index if not exists snapshots_token_time_idx on public.token_snapshots(token_id, captured_at desc);

-- ── Risk assessments ──────────────────────────────────────────────────────
create table if not exists public.risk_assessments (
  id                 uuid primary key default gen_random_uuid(),
  token_id           text not null references public.tokens(id) on delete cascade,
  assessed_at        timestamptz not null default now(),
  risk_score         integer not null,
  flags              jsonb not null default '[]'::jsonb,
  unavailable_checks jsonb not null default '[]'::jsonb
);

create index if not exists risk_token_time_idx on public.risk_assessments(token_id, assessed_at desc);

-- ── Score history: the whole point of the exercise ────────────────────────
create table if not exists public.score_history (
  id              uuid primary key default gen_random_uuid(),
  token_id        text not null references public.tokens(id) on delete cascade,
  scored_at       timestamptz not null default now(),
  overall_score   integer not null,
  components      jsonb not null,
  missing_inputs  jsonb not null default '[]'::jsonb,
  weights_version text not null
);

create index if not exists score_token_time_idx on public.score_history(token_id, scored_at desc);
create index if not exists score_overall_idx    on public.score_history(overall_score desc);
create index if not exists score_weights_idx    on public.score_history(weights_version);

-- ── Scanner runs: the log ─────────────────────────────────────────────────
create table if not exists public.scanner_runs (
  id                  text primary key,
  started_at          timestamptz not null,
  finished_at         timestamptz not null,
  duration_ms         integer not null,
  discovered          integer not null default 0,
  deduplicated        integer not null default 0,
  rejected_by_filters integer not null default 0,
  enriched            integer not null default 0,
  scored              integer not null default 0,
  opportunities       integer not null default 0,
  ai_researched       integer not null default 0,
  paper_trades_opened integer not null default 0,
  errors              jsonb not null default '[]'::jsonb,
  storage_mode        text not null default 'supabase'
);

create index if not exists runs_started_idx on public.scanner_runs(started_at desc);

-- ── Tracked X accounts: filled in phase 4, table exists now ───────────────
create table if not exists public.tracked_social_accounts (
  id         uuid primary key default gen_random_uuid(),
  platform   text not null default 'x',
  handle     text not null,
  weight     double precision not null default 1.0,
  note       text,
  added_at   timestamptz not null default now(),
  unique (platform, handle)
);

-- Row level security on, no public policies. Everything reaches these tables
-- through the server-side service-role key, never from the browser.
alter table public.tokens                  enable row level security;
alter table public.token_snapshots         enable row level security;
alter table public.risk_assessments        enable row level security;
alter table public.score_history           enable row level security;
alter table public.scanner_runs            enable row level security;
alter table public.tracked_social_accounts enable row level security;
