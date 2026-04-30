type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail: string;
};

export function getGoogleOAuthConfigFromEnv(): GoogleOAuthConfig | null {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
  const refreshToken = String(process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "").trim();
  const userEmail = String(process.env.GOOGLE_OAUTH_SENDER_EMAIL ?? "").trim();
  if (!clientId || !clientSecret || !refreshToken || !userEmail) return null;
  return { clientId, clientSecret, refreshToken, userEmail };
}

export async function getGoogleAccessToken(cfg: GoogleOAuthConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: cfg.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`google_oauth_token_failed: ${text.slice(0, 240)}`);
  }

  const j = JSON.parse(text) as GoogleTokenResponse;
  if (!j.access_token) throw new Error("google_oauth_token_failed");
  return j.access_token;
}

