alter table public.users add column if not exists is_demo boolean not null default false;
alter table public.users add column if not exists demo_group text;

create index if not exists idx_users_is_demo on public.users(is_demo, created_at desc);
create index if not exists idx_users_demo_group on public.users(demo_group, is_demo, created_at desc);

create table if not exists public.qa_bot_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'stopped',
  users_count int not null default 30,
  interval_sec int not null default 8,
  mode text not null default 'normal',
  requested_by uuid,
  started_at timestamptz,
  stopped_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.qa_bot_heartbeats (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.qa_bot_runs(id) on delete cascade,
  active_bots int not null default 0,
  actions jsonb not null default '[]'::jsonb,
  events_written int not null default 0,
  last_event_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_qa_bot_runs_updated on public.qa_bot_runs(updated_at desc);
create index if not exists idx_qa_bot_heartbeats_run on public.qa_bot_heartbeats(run_id, created_at desc);

alter table public.qa_bot_runs enable row level security;
alter table public.qa_bot_heartbeats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='qa_bot_runs' and policyname='admin qa bot runs'
  ) then
    create policy "admin qa bot runs"
      on public.qa_bot_runs
      for all
      using (public.is_admin_role())
      with check (public.is_admin_role());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='qa_bot_heartbeats' and policyname='admin qa bot heartbeats'
  ) then
    create policy "admin qa bot heartbeats"
      on public.qa_bot_heartbeats
      for all
      using (public.is_admin_role())
      with check (public.is_admin_role());
  end if;
end $$;
