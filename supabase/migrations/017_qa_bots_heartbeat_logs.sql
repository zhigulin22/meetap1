alter table public.qa_bot_heartbeats
  add column if not exists bot_id text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists status text,
  add column if not exists last_action text,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_qa_bot_heartbeats_bot_id_unique
  on public.qa_bot_heartbeats(bot_id)
  where bot_id is not null;

create index if not exists idx_qa_bot_heartbeats_last_seen
  on public.qa_bot_heartbeats(last_seen_at desc);

create table if not exists public.qa_bot_logs (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  run_id uuid references public.qa_bot_runs(id) on delete set null,
  level text not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_qa_bot_logs_created on public.qa_bot_logs(created_at desc);
create index if not exists idx_qa_bot_logs_bot on public.qa_bot_logs(bot_id, created_at desc);

alter table public.qa_bot_logs enable row level security;

update public.qa_bot_heartbeats
set
  last_seen_at = coalesce(last_seen_at, last_event_at, created_at),
  status = coalesce(status, 'alive'),
  updated_at = now()
where last_seen_at is null or status is null;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='qa_bot_logs' and policyname='admin qa bot logs'
  ) then
    create policy "admin qa bot logs"
      on public.qa_bot_logs
      for all
      using (public.is_admin_role())
      with check (public.is_admin_role());
  end if;
end $$;
