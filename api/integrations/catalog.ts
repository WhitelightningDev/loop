import { methodNotAllowed, sendError, sendJson } from "../../src/server/api/http";
import { PROVIDERS } from "../../src/server/integrations/providers";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const providers = Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      scopes: p.scopes,
      pkce: p.pkce,
    }));
    return sendJson(res, 200, { providers });
  } catch (e) {
    return sendError(res, 500, (e as Error).message || "catalog_failed");
  }
}

