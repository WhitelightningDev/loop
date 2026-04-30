import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { methodNotAllowed, sendError, sendJson } from "../../src/server/api/http";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const { count, error } = await supabaseAdmin
      .from("organisations")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return sendJson(res, 200, { count: count ?? 0 });
  } catch (e) {
    return sendError(res, 500, (e as Error).message || "teams_count_failed");
  }
}

