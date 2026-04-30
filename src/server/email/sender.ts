import nodemailer from "nodemailer";
import { getGoogleOAuthConfigFromEnv } from "./googleOAuth";
import { sendViaGmailApi } from "./gmailApi";
import type { GoogleOAuthConfig } from "./googleOAuth";
import type { SmtpSettings } from "../smtp/smtpSettings";
import { getOrgSmtpSettings } from "../smtp/smtpSettings";
import { getProviderCreds } from "../integrations/providers";
import { supabaseAdmin } from "../../integrations/supabase/client.server";

export type EmailProvider = "smtp" | "gmail_smtp" | "gmail_api";

export function getEmailProvider(): EmailProvider {
  const v = String(process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (v === "gmail_api" || v === "google" || v === "google_api") return "gmail_api";
  if (v === "gmail" || v === "gmail_smtp" || v === "gmail_app_password") return "gmail_smtp";
  // Smart default: if Gmail app-password or Google OAuth is (even partially) configured, prefer it
  // so we surface a clear config error instead of silently falling back to SMTP.
  if (hasAnyGmailSmtpEnv()) return "gmail_smtp";
  if (hasAnyGoogleOAuthEnv()) return "gmail_api";
  return "smtp";
}

function getGmailSmtpConfigFromEnv() {
  const userEmail = String(process.env.GMAIL_USER ?? process.env.GMAIL_EMAIL ?? "").trim();
  const appPassword = String(process.env.GMAIL_APP_PASSWORD ?? "").trim().replace(/\s+/g, "");
  if (!userEmail || !appPassword) return null;
  return { userEmail, appPassword };
}

function hasAnyGmailSmtpEnv() {
  const userEmail = String(process.env.GMAIL_USER ?? process.env.GMAIL_EMAIL ?? "").trim();
  const appPassword = String(process.env.GMAIL_APP_PASSWORD ?? "").trim();
  return !!userEmail || !!appPassword;
}

function hasAnyGoogleOAuthEnv() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
  const refreshToken = String(process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "").trim();
  const userEmail = String(process.env.GOOGLE_OAUTH_SENDER_EMAIL ?? "").trim();
  return !!clientId || !!clientSecret || !!refreshToken || !!userEmail;
}

async function getGoogleOAuthConfigFromOrgIntegration(orgId: string): Promise<GoogleOAuthConfig | null> {
  const { data: integ, error: integErr } = await supabaseAdmin
    .from("org_integrations")
    .select("id, account_label")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .eq("status", "connected")
    .maybeSingle();
  if (integErr) throw integErr;
  if (!integ?.id) return null;

  const { data: secret, error: secretErr } = await supabaseAdmin
    .from("org_integration_secrets")
    .select("refresh_token")
    .eq("integration_id", integ.id)
    .maybeSingle();
  if (secretErr) throw secretErr;

  const refreshToken = String(secret?.refresh_token ?? "").trim();
  if (!refreshToken) return null;

  const creds = await getProviderCreds("google", orgId);
  const userEmail = String(integ.account_label ?? "").trim();
  if (!userEmail) return null;

  return {
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    refreshToken,
    userEmail,
  };
}

export async function resolveEmailProviderForOrg(orgId: string): Promise<EmailProvider> {
  // If explicitly set, respect it.
  const explicit = String(process.env.EMAIL_PROVIDER ?? "").trim();
  if (explicit) return getEmailProvider();

  // If Google is connected for this org, default to Gmail API (Vercel-friendly).
  const { data: integ, error } = await supabaseAdmin
    .from("org_integrations")
    .select("id")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .eq("status", "connected")
    .limit(1);
  if (error) throw error;
  if ((integ ?? []).length > 0) return "gmail_api";

  return getEmailProvider();
}

