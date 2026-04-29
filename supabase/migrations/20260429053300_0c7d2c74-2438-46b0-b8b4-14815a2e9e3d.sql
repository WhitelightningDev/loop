
create table if not exists public.org_smtp_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique,
  host text not null,
  port integer not null default 587,
  username text not null,
  password text not null,
  from_email text not null,
  from_name text not null default '',
  use_tls boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_smtp_settings enable row level security;

create policy "smtp: admins read"
  on public.org_smtp_settings for select to authenticated
  using (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()));

create policy "smtp: admins insert"
  on public.org_smtp_settings for insert to authenticated
  with check (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()));

create policy "smtp: admins update"
  on public.org_smtp_settings for update to authenticated
  using (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()))
  with check (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()));

create policy "smtp: admins delete"
  on public.org_smtp_settings for delete to authenticated
  using (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()));

create trigger trg_smtp_touch
  before update on public.org_smtp_settings
  for each row execute function public.touch_updated_at();
