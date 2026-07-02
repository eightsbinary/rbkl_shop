-- Review mirror of supabase/migrations/20260627001100_orders_rls.sql.

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.discount_codes enable row level security;
alter table public.shipping_zones enable row level security;

-- shipping_zones: public read (active), owner/dev manage
create policy "shipping_zones_public_read"
on public.shipping_zones for select to anon, authenticated using (is_active);

create policy "shipping_zones_owner_dev_all"
on public.shipping_zones for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- discount_codes: owner/dev only (lookup goes through a future SECURITY DEFINER fn)
create policy "discount_codes_owner_dev_all"
on public.discount_codes for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- orders: logged-in customer reads own; guest reads go through signed-token RPC
create policy "orders_self_select"
on public.orders for select to authenticated using (customer_id = auth.uid());

create policy "orders_owner_dev_all"
on public.orders for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- order_items: visible via parent order ownership
create policy "order_items_via_parent_select"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.customer_id = auth.uid() or public.is_owner_or_dev())
  )
);

create policy "order_items_owner_dev_all"
on public.order_items for all to authenticated
using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

-- order_events: owner/dev only
create policy "order_events_owner_dev_select"
on public.order_events for select to authenticated using (public.is_owner_or_dev());

-- Grants (mandatory for new-style sb_secret_ / sb_publishable_ keys)
grant select on public.shipping_zones to anon, authenticated;
grant select, insert, update, delete
  on public.shipping_zones, public.discount_codes,
     public.orders, public.order_items, public.order_events
  to service_role;

grant select, insert, update, delete
  on public.shipping_zones, public.discount_codes,
     public.orders, public.order_items, public.order_events
  to authenticated;
