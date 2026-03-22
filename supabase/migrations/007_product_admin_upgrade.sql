alter table public.users add column if not exists bio text;
alter table public.users add column if not exists country text;
alter table public.users add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists privacy_settings jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists notification_settings jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists profile_completed boolean not null default false;
alter table public.users add column if not exists shadow_banned boolean not null default false;
alter table public.users add column if not exists deleted_at timestamptz;

alter table public.posts add column if not exists risk_score int not null default 0;
alter table public.posts add column if not exists moderation_status text not null default 'clean';
alter table public.posts add column if not exists removed_at timestamptz;
alter table public.posts add column if not exists removed_reason text;

alter table public.events add column if not exists risk_score int not null default 0;
alter table public.events add column if not exists moderation_status text not null default 'clean';
alter table public.events add column if not exists removed_at timestamptz;

alter table public.comments add column if not exists risk_score int not null default 0;
alter table public.comments add column if not exists moderation_status text not null default 'clean';
alter table public.comments add column if not exists removed_at timestamptz;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  content_type text not null,
  content_id uuid,
  reason text not null,
  details text,
  status text not null default 'open',
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reports_status_created on public.reports(status, created_at desc);
create index if not exists idx_reports_content on public.reports(content_type, content_id);

create table if not exists public.content_flags (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  content_id uuid not null,
  user_id uuid references public.users(id) on delete set null,
  source text not null,
  reason text not null,
  risk_score int not null default 0,
  status text not null default 'open',
  ai_explanation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_content_flags_status on public.content_flags(status, created_at desc);
create index if not exists idx_content_flags_content on public.content_flags(content_type, content_id);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  description text,
  enabled boolean not null default false,
  rollout int not null default 100,
  scope text not null default 'global',
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.remote_configs (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;
alter table public.content_flags enable row level security;
alter table public.feature_flags enable row level security;
alter table public.remote_configs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='public read reports'
  ) then
    create policy "public read reports" on public.reports for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='content_flags' and policyname='public read content_flags'
  ) then
    create policy "public read content_flags" on public.content_flags for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='feature_flags' and policyname='public read feature_flags'
  ) then
    create policy "public read feature_flags" on public.feature_flags for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='remote_configs' and policyname='public read remote_configs'
  ) then
    create policy "public read remote_configs" on public.remote_configs for select using (true);
  end if;
end $$;

insert into public.feature_flags (key, description, enabled, rollout, scope)
values
  ('new_admin_shell', 'Новый desktop admin shell', true, 100, 'global'),
  ('ai_assistant_v2', 'Расширенный AI assistant в админке', true, 100, 'global'),
  ('reactive_moderation', 'Реактивная модерация с auto-flags', true, 100, 'global')
on conflict (key) do nothing;
