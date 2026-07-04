-- Per-product accordion copy override (details/shipping title+body, bilingual).
-- Empty object = no override; the PDP falls back to the site-wide copy, then i18n.
alter table public.products
  add column if not exists copy jsonb not null default '{}'::jsonb;
