create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_post on public.comments(post_id, created_at desc);

-- удаляем дубли лайков, чтобы уникальный индекс создавался без ошибок
with duplicated_likes as (
  select id,
         row_number() over (partition by post_id, user_id order by created_at asc) as rn
  from public.reactions
  where reaction_type = 'like'
)
delete from public.reactions r
using duplicated_likes d
where r.id = d.id
  and d.rn > 1;

create unique index if not exists idx_like_unique_per_post_user
  on public.reactions(post_id, user_id)
  where reaction_type = 'like';

alter table public.comments enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'comments'
      and policyname = 'public read comments'
  ) then
    create policy "public read comments" on public.comments for select using (true);
  end if;
end $$;
