-- Replace the self-join policy so locked public channels cannot be self-joined
DROP POLICY IF EXISTS "channel_members: join public channels (self)" ON public.channel_members;

CREATE POLICY "channel_members: join public channels (self)"
ON public.channel_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_members.channel_id
      AND c.type = 'public'
      AND c.is_locked = false
      AND public.is_org_member(auth.uid(), c.org_id)
  )
);

-- Self-leave is unchanged: users can always leave a channel themselves.
-- Admin manage policy is unchanged: org/channel admins can still add/remove regardless of lock.
