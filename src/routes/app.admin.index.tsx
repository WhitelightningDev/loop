import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Users, Hash, Mail } from "lucide-react";

export const Route = createFileRoute("/app/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { currentOrg } = useOrg();
  const { data } = useQuery({
    queryKey: ["admin-overview", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const orgId = currentOrg!.id;
      const [members, channels, invites] = await Promise.all([
        supabase.from("organisation_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("channels").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_archived", false),
        supabase.from("invites").select("id", { count: "exact", head: true }).eq("org_id", orgId).is("accepted_at", null),
      ]);
      return {
        members: members.count ?? 0,
        channels: channels.count ?? 0,
        invites: invites.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Members", value: data?.members ?? 0, icon: Users },
    { label: "Active channels", value: data?.channels ?? 0, icon: Hash },
    { label: "Pending invites", value: data?.invites ?? 0, icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Workspace overview</h2>
        <p className="text-sm text-muted-foreground">
          Quick health snapshot for {currentOrg?.name}.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
