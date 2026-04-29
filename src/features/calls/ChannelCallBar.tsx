import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { useActiveCall, useCallActions } from "./useCallActions";

/**
 * Sticky bar shown above the messages area when a call is active in this channel.
 * Lets users start a call or join an in-progress one.
 */
export function ChannelCallBar({
  channelId,
  onOpenCall,
}: {
  channelId: string;
  onOpenCall: (callId: string, kind: "voice" | "video") => void;
}) {
  useAuth(); // ensure auth context exists when bar mounts
  const qc = useQueryClient();
  const { data: active } = useActiveCall(channelId);
  const { joinCall } = useCallActions();

  // Realtime: refresh when calls change in this channel
  useEffect(() => {
    const ch = supabase
      .channel(`calls-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `channel_id=eq.${channelId}` },
        () => qc.invalidateQueries({ queryKey: ["active-call", channelId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [channelId, qc]);


  const handleJoin = async () => {
    if (!active) return;
    await joinCall(active.id);
    onOpenCall(active.id, active.kind);
  };

  if (active) {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-success/10 px-5 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="font-medium">
            {active.kind === "video" ? "Video call" : "Voice call"} in progress
          </span>
        </div>
        <Button size="sm" onClick={handleJoin} className="h-7">
          {active.kind === "video" ? <Video className="mr-1.5 h-3.5 w-3.5" /> : <Phone className="mr-1.5 h-3.5 w-3.5" />}
          Join call
        </Button>
      </div>
    );
  }

  return (
    <div className="hidden">
      {/* Trigger buttons live in the channel header (rendered separately) */}
    </div>
  );
}

/** Compact call buttons for use in the channel header. */
export function CallTriggerButtons({
  channelId,
  onOpenCall,
}: {
  channelId: string;
  onOpenCall: (callId: string, kind: "voice" | "video") => void;
}) {
  const { startCall } = useCallActions();
  const handleStart = async (kind: "voice" | "video") => {
    const call = await startCall(channelId, kind);
    if (call) onOpenCall(call.id, call.kind);
  };
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleStart("voice")}
        title="Start voice call"
        className="h-8 w-8 p-0"
      >
        <Phone className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleStart("video")}
        title="Start video call"
        className="h-8 w-8 p-0"
      >
        <Video className="h-4 w-4" />
      </Button>
    </>
  );
}
