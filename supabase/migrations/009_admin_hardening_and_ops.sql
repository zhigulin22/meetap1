-- RBAC hardening + admin ops tables

alter table public.users add column if not exists role text not null default 'user';

create table if not exists public.alert_triggers (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.alerts(id) on delete cascade,
  metric text not null,
  value numeric not null,
  threshold numeric not null,
  triggered_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_alert_triggers_alert on public.alert_triggers(alert_id, triggered_at desc);

alter table public.alert_triggers enable row level security;
alter table public.system_settings enable row level security;

create or replace function public.is_admin_role()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin','moderator','analyst','content_manager','support')
      and (u.is_blocked is false or u.is_blocked is null)
  );
$$;

do $$
begin
  -- Remove overly broad read policies from admin tables if they exist
  if exists (select 1 from pg_policies where schemaname='public' and tablename='analytics_events' and policyname='public read analytics_events') then
    drop policy "public read analytics_events" on public.analytics_events;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='user_flags' and policyname='public read user_flags') then
    drop policy "public read user_flags" on public.user_flags;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='moderation_actions' and policyname='public read moderation_actions') then
    drop policy "public read moderation_actions" on public.moderation_actions;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='public read reports') then
    drop policy "public read reports" on public.reports;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='content_flags' and policyname='public read content_flags') then
    drop policy "public read content_flags" on public.content_flags;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='feature_flags' and policyname='public read feature_flags') then
    drop policy "public read feature_flags" on public.feature_flags;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='remote_configs' and policyname='public read remote_configs') then
    drop policy "public read remote_configs" on public.remote_configs;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='experiments' and policyname='public read experiments') then
    drop policy "public read experiments" on public.experiments;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='alerts' and policyname='public read alerts') then
    drop policy "public read alerts" on public.alerts;
  end if;

  -- Admin-only policies
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='analytics_events' and policyname='admin analytics events') then
    create policy "admin analytics events" on public.analytics_events for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_flags' and policyname='admin user flags') then
    create policy "admin user flags" on public.user_flags for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='moderation_actions' and policyname='admin moderation actions') then
    create policy "admin moderation actions" on public.moderation_actions for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='admin reports') then
    create policy "admin reports" on public.reports for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='content_flags' and policyname='admin content flags') then
    create policy "admin content flags" on public.content_flags for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='feature_flags' and policyname='admin feature flags') then
    create policy "admin feature flags" on public.feature_flags for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='remote_configs' and policyname='admin remote configs') then
    create policy "admin remote configs" on public.remote_configs for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='experiments' and policyname='admin experiments') then
    create policy "admin experiments" on public.experiments for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alerts' and policyname='admin alerts') then
    create policy "admin alerts" on public.alerts for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='alert_triggers' and policyname='admin alert triggers') then
    create policy "admin alert triggers" on public.alert_triggers for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='system_settings' and policyname='admin system settings') then
    create policy "admin system settings" on public.system_settings for all using (public.is_admin_role()) with check (public.is_admin_role());
  end if;
end $$;

insert into public.remote_configs(key,value,description)
values
  ('feed_lock_days', '{"value":7}'::jsonb, 'Через сколько дней без поста блокировать ленту'),
  ('connect_daily_limit', '{"value":10}'::jsonb, 'Лимит connect в день'),
  ('show_event_attendees_before_start', '{"value":false}'::jsonb, 'Показывать участников до старта ивента')
on conflict (key) do nothing;

insert into public.system_settings(key,value)
values
  ('brand', '{"title":"Meetap","support_email":"support@meetap.app"}'::jsonb),
  ('disaster_checklist', '{"steps":["Проверить Supabase status","Проверить Vercel deploy","Отключить risky flags","Экспортировать критичные таблицы"]}'::jsonb)
on conflict (key) do nothing;
