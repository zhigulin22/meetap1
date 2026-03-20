-- Add onboarding fields to users
alter table public.users
  add column if not exists gender         text check (gender in ('male', 'female', 'other')),
  add column if not exists city           text,
  add column if not exists education_type text check (education_type in ('school', 'university', 'adult'));

-- Make session_string nullable (Gateway API doesn't use MTProto sessions)
alter table telegram_mtproto_pending
  alter column session_string drop not null;

-- Update auth_provider constraint to include telegram_gateway
alter table public.users
  drop constraint if exists users_auth_provider_check;

alter table public.users
  add constraint users_auth_provider_check
  check (auth_provider in ('telegram', 'telegram_mtproto', 'telegram_gateway', 'google', 'password'));
