-- Restrict analytics_events writes from client roles.
-- Service role (used by server routes) bypasses RLS and can still write.

alter table public.analytics_events enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
  loop
    execute format('drop policy %I on public.analytics_events', policy_row.policyname);
  end loop;

  create policy "admin analytics read"
    on public.analytics_events
    for select
    using (public.is_admin_role());
end $$;
