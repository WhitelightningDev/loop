import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { requireSupabaseUserId } from "../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../src/server/api/http";
import { requireOrgAdmin } from "../../src/server/api/roles";
import type { ProviderId } from "../../src/server/integrations/providers";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<{ orgId?: string }>(req);
    if (!body.orgId) return sendError(res, 400, "missing_org_id");

    await requireOrgAdmin(userId, body.orgId);

    const { data: rows, error } = await supabaseAdmin
      .from("org_integrations")
      .select("id, provider, status, account_label, connected_at, scopes")
      .eq("org_id", body.orgId);
    if (error) throw error;

    const { data: credRows, error: credErr } = await supabaseAdmin
      .from("org_oauth_credentials")
      .select("provider, client_id")
      .eq("org_id", body.orgId);
    if (credErr) throw credErr;

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
      google:
        orgConfigured.has("google") ||
        (!!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    };

    return sendJson(res, 200, { integrations: rows ?? [], configured });
  } catch (e) {
    const msg = (e as Error).message || "list_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    return sendError(res, status, msg);
  }
}
