-- Add Google to integration_provider enum and allow it in org_oauth_credentials.
-- Required for Gmail API sending via Admin → Integrations.

do $$
begin
  alter type public.integration_provider add value if not exists 'google';
exception
  when duplicate_object then null;
end $$;

alter table public.org_oauth_credentials
  drop constraint if exists org_oauth_credentials_provider_check;

alter table public.org_oauth_credentials
  add constraint org_oauth_credentials_provider_check
  check (provider in ('github', 'jira', 'figma', 'google'));

