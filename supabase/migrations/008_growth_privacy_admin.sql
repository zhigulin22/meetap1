create table if not exists public.user_privacy_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  show_phone boolean not null default false,
  show_facts boolean not null default true,
  show_badges boolean not null default true,
  show_last_active boolean not null default true,
  show_event_history boolean not null default true,
  show_city boolean not null default true,
  show_work boolean not null default true,
  show_university boolean not null default true,
  who_can_message text not null default 'verified',
  updated_at timestamptz not null default now()
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  variants jsonb not null default '{}'::jsonb,
  rollout_percent int not null default 0,
  start_at timestamptz,
  end_at timestamptz,
  primary_metric text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  metric text not null,
  threshold numeric not null,
  window text not null,
  status text not null default 'active',
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  title text not null,
  description text not null,
  category text not null,
  is_seasonal boolean not null default false,
  season_key text,
  icon text,
  rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  is_featured boolean not null default false,
  unique(user_id, badge_id)
);

create table if not exists public.event_endorsements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(event_id, from_user_id, to_user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_endorsements_to on public.event_endorsements(to_user_id, created_at desc);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_alerts_metric on public.alerts(metric, status);
create index if not exists idx_experiments_status on public.experiments(status);

alter table public.user_privacy_settings enable row level security;
alter table public.experiments enable row level security;
alter table public.alerts enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.event_endorsements enable row level security;
alter table public.notifications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_privacy_settings' and policyname='public read privacy settings') then
    create policy "public read privacy settings" on public.user_privacy_settings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='experiments' and policyname='public read experiments') then
    create policy "public read experiments" on public.experiments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alerts' and policyname='public read alerts') then
    create policy "public read alerts" on public.alerts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='badges' and policyname='public read badges') then
    create policy "public read badges" on public.badges for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_badges' and policyname='public read user_badges') then
    create policy "public read user_badges" on public.user_badges for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='event_endorsements' and policyname='public read event_endorsements') then
    create policy "public read event_endorsements" on public.event_endorsements for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='public read notifications') then
    create policy "public read notifications" on public.notifications for select using (true);
  end if;
end $$;

insert into public.badges (key, title, description, category, icon, rules)
values
  ('starter_profile', 'Профиль собран', 'Заполнены фото, интересы и 3 факта', 'Активность', 'sparkles', '{"profile_completed": true}'::jsonb),
  ('events_regular', 'Свой в событиях', 'Посетил 5 событий', 'Ивенты', 'calendar', '{"event_joins": 5}'::jsonb),
  ('trusted_after_events', 'Теплый контакт', 'Тебя отметили после событий 10 раз', 'Общение', 'thumbs-up', '{"endorsements": 10}'::jsonb),
  ('season_winter_community', 'Зимний комьюнити', 'Сезонный бейдж сообщества', 'Сезонные', 'snowflake', '{"season":"winter"}'::jsonb)
on conflict (key) do nothing;
