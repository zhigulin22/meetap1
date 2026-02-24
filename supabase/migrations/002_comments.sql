create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comments_post on public.comments(post_id, created_at desc);
create unique index if not exists idx_like_unique_per_post_user
  on public.reactions(post_id, user_id)
  where reaction_type = like;

alter table public.comments enable row level security;
create policy "public read comments" on public.comments for select using (true);
