import nodemailer from "nodemailer";
import { getGoogleOAuthConfigFromEnv } from "./googleOAuth";
import { sendViaGmailApi } from "./gmailApi";
import type { SmtpSettings } from "../smtp/smtpSettings";

export type EmailProvider = "smtp" | "gmail_smtp" | "gmail_api";

export function getEmailProvider(): EmailProvider {
  const v = String(process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (v === "gmail_api" || v === "google" || v === "google_api") return "gmail_api";
  if (v === "gmail" || v === "gmail_smtp" || v === "gmail_app_password") return "gmail_smtp";
  // Smart default: if Gmail app-password or Google OAuth is configured, prefer it.
  if (getGmailSmtpConfigFromEnv()) return "gmail_smtp";
  if (getGoogleOAuthConfigFromEnv()) return "gmail_api";
  return "smtp";
}

function getGmailSmtpConfigFromEnv() {
  const userEmail = String(process.env.GMAIL_USER ?? process.env.GMAIL_EMAIL ?? "").trim();
  const appPassword = String(process.env.GMAIL_APP_PASSWORD ?? "").trim().replace(/\s+/g, "");
  if (!userEmail || !appPassword) return null;
  return { userEmail, appPassword };
}

export async function sendEmail(opts: {
  smtp?: SmtpSettings;
  fromEmail?: string;
  fromName?: string | null;
  toEmail: string;
  subject: string;
  html: string;
}) {
  const provider = getEmailProvider();

  if (provider === "gmail_api") {
    const oauth = getGoogleOAuthConfigFromEnv();
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
