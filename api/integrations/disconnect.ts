import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { requireSupabaseUserId } from "../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../src/server/api/http";
import { requireOrgAdmin } from "../../src/server/api/roles";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<{ integrationId?: string }>(req);
    if (!body.integrationId) return sendError(res, 400, "missing_integration_id");

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("org_integrations")
      .select("id, org_id")
      .eq("id", body.integrationId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row) return sendError(res, 404, "not_found");

    await requireOrgAdmin(userId, row.org_id);

    await supabaseAdmin.from("org_integration_secrets").delete().eq("integration_id", row.id);
    const { error } = await supabaseAdmin.from("org_integrations").delete().eq("id", row.id);
    if (error) throw error;

    return sendJson(res, 200, { ok: true });
  } catch (e) {
    const msg = (e as Error).message || "disconnect_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    return sendError(res, status, msg);
  }
}

