-- Newsletter: fans/buyers subscribe to receive product updates and news later.

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  locale text not null check (locale in ('th','en')),
  source text,
  status text not null default 'active' check (status in ('active','unsubscribed')),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique (email),
  check (
    (status = 'active' and unsubscribed_at is null)
    or (status = 'unsubscribed' and unsubscribed_at is not null)
  )
);

create index newsletter_subscribers_created_idx
  on public.newsletter_subscribers(created_at desc);

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
