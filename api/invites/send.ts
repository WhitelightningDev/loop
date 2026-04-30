import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { requireSupabaseUserId } from "../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../src/server/api/http";
import { requireOrgAdmin } from "../../src/server/api/roles";
import { getEmailProvider, sendEmail } from "../../src/server/email/sender";
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

    const provider = getEmailProvider();
    const smtp = provider === "smtp" ? await getOrgSmtpSettings(orgId) : undefined;
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
      smtpFromName: smtp?.fromName || orgName,
      toEmail,
      link,
      emailSettings: (emailSettings ?? null) as any,
    });

    await sendEmail({
      smtp,
      fromName: smtp?.fromName || orgName,
      fromEmail: smtp?.fromEmail,
      toEmail,
      subject,
      html,
    });

    return sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error("/api/invites/send error", e);
    const err = e as any;
    const msg = (err?.message as string) || "invite_send_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    const details =
      status === 500
        ? {
            name: typeof err?.name === "string" ? err.name : undefined,
            code: typeof err?.code === "string" ? err.code : undefined,
            command: typeof err?.command === "string" ? err.command : undefined,
            responseCode: typeof err?.responseCode === "number" ? err.responseCode : undefined,
          }
        : undefined;
    return details ? sendJson(res, status, { error: msg, details }) : sendError(res, status, msg);
  }
}
