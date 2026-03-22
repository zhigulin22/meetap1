-- Admin metrics lab + simulation support

alter table public.users add column if not exists message_limited boolean not null default false;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_seed_runs (
  id uuid primary key default gen_random_uuid(),
  run_by uuid references public.users(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_stats_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,
  dau boolean not null default false,
  posts int not null default 0,
  event_views int not null default 0,
  event_joins int not null default 0,
  connects_sent int not null default 0,
  connects_replied int not null default 0,
  msgs_sent int not null default 0,
  endorsements_received int not null default 0,
  reports_received int not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, day)
);

create index if not exists idx_admin_audit_log_created on public.admin_audit_log(created_at desc);
create index if not exists idx_demo_seed_runs_created on public.demo_seed_runs(created_at desc);
create index if not exists idx_user_stats_daily_day on public.user_stats_daily(day desc);
create index if not exists idx_user_stats_daily_user_day on public.user_stats_daily(user_id, day desc);

alter table public.admin_audit_log enable row level security;
alter table public.demo_seed_runs enable row level security;
alter table public.user_stats_daily enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='admin_audit_log' and policyname='admin audit access') then
    create policy "admin audit access" on public.admin_audit_log for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='demo_seed_runs' and policyname='admin seed runs access') then
    create policy "admin seed runs access" on public.demo_seed_runs for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_stats_daily' and policyname='admin user stats access') then
    create policy "admin user stats access" on public.user_stats_daily for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
end $$;
