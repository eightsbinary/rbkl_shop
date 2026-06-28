-- Durable, atomic webhook dedup. The unique (provider, event_id) lets the
-- notify handler insert-once: a 23505 conflict means "already processed".
-- Service role bypasses RLS; no policies = anon/auth get no access.
create table public.processed_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  order_id uuid references public.orders(id),
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.processed_webhook_events enable row level security;
