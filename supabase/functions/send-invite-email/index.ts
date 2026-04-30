// Send an invite email using the workspace's configured SMTP server.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SMTP_HOST_FALLBACKS: Record<string, string[]> = {
  "hkftservices.co.za": ["mail.webonline.biz", "webonline.biz"],
  "mail.hkftservices.co.za": ["mail.webonline.biz", "webonline.biz"],
};

const SMTP_SEND_TIMEOUT_MS = 12_000;

type ResolvedSmtpSettings = {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

const isTlsHostnameError = (error: unknown) =>
  /NotValidForName|invalid peer certificate|Hostname mismatch|certificate.*not valid/i.test(
    error instanceof Error ? error.message : String(error),
  );

const isNetPermissionError = (error: unknown) =>
  /PermissionDenied|Requires net access|allow-net/i.test(
    error instanceof Error ? `${error.name} ${error.message}` : String(error),
  );

const isRetryableConnectionError = (error: unknown) =>
  /TimedOut|ETIMEDOUT|Connection timed out|ECONNREFUSED|ENOTFOUND|network error/i.test(
    error instanceof Error ? `${error.name} ${error.message}` : String(error),
  );

const isSmtpAuthError = (error: unknown) =>
  /535|5\.7\.8|authentication failed|Invalid login|Username and Password not accepted/i.test(
    error instanceof Error ? error.message : String(error),
  );

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getSmtpHostCandidates = (host: string) => {
  const normalized = host.trim().toLowerCase();
  const fallbacks = SMTP_HOST_FALLBACKS[normalized] ?? [];
  return Array.from(new Set([...fallbacks, host.trim()].filter(Boolean)));
};

const getSmtpPortCandidates = (port: number) => {
  const normalized = Number(port);
  if (!Number.isFinite(normalized)) return [port];
  // Some providers (incl. common cPanel/Webonline setups) only accept SMTP AUTH on 465.
  // If a user picks 587 by habit, try 465 as a fallback.
  if (normalized === 587) return [587, 465];
  return [normalized];
};

const resolveSmtpSettings = async (
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<ResolvedSmtpSettings> => {
  const { data: smtp, error: smtpErr } = await supabase
    .from("org_smtp_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (smtpErr) throw new Error(smtpErr.message);

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

  // Default fallback (opt-in) for single-tenant setups.
  // Keeps secrets out of the DB while still allowing SMTP to work.
  // To enable:
  // - set DEFAULT_SMTP_ORG_ID to the target org UUID
  // - set DEFAULT_SMTP_HOST/PORT/USERNAME/PASSWORD/FROM_EMAIL (and optional FROM_NAME)
  const defaultOrgId = String(Deno.env.get("DEFAULT_SMTP_ORG_ID") ?? "").trim();
  if (!defaultOrgId || defaultOrgId !== orgId) {
    throw new Error("No SMTP settings configured for this workspace");
  }

  const host = String(Deno.env.get("DEFAULT_SMTP_HOST") ?? "").trim();
  const port = Number(Deno.env.get("DEFAULT_SMTP_PORT") ?? "465");
  const username = String(Deno.env.get("DEFAULT_SMTP_USERNAME") ?? "").trim();
  const password = String(Deno.env.get("DEFAULT_SMTP_PASSWORD") ?? "").trim();
  const fromEmail = String(Deno.env.get("DEFAULT_SMTP_FROM_EMAIL") ?? "").trim();
  const fromName = String(Deno.env.get("DEFAULT_SMTP_FROM_NAME") ?? "").trim();

  if (!host || !Number.isFinite(port) || !username || !password || !fromEmail) {
    throw new Error("Default SMTP secrets are not fully configured");
  }

  return { host, port, username, password, fromEmail, fromName };
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const paragraphHtml = (value: string) =>
  escapeHtml(value)
    .split(/\n{2,}/)
    .map(
      (part) =>
        `<p style="margin:0 0 14px;color:#3f3f46;line-height:1.6">${part.replaceAll("\n", "<br>")}</p>`,
    )
    .join("");

const withTimeout = async <T>(promise: Promise<T>, hostname: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`SMTP connection to ${hostname} timed out after 12 seconds`)),
      SMTP_SEND_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let lastAttempt: { hostname: string; port: number; tls: boolean } | null = null;

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    const body = await req.json();
    const { invite_id, test } = body as {
      invite_id?: string;
      test?: { to: string; org_id: string };
    };

    let orgId: string;
    let toEmail: string;
    let token: string | null = null;
    let orgName = "your workspace";

    if (test) {
      orgId = test.org_id;
      toEmail = test.to;
    } else {
      if (!invite_id) throw new Error("invite_id required");
      const { data: invite, error } = await supabase
        .from("invites")
        .select("id, email, token, org_id, organisations:org_id(name)")
        .eq("id", invite_id)
        .single();
      if (error || !invite) {
        throw new Error(error?.message ?? "Invite not found");
      }
      orgId = invite.org_id;
      toEmail = invite.email;
      token = invite.token;
      orgName = (invite as any).organisations?.name ?? orgName;
    }

    const smtpSettings = await resolveSmtpSettings(supabase, orgId);

    const smtpHost = smtpSettings.host;
    const smtpUsername = smtpSettings.username;
    const smtpPassword = smtpSettings.password;
    const smtpFromEmail = smtpSettings.fromEmail;
    const smtpFromName = smtpSettings.fromName;

    const { data: emailSettings } = await supabase
      .from("org_email_settings")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();

    const origin = req.headers.get("origin") ?? "";
    const link = token ? `${origin}/accept-invite/${token}` : origin;
    const brandName = emailSettings?.brand_name || orgName;
    const accentColor = /^#[0-9a-fA-F]{6}$/.test(emailSettings?.accent_color ?? "")
      ? emailSettings.accent_color
      : "#111111";
    const inviteHeading = emailSettings?.invite_heading || `You're being looped in to ${brandName}`;
    const inviteBody =
      emailSettings?.invite_body ||
      "Your team is using Loop — premium internal messaging. Click below to join the workspace and stay in the loop.";
    const signatureLines = [
      emailSettings?.signature_name || brandName,
      [emailSettings?.signature_title, emailSettings?.signature_company || brandName].filter(Boolean).join(" · "),
      emailSettings?.signature_phone,
      emailSettings?.signature_website,
    ].filter(Boolean);
    const subject = test
      ? `SMTP test from ${smtpFromName || orgName}`
      : emailSettings?.invite_subject || `${brandName} is looping you in on Loop`;
    const html = test
      ? `<p>This is a test message confirming your SMTP settings are working.</p>`
      : `
        <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#ffffff;color:#18181b;max-width:560px;margin:0 auto;padding:24px">
          ${emailSettings?.logo_url ? `<img src="${escapeHtml(emailSettings.logo_url)}" alt="${escapeHtml(brandName)}" style="display:block;max-height:42px;max-width:160px;margin:0 0 24px" />` : ""}
          <h2 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#18181b">${escapeHtml(inviteHeading)}</h2>
          ${paragraphHtml(inviteBody)}
          <p style="margin:22px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:11px 18px;background:${accentColor};color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Join the Loop</a></p>
          <p style="font-size:12px;color:#71717a;line-height:1.5">Or paste this link: ${escapeHtml(link)}</p>
          <div style="border-top:1px solid #e4e4e7;margin-top:26px;padding-top:16px;font-size:12px;color:#71717a;line-height:1.6">
            ${emailSettings?.signature_logo_url ? `<img src="${escapeHtml(emailSettings.signature_logo_url)}" alt="" style="display:block;max-height:48px;max-width:160px;margin:0 0 8px" />` : ""}
            ${signatureLines.map((line, index) => `<div style="${index === 0 ? "font-weight:700;color:#3f3f46" : ""}">${escapeHtml(line)}</div>`).join("")}
            ${emailSettings?.signature_disclaimer ? `<p style="margin:12px 0 0;color:#a1a1aa">${escapeHtml(emailSettings.signature_disclaimer)}</p>` : ""}
          </div>
        </div>`;

    // Port 465 = implicit TLS. Port 587/25 = STARTTLS upgrade.
    let lastError: unknown;
    for (const port of getSmtpPortCandidates(smtp.port)) {
      const implicitTls = port === 465;
      for (const hostname of getSmtpHostCandidates(smtpHost)) {
        lastAttempt = { hostname, port, tls: implicitTls };
        const client = new SMTPClient({
          connection: {
            hostname,
            port,
            tls: implicitTls,
            auth: { username: smtpUsername, password: smtpPassword },
          },
        });
        try {
          await withTimeout(
            client.send({
              from: `${smtpFromName || orgName} <${smtpFromEmail}>`,
              to: toEmail,
              subject,
              html,
              content: "auto",
            }),
            hostname,
          );
          await client.close();
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          try {
            await client.close();
          } catch (_) {
            // Ignore close errors after failed SMTP handshakes.
          }
          if (!isTlsHostnameError(error) && !isRetryableConnectionError(error)) {
            break;
          }
        }
      }
      if (!lastError) break;
    }
    if (lastError) throw lastError;

    return jsonResponse({ ok: true });
  } catch (e: any) {
    console.error("send-invite-email error", e);
    let msg = e.message ?? String(e);
    let code = "smtp_error";
    const debug = (e instanceof Error ? e.message : String(e)).slice(0, 800) || "Unknown SMTP error";
    if (isNetPermissionError(e)) {
      code = "smtp_net_not_allowed";
      msg =
        "SMTP via raw TCP sockets is not available in this runtime. Use an email API provider (Resend/Postmark/Mailgun) or move SMTP sending to your Vercel backend.";
    } else if (isSmtpAuthError(e)) {
      code = "smtp_auth_failed";
      msg =
        "SMTP authentication failed. Re-enter the mailbox password, use the full email address as the username, and confirm SMTP access is enabled for this mailbox.";
    } else if (isTlsHostnameError(e)) {
      code = "smtp_tls_host_mismatch";
      msg =
        "TLS certificate doesn't match the SMTP host. For this mailbox, use 'mail.webonline.biz' as the SMTP host with your existing email username and password.";
    } else if (isRetryableConnectionError(e)) {
      code = "smtp_connection_failed";
      msg =
        "The SMTP server did not respond in time. For Webonline/HKFT mailboxes, use 'mail.webonline.biz' with port 465 and TLS enabled.";
    }
    return jsonResponse({ ok: false, error: msg, code, last_attempt: lastAttempt, debug });
  }
});
