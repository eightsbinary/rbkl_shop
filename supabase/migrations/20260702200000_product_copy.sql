-- Editable product-page copy (singleton): the "Details & Care" and
-- "Shipping & Returns" accordions shown on every product page. Bilingual
-- overrides in `content`; absent fields fall back to the i18n defaults.
-- Mirrors about_content / home_content.
create table public.product_copy (
  id text primary key default 'singleton',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger product_copy_set_updated_at
before update on public.product_copy
for each row execute function public.set_updated_at();

alter table public.product_copy enable row level security;

create policy "product_copy_public_read"
on public.product_copy for select to anon, authenticated using (true);

create policy "product_copy_owner_dev_all"
on public.product_copy for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

grant select on public.product_copy to anon, authenticated;

insert into public.product_copy (id) values ('singleton') on conflict (id) do nothing;
