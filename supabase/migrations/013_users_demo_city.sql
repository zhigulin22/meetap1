alter table public.users add column if not exists is_demo boolean not null default false;
alter table public.users add column if not exists city text;

create index if not exists idx_users_is_demo on public.users(is_demo, created_at desc);
create index if not exists idx_users_city on public.users(city);
