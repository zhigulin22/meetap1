-- Event dictionary for metrics normalization + safe-mode switch for admin devtools

create table if not exists public.event_dictionary (
  event_name text primary key,
  family text not null,
  display_ru text not null,
  metric_tags text[] not null default '{}',
  is_key boolean not null default false,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_dictionary_family on public.event_dictionary(family);
create index if not exists idx_event_dictionary_is_key on public.event_dictionary(is_key);

alter table public.event_dictionary enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public' and tablename='event_dictionary' and policyname='admin event dictionary'
  ) then
    create policy "admin event dictionary"
      on public.event_dictionary
      for all
      using (public.is_admin_role())
      with check (public.is_admin_role());
  end if;
end $$;

insert into public.system_settings(key, value)
values
  (
    'admin_devtools_safe_mode',
    '{"enabled": false, "note": "Enable only for admin when live simulation is required in production."}'::jsonb
  )
on conflict (key) do nothing;
