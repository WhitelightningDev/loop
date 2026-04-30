import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useOrg, isAdmin } from "@/features/organisations/OrgProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Github,
  Plug,
  ExternalLink,
  Trash2,
  Loader2,
  Settings2,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { FigmaIcon, JiraIcon } from "@/components/icons/BrandIcons";
import {
  deleteOrgOAuthCredentials,
  disconnectIntegration,
  getOrgOAuthCredentials,
  getProviderCatalog,
  listOrgIntegrations,
  saveOrgOAuthCredentials,
  startIntegrationOAuth,
  type ProviderId,
} from "@/api/integrations";

type SearchSchema = { connected?: string; error?: string };

export const Route = createFileRoute("/app/admin/integrations")({
  validateSearch: (s: Record<string, unknown>): SearchSchema => ({
    connected: typeof s.connected === "string" ? s.connected : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: IntegrationsPage,
});

function ProviderIcon({ id }: { id: string }) {
  if (id === "github") return <Github className="h-6 w-6" />;
  if (id === "jira") return <JiraIcon className="h-6 w-6" />;
  if (id === "figma") return <FigmaIcon className="h-6 w-6" />;
  return <Plug className="h-6 w-6" />;
}

const PROVIDER_DOCS: Record<string, { url: string; callback: (origin: string) => string }> = {
  github: {
    url: "https://github.com/settings/developers",
    callback: (o) => `${o}/api/integrations/oauth/callback`,
  },
  jira: {
    url: "https://developer.atlassian.com/console/myapps/",
    callback: (o) => `${o}/api/integrations/oauth/callback`,
  },
  figma: {
    url: "https://www.figma.com/developers/apps",
    callback: (o) => `${o}/api/integrations/oauth/callback`,
  },
};

function IntegrationsPage() {
  const { currentOrg, roles } = useOrg();
  const { session } = useAuth();
  const qc = useQueryClient();
  const search = useSearch({ from: "/app/admin/integrations" }) as SearchSchema;
  const [credsDialog, setCredsDialog] = useState<null | { provider: string; label: string }>(null);
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (search.connected) {
      toast.success(`${search.connected} connected`);
      window.history.replaceState({}, "", "/app/admin/integrations");
    } else if (search.error) {
      toast.error(`Connection failed: ${search.error}`);
      window.history.replaceState({}, "", "/app/admin/integrations");
    }
  }, [search.connected, search.error]);

  const { data: catalog = [] } = useQuery({
    queryKey: ["integrations-catalog"],
    queryFn: async () => {
      const { providers } = await getProviderCatalog();
      return providers;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["org-integrations", currentOrg?.id, accessToken],
    enabled: !!currentOrg && !!accessToken,
    queryFn: () => listOrgIntegrations({ orgId: currentOrg!.id, accessToken: accessToken! }),
  });

  const { data: credsData } = useQuery({
    queryKey: ["org-oauth-creds", currentOrg?.id, accessToken],
    enabled: !!currentOrg && isAdmin(roles) && !!accessToken,
    queryFn: () => getOrgOAuthCredentials({ orgId: currentOrg!.id, accessToken: accessToken! }),
  });

  const startMutation = useMutation({
    mutationFn: async (provider: string) => {
      if (!accessToken) throw new Error("Not authenticated");
      const res = await startIntegrationOAuth({
        orgId: currentOrg!.id,
        provider: provider as ProviderId,
        origin: window.location.origin,
        accessToken,
      });
      window.location.href = res.authorizeUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: (integrationId: string) => {
      if (!accessToken) throw new Error("Not authenticated");
      return disconnectIntegration({ integrationId, accessToken });
    },
    onSuccess: () => {
      toast.success("Integration disconnected");
      qc.invalidateQueries({ queryKey: ["org-integrations", currentOrg?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin(roles)) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        You need admin permissions to manage integrations.
      </div>
    );
  }

  const integrations = data?.integrations ?? [];
  const configured = data?.configured ?? { github: false, jira: false, figma: false };
  const credentialList = credsData?.credentials ?? [];
  const hasOrgCreds = (id: string) => credentialList.some((c) => c.provider === id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect external tools to {currentOrg?.name ?? "your workspace"}. As a workspace admin,
          you can paste your own OAuth client ID and secret for each provider — tokens are stored
          securely and never exposed in the browser.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {catalog.map((p) => {
            const existing = integrations.find((i) => i.provider === p.id);
            const providerConfigured = configured[p.id as keyof typeof configured];
            const usingOrgCreds = hasOrgCreds(p.id);
            return (
              <div
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <ProviderIcon id={p.id} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.label}</span>
                      {existing ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Connected</Badge>
                      ) : providerConfigured ? (
                        <Badge variant="outline">Ready to connect</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
                          Needs OAuth credentials
                        </Badge>
                      )}
                      {usingOrgCreds && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Workspace credentials
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                    {existing && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {existing.account_label} · connected{" "}
                        {existing.connected_at ? new Date(existing.connected_at).toLocaleDateString() : "—"}
                      </p>
                    )}
                    {!providerConfigured && !existing && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Click <strong>Configure</strong> to add your {p.label} OAuth Client ID and Secret.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCredsDialog({ provider: p.id, label: p.label })}
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    {usingOrgCreds ? "Edit credentials" : "Configure"}
                  </Button>
                  {existing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMutation.mutate(existing.id)}
                      disabled={disconnectMutation.isPending}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => startMutation.mutate(p.id)}
                      disabled={startMutation.isPending || !providerConfigured}
                    >
                      {startMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plug className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Connect
                      <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {credsDialog && currentOrg && accessToken && (
        <CredentialsDialog
          orgId={currentOrg.id}
          provider={credsDialog.provider}
          label={credsDialog.label}
          existing={hasOrgCreds(credsDialog.provider)}
          accessToken={accessToken}
          onClose={() => setCredsDialog(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["org-oauth-creds", currentOrg.id] });
            qc.invalidateQueries({ queryKey: ["org-integrations", currentOrg.id] });
          }}
        />
      )}
    </div>
  );
}

function CredentialsDialog({
  orgId,
  provider,
  label,
  existing,
  accessToken,
  onClose,
  onSaved,
}: {
  orgId: string;
  provider: string;
  label: string;
  existing: boolean;
  accessToken: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const docs = PROVIDER_DOCS[provider];
  const callbackUrl = docs?.callback(window.location.origin) ?? "";

  const saveMutation = useMutation({
    mutationFn: () =>
      saveOrgOAuthCredentials({
        orgId,
        provider: provider as ProviderId,
        clientId,
        clientSecret,
        accessToken,
      }),
    onSuccess: () => {
      toast.success(`${label} credentials saved`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteOrgOAuthCredentials({
        orgId,
        provider: provider as ProviderId,
        accessToken,
      }),
    onSuccess: () => {
      toast.success(`${label} credentials removed`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> {label} OAuth credentials
          </DialogTitle>
          <DialogDescription>
            Create an OAuth app in your {label} developer console and paste the Client ID and Client
            Secret here. Use this redirect URL when registering the app:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-2 text-xs font-mono break-all">
            {callbackUrl}
          </div>
          {docs && (
            <a
              href={docs.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open {label} developer console <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <Input
              id="client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={existing ? "•••••• (already set — enter to replace)" : "e.g. Iv1.abc123..."}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <Input
              id="client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={existing ? "•••••• (already set — enter to replace)" : "Paste secret"}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Stored encrypted at rest. Never sent to the browser after saving.
            </p>
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            {existing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!clientId.trim() || !clientSecret.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
