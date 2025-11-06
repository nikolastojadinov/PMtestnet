-- Durable job state tables (idempotent)
create table if not exists public.job_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.job_cursor (
  job_name text primary key,
  cursor jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists job_state_updated_at_idx on public.job_state(updated_at);
create index if not exists job_cursor_updated_at_idx on public.job_cursor(updated_at);
