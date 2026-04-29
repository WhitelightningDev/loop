import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();

  const { data: general } = useQuery({
    queryKey: ["general-channel", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
        .select("id")
        .eq("org_id", currentOrg!.id)
        .eq("type", "public")
        .ilike("name", "general")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (general?.id) navigate({ to: "/app/c/$channelId", params: { channelId: general.id } });
  }, [general, navigate]);

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Pick a loop from the sidebar to jump in.
    </div>
  );
}
