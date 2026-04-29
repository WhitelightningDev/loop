import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { getProvider, getProviderCreds, type ProviderId, PROVIDERS } from "@/server/integrations/providers";
import { pkceChallenge, randomToken } from "@/server/integrations/pkce";

const ProviderEnum = z.enum(["github", "jira", "figma"]);

/** List the org's current integration connections (admin only). */
export const listOrgIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS gates this — only org members can read; admins manage.
    const { data: rows, error } = await supabase
      .from("org_integrations")
      .select("id, provider, status, account_label, connected_at, scopes")
      .eq("org_id", data.orgId);
    if (error) throw error;

    // Per-workspace OAuth credentials configured by the org admin
    const { data: credRows } = await supabaseAdmin
      .from("org_oauth_credentials")
      .select("provider, client_id")
      .eq("org_id", data.orgId);
    const orgConfigured = new Set((credRows ?? []).map((r) => r.provider));

    const configured: Record<ProviderId, boolean> = {
      github:
        orgConfigured.has("github") ||
        (!!process.env.GITHUB_OAUTH_CLIENT_ID && !!process.env.GITHUB_OAUTH_CLIENT_SECRET),
      jira:
        orgConfigured.has("jira") ||
        (!!process.env.JIRA_OAUTH_CLIENT_ID && !!process.env.JIRA_OAUTH_CLIENT_SECRET),
      figma:
        orgConfigured.has("figma") ||
        (!!process.env.FIGMA_OAUTH_CLIENT_ID && !!process.env.FIGMA_OAUTH_CLIENT_SECRET),
    };
    return { integrations: rows ?? [], configured };
  });

/** Build a provider authorize URL and persist the OAuth state. Admin only. */
export const startIntegrationOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; provider: string; origin: string }) =>
    z.object({
      orgId: z.string().uuid(),
      provider: ProviderEnum,
      origin: z.string().url(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verify admin via service role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, org_id")
      .eq("user_id", userId);
    const isAdmin =
      (roles ?? []).some(
        (r) => r.org_id === data.orgId && r.role === "org_admin",
      ) ||
      (roles ?? []).some((r) => r.org_id === null && r.role === "super_admin");
    if (!isAdmin) throw new Error("Only org admins can connect integrations.");

    let provider, creds;
    try {
      provider = getProvider(data.provider);
      creds = await getProviderCreds(data.provider as ProviderId, data.orgId);
    } catch (e) {
      throw new Error((e as Error).message);
    }

    const state = randomToken(24);
    const codeVerifier = provider.pkce ? randomToken(48) : null;
    const redirectUri = `${data.origin}/api/integrations/oauth/callback`;

    await supabaseAdmin.from("oauth_states").insert({
      state,
      org_id: data.orgId,
      user_id: userId,
      provider: data.provider as ProviderId,
      code_verifier: codeVerifier,
      redirect_to: "/app/admin/integrations",
    });

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: provider.scopes.join(data.provider === "github" ? "," : " "),
    });
    if (data.provider === "jira") {
      params.set("audience", "api.atlassian.com");
      params.set("prompt", "consent");
    }
    if (codeVerifier) {
      params.set("code_challenge", pkceChallenge(codeVerifier));
      params.set("code_challenge_method", "S256");
    }

    return { authorizeUrl: `${provider.authorizeUrl}?${params.toString()}` };
  });

/** Disconnect (delete) an integration. Admin only. */
export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { integrationId: string }) =>
    z.object({ integrationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS enforces admin-only delete.
    const { error } = await supabase
      .from("org_integrations")
      .delete()
      .eq("id", data.integrationId);
    if (error) throw error;
    return { ok: true };
  });

/** Static provider catalog for the UI. */
export const getProviderCatalog = createServerFn({ method: "GET" }).handler(async () => {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    scopes: p.scopes,
  }));
});

/** Get OAuth credential metadata for an org (admin only). Returns whether each provider has creds and the client_id (never the secret). */
export const getOrgOAuthCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, org_id")
      .eq("user_id", userId);
    const isAdmin =
      (roles ?? []).some((r) => r.org_id === data.orgId && r.role === "org_admin") ||
      (roles ?? []).some((r) => r.org_id === null && r.role === "super_admin");
    if (!isAdmin) throw new Error("Only org admins can view OAuth credentials.");

    const { data: rows } = await supabaseAdmin
      .from("org_oauth_credentials")
      .select("provider, client_id, updated_at")
      .eq("org_id", data.orgId);
    return { credentials: rows ?? [] };
  });

/** Save (upsert) OAuth credentials for a given provider in this org. Admin only. */
export const saveOrgOAuthCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; provider: string; clientId: string; clientSecret: string }) =>
    z.object({
      orgId: z.string().uuid(),
      provider: ProviderEnum,
      clientId: z.string().min(1).max(500),
      clientSecret: z.string().min(1).max(2000),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, org_id")
      .eq("user_id", userId);
    const isAdmin =
      (roles ?? []).some((r) => r.org_id === data.orgId && r.role === "org_admin") ||
      (roles ?? []).some((r) => r.org_id === null && r.role === "super_admin");
    if (!isAdmin) throw new Error("Only org admins can configure OAuth credentials.");

    const { error } = await supabaseAdmin
      .from("org_oauth_credentials")
      .upsert(
        [{
          org_id: data.orgId,
          provider: data.provider,
          client_id: data.clientId.trim(),
          client_secret: data.clientSecret.trim(),
        }],
        { onConflict: "org_id,provider" },
      );
    if (error) throw error;
    return { ok: true };
  });

/** Delete OAuth credentials for a provider. Admin only. */
export const deleteOrgOAuthCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orgId: string; provider: string }) =>
    z.object({ orgId: z.string().uuid(), provider: ProviderEnum }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, org_id")
      .eq("user_id", userId);
    const isAdmin =
      (roles ?? []).some((r) => r.org_id === data.orgId && r.role === "org_admin") ||
      (roles ?? []).some((r) => r.org_id === null && r.role === "super_admin");
    if (!isAdmin) throw new Error("Only org admins can delete OAuth credentials.");

    const { error } = await supabaseAdmin
      .from("org_oauth_credentials")
      .delete()
      .eq("org_id", data.orgId)
      .eq("provider", data.provider);
    if (error) throw error;
    return { ok: true };
  });
