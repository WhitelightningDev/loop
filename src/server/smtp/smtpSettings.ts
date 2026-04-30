import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SmtpSettings = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

export async function getOrgSmtpSettings(orgId: string): Promise<SmtpSettings> {
  const { data: smtp, error } = await supabaseAdmin
    .from("org_smtp_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw error;
  if (smtp) {
    return {
      host: String(smtp.host ?? "").trim(),
      port: Number(smtp.port),
      username: String(smtp.username ?? "").trim(),
      password: String(smtp.password ?? "").trim(),
      fromEmail: String(smtp.from_email ?? "").trim(),
      fromName: String(smtp.from_name ?? "").trim(),
    };
  }

  // Optional Vercel env fallback (single-tenant MVP convenience)
  const defaultOrgId = String(process.env.DEFAULT_SMTP_ORG_ID ?? "").trim();
  if (!defaultOrgId || defaultOrgId !== orgId) {
    throw new Error("No SMTP settings configured for this workspace");
  }

  const host = String(process.env.DEFAULT_SMTP_HOST ?? "").trim();
  const port = Number(process.env.DEFAULT_SMTP_PORT ?? "465");
  const username = String(process.env.DEFAULT_SMTP_USERNAME ?? "").trim();
  const password = String(process.env.DEFAULT_SMTP_PASSWORD ?? "").trim();
  const fromEmail = String(process.env.DEFAULT_SMTP_FROM_EMAIL ?? "").trim();
  const fromName = String(process.env.DEFAULT_SMTP_FROM_NAME ?? "").trim();

  if (!host || !Number.isFinite(port) || !username || !password || !fromEmail) {
    throw new Error("Default SMTP env vars are not fully configured");
  }

  return { host, port, username, password, fromEmail, fromName };
}

