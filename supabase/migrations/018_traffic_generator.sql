create table if not exists public.traffic_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'stopped',
  users_count int not null default 30,
  interval_sec int not null default 5,
  intensity text not null default 'normal',
  chaos boolean not null default false,
  created_by uuid,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists is_demo boolean not null default false;
alter table public.users add column if not exists demo_group text;
alter table public.events add column if not exists is_demo boolean not null default false;
alter table public.events add column if not exists demo_group text;
alter table public.posts add column if not exists is_demo boolean not null default false;
alter table public.posts add column if not exists demo_group text;
alter table public.connections add column if not exists is_demo boolean not null default false;
alter table public.connections add column if not exists demo_group text;
alter table public.messages add column if not exists is_demo boolean not null default false;
alter table public.messages add column if not exists demo_group text;

create index if not exists idx_traffic_runs_status on public.traffic_runs(status, updated_at desc);
create index if not exists idx_users_demo_group_traffic on public.users(demo_group, is_demo, created_at desc);
create index if not exists idx_events_demo_group_traffic on public.events(demo_group, is_demo, created_at desc);
create index if not exists idx_posts_demo_group_traffic on public.posts(demo_group, is_demo, created_at desc);
create index if not exists idx_connections_demo_group_traffic on public.connections(demo_group, is_demo, created_at desc);
create index if not exists idx_messages_demo_group_traffic on public.messages(demo_group, is_demo, created_at desc);

alter table public.traffic_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='traffic_runs' and policyname='admin traffic runs'
  ) then
    create policy "admin traffic runs"
      on public.traffic_runs
      for all
      using (public.is_admin_role())
      with check (public.is_admin_role());
  end if;
end $$;
