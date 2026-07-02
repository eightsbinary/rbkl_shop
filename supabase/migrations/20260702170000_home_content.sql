-- Editable homepage hero (singleton), mirroring about_content: bilingual text
-- overrides in `content` (falls back to i18n), hero image path in `images`
-- (falls back to /hero.png). Public read; owner/dev write via service role.
create table public.home_content (
  id text primary key default 'singleton',
  content jsonb not null default '{}'::jsonb,
  images jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger home_content_set_updated_at
before update on public.home_content
for each row execute function public.set_updated_at();

alter table public.home_content enable row level security;

create policy "home_content_public_read"
on public.home_content for select to anon, authenticated using (true);

create policy "home_content_owner_dev_all"
on public.home_content for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

grant select on public.home_content to anon, authenticated;

insert into public.home_content (id) values ('singleton') on conflict (id) do nothing;

-- Public-read bucket for homepage images. Owners/devs write via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home-assets',
  'home-assets',
  true,
  3145728,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "home_assets_public_select"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'home-assets');

create policy "home_assets_owner_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'home-assets' and public.is_owner_or_dev());

create policy "home_assets_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'home-assets' and public.is_owner_or_dev())
with check (bucket_id = 'home-assets' and public.is_owner_or_dev());

create policy "home_assets_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'home-assets' and public.is_owner_or_dev());
