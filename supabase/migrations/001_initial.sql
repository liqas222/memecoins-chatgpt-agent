create extension if not exists pgcrypto;

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  query text not null,
  report text not null,
  market_snapshot jsonb not null default '[]'::jsonb
);

create index if not exists analyses_created_at_idx on public.analyses(created_at desc);

alter table public.analyses enable row level security;
-- No public policies on purpose. The app accesses this table only through the
-- server-side service-role key stored as a Vercel environment variable.
