-- Remove live simulation backend and prepare one-shot Seed Minimal.

alter table public.events add column if not exists is_demo boolean not null default false;
alter table public.posts add column if not exists is_demo boolean not null default false;
alter table public.connections add column if not exists is_demo boolean not null default false;
alter table public.messages add column if not exists is_demo boolean not null default false;

create index if not exists idx_events_is_demo on public.events(is_demo, created_at desc);
create index if not exists idx_posts_is_demo on public.posts(is_demo, created_at desc);
create index if not exists idx_connections_is_demo on public.connections(is_demo, created_at desc);
create index if not exists idx_messages_is_demo on public.messages(is_demo, created_at desc);

-- Simulation no longer used.
drop table if exists public.simulation_users;
drop table if exists public.simulation_runs;
