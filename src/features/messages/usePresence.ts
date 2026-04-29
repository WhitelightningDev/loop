import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Heartbeat: keeps the current user's presence_status='online' while the tab is active.
 * Marks 'offline' on unmount / page hide.
 */
export function usePresenceHeartbeat(userId: string | undefined, orgId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const beat = async (status: "online" | "away" | "offline") => {
      // Composite key: (user_id, org_id) — different orgs don't overwrite each other.
      // We can't use upsert with a partial-coalesced unique index, so do a manual
      // "update first, insert if no row" pattern. Cheap and race-tolerant enough
      // for a 30s heartbeat.
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("user_presence")
        .update({ status, last_seen_at: nowIso })
        .eq("user_id", userId);
      q = orgId ? q.eq("org_id", orgId) : q.is("org_id", null);
      const { data: updated } = await q.select("user_id");
      if (!updated || updated.length === 0) {
        await supabase.from("user_presence").insert({
          user_id: userId,
          org_id: orgId ?? null,
          status,
          last_seen_at: nowIso,
        });
      }
      await supabase.from("user_profiles").update({ presence_status: status }).eq("id", userId);
    };

    void beat("online");
    const interval = setInterval(() => void beat("online"), 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void beat("away");
      else void beat("online");
    };
    const onUnload = () => { void beat("offline"); };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      void beat("offline");
    };
  }, [userId, orgId]);
}
