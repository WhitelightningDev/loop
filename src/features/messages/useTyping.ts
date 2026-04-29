import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingRow {
  channel_id: string;
  user_id: string;
  expires_at: string;
}

export function useTypingIndicator(channelId: string, userId: string | undefined) {
  const [typers, setTypers] = useState<string[]>([]);
  const lastSentRef = useRef(0);

  // Subscribe to typing changes for this channel
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const refresh = async () => {
      const { data } = await supabase
        .from("typing_indicators")
        .select("user_id, expires_at")
        .eq("channel_id", channelId)
        .gt("expires_at", new Date().toISOString());
      if (cancelled) return;
      setTypers((data ?? []).map((d) => d.user_id).filter((id) => id !== userId));
    };

    void refresh();
    const poll = setInterval(refresh, 2500);

    const ch = supabase
      .channel(`typing-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_indicators", filter: `channel_id=eq.${channelId}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [channelId, userId]);

  const ping = useCallback(async () => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;
    await supabase.from("typing_indicators").upsert(
      {
        channel_id: channelId,
        user_id: userId,
        expires_at: new Date(now + 4000).toISOString(),
      } as unknown as TypingRow,
      { onConflict: "channel_id,user_id" },
    );
  }, [channelId, userId]);

  return { typers, ping };
}
