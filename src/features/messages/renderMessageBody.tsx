import { Fragment, type ReactNode } from "react";

export interface MentionableUser {
  id: string;
  username: string | null;
  full_name: string | null;
}

const MENTION_RE = /(^|\s)@([a-zA-Z0-9_.]{2,30})/g;

/**
 * Render message body text with @mentions highlighted.
 * Matches against username (primary) and full_name with whitespace removed (fallback).
 */
export function renderMessageBody(body: string, users: MentionableUser[], currentUserId?: string): ReactNode {
  if (!body) return null;
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(body)) !== null) {
    const [whole, lead, tag] = match;
    const start = match.index + lead.length;
    if (start > last) out.push(body.slice(last, start));
    const tagLower = tag.toLowerCase();
    const user = users.find(
      (u) =>
        (u.username ?? "").toLowerCase() === tagLower ||
        (u.full_name ?? "").replace(/\s+/g, "").toLowerCase() === tagLower,
    );
    if (user) {
      const isMe = currentUserId === user.id;
      out.push(
        <span
          key={`m-${start}`}
          className={
            isMe
              ? "rounded bg-primary/20 px-1 py-0.5 font-medium text-primary"
              : "rounded bg-accent/40 px-1 py-0.5 font-medium text-foreground"
          }
        >
          @{user.username ?? tag}
        </span>,
      );
    } else {
      out.push(`@${tag}`);
    }
    last = match.index + whole.length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out.map((node, i) => <Fragment key={i}>{node}</Fragment>);
}
