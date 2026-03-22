create table if not exists public.user_compatibility (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  score int not null check (score >= 0 and score <= 100),
  reason text not null default 'Совместимость рассчитана AI',
  source text not null default 'ai' check (source in ('ai', 'fallback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_user_id),
  check (user_id <> target_user_id)
);

create index if not exists idx_user_compatibility_user_score
  on public.user_compatibility(user_id, score desc, updated_at desc);

create index if not exists idx_user_compatibility_target
  on public.user_compatibility(target_user_id);

alter table public.user_compatibility enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_compatibility'
      and policyname = 'public read compatibility'
  ) then
    create policy "public read compatibility"
      on public.user_compatibility
      for select
      using (true);
  end if;
end
$$;
