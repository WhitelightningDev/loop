// Provider definitions for org-level OAuth integrations.
// CLIENT IDs are public; client secrets are server-only.

export type ProviderId = "github" | "jira" | "figma";

export interface ProviderDef {
  id: ProviderId;
  label: string;
  description: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  // Whether this provider requires PKCE (Jira & Figma do; GitHub does not require it but supports it)
  pkce: boolean;
  // Function to fetch the connected account label after token exchange
  fetchAccount: (
    accessToken: string,
  ) => Promise<{ accountId: string; accountLabel: string; metadata?: Record<string, unknown> }>;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  github: {
    id: "github",
    label: "GitHub",
    description: "Link issues, PRs and repositories to channels.",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["read:user", "repo", "read:org"],
    pkce: false,
    fetchAccount: async (token) => {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (!res.ok) throw new Error(`GitHub /user failed: ${res.status}`);
      const j = (await res.json()) as { id: number; login: string; name?: string };
      return {
        accountId: String(j.id),
        accountLabel: j.login,
        metadata: { name: j.name ?? null },
      };
    },
  },
  jira: {
    id: "jira",
    label: "Jira",
    description: "Surface and create Jira issues from your conversations.",
    authorizeUrl: "https://auth.atlassian.com/authorize",
    tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: [
      "read:jira-user",
      "read:jira-work",
      "write:jira-work",
      "offline_access",
    ],
    pkce: true,
    fetchAccount: async (token) => {
      const res = await fetch(
        "https://api.atlassian.com/oauth/token/accessible-resources",
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`Jira accessible-resources failed: ${res.status}`);
      const sites = (await res.json()) as Array<{ id: string; name: string; url: string }>;
      const site = sites[0];
      if (!site) throw new Error("No Jira sites accessible by this account");
      return {
        accountId: site.id,
        accountLabel: site.name,
        metadata: { url: site.url, sites },
      };
    },
  },
  figma: {
    id: "figma",
    label: "Figma",
    description: "Preview and embed Figma frames inside messages.",
    authorizeUrl: "https://www.figma.com/oauth",
    tokenUrl: "https://www.figma.com/api/oauth/token",
    scopes: ["files:read"],
    pkce: false,
    fetchAccount: async (token) => {
      const res = await fetch("https://api.figma.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Figma /me failed: ${res.status}`);
      const j = (await res.json()) as { id: string; handle?: string; email?: string };
      return {
        accountId: j.id,
        accountLabel: j.handle ?? j.email ?? "Figma user",
        metadata: { email: j.email ?? null },
      };
    },
  },
};

export function getProvider(id: string): ProviderDef {
  if (!(id in PROVIDERS)) throw new Error(`Unknown provider: ${id}`);
  return PROVIDERS[id as ProviderId];
}

interface ProviderCreds {
  clientId: string;
  clientSecret: string;
}

/**
 * Resolve OAuth client credentials for a provider for a specific org.
 * Looks up the per-workspace `org_oauth_credentials` row first, then falls
 * back to platform-level env vars for backward compatibility.
 */
export async function getProviderCreds(
  id: ProviderId,
  orgId: string,
): Promise<ProviderCreds> {
  const { supabaseAdmin } = await import("../../integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("org_oauth_credentials")
    .select("client_id, client_secret")
    .eq("org_id", orgId)
    .eq("provider", id)
    .maybeSingle();
  if (row?.client_id && row?.client_secret) {
    return { clientId: row.client_id, clientSecret: row.client_secret };
  }
  const map: Record<ProviderId, [string, string]> = {
    github: ["GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET"],
    jira: ["JIRA_OAUTH_CLIENT_ID", "JIRA_OAUTH_CLIENT_SECRET"],
    figma: ["FIGMA_OAUTH_CLIENT_ID", "FIGMA_OAUTH_CLIENT_SECRET"],
  };
  const [idEnv, secretEnv] = map[id];
  const clientId = process.env[idEnv];
  const clientSecret = process.env[secretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(
      `${id} OAuth is not configured for this workspace. Add a Client ID and Client Secret in Admin → Integrations.`,
    );
  }
  return { clientId, clientSecret };
}
