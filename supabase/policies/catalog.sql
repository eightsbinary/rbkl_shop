-- Review mirror of supabase/migrations/20260626001100_catalog_rls.sql.
-- The migration is what actually runs; this file is documentation.

-- Enable RLS
alter table public.products enable row level security;
alter table public.variant_options enable row level security;
alter table public.variants enable row level security;
alter table public.product_images enable row level security;

-- products: anon/authenticated read active; owner/dev manage
create policy "products_public_read"
on public.products for select
to anon, authenticated
using (status = 'active');

create policy "products_owner_dev_all"
on public.products for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- variants: public read for active variants of active products; owner/dev manage
create policy "variants_public_read"
on public.variants for select
to anon, authenticated
using (
  is_active and exists (
    select 1 from public.products p
    where p.id = variants.product_id and p.status = 'active'
  )
);

create policy "variants_owner_dev_all"
on public.variants for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- variant_options: same shape as variants
create policy "variant_options_public_read"
on public.variant_options for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = variant_options.product_id and p.status = 'active'
  )
);

create policy "variant_options_owner_dev_all"
on public.variant_options for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- product_images: same shape
create policy "product_images_public_read"
on public.product_images for select
to anon, authenticated
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.status = 'active'
  )
);

create policy "product_images_owner_dev_all"
on public.product_images for all
to authenticated
using (public.is_owner_or_dev())
with check (public.is_owner_or_dev());

-- Grants required for new-style API keys (sb_publishable_, sb_secret_)
grant usage on schema public to anon, authenticated, service_role;
grant select on public.products, public.variants, public.variant_options, public.product_images
  to anon, authenticated;
grant select, insert, update, delete
  on public.products, public.variants, public.variant_options, public.product_images
  to authenticated, service_role;
