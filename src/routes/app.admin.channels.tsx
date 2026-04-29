import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hash, Lock, EyeOff, Globe } from "lucide-react";

export const Route = createFileRoute("/app/admin/channels")({
  component: ChannelsAdmin,
});

type ChannelRow = {
  id: string;
  name: string;
  description: string | null;
  type: "public" | "private" | "dm";
  visibility: "open" | "restricted";
  is_archived: boolean;
  is_locked: boolean;
};

function ChannelsAdmin() {
  const { currentOrg } = useOrg();
  const qc = useQueryClient();

  const { data: channels = [] } = useQuery({
    queryKey: ["admin-channels", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
        .select("id, name, description, type, visibility, is_archived, is_locked")
        .eq("org_id", currentOrg!.id)
        .neq("type", "dm")
        .order("created_at", { ascending: false });
      return (data ?? []) as ChannelRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-channels", currentOrg?.id] });
    qc.invalidateQueries({ queryKey: ["sidebar-channels"] });
  };

  const update = async (id: string, patch: Partial<ChannelRow>, msg: string) => {
    const { error } = await supabase.from("channels").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Channels</h2>
        <p className="text-sm text-muted-foreground">
          Control privacy, lock conversations, and archive channels in this workspace.
        </p>
      </div>

      <div className="space-y-3">
        {channels.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No channels yet.
          </div>
        )}

        {channels.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {c.type === "private" ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Hash className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">{c.name}</span>
                  {c.is_archived && <Badge variant="secondary">Archived</Badge>}
                  {c.is_locked && (
                    <Badge variant="destructive" className="gap-1">
                      <Lock className="h-3 w-3" /> Locked
                    </Badge>
                  )}
                  {c.visibility === "restricted" && (
                    <Badge variant="outline" className="gap-1">
                      <EyeOff className="h-3 w-3" /> Restricted
                    </Badge>
                  )}
                </div>
                {c.description && (
                  <div className="mt-1 text-sm text-muted-foreground">{c.description}</div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update(
                    c.id,
                    { is_archived: !c.is_archived },
                    c.is_archived ? "Channel restored" : "Channel archived",
                  )
                }
              >
                {c.is_archived ? "Restore" : "Archive"}
              </Button>
            </div>

            <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Type
                </Label>
                <Select
                  value={c.type === "dm" ? "public" : c.type}
                  onValueChange={(v) =>
                    update(
                      c.id,
                      { type: v as "public" | "private" },
                      `Channel set to ${v}`,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Hash className="h-3.5 w-3.5" /> Public
                      </div>
                    </SelectItem>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" /> Private
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Visibility
                </Label>
                <Select
                  value={c.visibility}
                  onValueChange={(v) =>
                    update(
                      c.id,
                      { visibility: v as "open" | "restricted" },
                      `Visibility set to ${v}`,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5" /> Open to workspace
                      </div>
                    </SelectItem>
                    <SelectItem value="restricted">
                      <div className="flex items-center gap-2">
                        <EyeOff className="h-3.5 w-3.5" /> Restricted to members
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-between gap-3 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Lock channel</div>
                  <div className="text-xs text-muted-foreground">
                    Only admins can post.
                  </div>
                </div>
                <Switch
                  checked={c.is_locked}
                  onCheckedChange={(checked) =>
                    update(
                      c.id,
                      { is_locked: checked },
                      checked ? "Channel locked" : "Channel unlocked",
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
