import { supabaseAdmin } from "../../../src/integrations/supabase/client.server";
import { methodNotAllowed } from "../../../src/server/api/http";
import { getProvider, getProviderCreds, type ProviderId } from "../../../src/server/integrations/providers";

function getPublicUrl(req: any) {
  const proto = (req.headers["x-forwarded-proto"] ?? "https") as string;
  const host = (req.headers["x-forwarded-host"] ?? req.headers.host) as string | undefined;
  return `${proto}://${host ?? "localhost"}`;
}

function redirect(res: any, location: string) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function errorRedirect(res: any, message: string) {
  const params = new URLSearchParams({ error: message });
  redirect(res, `/app/admin/integrations?${params.toString()}`);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const base = getPublicUrl(req);
  const url = new URL(req.url, base);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");

  try {
    if (errParam) return errorRedirect(res, errParam);
    if (!code || !state) return errorRedirect(res, "missing_code_or_state");

    const { data: stateRow, error: stateErr } = await supabaseAdmin
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();
    if (stateErr) throw stateErr;
    if (!stateRow) return errorRedirect(res, "invalid_state");

    if (stateRow.expires_at && new Date(stateRow.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("oauth_states").delete().eq("state", state);
      return errorRedirect(res, "state_expired");
    }

    const providerId = stateRow.provider as ProviderId;
    const provider = getProvider(providerId);
    const creds = await getProviderCreds(providerId, stateRow.org_id);

    const redirectUri = `${url.origin}/api/integrations/oauth/callback`;

    const body: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    };
    if (stateRow.code_verifier) body.code_verifier = stateRow.code_verifier;

    const tokenRes = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("Token exchange failed:", tokenJson);
      return errorRedirect(res, tokenJson.error_description ?? tokenJson.error ?? "token_exchange_failed");
    }

    let account;
    try {
      account = await provider.fetchAccount(tokenJson.access_token);
    } catch (e) {
      console.error("fetchAccount failed:", e);
      return errorRedirect(res, "fetch_account_failed");
    }

    const { data: integration, error: upsertErr } = await supabaseAdmin
      .from("org_integrations")
      .upsert(
        [
          {
            org_id: stateRow.org_id,
            provider: providerId,
            status: "connected",
            account_label: account.accountLabel,
            account_id: account.accountId,
            scopes: tokenJson.scope ? tokenJson.scope.split(/[,\s]+/) : provider.scopes,
            metadata: (account.metadata ?? {}) as never,
            connected_by: stateRow.user_id,
            connected_at: new Date().toISOString(),
          },
        ],
        { onConflict: "org_id,provider" },
      )
      .select("id")
      .single();
    if (upsertErr || !integration) {
      console.error("Integration upsert failed:", upsertErr);
      return errorRedirect(res, "save_failed");
    }

    const expiresAt = tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;
    await supabaseAdmin.from("org_integration_secrets").upsert([
      {
        integration_id: integration.id,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token ?? null,
        token_type: tokenJson.token_type ?? "Bearer",
        expires_at: expiresAt,
        raw: tokenJson as unknown as never,
      },
    ]);

    await supabaseAdmin.from("oauth_states").delete().eq("state", state);

    const redirectTo = stateRow.redirect_to ?? "/app/admin/integrations";
    const params = new URLSearchParams({ connected: providerId });
    return redirect(res, `${redirectTo}?${params.toString()}`);
  } catch (e) {
    console.error("OAuth callback error:", e);
    return errorRedirect(res, "oauth_callback_failed");
  }
}

