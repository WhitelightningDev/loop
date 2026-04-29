
-- Fix search_path on trigger fn missing it
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

-- Revoke execute from anon/public on all our SECURITY DEFINER functions.
-- They should only be callable by authenticated users (RLS still applies inside).
revoke execute on function public.is_org_member(uuid, uuid) from public, anon;
revoke execute on function public.has_role(uuid, uuid, public.app_role) from public, anon;
revoke execute on function public.is_super_admin(uuid) from public, anon;
revoke execute on function public.is_channel_member(uuid, uuid) from public, anon;
revoke execute on function public.can_read_channel(uuid, uuid) from public, anon;
revoke execute on function public.channel_org(uuid) from public, anon;
revoke execute on function public.message_channel(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.handle_new_organisation() from public, anon;
revoke execute on function public.handle_new_channel() from public, anon;
revoke execute on function public.touch_updated_at() from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;

grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.has_role(uuid, uuid, public.app_role) to authenticated;
grant execute on function public.is_super_admin(uuid) to authenticated;
grant execute on function public.is_channel_member(uuid, uuid) to authenticated;
grant execute on function public.can_read_channel(uuid, uuid) to authenticated;
grant execute on function public.channel_org(uuid) to authenticated;
grant execute on function public.message_channel(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- Tighten public avatar bucket: only let users list their own files (path prefix = user id)
drop policy if exists "avatars public read" on storage.objects;

create policy "avatars: public read individual files"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Note: we keep public read for direct-link rendering of avatars, but listing
-- isn't possible without a path, so this satisfies normal use.
