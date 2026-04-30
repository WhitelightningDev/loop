import { supabaseAdmin } from "../../../src/integrations/supabase/client.server";
import { requireSupabaseUserId } from "../../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../../src/server/api/http";
import { requireOrgAdmin } from "../../../src/server/api/roles";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<{ orgId?: string }>(req);
    if (!body.orgId) return sendError(res, 400, "missing_org_id");

    await requireOrgAdmin(userId, body.orgId);

    const { data: rows, error } = await supabaseAdmin
      .from("org_oauth_credentials")
      .select("provider, client_id, updated_at")
      .eq("org_id", body.orgId);
    if (error) throw error;

    return sendJson(res, 200, { credentials: rows ?? [] });
  } catch (e) {
    const msg = (e as Error).message || "creds_list_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    return sendError(res, status, msg);
  }
}

