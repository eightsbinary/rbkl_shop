-- Slip submissions (audit trail; supports re-uploads). Service-role only.
create table public.payment_slips (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text
);
create index payment_slips_order_idx on public.payment_slips(order_id);
create index payment_slips_status_idx on public.payment_slips(status);
alter table public.payment_slips enable row level security;

create table public.payment_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  promptpay_qr_path text,
  account_label text,
  instructions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.payment_settings (id) values ('singleton') on conflict do nothing;
alter table public.payment_settings enable row level security;
create policy "payment_settings public read" on public.payment_settings for select using (true);
create policy "payment_settings owner write" on public.payment_settings for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-assets', 'payment-assets', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-slips', 'payment-slips', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "payment-assets read" on storage.objects for select using (bucket_id = 'payment-assets');
create policy "payment-assets owner write" on storage.objects for insert
  with check (bucket_id = 'payment-assets' and public.is_owner_or_dev());
create policy "payment-assets owner update" on storage.objects for update
  using (bucket_id = 'payment-assets' and public.is_owner_or_dev())
  with check (bucket_id = 'payment-assets' and public.is_owner_or_dev());
