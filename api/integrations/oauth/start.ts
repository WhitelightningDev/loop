import { supabaseAdmin } from "../../../src/integrations/supabase/client.server";
import { requireSupabaseUserId } from "../../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../../src/server/api/http";
import { requireOrgAdmin } from "../../../src/server/api/roles";
import { getProvider, getProviderCreds, type ProviderId } from "../../../src/server/integrations/providers";
import { pkceChallenge, randomToken } from "../../../src/server/integrations/pkce";

type Body = { orgId?: string; provider?: ProviderId; origin?: string };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<Body>(req);

    if (!body.orgId) return sendError(res, 400, "missing_org_id");
    if (!body.provider) return sendError(res, 400, "missing_provider");
    if (!body.origin) return sendError(res, 400, "missing_origin");

    let originUrl: URL;
    try {
      originUrl = new URL(body.origin);
    } catch {
      return sendError(res, 400, "invalid_origin");
    }

    await requireOrgAdmin(userId, body.orgId);

    const provider = getProvider(body.provider);
    const creds = await getProviderCreds(body.provider, body.orgId);

    const state = randomToken(24);
    const codeVerifier = provider.pkce ? randomToken(48) : null;
    const redirectUri = `${originUrl.origin}/api/integrations/oauth/callback`;

    const { error } = await supabaseAdmin.from("oauth_states").insert({
      state,
      org_id: body.orgId,
      user_id: userId,
      provider: body.provider,
      code_verifier: codeVerifier,
      redirect_to: "/app/admin/integrations",
    });
    if (error) throw error;

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: provider.scopes.join(body.provider === "github" ? "," : " "),
    });
    if (body.provider === "jira") {
      params.set("audience", "api.atlassian.com");
      params.set("prompt", "consent");
    }
    if (codeVerifier) {
      params.set("code_challenge", pkceChallenge(codeVerifier));
      params.set("code_challenge_method", "S256");
    }

    return sendJson(res, 200, { authorizeUrl: `${provider.authorizeUrl}?${params.toString()}` });
  } catch (e) {
    const msg = (e as Error).message || "oauth_start_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    return sendError(res, status, msg);
  }
}

