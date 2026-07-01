-- Review mirror of supabase/migrations/20260701120000_newsletter_subscribers.sql.

alter table public.newsletter_subscribers enable row level security;

-- anon/authenticated can subscribe (own email submitted via API)
create policy "newsletter_anon_insert"
on public.newsletter_subscribers for insert to anon, authenticated
with check (true);

-- owner/dev manage everything (list, export, prune)
create policy "newsletter_owner_dev_all"
on public.newsletter_subscribers for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Grants (mandatory for new-style sb_secret_ / sb_publishable_ keys)
grant insert on public.newsletter_subscribers to anon, authenticated;
grant select, insert, update, delete on public.newsletter_subscribers to authenticated, service_role;
