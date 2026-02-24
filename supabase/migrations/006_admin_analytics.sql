alter table public.users add column if not exists role text not null default 'user';
alter table public.users add column if not exists is_blocked boolean not null default false;
alter table public.users add column if not exists blocked_reason text;
alter table public.users add column if not exists blocked_until timestamptz;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  path text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_event_name on public.analytics_events(event_name, created_at desc);
create index if not exists idx_analytics_user on public.analytics_events(user_id, created_at desc);

create table if not exists public.user_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null,
  severity text not null default 'medium',
  reason text not null,
  evidence text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_user_flags_user on public.user_flags(user_id, created_at desc);
create index if not exists idx_user_flags_status on public.user_flags(status, created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_target on public.moderation_actions(target_user_id, created_at desc);

alter table public.analytics_events enable row level security;
alter table public.user_flags enable row level security;
alter table public.moderation_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='analytics_events' and policyname='public read analytics_events'
  ) then
    create policy "public read analytics_events" on public.analytics_events for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_flags' and policyname='public read user_flags'
  ) then
    create policy "public read user_flags" on public.user_flags for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='moderation_actions' and policyname='public read moderation_actions'
  ) then
    create policy "public read moderation_actions" on public.moderation_actions for select using (true);
  end if;
end $$;

-- если админов еще нет, делаем первого пользователя админом
with first_user as (
  select id
  from public.users
  order by created_at asc
  limit 1
)
update public.users
set role = 'admin'
where id in (select id from first_user)
  and not exists (select 1 from public.users u where u.role = 'admin');
