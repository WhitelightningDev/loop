CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite public.invites%rowtype;
  v_user uuid := auth.uid();
  v_email text;
  v_meta jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select email, raw_user_meta_data into v_email, v_meta from auth.users where id = v_user;

  select * into v_invite from public.invites where token = _token;
  if not found then raise exception 'Invalid invite'; end if;
  if v_invite.accepted_at is not null then raise exception 'Invite already used'; end if;
  if v_invite.expires_at < now() then raise exception 'Invite expired'; end if;
  if lower(v_invite.email) <> lower(coalesce(v_email,'')) then
    raise exception 'Invite email does not match your account';
  end if;

  -- Ensure a profile exists for the invited user (defensive: in case the
  -- on_auth_user_created trigger ever missed this account).
  insert into public.user_profiles (id, email, full_name, avatar_url)
  values (
    v_user,
    v_email,
    coalesce(v_meta->>'full_name', v_meta->>'name', split_part(v_email,'@',1)),
    v_meta->>'avatar_url'
  )
  on conflict (id) do update
    set email = coalesce(public.user_profiles.email, excluded.email),
        full_name = coalesce(public.user_profiles.full_name, excluded.full_name);

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
$function$;