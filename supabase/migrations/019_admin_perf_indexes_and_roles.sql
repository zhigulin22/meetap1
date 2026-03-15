-- Admin performance indexes
create index if not exists idx_analytics_events_created_at on public.analytics_events (created_at desc);
create index if not exists idx_analytics_events_event_created on public.analytics_events (event_name, created_at desc);
create index if not exists idx_analytics_events_user_created on public.analytics_events (user_id, created_at desc);

create index if not exists idx_users_is_demo_group on public.users (is_demo, demo_group);
create index if not exists idx_users_role on public.users (role);
create index if not exists idx_users_shadow_banned on public.users (shadow_banned);
create index if not exists idx_users_message_limited on public.users (message_limited);
create index if not exists idx_users_profile_completed on public.users (profile_completed);

create index if not exists idx_reports_target_created on public.reports (target_user_id, created_at desc);
create index if not exists idx_reports_status_created on public.reports (status, created_at desc);

-- Ensure super_admin role value is allowed by data model if role column is plain text.
-- (No enum migration here to avoid breaking existing installations.)
