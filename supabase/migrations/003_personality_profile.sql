alter table public.users
  add column if not exists personality_profile jsonb,
  add column if not exists personality_updated_at timestamptz;
