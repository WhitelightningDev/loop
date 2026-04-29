
-- =====================================================================
-- FLOWCHAT — Initial schema, RLS, helpers, triggers, storage
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type public.app_role as enum ('super_admin','org_admin','manager','member','guest');
create type public.channel_type as enum ('public','private','group','dm');
create type public.member_status as enum ('active','invited','suspended');
create type public.presence_status as enum ('online','away','offline');
create type public.notif_level as enum ('all','mentions','none');

-- =====================================================================
-- TABLES
-- =====================================================================

-- Organisations
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User profiles (1:1 with auth.users)
create table public.user_profiles (
  id uuid primary key, -- = auth.users.id
  email text not null,
  full_name text,
  avatar_url text,
  job_title text,
  department text,
  status_text text,
  presence_status public.presence_status not null default 'offline',
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Organisation members
create table public.organisation_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null,
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on public.organisation_members(user_id);
create index on public.organisation_members(org_id);

-- Roles (org-scoped, super_admin uses null org_id)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id, role)
);
create index on public.user_roles(user_id);
create index on public.user_roles(org_id);

-- Invites
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'member',
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  invited_by uuid not null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.invites(org_id);
create index on public.invites(email);

-- Channels
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  type public.channel_type not null default 'public',
  name text not null,
  description text,
  topic text,
  created_by uuid not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.channels(org_id);
create unique index channels_org_name_unique
  on public.channels(org_id, lower(name))
  where type in ('public','private') and is_archived = false;

-- Channel members
create table public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member', -- 'admin' | 'member'
  notif_level public.notif_level not null default 'all',
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  unique (channel_id, user_id)
);
create index on public.channel_members(user_id);
create index on public.channel_members(channel_id);

-- Messages (with FTS)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null,
  body text not null default '',
  parent_id uuid references public.messages(id) on delete cascade,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  ts_search tsvector generated always as (to_tsvector('english', coalesce(body,''))) stored
);
create index on public.messages(channel_id, created_at desc);
create index on public.messages(parent_id);
create index messages_ts_search_idx on public.messages using gin(ts_search);

-- Reactions
create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index on public.message_reactions(message_id);

-- Attachments
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size bigint,
  width int,
  height int,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index on public.attachments(message_id);

-- Pinned messages
create table public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null,
  pinned_at timestamptz not null default now(),
  unique (channel_id, message_id)
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_id uuid references public.organisations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, read_at);

-- Presence
create table public.user_presence (
  user_id uuid primary key,
  org_id uuid references public.organisations(id) on delete cascade,
  status public.presence_status not null default 'offline',
  last_seen_at timestamptz not null default now()
);

-- Typing indicators
create table public.typing_indicators (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null,
  expires_at timestamptz not null default (now() + interval '4 seconds'),
  primary key (channel_id, user_id)
);

-- Audit log
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs(org_id, created_at desc);

-- =====================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER, no recursion)
-- =====================================================================

create or replace function public.is_org_member(_user uuid, _org uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organisation_members
    where user_id = _user and org_id = _org and status = 'active'
  );
$$;

create or replace function public.has_role(_user uuid, _org uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user
      and role = _role
      and (
        (_role = 'super_admin' and org_id is null)
        or org_id = _org
      )
  );
$$;

create or replace function public.is_super_admin(_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user and role = 'super_admin' and org_id is null
  );
$$;

create or replace function public.is_channel_member(_user uuid, _channel uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.channel_members
    where user_id = _user and channel_id = _channel
  );
$$;

create or replace function public.can_read_channel(_user uuid, _channel uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.channels c
    where c.id = _channel
      and (
        -- public channel: any active org member can read
        (c.type = 'public' and public.is_org_member(_user, c.org_id))
        -- otherwise must be a channel member
        or public.is_channel_member(_user, _channel)
        -- super admin can read all
        or public.is_super_admin(_user)
      )
  );
