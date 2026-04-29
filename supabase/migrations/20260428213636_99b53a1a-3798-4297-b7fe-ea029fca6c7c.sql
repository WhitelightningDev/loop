-- 1. New enum for job roles
do $$ begin
  create type public.job_role as enum (
    'employee',
    'executive',
    'manager',
    'product_manager',
    'developer',
    'designer',
    'marketer',
    'operations',
    'sales',
    'support',
    'hr',
    'finance',
    'legal',
    'other'
  );
exception when duplicate_object then null; end $$;

-- 2. Add job_role to invites
alter table public.invites
  add column if not exists job_role public.job_role not null default 'employee';

-- 3. Add job_role to organisation_members
alter table public.organisation_members
  add column if not exists job_role public.job_role not null default 'employee';

-- 4. Channel: is_locked + visibility
alter table public.channels
  add column if not exists is_locked boolean not null default false;

do $$ begin
  create type public.channel_visibility as enum ('open', 'restricted');
exception when duplicate_object then null; end $$;

alter table public.channels
  add column if not exists visibility public.channel_visibility not null default 'open';

-- 5. Update accept_invite to copy job_role onto membership
create or replace function public.accept_invite(_token text)
returns uuid
language plpgsql
security definer
set search_path = public
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

  insert into public.organisation_members(org_id, user_id, status, job_role)
  values (v_invite.org_id, v_user, 'active', v_invite.job_role)
  on conflict (org_id, user_id) do update
    set status = 'active', job_role = excluded.job_role;

  insert into public.user_roles(org_id, user_id, role)
  values (v_invite.org_id, v_user, v_invite.role)
  on conflict do nothing;

  update public.invites set accepted_at = now() where id = v_invite.id;

  insert into public.channel_members(channel_id, user_id)
  select c.id, v_user from public.channels c
  where c.org_id = v_invite.org_id and c.type = 'public' and lower(c.name) = 'general'
  on conflict do nothing;

  return v_invite.org_id;
end;
$$;

-- 6. Update message-insert RLS so locked channels block non-admins from posting
drop policy if exists "messages: members can post in non-archived channels" on public.messages;
create policy "messages: members can post in non-archived non-locked channels"
on public.messages
for insert
to authenticated
with check (
  author_id = auth.uid()
  and is_channel_member(auth.uid(), channel_id)
  and not exists (
    select 1 from public.channels c
    where c.id = messages.channel_id and c.is_archived
  )
  and (
    -- channel not locked, OR user is org/super admin
    not exists (
      select 1 from public.channels c where c.id = messages.channel_id and c.is_locked
    )
    or has_role(auth.uid(), channel_org(messages.channel_id), 'org_admin'::app_role)
    or is_super_admin(auth.uid())
  )
);
