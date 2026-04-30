import nodemailer from "nodemailer";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { requireSupabaseUserId } from "../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../src/server/api/http";
import { requireOrgAdmin } from "../../src/server/api/roles";
import { buildInviteEmail } from "../../src/server/email/inviteEmail";
import { getOrgSmtpSettings } from "../../src/server/smtp/smtpSettings";

type Body = { inviteId?: string; origin?: string };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<Body>(req);
    if (!body.inviteId) return sendError(res, 400, "missing_invite_id");

    const inviteRes = await supabaseAdmin
      .from("invites")
      .select("id, email, token, org_id, organisations:org_id(name)")
      .eq("id", body.inviteId)
      .single();
    if (inviteRes.error || !inviteRes.data) {
      return sendError(res, 404, inviteRes.error?.message ?? "invite_not_found");
    }

    const invite = inviteRes.data as any;
    const orgId = String(invite.org_id);
    const toEmail = String(invite.email);
    const token = String(invite.token);
    const orgName = invite.organisations?.name ?? "your workspace";

    await requireOrgAdmin(userId, orgId);

    const smtp = await getOrgSmtpSettings(orgId);
    const { data: emailSettings } = await supabaseAdmin
      .from("org_email_settings")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();

    const origin = (() => {
      const raw = String(body.origin ?? "").trim();
      if (raw) return raw;
      const proto = (req.headers["x-forwarded-proto"] ?? "https") as string;
      const host = (req.headers["x-forwarded-host"] ?? req.headers.host) as string | undefined;
      return `${proto}://${host ?? "localhost"}`;
    })();

    const link = `${origin}/accept-invite/${encodeURIComponent(token)}`;
    const { subject, html } = buildInviteEmail({
      test: false,
      orgName,
      smtpFromName: smtp.fromName || orgName,
      toEmail,
      link,
      emailSettings: (emailSettings ?? null) as any,
    });

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.username, pass: smtp.password },
      tls: { servername: smtp.host },
    });

    await transport.sendMail({
      from: `${smtp.fromName || orgName} <${smtp.fromEmail}>`,
      to: toEmail,
      subject,
      html,
    });

    return sendJson(res, 200, { ok: true });
  } catch (e) {
    const msg = (e as Error).message || "invite_send_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    return sendError(res, status, msg);
  }
}

