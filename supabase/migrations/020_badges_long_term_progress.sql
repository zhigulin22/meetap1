alter table if exists public.badges
  add column if not exists rarity text not null default 'common',
  add column if not exists tier int not null default 1;

alter table if exists public.user_badges
  add column if not exists progress jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_rarity_check'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges
      add constraint badges_rarity_check
      check (rarity in ('common','rare','epic','legendary'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_tier_check'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges
      add constraint badges_tier_check
      check (tier between 1 and 4);
  end if;
end $$;

create index if not exists idx_badges_category_rarity_tier
  on public.badges(category, rarity, tier);

create index if not exists idx_user_badges_user_earned
  on public.user_badges(user_id, earned_at desc);
