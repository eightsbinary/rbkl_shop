-- Waitlist: fans subscribe to be notified when a sold-out variant restocks.

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  email text not null,
  locale text not null check (locale in ('th','en')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (variant_id, email)
);

create index waitlist_entries_variant_idx on public.waitlist_entries(variant_id);
create index waitlist_entries_pending_idx
  on public.waitlist_entries(variant_id, created_at)
  where notified_at is null;

alter table public.waitlist_entries enable row level security;

-- anon/authenticated can join the waitlist
create policy "waitlist_anon_insert"
on public.waitlist_entries for insert
to anon, authenticated
with check (true);

-- owner/dev manage everything
create policy "waitlist_owner_dev_all"
on public.waitlist_entries for all
to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- Grants (mandatory for new-style sb_secret_ / sb_publishable_ keys)
grant insert on public.waitlist_entries to anon, authenticated;
grant select, insert, update, delete on public.waitlist_entries to authenticated, service_role;