$$;

create or replace function public.channel_org(_channel uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.channels where id = _channel;
$$;

create or replace function public.message_channel(_message uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select channel_id from public.messages where id = _message;
$$;

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- On organisation insert: add creator as active member + grant org_admin
create or replace function public.handle_new_organisation()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.organisation_members(org_id, user_id, status)
  values (new.id, new.created_by, 'active')
  on conflict do nothing;

  insert into public.user_roles(org_id, user_id, role)
  values (new.id, new.created_by, 'org_admin')
  on conflict do nothing;

  -- Seed a #general public channel
  insert into public.channels(org_id, type, name, description, created_by)
  values (new.id, 'public', 'general', 'Company-wide announcements and discussion', new.created_by);

  return new;
end;
$$;

drop trigger if exists on_organisation_created on public.organisations;
create trigger on_organisation_created
  after insert on public.organisations
  for each row execute function public.handle_new_organisation();

-- After channel insert: add creator as channel admin
create or replace function public.handle_new_channel()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.channel_members(channel_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_channel_created on public.channels;
create trigger on_channel_created
  after insert on public.channels
  for each row execute function public.handle_new_channel();

-- updated_at touch
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger touch_orgs before update on public.organisations
  for each row execute function public.touch_updated_at();
create trigger touch_profiles before update on public.user_profiles
  for each row execute function public.touch_updated_at();
create trigger touch_channels before update on public.channels
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.organisations         enable row level security;
alter table public.user_profiles         enable row level security;
alter table public.organisation_members  enable row level security;
alter table public.user_roles            enable row level security;
alter table public.invites               enable row level security;
alter table public.channels              enable row level security;
alter table public.channel_members       enable row level security;
alter table public.messages              enable row level security;
alter table public.message_reactions     enable row level security;
alter table public.attachments           enable row level security;
alter table public.pinned_messages       enable row level security;
alter table public.notifications         enable row level security;
alter table public.user_presence         enable row level security;
alter table public.typing_indicators     enable row level security;
alter table public.audit_logs            enable row level security;

-- ---------- organisations ----------
create policy "orgs: members can read"
  on public.organisations for select to authenticated
  using (public.is_org_member(auth.uid(), id) or public.is_super_admin(auth.uid()));

create policy "orgs: any authenticated can create (becomes admin via trigger)"
  on public.organisations for insert to authenticated
  with check (created_by = auth.uid());

create policy "orgs: org admins can update"
  on public.organisations for update to authenticated
  using (public.has_role(auth.uid(), id, 'org_admin') or public.is_super_admin(auth.uid()))
  with check (public.has_role(auth.uid(), id, 'org_admin') or public.is_super_admin(auth.uid()));

create policy "orgs: super admin can delete"
  on public.organisations for delete to authenticated
  using (public.is_super_admin(auth.uid()));

-- ---------- user_profiles ----------
create policy "profiles: any authenticated can read"
  on public.user_profiles for select to authenticated using (true);

create policy "profiles: user updates own"
  on public.user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: user inserts own"
  on public.user_profiles for insert to authenticated
  with check (id = auth.uid());

-- ---------- organisation_members ----------
create policy "org_members: members can read same org"
  on public.organisation_members for select to authenticated
  using (public.is_org_member(auth.uid(), org_id) or public.is_super_admin(auth.uid()));

create policy "org_members: org admins can manage"
  on public.organisation_members for all to authenticated
  using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()))
  with check (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

create policy "org_members: user can leave (delete own)"
  on public.organisation_members for delete to authenticated
  using (user_id = auth.uid());

-- ---------- user_roles ----------
create policy "roles: members read same org"
  on public.user_roles for select to authenticated
  using (
    (org_id is not null and public.is_org_member(auth.uid(), org_id))
    or public.is_super_admin(auth.uid())
  );

create policy "roles: org admin manages org roles (no super_admin)"
  on public.user_roles for all to authenticated
  using (
    org_id is not null
    and role <> 'super_admin'
    and (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()))
  )
  with check (
    org_id is not null
    and role <> 'super_admin'
    and (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()))
  );

