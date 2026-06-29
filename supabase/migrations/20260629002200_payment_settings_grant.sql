-- RLS policies filter rows but the role still needs base table privileges.
-- payment_settings is public-read (QR + instructions shown at checkout), so grant
-- SELECT to anon/authenticated. (payment_slips stays service-role-only.)
grant select on public.payment_settings to anon, authenticated;
