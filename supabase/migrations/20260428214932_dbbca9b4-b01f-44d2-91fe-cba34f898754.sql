
-- Call kind enum
DO $$ BEGIN
  CREATE TYPE public.call_kind AS ENUM ('voice', 'video');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.call_status AS ENUM ('ringing', 'active', 'ended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL,
  kind public.call_kind NOT NULL DEFAULT 'voice',
  status public.call_status NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calls_channel_active
  ON public.calls(channel_id) WHERE status <> 'ended';

CREATE TABLE IF NOT EXISTS public.call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE (call_id, user_id)
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- Read calls in channels you can read
CREATE POLICY "calls_read" ON public.calls
  FOR SELECT TO authenticated
  USING (public.can_read_channel(auth.uid(), channel_id));

-- Start a call in a channel you can read; you must be initiator
CREATE POLICY "calls_insert" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = initiator_id
    AND public.can_read_channel(auth.uid(), channel_id)
  );

-- Initiator can end the call
CREATE POLICY "calls_update_initiator" ON public.calls
  FOR UPDATE TO authenticated
  USING (auth.uid() = initiator_id)
  WITH CHECK (auth.uid() = initiator_id);

-- Participants: read if you can read the underlying call/channel
CREATE POLICY "call_participants_read" ON public.call_participants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_id
        AND public.can_read_channel(auth.uid(), c.channel_id)
    )
  );

-- Join: insert your own row if you can read the call's channel
CREATE POLICY "call_participants_insert_self" ON public.call_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_id
        AND public.can_read_channel(auth.uid(), c.channel_id)
    )
  );

-- Leave: update your own row
CREATE POLICY "call_participants_update_self" ON public.call_participants
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
