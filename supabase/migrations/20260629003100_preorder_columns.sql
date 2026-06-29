alter table public.products
  add column if not exists is_preorder boolean not null default false,
  add column if not exists preorder_ship_date date;

alter table public.variants
  add column if not exists preorder_enabled boolean not null default false,
  add column if not exists preorder_cap int check (preorder_cap is null or preorder_cap >= 0),
  add column if not exists preorder_count int not null default 0 check (preorder_count >= 0);

alter table public.order_items
  add column if not exists is_preorder boolean not null default false;
