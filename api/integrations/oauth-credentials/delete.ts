import { supabaseAdmin } from "../../../src/integrations/supabase/client.server";
import { requireSupabaseUserId } from "../../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../../src/server/api/http";
import { requireOrgAdmin } from "../../../src/server/api/roles";
import { getProvider, type ProviderId } from "../../../src/server/integrations/providers";

type Body = { orgId?: string; provider?: ProviderId };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<Body>(req);

    if (!body.orgId) return sendError(res, 400, "missing_org_id");
    if (!body.provider) return sendError(res, 400, "missing_provider");

    // Validate provider id
    getProvider(body.provider);

    await requireOrgAdmin(userId, body.orgId);

    const { error } = await supabaseAdmin
      .from("org_oauth_credentials")
      .delete()
      .eq("org_id", body.orgId)
      .eq("provider", body.provider);
    if (error) throw error;

    return sendJson(res, 200, { ok: true });
  } catch (e) {
    const msg = (e as Error).message || "creds_delete_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    return sendError(res, status, msg);
  }
}

