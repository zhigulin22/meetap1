create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  device_label text not null,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_user_sessions_user on public.user_sessions(user_id, created_at desc);

alter table public.user_sessions enable row level security;
create policy "public read own sessions" on public.user_sessions for select using (true);
