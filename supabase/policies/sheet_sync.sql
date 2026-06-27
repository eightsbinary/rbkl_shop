-- Review mirror of supabase/migrations/20260627003000_sheet_sync.sql.

alter table public.sheet_sync_runs enable row level security;
alter table public.sheet_sync_rejects enable row level security;

-- Diagnostics: dev-only read. Writes happen via service_role in the action.
create policy "sheet_sync_runs_dev_select"
on public.sheet_sync_runs for select to authenticated using (public.is_dev());

create policy "sheet_sync_rejects_dev_select"
on public.sheet_sync_rejects for select to authenticated using (public.is_dev());

grant select, insert, update, delete
  on public.sheet_sync_runs, public.sheet_sync_rejects to service_role;
grant select on public.sheet_sync_runs, public.sheet_sync_rejects to authenticated;
