
-- Logo bucket
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

create policy "org-logos: public read"
  on storage.objects for select
  using (bucket_id = 'org-logos');

create policy "org-logos: admins upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and (
      has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'org_admin'::app_role)
      or is_super_admin(auth.uid())
    )
  );

create policy "org-logos: admins update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'org-logos'
    and (
      has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'org_admin'::app_role)
      or is_super_admin(auth.uid())
    )
  );

create policy "org-logos: admins delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and (
      has_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'org_admin'::app_role)
      or is_super_admin(auth.uid())
    )
  );

-- Slack import tracking
create type slack_import_status as enum ('pending','running','completed','failed','cancelled');

create table public.slack_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  started_by uuid not null,
  status slack_import_status not null default 'pending',
  scope text not null default 'channels_messages_members',
  history_window text not null default 'all',
  channels_imported integer not null default 0,
  messages_imported integer not null default 0,
  members_linked integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cursor_state jsonb not null default '{}'::jsonb
);

alter table public.slack_imports enable row level security;

create policy "slack_imports: admins manage"
  on public.slack_imports for all to authenticated
  using (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()))
  with check (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()));

-- Slack -> Axon mappings
create table public.slack_user_map (
  org_id uuid not null,
  slack_user_id text not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (org_id, slack_user_id)
);
alter table public.slack_user_map enable row level security;
create policy "slack_user_map: admins manage"
  on public.slack_user_map for all to authenticated
  using (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()))
  with check (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()));

create table public.slack_channel_map (
  org_id uuid not null,
  slack_channel_id text not null,
  channel_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (org_id, slack_channel_id)
);
alter table public.slack_channel_map enable row level security;
create policy "slack_channel_map: admins manage"
  on public.slack_channel_map for all to authenticated
  using (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()))
  with check (has_role(auth.uid(), org_id, 'org_admin'::app_role) or is_super_admin(auth.uid()));

-- Dedupe messages on re-import
alter table public.messages add column if not exists slack_message_id text;
create unique index if not exists messages_channel_slack_msg_idx
  on public.messages (channel_id, slack_message_id)
  where slack_message_id is not null;
