-- Audit trail for Google Sheets sync runs (Plan 5).

create table public.sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('manual')),
  status text not null check (status in ('running', 'ok', 'error')),
  rows_pulled int not null default 0,
  rows_applied int not null default 0,
  rows_rejected int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.sheet_sync_rejects (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sheet_sync_runs(id) on delete cascade,
  table_name text not null,
  row_pk text not null,
  column_name text not null,
  reason text not null check (reason in ('read_only', 'version_stale', 'validation', 'run_cap')),
  attempted_value text,
  created_at timestamptz not null default now()
);

create index sheet_sync_runs_started_idx on public.sheet_sync_runs(started_at desc);
create index sheet_sync_rejects_run_idx on public.sheet_sync_rejects(run_id);

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
