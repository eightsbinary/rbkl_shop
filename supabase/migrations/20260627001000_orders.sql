create type public.order_status as enum (
  'awaiting_payment',
  'paid',
  'failed',
  'cancelled',
  'refunded'
);

create type public.ship_status as enum (
  'pending',
  'preparing',
  'shipped',
  'delivered'
);

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name jsonb not null,
  countries text[] not null,
  flat_rate_thb int not null check (flat_rate_thb >= 0),
  is_active boolean not null default true,
  sort int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shipping_zones_set_updated_at
before update on public.shipping_zones
for each row execute function public.set_updated_at();

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('fixed','percent')),
  value int not null check (value >= 0),
  min_subtotal_thb int not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_uses int,
  uses int not null default 0,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger discount_codes_set_updated_at
before update on public.discount_codes
for each row execute function public.set_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_email text not null,
  customer_id uuid references auth.users(id) on delete set null,
  status public.order_status not null default 'awaiting_payment',
  subtotal_thb int not null check (subtotal_thb >= 0),
  discount_thb int not null default 0 check (discount_thb >= 0),
  shipping_thb int not null default 0 check (shipping_thb >= 0),
  total_thb int not null check (total_thb >= 0),
  currency text not null default 'THB',
  locale text not null check (locale in ('th','en')),
  shipping_address jsonb not null,
  payment_provider text not null,
  payment_method text,
  payment_charge_id text,
  last_event_id text,
  paid_at timestamptz,
  ship_status public.ship_status not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  tracking_carrier text,
  tracking_number text,
  tracking_url text,
  estimated_delivery_date date,
  notes_internal text,
  notes_to_buyer text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_status_idx on public.orders(status);
create index orders_customer_email_idx on public.orders(customer_email);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.variants(id) on delete set null,
  qty int not null check (qty > 0),
  unit_price_thb int not null check (unit_price_thb >= 0),
  line_total_thb int not null check (line_total_thb >= 0),
  product_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items(order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor text not null,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events(order_id, created_at);
