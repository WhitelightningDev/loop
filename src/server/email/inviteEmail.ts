type InviteEmailSettings = {
  brand_name?: string | null;
  accent_color?: string | null;
  invite_subject?: string | null;
  invite_heading?: string | null;
  invite_body?: string | null;
  logo_url?: string | null;
  signature_name?: string | null;
  signature_title?: string | null;
  signature_company?: string | null;
  signature_phone?: string | null;
  signature_website?: string | null;
  signature_logo_url?: string | null;
  signature_disclaimer?: string | null;
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

export function buildInviteEmail(opts: {
  test: boolean;
  orgName: string;
  smtpFromName: string | null;
  toEmail: string;
  link?: string | null;
  emailSettings?: InviteEmailSettings | null;
}) {
  const brandName = opts.emailSettings?.brand_name || opts.orgName;
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(opts.emailSettings?.accent_color ?? "")
    ? (opts.emailSettings?.accent_color as string)
    : "#111111";

  const inviteHeading =
    opts.emailSettings?.invite_heading || `You're being looped in to ${brandName}`;
  const inviteBody =
    opts.emailSettings?.invite_body ||
    "Your team is using Loop — premium internal messaging. Click below to join the workspace and stay in the loop.";

  const signatureLines = [
    opts.emailSettings?.signature_name || brandName,
    [opts.emailSettings?.signature_title, opts.emailSettings?.signature_company || brandName].filter(Boolean).join(" · "),
    opts.emailSettings?.signature_phone,
    opts.emailSettings?.signature_website,
  ].filter(Boolean) as string[];

  const subject = opts.test
    ? `SMTP test from ${opts.smtpFromName || opts.orgName}`
    : opts.emailSettings?.invite_subject || `${brandName} is looping you in on Loop`;

  const html = opts.test
    ? `<p>This is a test message confirming your SMTP settings are working.</p>`
    : `
        <div style="font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#ffffff;color:#18181b;max-width:560px;margin:0 auto;padding:24px">
          ${opts.emailSettings?.logo_url ? `<img src="${escapeHtml(opts.emailSettings.logo_url)}" alt="${escapeHtml(brandName)}" style="display:block;max-height:42px;max-width:160px;margin:0 0 24px" />` : ""}
          <h2 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#18181b">${escapeHtml(inviteHeading)}</h2>
          ${paragraphHtml(inviteBody)}
          <p style="margin:22px 0"><a href="${escapeHtml(opts.link)}" style="display:inline-block;padding:11px 18px;background:${accentColor};color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Join the Loop</a></p>
          <p style="font-size:12px;color:#71717a;line-height:1.5">Or paste this link: ${escapeHtml(opts.link)}</p>
          <div style="border-top:1px solid #e4e4e7;margin-top:26px;padding-top:16px;font-size:12px;color:#71717a;line-height:1.6">
            ${opts.emailSettings?.signature_logo_url ? `<img src="${escapeHtml(opts.emailSettings.signature_logo_url)}" alt="" style="display:block;max-height:48px;max-width:160px;margin:0 0 8px" />` : ""}
            ${signatureLines.map((line, index) => `<div style="${index === 0 ? "font-weight:700;color:#3f3f46" : ""}">${escapeHtml(line)}</div>`).join("")}
            ${opts.emailSettings?.signature_disclaimer ? `<p style="margin:12px 0 0;color:#a1a1aa">${escapeHtml(opts.emailSettings.signature_disclaimer)}</p>` : ""}
          </div>
        </div>`;

  return { subject, html };
}

