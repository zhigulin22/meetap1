-- Make phone nullable (Google OAuth users won't have a phone)
alter table public.users
  alter column phone drop not null;

-- Add Google OAuth fields
alter table public.users
  add column if not exists email        text unique,
  add column if not exists username     text unique,
  add column if not exists age          int check (age >= 13 and age <= 100),
  add column if not exists auth_provider text not null default 'telegram'
    check (auth_provider in ('telegram', 'google', 'password'));

-- Index for email lookups
create index if not exists idx_users_email on public.users(email);

-- Index for username lookups
create index if not exists idx_users_username on public.users(username);
