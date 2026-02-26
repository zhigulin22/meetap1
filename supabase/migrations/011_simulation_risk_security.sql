-- Simulation engine + risk signals

create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'stopped' check (status in ('running','stopped')),
  users_count int not null default 40,
  interval_sec int not null default 8,
  mode text not null default 'normal' check (mode in ('normal','chaos')),
  intensity text not null default 'normal' check (intensity in ('low','normal','high')),
  total_events_generated bigint not null default 0,
  recent_actions jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  stopped_at timestamptz,
  last_tick_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simulation_users (
  id uuid primary key default gen_random_uuid(),
  sim_run_id uuid not null references public.simulation_runs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  persona jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(sim_run_id, user_id)
);

create table if not exists public.risk_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  signal_key text not null,
  value numeric not null default 0,
  severity int not null default 1,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_simulation_runs_status on public.simulation_runs(status, updated_at desc);
create index if not exists idx_simulation_users_run on public.simulation_users(sim_run_id, created_at desc);
create index if not exists idx_risk_signals_user on public.risk_signals(user_id, created_at desc);
create index if not exists idx_risk_signals_key on public.risk_signals(signal_key, created_at desc);

alter table public.simulation_runs enable row level security;
alter table public.simulation_users enable row level security;
alter table public.risk_signals enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='simulation_runs' and policyname='admin simulation runs access') then
    create policy "admin simulation runs access" on public.simulation_runs for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='simulation_users' and policyname='admin simulation users access') then
    create policy "admin simulation users access" on public.simulation_users for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='risk_signals' and policyname='admin risk signals access') then
    create policy "admin risk signals access" on public.risk_signals for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
end $$;
