import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrg } from "@/features/organisations/OrgProvider";
import { ChannelView } from "@/features/messages/ChannelView";

export const Route = createFileRoute("/app/dm/$userId")({
  component: DMPage,
});

function DMPage() {
  const { userId: otherId } = Route.useParams();
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [channelId, setChannelId] = useState<string | null>(null);

  useQuery({
    queryKey: ["dm", currentOrg?.id, user?.id, otherId],
    enabled: !!user && !!currentOrg,
    queryFn: async () => {
      // Find a DM channel that contains exactly user + otherId in this org.
      const { data: existing } = await supabase
        .from("channels")
        .select("id, channel_members!inner(user_id)")
        .eq("org_id", currentOrg!.id)
        .eq("type", "dm");

      const match = existing?.find((c: any) => {
        const ids = (c.channel_members as { user_id: string }[]).map((m) => m.user_id).sort();
        const want = [user!.id, otherId].sort();
        return ids.length === 2 && ids[0] === want[0] && ids[1] === want[1];
      });

      if (match) {
        setChannelId(match.id);
        return match;
      }

      // Create DM channel + add both members
      const { data: newCh, error } = await supabase
        .from("channels")
        .insert({
          org_id: currentOrg!.id,
          type: "dm",
          name: `dm-${user!.id.slice(0, 6)}-${otherId.slice(0, 6)}`,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error || !newCh) throw error;
      // Trigger added creator; add the other user
      await supabase.from("channel_members").insert({ channel_id: newCh.id, user_id: otherId });
      setChannelId(newCh.id);
      return newCh;
    },
  });

  useEffect(() => {
    setChannelId(null);
  }, [otherId]);

  if (!channelId) return <div className="flex h-full items-center justify-center text-muted-foreground">Opening conversation...</div>;
  return <ChannelView channelId={channelId} />;
}
