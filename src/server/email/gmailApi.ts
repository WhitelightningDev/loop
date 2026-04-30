import type { GoogleOAuthConfig } from "./googleOAuth";
import { getGoogleAccessToken } from "./googleOAuth";

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sendViaGmailApi(opts: {
  oauth: GoogleOAuthConfig;
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  subject: string;
  html: string;
}) {
  const accessToken = await getGoogleAccessToken(opts.oauth);

  const from = opts.fromName ? `${opts.fromName} <${opts.fromEmail}>` : opts.fromEmail;

  const raw = [
    `From: ${from}`,
    `To: ${opts.toEmail}`,
    `Subject: ${opts.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    opts.html,
  ].join("\r\n");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(raw) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gmail_api_send_failed: ${text.slice(0, 240)}`);
  }
}

