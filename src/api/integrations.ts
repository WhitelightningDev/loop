import { fetchJson } from "./fetchJson";

export type ProviderId = "github" | "jira" | "figma" | "google";

export type ProviderCatalogItem = {
  id: ProviderId;
  label: string;
  description: string;
  scopes: string[];
  pkce: boolean;
};

export type OrgIntegrationRow = {
  id: string;
  provider: ProviderId;
  status: string;
  account_label: string | null;
  connected_at: string | null;
  scopes: string[] | null;
};

export async function getProviderCatalog() {
  return fetchJson<{ providers: ProviderCatalogItem[] }>("/api/integrations/catalog");
}

export async function listOrgIntegrations(opts: { orgId: string; accessToken: string }) {
  return fetchJson<{
    integrations: OrgIntegrationRow[];
    configured: Record<ProviderId, boolean>;
  }>("/api/integrations/list", {
    method: "POST",
    accessToken: opts.accessToken,
    json: { orgId: opts.orgId },
  });
}

export async function startIntegrationOAuth(opts: {
  orgId: string;
  provider: ProviderId;
  origin: string;
  accessToken: string;
}) {
  return fetchJson<{ authorizeUrl: string }>("/api/integrations/oauth/start", {
    method: "POST",
    accessToken: opts.accessToken,
    json: { orgId: opts.orgId, provider: opts.provider, origin: opts.origin },
  });
}

export async function disconnectIntegration(opts: { integrationId: string; accessToken: string }) {
  return fetchJson<{ ok: true }>("/api/integrations/disconnect", {
    method: "POST",
    accessToken: opts.accessToken,
    json: { integrationId: opts.integrationId },
  });
}

export async function getOrgOAuthCredentials(opts: { orgId: string; accessToken: string }) {
  return fetchJson<{ credentials: Array<{ provider: ProviderId; client_id: string; updated_at: string }> }>(
    "/api/integrations/oauth-credentials/list",
    {
      method: "POST",
      accessToken: opts.accessToken,
      json: { orgId: opts.orgId },
    },
  );
}

export async function saveOrgOAuthCredentials(opts: {
  orgId: string;
  provider: ProviderId;
  clientId: string;
  clientSecret: string;
  accessToken: string;
}) {
  return fetchJson<{ ok: true }>("/api/integrations/oauth-credentials/save", {
    method: "POST",
    accessToken: opts.accessToken,
    json: {
      orgId: opts.orgId,
      provider: opts.provider,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
    },
  });
}

export async function deleteOrgOAuthCredentials(opts: { orgId: string; provider: ProviderId; accessToken: string }) {
  return fetchJson<{ ok: true }>("/api/integrations/oauth-credentials/delete", {
    method: "POST",
    accessToken: opts.accessToken,
    json: { orgId: opts.orgId, provider: opts.provider },
  });
}
