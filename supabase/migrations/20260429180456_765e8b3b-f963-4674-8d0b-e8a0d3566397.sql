
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

create table if not exists public.org_oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null check (provider in ('github','jira','figma')),
  client_id text not null,
  client_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

alter table public.org_oauth_credentials enable row level security;

create policy "org admins read oauth creds"
on public.org_oauth_credentials for select to authenticated
using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

create policy "org admins insert oauth creds"
on public.org_oauth_credentials for insert to authenticated
with check (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

create policy "org admins update oauth creds"
on public.org_oauth_credentials for update to authenticated
using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()))
with check (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

create policy "org admins delete oauth creds"
on public.org_oauth_credentials for delete to authenticated
using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

create trigger trg_org_oauth_credentials_updated
before update on public.org_oauth_credentials
for each row execute function public.set_updated_at();
