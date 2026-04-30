import { requireSupabaseUserId } from "../../src/server/api/auth";
import { methodNotAllowed, readJsonBody, sendError, sendJson } from "../../src/server/api/http";
import { requireOrgAdmin } from "../../src/server/api/roles";
import { resolveEmailProviderForOrg, sendEmailForOrg } from "../../src/server/email/sender";

type Body = { orgId?: string; to?: string };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const { userId } = await requireSupabaseUserId(req);
    const body = await readJsonBody<Body>(req);
    if (!body.orgId) return sendError(res, 400, "missing_org_id");
    if (!body.to) return sendError(res, 400, "missing_to");

    await requireOrgAdmin(userId, body.orgId);

    const provider = await resolveEmailProviderForOrg(body.orgId);
    const fromName = "Loop";
    await sendEmailForOrg({
      orgId: body.orgId,
      fromName,
      toEmail: body.to,
      subject: `Email test from ${fromName}`,
      html: "<p>This is a test message confirming your email sending is working.</p>",
    });

    return sendJson(res, 200, { ok: true, provider });
  } catch (e) {
    console.error("/api/smtp/test error", e);
    const err = e as any;
    const msg = (err?.message as string) || "smtp_test_failed";
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
