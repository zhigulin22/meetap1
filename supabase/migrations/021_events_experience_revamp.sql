-- Events 2.0: external/community split, submission moderation queue, social companion signals

alter table if exists public.events
  add column if not exists source_kind text not null default 'external',
  add column if not exists category text,
  add column if not exists short_description text,
  add column if not exists full_description text,
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists external_url text,
  add column if not exists external_source text,
  add column if not exists organizer_telegram text,
  add column if not exists social_mode text,
  add column if not exists is_paid boolean,
  add column if not exists price_note text,
  add column if not exists payment_url text,
  add column if not exists payment_note text,
  add column if not exists participant_limit int,
  add column if not exists looking_for_count int,
  add column if not exists submission_id uuid,
  add column if not exists moderation_status text not null default 'published',
  add column if not exists status text not null default 'published',
  add column if not exists source_meta jsonb not null default '{}'::jsonb;

create index if not exists idx_events_source_kind_date on public.events(source_kind, coalesce(starts_at, event_date));
create index if not exists idx_events_category_date on public.events(category, coalesce(starts_at, event_date));
create index if not exists idx_events_status_date on public.events(status, coalesce(starts_at, event_date));

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

create index if not exists idx_event_submissions_status_created on public.event_submissions(moderation_status, created_at desc);
create index if not exists idx_event_submissions_creator on public.event_submissions(creator_user_id, created_at desc);

create table if not exists public.event_companion_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create index if not exists idx_event_companion_event on public.event_companion_requests(event_id, created_at desc);
create index if not exists idx_event_companion_user on public.event_companion_requests(user_id, created_at desc);

create table if not exists public.event_submission_moderation_log (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.event_submissions(id) on delete cascade,
  action text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  via text not null default 'telegram_bot',
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_submission_log_submission on public.event_submission_moderation_log(submission_id, created_at desc);

alter table if exists public.event_submissions enable row level security;
alter table if exists public.event_companion_requests enable row level security;
alter table if exists public.event_submission_moderation_log enable row level security;

-- Conservative policies for direct client usage; server routes still use service role.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_submissions' and policyname='event submissions own read'
  ) then
    create policy "event submissions own read" on public.event_submissions
      for select using (creator_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_submissions' and policyname='event submissions own insert'
  ) then
    create policy "event submissions own insert" on public.event_submissions
      for insert with check (creator_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_companion_requests' and policyname='event companion own manage'
  ) then
    create policy "event companion own manage" on public.event_companion_requests
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
