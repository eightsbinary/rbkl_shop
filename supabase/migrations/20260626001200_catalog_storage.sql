-- Public-read bucket for product images. Owners/devs write via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  3145728,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "product_images_public_select"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "product_images_owner_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_owner_or_dev());

create policy "product_images_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_owner_or_dev())
with check (bucket_id = 'product-images' and public.is_owner_or_dev());

create policy "product_images_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_owner_or_dev());
