-- Explicit privilege grants for the profiles table.
--
-- Why this exists: the new Supabase API key format (`sb_publishable_…`,
-- `sb_secret_…`) authenticates as the `anon` / `authenticated` / `service_role`
-- Postgres roles, but does NOT auto-grant table privileges on tables created
-- via migration. RLS is enforced for `anon` + `authenticated`; `service_role`
-- needs full grants to bypass.
--
-- Without these grants, scripts/grant-dev.ts (which uses the service-role key)
-- fails with "permission denied for table profiles" even though RLS would
-- have allowed it.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.profiles to service_role;
grant select, update on public.profiles to authenticated;

-- Function execute grants — already public by default, but pinning to be explicit
grant execute on function public.current_role() to anon, authenticated, service_role;
grant execute on function public.is_owner_or_dev() to anon, authenticated, service_role;
grant execute on function public.is_dev() to anon, authenticated, service_role;

-- Default privileges so future tables in public auto-grant to service_role.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
