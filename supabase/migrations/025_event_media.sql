-- Event media storage: uploaded files stored in Supabase Storage bucket `event-media`

create extension if not exists pgcrypto;

create table if not exists public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  media_type text not null default 'image',
  storage_bucket text not null default 'event-media',
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  duration_seconds integer,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_media_event on public.event_media(event_id, sort_order);
create index if not exists idx_event_media_primary on public.event_media(event_id, is_primary);

alter table public.events
  add column if not exists primary_media_id uuid;

-- Extend event_status enum if it exists (production-safe).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'event_status' AND e.enumlabel = 'draft'
    ) THEN
      ALTER TYPE event_status ADD VALUE 'draft';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'event_status' AND e.enumlabel = 'pending_review'
    ) THEN
      ALTER TYPE event_status ADD VALUE 'pending_review';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'event_status' AND e.enumlabel = 'published'
    ) THEN
      ALTER TYPE event_status ADD VALUE 'published';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'event_status' AND e.enumlabel = 'hidden'
    ) THEN
      ALTER TYPE event_status ADD VALUE 'hidden';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'event_status' AND e.enumlabel = 'removed'
    ) THEN
      ALTER TYPE event_status ADD VALUE 'removed';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'event_status' AND e.enumlabel = 'archived'
    ) THEN
      ALTER TYPE event_status ADD VALUE 'archived';
    END IF;
  END IF;
END $$;

create index if not exists idx_events_primary_media on public.events(primary_media_id);
