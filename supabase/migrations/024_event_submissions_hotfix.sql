-- Hotfix: ensure public.event_submissions exists with required columns for community events.

create extension if not exists pgcrypto;

create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  user_id uuid,
  creator_user_id uuid references public.users(id) on delete set null,
  title text not null,
  category text not null,
  format text,
  mode text,
  city text not null,
  venue text,
  address text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  short_description text not null,
  full_description text not null,
  cover_image_url text,
  cover_urls jsonb not null default '[]'::jsonb,
  is_paid boolean not null default false,
  price_text text,
  price numeric,
  payment_url text,
  payment_note text,
  organizer_name text,
  organizer_telegram text,
  telegram_contact text,
  participant_limit int,
  looking_for_count int,
  status text not null default 'pending',
  moderation_status text not null default 'pending',
  admin_notes text,
  moderator_comment text,
  moderation_reason text,
  trust_confirmed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.event_submissions
  add column if not exists event_id uuid,
  add column if not exists user_id uuid,
  add column if not exists creator_user_id uuid,
  add column if not exists format text,
  add column if not exists mode text,
  add column if not exists venue text,
  add column if not exists address text,
  add column if not exists cover_image_url text,
  add column if not exists cover_urls jsonb not null default '[]'::jsonb,
  add column if not exists organizer_name text,
  add column if not exists organizer_telegram text,
  add column if not exists telegram_contact text,
  add column if not exists price_text text,
  add column if not exists payment_url text,
  add column if not exists payment_note text,
  add column if not exists participant_limit int,
  add column if not exists looking_for_count int,
  add column if not exists moderator_comment text,
  add column if not exists moderation_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.event_submissions(id) on delete cascade,
  admin_id uuid references public.users(id) on delete set null,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.event_submissions enable row level security;

-- Policies: users can insert/read their own submissions.
DO $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_submissions' and policyname='event submissions own read'
  ) then
    create policy "event submissions own read" on public.event_submissions
      for select using (coalesce(creator_user_id, user_id) = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_submissions' and policyname='event submissions own insert'
  ) then
    create policy "event submissions own insert" on public.event_submissions
      for insert with check (coalesce(creator_user_id, user_id) = auth.uid());
  end if;
end $$;

