import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface MentionUser {
  id: string;
  username: string | null;
  full_name: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  users: MentionUser[];
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  rows?: number;
  className?: string;
}

/** Find an active "@token" right before the caret (no spaces in token). */
function getActiveMention(text: string, caret: number): { start: number; query: string } | null {
  if (caret <= 0) return null;
  // Walk back from caret while characters are valid mention chars
  let i = caret;
  while (i > 0) {
    const ch = text[i - 1];
    if (ch === "@") {
      const before = i >= 2 ? text[i - 2] : "";
      // Must be at start, after whitespace, or after newline
      if (before === "" || /\s/.test(before)) {
        return { start: i - 1, query: text.slice(i, caret) };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

function score(u: MentionUser, q: string): number {
  if (!q) return 1;
  const lq = q.toLowerCase();
  const uname = (u.username ?? "").toLowerCase();
  const name = (u.full_name ?? "").toLowerCase();
  const compact = name.replace(/\s+/g, "");
  if (uname.startsWith(lq)) return 100 - (uname.length - lq.length);
  if (compact.startsWith(lq)) return 80 - (compact.length - lq.length);
  if (name.startsWith(lq)) return 70 - (name.length - lq.length);
  if (uname.includes(lq)) return 40;
  if (compact.includes(lq)) return 30;
  if (name.includes(lq)) return 20;
  return 0;
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, onKeyDown, users, placeholder, disabled, maxLength, rows = 1, className },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const [caret, setCaret] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const mention = useMemo(() => getActiveMention(value, caret), [value, caret]);

  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query;
    const ranked = users
      .map((u) => ({ u, s: score(u, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.u);
    return ranked;
  }, [mention, users]);

  useEffect(() => {
    if (mention && matches.length > 0) {
      setOpen(true);
      setActiveIdx(0);
    } else {
      setOpen(false);
    }
  }, [mention, matches.length]);

  const insertMention = (u: MentionUser) => {
    if (!mention) return;
    const tag = u.username ?? (u.full_name ?? "user").replace(/\s+/g, "").toLowerCase();
    const before = value.slice(0, mention.start);
    const after = value.slice(caret);
    const insert = `@${tag} `;
    const next = before + insert + after;
    onChange(next);
    const newCaret = before.length + insert.length;
    requestAnimationFrame(() => {
      const el = innerRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
        setCaret(newCaret);
      }
    });
    setOpen(false);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const updateCaret = () => {
    const el = innerRef.current;
    if (el) setCaret(el.selectionStart ?? el.value.length);
  };

  return (
    <div className="relative">
      <Textarea
        ref={innerRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={updateCaret}
        onClick={updateCaret}
        onSelect={updateCaret}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        className={className}
      />
      {open && matches.length > 0 && (
        <div className="absolute bottom-full left-2 z-50 mb-1 w-72 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="border-b border-border/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            People
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {matches.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm",
                    i === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={u.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(u.full_name ?? u.username ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.full_name ?? u.username}</div>
                    {u.username && (
                      <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
