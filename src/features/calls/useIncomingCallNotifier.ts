import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrg } from "@/features/organisations/OrgProvider";

/**
 * Listens for new calls created in any channel of the current org that the
 * user is a member of and surfaces a "Join call" toast.
 */
export function useIncomingCallNotifier() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !currentOrg) return;
    const orgId = currentOrg.id;

    const ch = supabase
      .channel(`incoming-calls-${orgId}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        async (payload) => {
          const call = payload.new as {
            id: string; channel_id: string; initiator_id: string; kind: "voice" | "video";
          };
          if (!call || call.initiator_id === user.id) return;
          if (seenRef.current.has(call.id)) return;
          seenRef.current.add(call.id);

          // Verify the call belongs to a channel the user can read in this org
          const { data: channel } = await supabase
            .from("channels")
            .select("id, name, type, org_id")
            .eq("id", call.channel_id)
            .maybeSingle();
          if (!channel || channel.org_id !== orgId) return;

          const { data: profile } = await supabase
            .from("user_profiles")
            .select("full_name, email")
            .eq("id", call.initiator_id)
            .maybeSingle();

          const who = profile?.full_name ?? profile?.email ?? "Someone";
          const where = channel.type === "dm" ? "a direct message" : `#${channel.name}`;

          toast(`${who} started a ${call.kind} call`, {
            description: `In ${where}`,
            duration: 15000,
            action: {
              label: "Join",
              onClick: () => {
                navigate({ to: "/app/c/$channelId", params: { channelId: call.channel_id } });
              },
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, currentOrg, navigate]);
}
