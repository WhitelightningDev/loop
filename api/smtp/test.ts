import nodemailer from "nodemailer";
import { requireSupabaseUserId } from "../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../src/server/api/http";
import { requireOrgAdmin } from "../../src/server/api/roles";
import { getOrgSmtpSettings } from "../../src/server/smtp/smtpSettings";

type Body = { orgId?: string; to?: string };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<Body>(req);
    if (!body.orgId) return sendError(res, 400, "missing_org_id");
    if (!body.to) return sendError(res, 400, "missing_to");

    await requireOrgAdmin(userId, body.orgId);

    const smtp = await getOrgSmtpSettings(body.orgId);

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.username, pass: smtp.password },
      tls: {
        servername: smtp.host,
      },
    });

    await transport.sendMail({
      from: `${smtp.fromName || "Loop"} <${smtp.fromEmail}>`,
      to: body.to,
      subject: `SMTP test from ${smtp.fromName || "Loop"}`,
      html: "<p>This is a test message confirming your SMTP settings are working.</p>",
    });

    return sendJson(res, 200, { ok: true });
  } catch (e) {
    const msg = (e as Error).message || "smtp_test_failed";
    const status =
      msg === "missing_bearer_token" || msg === "invalid_token" ? 401 : msg === "forbidden" ? 403 : 500;
    return sendError(res, status, msg);
  }
}