create policy "roles: super admin manages all"
  on public.user_roles for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- ---------- invites ----------
create policy "invites: org admins read"
  on public.invites for select to authenticated
  using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

create policy "invites: org admins manage"
  on public.invites for all to authenticated
  using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()))
  with check (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

-- ---------- channels ----------
create policy "channels: readable by org members for public, by members for private"
  on public.channels for select to authenticated
  using (
    public.is_super_admin(auth.uid())
    or (type = 'public' and public.is_org_member(auth.uid(), org_id))
    or public.is_channel_member(auth.uid(), id)
  );

create policy "channels: org members can create"
  on public.channels for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_org_member(auth.uid(), org_id)
  );

create policy "channels: channel admins or org admins update"
  on public.channels for update to authenticated
  using (
    public.has_role(auth.uid(), org_id, 'org_admin')
    or public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.channel_members cm
      where cm.channel_id = id and cm.user_id = auth.uid() and cm.role = 'admin'
    )
  )
  with check (
    public.has_role(auth.uid(), org_id, 'org_admin')
    or public.is_super_admin(auth.uid())
    or exists (
      select 1 from public.channel_members cm
      where cm.channel_id = id and cm.user_id = auth.uid() and cm.role = 'admin'
    )
  );

create policy "channels: org admin can delete"
  on public.channels for delete to authenticated
  using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

-- ---------- channel_members ----------
create policy "channel_members: read if can read channel"
  on public.channel_members for select to authenticated
  using (public.can_read_channel(auth.uid(), channel_id));

create policy "channel_members: join public channels (self)"
  on public.channel_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.channels c
      where c.id = channel_id and c.type = 'public'
        and public.is_org_member(auth.uid(), c.org_id)
    )
  );

create policy "channel_members: channel/org admins manage"
  on public.channel_members for all to authenticated
  using (
    public.is_super_admin(auth.uid())
    or public.has_role(auth.uid(), public.channel_org(channel_id), 'org_admin')
    or exists (
      select 1 from public.channel_members cm
      where cm.channel_id = channel_id and cm.user_id = auth.uid() and cm.role = 'admin'
    )
  )
  with check (
    public.is_super_admin(auth.uid())
    or public.has_role(auth.uid(), public.channel_org(channel_id), 'org_admin')
    or exists (
      select 1 from public.channel_members cm
      where cm.channel_id = channel_id and cm.user_id = auth.uid() and cm.role = 'admin'
    )
  );

create policy "channel_members: leave self"
  on public.channel_members for delete to authenticated
  using (user_id = auth.uid());

create policy "channel_members: update own prefs"
  on public.channel_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- messages ----------
create policy "messages: readable if can read channel"
  on public.messages for select to authenticated
  using (public.can_read_channel(auth.uid(), channel_id));

create policy "messages: members can post in non-archived channels"
  on public.messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_channel_member(auth.uid(), channel_id)
    and not exists (select 1 from public.channels c where c.id = channel_id and c.is_archived)
  );

create policy "messages: author can update"
  on public.messages for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "messages: author or org admin can delete"
  on public.messages for delete to authenticated
  using (
    author_id = auth.uid()
    or public.has_role(auth.uid(), public.channel_org(channel_id), 'org_admin')
    or public.is_super_admin(auth.uid())
  );

-- ---------- reactions ----------
create policy "reactions: read with channel"
  on public.message_reactions for select to authenticated
  using (public.can_read_channel(auth.uid(), public.message_channel(message_id)));

create policy "reactions: members add own"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_channel_member(auth.uid(), public.message_channel(message_id))
  );

