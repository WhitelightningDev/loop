
-- Helper: is the user a channel admin? SECURITY DEFINER bypasses RLS recursion.
CREATE OR REPLACE FUNCTION public.is_channel_admin(_user uuid, _channel uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = _channel
      AND user_id = _user
      AND role = 'admin'
  );
$$;

-- Replace the recursive channel_members policy
DROP POLICY IF EXISTS "channel_members: channel/org admins manage" ON public.channel_members;

CREATE POLICY "channel_members: channel/org admins manage"
ON public.channel_members
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), public.channel_org(channel_id), 'org_admin'::public.app_role)
  OR public.is_channel_admin(auth.uid(), channel_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), public.channel_org(channel_id), 'org_admin'::public.app_role)
  OR public.is_channel_admin(auth.uid(), channel_id)
);

-- The channels UPDATE policy has the same shape bug; fix it too.
DROP POLICY IF EXISTS "channels: channel admins or org admins update" ON public.channels;

CREATE POLICY "channels: channel admins or org admins update"
ON public.channels
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), org_id, 'org_admin'::public.app_role)
  OR public.is_channel_admin(auth.uid(), id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), org_id, 'org_admin'::public.app_role)
  OR public.is_channel_admin(auth.uid(), id)
);
