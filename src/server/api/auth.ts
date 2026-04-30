import type { IncomingMessage } from "node:http";

function getHeader(req: IncomingMessage, name: string) {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v ?? null;
}

export function getBearerToken(req: IncomingMessage) {
  const auth = getHeader(req, "authorization");
  if (!auth) return null;
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice("bearer ".length).trim();
  return token || null;
}

export async function requireSupabaseUserId(req: IncomingMessage) {
  const token = getBearerToken(req);
  if (!token) throw new Error("missing_bearer_token");

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("missing_supabase_env");
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("invalid_token");

  const j = (await res.json()) as { id?: string };
  if (!j.id) throw new Error("invalid_token");
  return { userId: j.id, accessToken: token };
}

