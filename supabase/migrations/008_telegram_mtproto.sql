-- Table to store pending MTProto verification sessions
create table if not exists telegram_mtproto_pending (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null,
  phone_code_hash text not null,
  session_string  text not null,
  verified        boolean not null default false,
  expires_at      timestamptz not null default (now() + interval '10 minutes'),
  created_at      timestamptz not null default now()
);

create index if not exists idx_tg_mtproto_phone on telegram_mtproto_pending (phone);

-- Update auth_provider check to allow telegram_mtproto
alter table public.users
  drop constraint if exists users_auth_provider_check;

alter table public.users
  add constraint users_auth_provider_check
  check (auth_provider in ('telegram', 'telegram_mtproto', 'google', 'password'));
