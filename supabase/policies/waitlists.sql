-- Review mirror of supabase/migrations/20260627002000_waitlists.sql.

alter table public.waitlist_entries enable row level security;

-- anon/authenticated can join the waitlist (own email submitted via API)
create policy "waitlist_anon_insert"
on public.waitlist_entries for insert to anon, authenticated
with check (true);

-- owner/dev manage everything (list, notify, prune)
create policy "waitlist_owner_dev_all"
on public.waitlist_entries for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Grants (mandatory for new-style sb_secret_ / sb_publishable_ keys)
grant insert on public.waitlist_entries to anon, authenticated;
grant select, insert, update, delete on public.waitlist_entries to authenticated, service_role;
