-- Global app settings (singleton). Currently just the transactional email
-- provider toggle (Gmail by default; Resend once a domain is registered).
create table public.app_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  email_provider text not null default 'gmail' check (email_provider in ('gmail','resend')),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values ('singleton') on conflict do nothing;

alter table public.app_settings enable row level security;

-- owner/dev read + write; the mailer reads it via the service role (bypasses RLS).
create policy "app_settings owner read" on public.app_settings for select
  using (public.is_owner_or_dev());
create policy "app_settings owner write" on public.app_settings for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());

grant select, insert, update on public.app_settings to authenticated, service_role;