create policy "reactions: remove own"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ---------- attachments ----------
create policy "attachments: read with channel"
  on public.attachments for select to authenticated
  using (public.can_read_channel(auth.uid(), public.message_channel(message_id)));

create policy "attachments: creator inserts"
  on public.attachments for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_channel_member(auth.uid(), public.message_channel(message_id))
  );

create policy "attachments: creator deletes"
  on public.attachments for delete to authenticated
  using (created_by = auth.uid());

-- ---------- pinned ----------
create policy "pinned: read with channel"
  on public.pinned_messages for select to authenticated
  using (public.can_read_channel(auth.uid(), channel_id));

create policy "pinned: members manage"
  on public.pinned_messages for all to authenticated
  using (public.is_channel_member(auth.uid(), channel_id))
  with check (public.is_channel_member(auth.uid(), channel_id) and pinned_by = auth.uid());

-- ---------- notifications ----------
create policy "notifications: owner reads"
  on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: owner updates"
  on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: owner deletes"
  on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------- presence ----------
create policy "presence: org members read"
  on public.user_presence for select to authenticated
  using (
    org_id is null
    or public.is_org_member(auth.uid(), org_id)
    or user_id = auth.uid()
  );
create policy "presence: user upserts own"
  on public.user_presence for insert to authenticated with check (user_id = auth.uid());
create policy "presence: user updates own"
  on public.user_presence for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- typing ----------
create policy "typing: read with channel"
  on public.typing_indicators for select to authenticated
  using (public.can_read_channel(auth.uid(), channel_id));
create policy "typing: user upserts own"
  on public.typing_indicators for insert to authenticated
  with check (user_id = auth.uid() and public.is_channel_member(auth.uid(), channel_id));
create policy "typing: user updates own"
  on public.typing_indicators for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "typing: user deletes own"
  on public.typing_indicators for delete to authenticated using (user_id = auth.uid());

-- ---------- audit_logs ----------
create policy "audit: org admins read"
  on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(), org_id, 'org_admin') or public.is_super_admin(auth.uid()));

-- =====================================================================
-- INVITE ACCEPT RPC (security definer)
-- =====================================================================
create or replace function public.accept_invite(_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_user;

  select * into v_invite from public.invites where token = _token;
  if not found then raise exception 'Invalid invite'; end if;
  if v_invite.accepted_at is not null then raise exception 'Invite already used'; end if;
  if v_invite.expires_at < now() then raise exception 'Invite expired'; end if;
  if lower(v_invite.email) <> lower(coalesce(v_email,'')) then
    raise exception 'Invite email does not match your account';
  end if;

  insert into public.organisation_members(org_id, user_id, status)
  values (v_invite.org_id, v_user, 'active')
  on conflict (org_id, user_id) do update set status = 'active';

  insert into public.user_roles(org_id, user_id, role)
  values (v_invite.org_id, v_user, v_invite.role)
  on conflict do nothing;

  update public.invites set accepted_at = now() where id = v_invite.id;

  -- auto-join #general
  insert into public.channel_members(channel_id, user_id)
  select c.id, v_user from public.channels c
  where c.org_id = v_invite.org_id and c.type = 'public' and lower(c.name) = 'general'
  on conflict do nothing;

  return v_invite.org_id;
end;
$$;

-- =====================================================================
-- REALTIME
-- =====================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.pinned_messages;
alter publication supabase_realtime add table public.channel_members;
alter publication supabase_realtime add table public.typing_indicators;
alter publication supabase_realtime add table public.user_presence;

-- =====================================================================
-- STORAGE BUCKETS
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- avatars: public read, owner write
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and owner = auth.uid());

create policy "avatars owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid())
  with check (bucket_id = 'avatars' and owner = auth.uid());

create policy "avatars owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());

-- attachments: authenticated read (RLS-gated via app), owner manage
create policy "attachments authed read"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

create policy "attachments owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and owner = auth.uid());

create policy "attachments owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and owner = auth.uid());
