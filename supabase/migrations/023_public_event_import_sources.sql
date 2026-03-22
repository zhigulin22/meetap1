create extension if not exists pgcrypto;

create table if not exists public.event_import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default 'kudago_timepad',
  status text not null default 'ok',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats_json jsonb not null default '{}'::jsonb,
  error_text text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_import_jobs_started on public.event_import_jobs(started_at desc);
create index if not exists idx_event_import_jobs_status on public.event_import_jobs(status, started_at desc);

alter table if exists public.events
  add column if not exists source_event_id text,
  add column if not exists source_url text,
  add column if not exists source_type text not null default 'external',
  add column if not exists raw_category text,
  add column if not exists image_url text,
  add column if not exists price_min numeric,
  add column if not exists price_max numeric,
  add column if not exists price_text text,
  add column if not exists ticket_url text,
  add column if not exists description_short text,
  add column if not exists description_full text;

update public.events
set source_event_id = external_event_id
where source_event_id is null
  and external_event_id is not null;

update public.events
set source_url = external_url
where source_url is null
  and external_url is not null;

update public.events
set source_type = source_kind
where source_type is null
  and source_kind is not null;

update public.events
set image_url = cover_url
where image_url is null
  and cover_url is not null;

create unique index if not exists uq_events_source_name_source_event_id
  on public.events(source_name, source_event_id)
  where source_name is not null and source_event_id is not null;

create index if not exists idx_events_category_starts_at
  on public.events(category, coalesce(starts_at, event_date));

create index if not exists idx_events_city_starts_at
  on public.events(city, coalesce(starts_at, event_date));
