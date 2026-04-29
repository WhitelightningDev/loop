import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slack, Download, AlertTriangle, CheckCircle2, Loader2, ExternalLink, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/app/admin/slack")({
  component: SlackImportPage,
});

function SlackImportPage() {
  const { currentOrg } = useOrg();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [historyWindow, setHistoryWindow] = useState<"all" | "12m" | "30d">("all");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const { data: imports = [] } = useQuery({
    queryKey: ["slack-imports", currentOrg?.id],
    enabled: !!currentOrg,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await supabase
        .from("slack_imports")
        .select("*")
        .eq("org_id", currentOrg!.id)
        .order("started_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const active = imports.find((i: any) => i.status === "running" || i.status === "pending");

  const startImport = async () => {
    if (!currentOrg) return;
    if (!token.trim()) {
      toast.error("Paste your Slack Bot User OAuth Token to start.");
      return;
    }
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("slack-import", {
      body: {
        org_id: currentOrg.id,
        history_window: historyWindow,
        slack_token: token.trim(),
      },
    });
    setRunning(false);
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error ?? error?.message ?? "Import failed";
      toast.error(msg);
      qc.invalidateQueries({ queryKey: ["slack-imports", currentOrg.id] });
      return;
    }
    toast.success(`Imported ${(data as any).channels} channels and ${(data as any).messages} messages.`);
    setToken("");
    qc.invalidateQueries({ queryKey: ["slack-imports", currentOrg.id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Migrate from Slack</h2>
          <p className="text-sm text-muted-foreground">
            Recreate your Slack public channels here, link members by email, and import message history.
          </p>
        </div>
        <Slack className="h-6 w-6 text-muted-foreground" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <h3 className="font-medium">Run an import</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Imports are <strong>safe to re-run</strong> — channels and messages already imported are skipped.
            Public channels only.
          </p>
        </div>

        <ManualGuide />

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Slack Bot User OAuth Token</label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              placeholder="xoxb-..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowToken((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Starts with <code className="rounded bg-muted px-1">xoxb-</code>. The token is sent securely to the import job and is not stored.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message history</label>
            <Select value={historyWindow} onValueChange={(v) => setHistoryWindow(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="all">Everything available</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={startImport} disabled={running || !!active} size="lg">
            {running || active ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Start import</>
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-medium">Recent imports</div>
        <div className="divide-y divide-border">
          {imports.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No imports yet.</div>
          )}
          {imports.map((i: any) => (
            <div key={i.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={i.status} />
                  <span className="text-sm">{new Date(i.started_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {i.channels_imported} channels · {i.messages_imported} messages · {i.members_linked} members linked
                </div>
                {i.error_message && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-all">{i.error_message}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManualGuide() {
  const scopes = [
    "channels:read",
    "channels:history",
    "users:read",
    "users:read.email",
    "team:read",
  ];
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
      <p className="font-medium mb-2">Step-by-step: get a Slack bot token</p>
      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>
          Open{" "}
          <a
            href="https://api.slack.com/apps"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
          >
            api.slack.com/apps <ExternalLink className="h-3 w-3" />
          </a>{" "}
          and sign in to the Slack workspace you want to migrate from.
        </li>
        <li>
          Click <strong>Create New App → From scratch</strong>. Name it (e.g. "Migration") and pick the workspace.
        </li>
        <li>
          In the left sidebar, open <strong>OAuth &amp; Permissions</strong>. Scroll to <strong>Bot Token Scopes</strong> and add:
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scopes.map((s) => (
              <code key={s} className="rounded bg-background px-1.5 py-0.5 text-xs border border-border">{s}</code>
            ))}
          </div>
        </li>
        <li>
          Scroll up and click <strong>Install to Workspace</strong>, then approve.
        </li>
        <li>
          Copy the <strong>Bot User OAuth Token</strong> (starts with <code className="rounded bg-background px-1">xoxb-</code>) and paste it below.
        </li>
        <li>
          For private channels, invite the bot inside Slack: <code className="rounded bg-background px-1">/invite @YourAppName</code>.
        </li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        You can delete the Slack app afterwards — the token will stop working immediately and nothing is stored on our side.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>;
  }
  if (status === "running" || status === "pending") {
    return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Running</Badge>;
  }
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
