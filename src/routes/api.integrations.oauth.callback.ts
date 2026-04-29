import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProvider, getProviderCreds, type ProviderId } from "@/server/integrations/providers";

function getCallbackUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.origin}/api/integrations/oauth/callback`;
}

function errorRedirect(message: string) {
  const params = new URLSearchParams({ error: message });
  throw redirect({ href: `/app/admin/integrations?${params.toString()}` });
}

export const Route = createFileRoute("/api/integrations/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errParam = url.searchParams.get("error");
        if (errParam) errorRedirect(errParam);
        if (!code || !state) errorRedirect("missing_code_or_state");

        // Look up state
        const { data: stateRow } = await supabaseAdmin
          .from("oauth_states")
          .select("*")
          .eq("state", state!)
          .maybeSingle();
        if (!stateRow) errorRedirect("invalid_state");
        if (new Date(stateRow!.expires_at).getTime() < Date.now()) {
          await supabaseAdmin.from("oauth_states").delete().eq("state", state!);
          errorRedirect("state_expired");
        }

        const providerId = stateRow!.provider as ProviderId;
        const provider = getProvider(providerId);
        const creds = await getProviderCreds(providerId, stateRow!.org_id);
        const redirectUri = getCallbackUrl(request);

        // Exchange code for token
        const body: Record<string, string> = {
          grant_type: "authorization_code",
          code: code!,
          redirect_uri: redirectUri,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        };
        if (stateRow!.code_verifier) body.code_verifier = stateRow!.code_verifier;

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
          errorRedirect(tokenJson.error_description ?? tokenJson.error ?? "token_exchange_failed");
        }

        let account;
        try {
          account = await provider.fetchAccount(tokenJson.access_token!);
        } catch (e) {
          console.error("fetchAccount failed:", e);
          errorRedirect("fetch_account_failed");
        }

        // Upsert integration
        const { data: integration, error: upsertErr } = await supabaseAdmin
          .from("org_integrations")
          .upsert(
            [
              {
                org_id: stateRow!.org_id,
                provider: providerId,
                status: "connected",
                account_label: account!.accountLabel,
                account_id: account!.accountId,
                scopes: tokenJson.scope ? tokenJson.scope.split(/[,\s]+/) : provider.scopes,
                metadata: (account!.metadata ?? {}) as never,
                connected_by: stateRow!.user_id,
                connected_at: new Date().toISOString(),
              },
            ],
            { onConflict: "org_id,provider" },
          )
          .select("id")
          .single();
        if (upsertErr || !integration) {
          console.error("Integration upsert failed:", upsertErr);
          errorRedirect("save_failed");
        }

        const expiresAt = tokenJson.expires_in
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null;
        await supabaseAdmin.from("org_integration_secrets").upsert([
          {
            integration_id: integration!.id,
            access_token: tokenJson.access_token!,
            refresh_token: tokenJson.refresh_token ?? null,
            token_type: tokenJson.token_type ?? "Bearer",
            expires_at: expiresAt,
            raw: tokenJson as unknown as never,
          },
        ]);

        // Cleanup state
        await supabaseAdmin.from("oauth_states").delete().eq("state", state!);

        const redirectTo = stateRow!.redirect_to ?? "/app/admin/integrations";
        const params = new URLSearchParams({ connected: providerId });
        throw redirect({ href: `${redirectTo}?${params.toString()}` });
      },
    },
  },
});
