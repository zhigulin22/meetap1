create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key,
  phone text unique not null,
  name text not null,
  telegram_verified boolean not null default false,
  telegram_user_id text,
  last_post_at timestamptz,
  xp int not null default 0,
  level int not null default 1,
  university text,
  work text,
  hobbies text[],
  interests text[],
  facts text[],
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  token uuid unique not null,
  status text not null check (status in ('pending', 'verified', 'expired')),
  telegram_user_id text,
  verified_phone text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('daily_duo','reel')),
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  fact text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('front','back','cover')),
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like','connect','star')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  outcomes text[] not null default '{}',
  cover_url text,
  event_date timestamptz not null,
  price int not null default 0,
  city text not null default 'Москва',
  created_at timestamptz not null default now()
);

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);

create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid references public.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_user on public.posts(user_id, created_at desc);
create index if not exists idx_events_date on public.events(event_date asc);
create index if not exists idx_members_event on public.event_members(event_id);
create index if not exists idx_reactions_post on public.reactions(post_id);

insert into storage.buckets (id, name, public)
values ('daily-duo', 'daily-duo', true)
on conflict (id) do nothing;

alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.photos enable row level security;
alter table public.reactions enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.telegram_verifications enable row level security;
alter table public.facts enable row level security;

create policy "public read users" on public.users for select using (true);
create policy "public read posts" on public.posts for select using (true);
create policy "public read photos" on public.photos for select using (true);
create policy "public read reactions" on public.reactions for select using (true);
create policy "public read events" on public.events for select using (true);
create policy "public read members" on public.event_members for select using (true);
