import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import type { CallKind } from "./useCallSession";

/**
 * High-level helpers for call lifecycle:
 * - Active call lookup per channel
 * - Start a new call
 * - Join / leave / end
 */

export interface CallRow {
  id: string;
  channel_id: string;
  initiator_id: string;
  kind: CallKind;
  status: "ringing" | "active" | "ended";
  started_at: string;
}

export function useActiveCall(channelId: string | null | undefined) {
  return useQuery({
    queryKey: ["active-call", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data } = await supabase
        .from("calls")
        .select("*")
        .eq("channel_id", channelId!)
        .neq("status", "ended")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as CallRow | null) ?? null;
    },
  });
}

export function useCallActions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const startCall = useCallback(
    async (channelId: string, kind: CallKind) => {
      if (!user) return null;
      // If a call already exists, reuse it
      const { data: existing } = await supabase
        .from("calls")
        .select("*")
        .eq("channel_id", channelId)
        .neq("status", "ended")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let call = existing as CallRow | null;
      if (!call) {
        const { data, error } = await supabase
          .from("calls")
          .insert({ channel_id: channelId, initiator_id: user.id, kind, status: "active" })
          .select()
          .single();
        if (error || !data) {
          toast.error(error?.message ?? "Could not start call");
          return null;
        }
        call = data as CallRow;
      }

      // Insert / refresh participant row
      await supabase
        .from("call_participants")
        .upsert(
          { call_id: call.id, user_id: user.id, joined_at: new Date().toISOString(), left_at: null },
          { onConflict: "call_id,user_id" },
        );

      qc.invalidateQueries({ queryKey: ["active-call", channelId] });
      return call;
    },
    [user, qc],
  );

  const joinCall = useCallback(
    async (callId: string) => {
      if (!user) return;
      await supabase
        .from("call_participants")
        .upsert(
          { call_id: callId, user_id: user.id, joined_at: new Date().toISOString(), left_at: null },
          { onConflict: "call_id,user_id" },
        );
    },
    [user],
  );

  const leaveCall = useCallback(
    async (callId: string, channelId: string) => {
      if (!user) return;
      await supabase
        .from("call_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("call_id", callId)
        .eq("user_id", user.id);

      // If no one is left, end the call
      const { data: remaining } = await supabase
        .from("call_participants")
        .select("id")
        .eq("call_id", callId)
        .is("left_at", null);
      if (!remaining || remaining.length === 0) {
        await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
      }
      qc.invalidateQueries({ queryKey: ["active-call", channelId] });
    },
    [user, qc],
  );

  return { startCall, joinCall, leaveCall };
}
