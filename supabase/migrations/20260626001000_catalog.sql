-- Catalog: products + variant axes + variants + product images
-- Storage bucket policies live in a separate migration (Task 6).

create type public.product_status as enum ('draft', 'active', 'archived');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status public.product_status not null default 'draft',
  name jsonb not null,                 -- { th: "...", en: "..." }
  description jsonb not null default '{}'::jsonb,
  base_price_thb int not null check (base_price_thb >= 0),
  weight_grams int not null default 0 check (weight_grams >= 0),
  category text,
  is_featured boolean not null default false,
  hero_image_id uuid,                  -- FK added later (forward ref)
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_status_idx on public.products(status);
create index products_featured_idx on public.products(is_featured) where is_featured;
create index products_slug_idx on public.products(slug);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table public.variant_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,                  -- 'size' | 'color' | etc.
  values text[] not null,              -- ['S','M','L','XL']
  sort int not null default 0,
  unique (product_id, name)
);

create index variant_options_product_idx on public.variant_options(product_id);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  option_values jsonb not null,        -- { size: 'M', color: 'cream' }
  price_thb int,                       -- null = use product.base_price_thb
  stock_available int not null default 0 check (stock_available >= 0),
  stock_reserved int not null default 0 check (stock_reserved >= 0),
  is_active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index variants_product_idx on public.variants(product_id);
create index variants_active_idx on public.variants(is_active) where is_active;

create trigger variants_set_updated_at
before update on public.variants
for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sort int not null default 0,
  storage_path text not null,
  url_400 text not null,
  url_800 text not null,
  url_1600 text not null,
  alt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images(product_id, sort);

alter table public.products
  add constraint products_hero_image_fk
  foreign key (hero_image_id) references public.product_images(id) on delete set null;