export async function sendEmail(opts: {
  provider?: EmailProvider;
  smtp?: SmtpSettings;
  oauth?: GoogleOAuthConfig;
  fromEmail?: string;
  fromName?: string | null;
  toEmail: string;
  subject: string;
  html: string;
}) {
  const provider = opts.provider ?? getEmailProvider();

  if (provider === "gmail_api") {
    const oauth = opts.oauth ?? getGoogleOAuthConfigFromEnv();
    if (!oauth) {
      throw new Error(
        "gmail_api_not_configured: set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, GOOGLE_OAUTH_SENDER_EMAIL",
      );
    }
    const fromEmail = opts.fromEmail || oauth.userEmail;
    await sendViaGmailApi({
      oauth,
      fromEmail,
      fromName: opts.fromName ?? null,
      toEmail: opts.toEmail,
      subject: opts.subject,
      html: opts.html,
    });
    return;
  }

  if (provider === "gmail_smtp") {
    const cfg = getGmailSmtpConfigFromEnv();
    if (!cfg) {
      const userEmail = String(process.env.GMAIL_USER ?? process.env.GMAIL_EMAIL ?? "").trim();
      const appPassword = String(process.env.GMAIL_APP_PASSWORD ?? "").trim();
      if (!userEmail && appPassword) throw new Error("gmail_smtp_not_configured: set GMAIL_USER (or GMAIL_EMAIL)");
      if (userEmail && !appPassword) throw new Error("gmail_smtp_not_configured: set GMAIL_APP_PASSWORD");
      throw new Error("gmail_smtp_not_configured: set GMAIL_USER and GMAIL_APP_PASSWORD");
    }
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: cfg.userEmail, pass: cfg.appPassword },
      // Keep failures fast so the function returns a useful error instead of timing out.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    } as any);

    const fromEmail = opts.fromEmail || cfg.userEmail;
    const from = opts.fromName ? `${opts.fromName} <${fromEmail}>` : fromEmail;

    await transport.sendMail({
      from,
      to: opts.toEmail,
      subject: opts.subject,
      html: opts.html,
    });
    return;
  }

  // Default SMTP (org-configured)
  if (!opts.smtp) {
    throw new Error("smtp_not_configured");
  }

  const transport = nodemailer.createTransport({
    host: opts.smtp.host,
    port: opts.smtp.port,
    secure: opts.smtp.port === 465,
    auth: { user: opts.smtp.username, pass: opts.smtp.password },
    tls: { servername: opts.smtp.host },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  } as any);

  const fromEmail = opts.fromEmail || opts.smtp.fromEmail;
  const fromName = opts.fromName ?? opts.smtp.fromName ?? null;
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  await transport.sendMail({
    from,
    to: opts.toEmail,
    subject: opts.subject,
    html: opts.html,
  });
}

export async function sendEmailForOrg(opts: {
  orgId: string;
  toEmail: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string | null;
}) {
  const provider = await resolveEmailProviderForOrg(opts.orgId);

  if (provider === "gmail_api") {
    const oauth = getGoogleOAuthConfigFromEnv() ?? (await getGoogleOAuthConfigFromOrgIntegration(opts.orgId));
    if (!oauth) {
      throw new Error(
        "gmail_api_not_configured: connect Google in Admin → Integrations (or set GOOGLE_OAUTH_* env vars)",
      );
    }
    return sendEmail({
      provider,
      oauth,
      fromEmail: opts.fromEmail,
      fromName: opts.fromName,
      toEmail: opts.toEmail,
      subject: opts.subject,
      html: opts.html,
    });
  }

  if (provider === "gmail_smtp") {
    return sendEmail({
      provider,
      fromEmail: opts.fromEmail,
      fromName: opts.fromName,
      toEmail: opts.toEmail,
      subject: opts.subject,
      html: opts.html,
    });
  }

  const smtp = await getOrgSmtpSettings(opts.orgId);
  return sendEmail({
    provider: "smtp",
    smtp,
    fromEmail: smtp.fromEmail || opts.fromEmail,
    fromName: (smtp.fromName ? smtp.fromName : null) ?? opts.fromName ?? null,
    toEmail: opts.toEmail,
    subject: opts.subject,
    html: opts.html,
  });
}
