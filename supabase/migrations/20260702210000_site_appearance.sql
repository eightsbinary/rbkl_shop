-- Site-wide appearance overrides (singleton): storefront background color per
-- theme. Null → the built-in Editorial Mono palette value. Public read (the
-- storefront layout injects these for anonymous visitors, mirroring
-- home_content); owner/dev write via the service role.
create table public.site_appearance (
  id text primary key default 'singleton' check (id = 'singleton'),
  bg_light text check (bg_light ~ '^#[0-9a-f]{6}$'),
  bg_dark text check (bg_dark ~ '^#[0-9a-f]{6}$'),
  updated_at timestamptz not null default now()
);

create trigger site_appearance_set_updated_at
before update on public.site_appearance
for each row execute function public.set_updated_at();

alter table public.site_appearance enable row level security;

create policy "site_appearance_public_read"
on public.site_appearance for select to anon, authenticated using (true);

create policy "site_appearance_owner_dev_all"
on public.site_appearance for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

grant select on public.site_appearance to anon, authenticated;

insert into public.site_appearance (id) values ('singleton') on conflict (id) do nothing;
