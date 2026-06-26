-- Mirror of profiles RLS policies (see migration 20260626000100_profiles_rls.sql)
-- for code-review readability. The migration is what actually runs; this file
-- is documentation only.

-- customer: select + update OWN row
-- owner:    select + update OWN row
-- dev:      ALL on all rows (role mgmt)
-- anon:     no access

-- Customer + owner: select own profile
create policy "profiles_self_select"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Customer + owner: update own profile (cannot change own role)
create policy "profiles_self_update"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and (role = (select role from public.profiles where id = auth.uid()))
);

-- Dev: full read
create policy "profiles_dev_select"
on public.profiles for select
to authenticated
using (public.is_dev());

-- Dev: full insert
create policy "profiles_dev_insert"
on public.profiles for insert
to authenticated
with check (public.is_dev());

-- Dev: full update (including role changes)
create policy "profiles_dev_update"
on public.profiles for update
to authenticated
using (public.is_dev())
with check (public.is_dev());

-- Dev: delete (rare, but covered for role mgmt)
create policy "profiles_dev_delete"
on public.profiles for delete
to authenticated
using (public.is_dev());
