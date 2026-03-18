-- Events import pipeline hardening: import jobs + resilient events schema + submissions safety.

create extension if not exists pgcrypto;

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null default 'running',
  requested_categories text[] not null default '{}',
  city text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  imported_count int not null default 0,
  seeded_count int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_jobs_status_started on public.import_jobs(status, started_at desc);
create index if not exists idx_import_jobs_source_started on public.import_jobs(source_name, started_at desc);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  outcomes text[] not null default '{}',
  cover_url text,
  event_date timestamptz not null default now(),
  price numeric not null default 0,
  city text,
  location text,
  created_at timestamptz not null default now()
);

alter table if exists public.events
  add column if not exists source_kind text not null default 'external',
  add column if not exists source_name text,
  add column if not exists external_event_id text,
  add column if not exists category text,
  add column if not exists short_description text,
  add column if not exists full_description text,
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists external_url text,
  add column if not exists external_source text,
  add column if not exists organizer_name text,
  add column if not exists organizer_telegram text,
  add column if not exists social_mode text,
  add column if not exists is_paid boolean,
  add column if not exists price_note text,
  add column if not exists payment_url text,
  add column if not exists payment_note text,
  add column if not exists participant_limit int,
  add column if not exists looking_for_count int,
  add column if not exists submission_id uuid,
  add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null,
  add column if not exists moderation_status text not null default 'published',
  add column if not exists status text not null default 'published',
  add column if not exists source_meta jsonb not null default '{}'::jsonb,
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_group text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists uq_events_source_external_id
  on public.events(source_name, external_event_id)
  where external_event_id is not null;

create index if not exists idx_events_source_name_status_date
  on public.events(source_name, status, coalesce(starts_at, event_date));

create index if not exists idx_events_source_kind_category_date
  on public.events(source_kind, category, coalesce(starts_at, event_date));

create index if not exists idx_events_city_date
  on public.events(city, coalesce(starts_at, event_date));

create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid references public.users(id) on delete set null,
  title text not null,
  category text not null,
  short_description text not null,
  full_description text not null,
  city text not null,
  address text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  cover_urls jsonb not null default '[]'::jsonb,
  mode text not null default 'organize',
  is_paid boolean not null default false,
  price numeric,
  payment_url text,
  payment_note text,
  telegram_contact text not null,
  participant_limit int,
  looking_for_count int,
  moderator_comment text,
  trust_confirmed boolean not null default false,
  moderation_status text not null default 'pending',
  moderation_reason text,
  moderated_by uuid references public.users(id) on delete set null,
  moderated_at timestamptz,
  published_event_id uuid references public.events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_submissions_status_created
  on public.event_submissions(moderation_status, created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_actions_target_created
  on public.moderation_actions(target_user_id, created_at desc);
