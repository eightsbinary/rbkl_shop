-- Selectable About-page section images. Paths (in the about-assets bucket)
-- live in a jsonb column on the about_content singleton: {hero, craft,
-- inspiration}. A missing key means the section uses its built-in default
-- (/about-*.png), so the page is unchanged until an admin picks an image.
alter table public.about_content
  add column images jsonb not null default '{}'::jsonb;

-- Public-read bucket for About-page images. Owners/devs write via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'about-assets',
  'about-assets',
  true,
  3145728,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "about_assets_public_select"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'about-assets');

create policy "about_assets_owner_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'about-assets' and public.is_owner_or_dev());

create policy "about_assets_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'about-assets' and public.is_owner_or_dev())
with check (bucket_id = 'about-assets' and public.is_owner_or_dev());

create policy "about_assets_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'about-assets' and public.is_owner_or_dev());
