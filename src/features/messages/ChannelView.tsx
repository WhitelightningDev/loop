import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Hash,
  Lock,
  Send,
  Smile,
  Pin,
  Trash2,
  MessageSquare,
  Users,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Film,
  Plus,
  UserPlus,
  UserMinus,
  ShieldAlert,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Attachment } from "./Attachment";
import { ThreadPanel } from "./ThreadPanel";
import { MentionTextarea } from "./MentionTextarea";
import { renderMessageBody } from "./renderMessageBody";
import { useTypingIndicator } from "./useTyping";
import { CallPanel } from "@/features/calls/CallPanel";
import { ChannelCallBar, CallTriggerButtons } from "@/features/calls/ChannelCallBar";
import type { CallKind } from "@/features/calls/useCallSession";
import { useOrg, isAdmin as isOrgAdmin } from "@/features/organisations/OrgProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

interface MessageRow {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  edited_at: string | null;
  created_at: string;
}

export function ChannelView({ channelId }: { channelId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [threadParent, setThreadParent] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{ id: string; kind: CallKind } | null>(null);
  const { typers, ping } = useTypingIndicator(channelId, user?.id);
  const [fileAccept, setFileAccept] = useState<string>("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Reset thread + call when channel changes
  useEffect(() => {
    setThreadParent(null);
    setActiveCall(null);
  }, [channelId]);

  const { data: channel } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .maybeSingle();
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["channel-members", channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("channel_members")
        .select(
          "user_id, user_profiles!inner(id, username, full_name, email, avatar_url, presence_status, status_text)",
        )
        .eq("channel_id", channelId);
      return (data ?? []).map((m: any) => m.user_profiles);
    },
  });

  const { data: ownMembership } = useQuery({
    queryKey: ["channel-membership", channelId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_members")
        .select("channel_id")
        .eq("channel_id", channelId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const isMember = ownMembership === true || members.some((m: any) => m.id === user?.id);
  const membershipStatusKnown = !user || ownMembership !== undefined || isMember;

  const { roles } = useOrg();
  const orgAdmin = isOrgAdmin(roles);
  const [showManageMembers, setShowManageMembers] = useState(false);

  const { data: ownChannelRole } = useQuery({
    queryKey: ["channel-member-role", channelId, user?.id],
    enabled: !!user && isMember,
    queryFn: async () => {
      const { data } = await supabase
        .from("channel_members")
        .select("role")
        .eq("channel_id", channelId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.role ?? null;
    },
  });

  const isChannelAdmin = ownChannelRole === "admin";
  const canManageMembers = orgAdmin || isChannelAdmin;
  const locked = !!channel?.is_locked;

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .is("parent_id", null)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as MessageRow[];
    },
  });

  const messageIds = messages.map((m) => m.id);

  const { data: reactions = [] } = useQuery({
    queryKey: ["reactions", channelId, messageIds.length],
    enabled: messageIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageIds);
      return data ?? [];
    },
  });

  const { data: pins = [] } = useQuery({
    queryKey: ["pins", channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pinned_messages")
        .select("message_id")
        .eq("channel_id", channelId);
      return (data ?? []).map((p) => p.message_id);
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", channelId, messageIds.length],
    enabled: messageIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("attachments").select("*").in("message_id", messageIds);
      return data ?? [];
    },
  });

  const authorIds = Array.from(new Set(messages.map((m) => m.author_id)));
  const { data: authorProfiles = [] } = useQuery({
    queryKey: ["message-authors", channelId, authorIds.sort().join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, username, full_name, email, avatar_url, presence_status, status_text")
        .in("id", authorIds);
      return data ?? [];
    },
  });

  const { data: replyCounts = {} } = useQuery({
    queryKey: ["reply-counts", channelId, messageIds.length],
    enabled: messageIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("parent_id")
        .in("parent_id", messageIds)
        .is("deleted_at", null);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.parent_id) counts[r.parent_id] = (counts[r.parent_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`channel-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", channelId] });
          qc.invalidateQueries({ queryKey: ["reply-counts", channelId] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["reactions", channelId] });
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pinned_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["pins", channelId] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "attachments" }, () => {
        qc.invalidateQueries({ queryKey: ["attachments", channelId] });
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_members",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
          if (user?.id)
            qc.invalidateQueries({ queryKey: ["channel-membership", channelId, user.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId, qc, user?.id]);

  // Presence refresh: throttled, only updates a lightweight presence cache,
  // never invalidates the heavy channel-members query (which triggers cascades).
  useEffect(() => {
    let pending = false;
    const ch = supabase
      .channel(`presence-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => {
        if (pending) return;
        pending = true;
        setTimeout(() => {
          pending = false;
          qc.invalidateQueries({ queryKey: ["channel-members", channelId], refetchType: "none" });
        }, 5000);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [channelId, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Update last_read_at only when the channel changes or unmounts — not on every new message.
  useEffect(() => {
    if (!user) return;
    const update = () => {
      void supabase
        .from("channel_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("user_id", user.id);
    };
    update();
    return update;
  }, [channelId, user]);

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const valid = list.filter((f) => {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} is over 25 MB`);
        return false;
      }
      return true;
    });
    setPendingFiles((p) => [...p, ...valid].slice(0, 10));
    if (fileRef.current) fileRef.current.value = "";
  };

  const ensureMembership = async (): Promise<boolean> => {
    if (!user) return false;
    if (isMember) return true;
    if (channel?.type !== "public") return false;
    const { error } = await supabase
      .from("channel_members")
      .insert({ channel_id: channelId, user_id: user.id });
    if (error && !/duplicate key/i.test(error.message)) {
      toast.error(error.message);
      return false;
    }
    qc.setQueryData(["channel-membership", channelId, user.id], true);
    void qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
    void qc.invalidateQueries({ queryKey: ["sidebar-channels"] });
    return true;
  };

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!user) return;
    const text = body.trim().slice(0, 4000);
    const filesToSend = pendingFiles;
    if (!text && filesToSend.length === 0) return;

    // Clear the composer immediately for snappy UX.
    setBody("");
    setPendingFiles([]);
    if (taRef.current) taRef.current.style.height = "auto";

    // Optimistic message — appears instantly. Real row replaces it via realtime.
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: MessageRow = {
      id: tempId,
      channel_id: channelId,
      author_id: user.id,
      body: text,
      parent_id: null,
      edited_at: null,
      created_at: new Date().toISOString(),
    };
    qc.setQueryData<MessageRow[]>(["messages", channelId], (prev = []) => [...prev, optimistic]);

    try {
      const ok = await ensureMembership();
      if (!ok) {
        toast.error("Join this channel before sending messages.");
        qc.setQueryData<MessageRow[]>(["messages", channelId], (prev = []) =>
          prev.filter((m) => m.id !== tempId),
        );
        setBody(text);
        setPendingFiles(filesToSend);
        return;
      }

      const { data: msg, error } = await supabase
        .from("messages")
        .insert({ channel_id: channelId, author_id: user.id, body: text })
        .select()
        .single();
      if (error || !msg) throw error ?? new Error("Failed to send");

      // Swap optimistic for real id so realtime dedupe works.
      qc.setQueryData<MessageRow[]>(["messages", channelId], (prev = []) =>
        prev.map((m) => (m.id === tempId ? (msg as MessageRow) : m)),
      );

      // Upload files in parallel, in the background — don't block the UI.
      if (filesToSend.length > 0) {
        setUploading(true);
        void Promise.all(
          filesToSend.map(async (file) => {
            const path = `${channelId}/${msg.id}/${crypto.randomUUID()}-${file.name}`;
            const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
              contentType: file.type,
              upsert: false,
            });
            if (upErr) {
              toast.error(`Upload failed: ${file.name}`);
              return;
            }
            await supabase.from("attachments").insert({
              message_id: msg.id,
              created_by: user.id,
              storage_path: path,
              mime_type: file.type,
              size: file.size,
            });
          }),
        ).finally(() => setUploading(false));
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send");
      qc.setQueryData<MessageRow[]>(["messages", channelId], (prev = []) =>
        prev.filter((m) => m.id !== tempId),
      );
      setBody(text);
      setPendingFiles(filesToSend);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const openFilePicker = (accept: string) => {
    setFileAccept(accept);
    // Wait for state to apply
    setTimeout(() => fileRef.current?.click(), 0);
  };

  const [joining, setJoining] = useState(false);
  const join = async () => {
    if (!user || joining) return;
    setJoining(true);
    try {
      // Insert membership; if it already exists, treat as success.
      const { error } = await supabase
        .from("channel_members")
        .insert({ channel_id: channelId, user_id: user.id });
      if (error && !/duplicate key/i.test(error.message)) {
        toast.error(error.message);
        return;
      }
      // Profile row is created by the on_auth_user_created trigger; no manual insert needed.
      qc.setQueryData(["channel-membership", channelId, user.id], true);
      toast.success(`Joined #${channel?.name ?? "channel"}`);
      await qc.invalidateQueries({ queryKey: ["channel-membership", channelId, user.id] });
      await qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
      await qc.invalidateQueries({ queryKey: ["sidebar-channels"] });
    } finally {
      setJoining(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find(
      (r: any) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji,
    );
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  const togglePin = async (messageId: string) => {
    if (!user) return;
    if (pins.includes(messageId)) {
      await supabase
        .from("pinned_messages")
        .delete()
        .eq("channel_id", channelId)
        .eq("message_id", messageId);
    } else {
      await supabase
        .from("pinned_messages")
        .insert({ channel_id: channelId, message_id: messageId, pinned_by: user.id });
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message?")) return;
    await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId);
  };

  if (!channel) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading channel...
      </div>
    );
  }

  const typerNames = typers
    .map((id) => members.find((m: any) => m.id === id)?.full_name)
    .filter(Boolean) as string[];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
          <div className="flex min-w-0 items-center gap-2">
            {channel.type === "private" ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : channel.type === "dm" ? (
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Hash className="h-4 w-4 text-muted-foreground" />
            )}
            <h2 className="truncate font-semibold">{channel.name}</h2>
            {locked && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
            {channel.description && (
              <>
                <span className="mx-2 h-4 w-px bg-border" />
                <span className="truncate text-sm text-muted-foreground">
                  {channel.description}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <CallTriggerButtons
              channelId={channelId}
              onOpenCall={(id, kind) => setActiveCall({ id, kind })}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMembers((s) => !s)}
              className="gap-1.5"
            >
              <Users className="h-4 w-4" /> {members.length}
            </Button>
          </div>
        </div>

        <ChannelCallBar
          channelId={channelId}
          onOpenCall={(id, kind) => setActiveCall({ id, kind })}
        />

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Hash className="h-5 w-5" />
              </div>
              <div className="text-base font-semibold">Welcome to #{channel.name}</div>
              <p className="max-w-sm text-sm text-muted-foreground">
                Start the loop — drop the first message and bring your team in.
              </p>
            </div>
          )}
          <div className="space-y-1">
            {messages.map((m, idx) => {
              const author =
                authorProfiles.find((u: any) => u.id === m.author_id) ??
                members.find((u: any) => u.id === m.author_id);
              const msgReactions = reactions.filter((r: any) => r.message_id === m.id);
              const grouped: Record<string, string[]> = {};
              msgReactions.forEach((r: any) => {
                grouped[r.emoji] = grouped[r.emoji]
                  ? [...grouped[r.emoji], r.user_id]
                  : [r.user_id];
              });
              const isPinned = pins.includes(m.id);
              const msgAtts = attachments.filter((a: any) => a.message_id === m.id);
              const replyCount = (replyCounts as Record<string, number>)[m.id] ?? 0;
              const hasReactions = Object.keys(grouped).length > 0;

              const prev = messages[idx - 1];
              const grouping =
                prev &&
                prev.author_id === m.author_id &&
                new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                  5 * 60 * 1000;

              const isMine = m.author_id === user?.id;

              return (
                <div
                  key={m.id}
                  className={cn(
                    "group relative flex w-full gap-2 px-2",
                    grouping ? "mt-0.5" : "mt-3",
                    isMine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {/* Avatar (only on first in group) */}
                  <div className="w-9 shrink-0">
                    {!grouping ? (
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={author?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {(author?.full_name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-9 w-9" />
                    )}
                  </div>

                  <div
                    className={cn(
                      "flex min-w-0 max-w-[78%] flex-col sm:max-w-[68%]",
                      isMine ? "items-end" : "items-start",
                    )}
                  >
                    {!grouping && (
                      <div
                        className={cn(
                          "mb-0.5 flex items-baseline gap-2 px-1",
                          isMine && "flex-row-reverse",
                        )}
                      >
                        <span className="text-xs font-semibold">
                          {isMine ? "You" : (author?.full_name ?? "Member")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isPinned && <Pin className="h-3 w-3 text-warning" />}
                      </div>
                    )}

                    {(m.body || hasReactions) && (
                      <div
                        className={cn(
                          "relative px-3 py-2 text-sm leading-relaxed shadow-sm",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-md"
                            : "bg-muted text-foreground rounded-2xl rounded-tl-md",
                          grouping && (isMine ? "rounded-tr-2xl" : "rounded-tl-2xl"),
                        )}
                      >
                        {m.body && (
                          <div className="whitespace-pre-wrap break-words">
                            {renderMessageBody(m.body, members as any, user?.id)}
                          </div>
                        )}
                        {hasReactions && (
                          <div className={cn("mt-2 flex flex-wrap gap-1", isMine && "justify-end")}>
                            {Object.entries(grouped).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(m.id, emoji)}
                                className={cn(
                                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                                  isMine
                                    ? user && users.includes(user.id)
                                      ? "border-primary-foreground/50 bg-primary-foreground/25 text-primary-foreground"
                                      : "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
                                    : user && users.includes(user.id)
                                      ? "border-primary/40 bg-primary/10 text-primary"
                                      : "border-border bg-background hover:bg-accent",
                                )}
                              >
                                <span>{emoji}</span>
                                <span className="tabular-nums">{users.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {replyCount > 0 && (
                      <button
                        onClick={() => setThreadParent(m.id)}
                        className="mt-1 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {replyCount} {replyCount === 1 ? "reply" : "replies"}
                      </button>
                    )}

                    {msgAtts.length > 0 && (
                      <div
                        className={cn(
                          "mt-1 flex flex-col gap-1",
                          isMine ? "items-end" : "items-start",
                        )}
                      >
                        {msgAtts.map((a: any) => (
                          <Attachment key={a.id} att={a} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hover toolbar */}
                  <div
                    className={cn(
                      "absolute -top-3 flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100",
                      isMine ? "left-12" : "right-2",
                    )}
                  >
                    <ReactionPicker onPick={(e) => toggleReaction(m.id, e)} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setThreadParent(m.id)}
                      title="Continue the loop"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => togglePin(m.id)}
                      title="Pin"
                    >
                      <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-warning text-warning")} />
                    </Button>
                    {isMine && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => deleteMessage(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          {membershipStatusKnown && !isMember && channel.type !== "public" && (
            <div className="mb-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span>You're not in this loop yet.</span>
            </div>
          )}
          <form
            onSubmit={(e) => void sendMessage(e)}
            className="rounded-xl border border-border bg-surface shadow-sm transition-shadow focus-within:border-ring/40 focus-within:shadow-md"
          >
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-border px-3 pb-2 pt-2.5">
                {pendingFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs"
                  >
                    {f.type.startsWith("image/") ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : f.type.startsWith("video/") ? (
                      <Film className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    <span className="max-w-[160px] truncate">{f.name}</span>
                    <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <MentionTextarea
              ref={taRef}
              value={body}
              onChange={(next) => {
                setBody(next);
                if (next.length > 0) void ping();
              }}
              onKeyDown={onKeyDown}
              users={members as any}
              placeholder={`Message #${channel.name}`}
              maxLength={4000}
              rows={1}
              disabled={membershipStatusKnown && !isMember && channel.type !== "public"}
              className="min-h-[44px] resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between border-t border-border/60 px-2 py-1.5">
              <div className="flex items-center gap-0.5">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept={fileAccept || undefined}
                  className="hidden"
                  onChange={onPickFiles}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={uploading}
                      className="h-7 w-7"
                      title="Attach"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="w-56">
                    <DropdownMenuLabel>Attach</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => openFilePicker("image/*")}>
                      <ImageIcon className="mr-2 h-4 w-4" /> Photo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openFilePicker("video/*")}>
                      <Film className="mr-2 h-4 w-4" /> Video
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        openFilePicker(".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx")
                      }
                    >
                      <FileText className="mr-2 h-4 w-4" /> Document
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openFilePicker("")}>
                      <Paperclip className="mr-2 h-4 w-4" /> Any file
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={!body.trim() && pendingFiles.length === 0}
                className="h-7 gap-1.5 px-3"
              >
                <Send className="h-3.5 w-3.5" />
                Loop
              </Button>
            </div>
          </form>
          <div className="mt-1 px-1 text-[11px] text-muted-foreground">
            <span className="opacity-60">Enter</span> to loop ·{" "}
            <span className="opacity-60">Shift+Enter</span> for new line
          </div>
          <div className="mt-1 h-4 px-1 text-xs text-muted-foreground">
            {typerNames.length === 1 && `${typerNames[0]} is typing…`}
            {typerNames.length === 2 && `${typerNames[0]} and ${typerNames[1]} are typing…`}
            {typerNames.length > 2 && `Several people are typing…`}
          </div>
        </div>
      </div>

      {/* Active call panel */}
      {activeCall && (
        <aside className="hidden h-full w-[420px] shrink-0 border-l border-border xl:flex">
          <CallPanel
            callId={activeCall.id}
            channelId={channelId}
            kind={activeCall.kind}
            members={members as any}
            onClose={() => setActiveCall(null)}
          />
        </aside>
      )}

      {/* Thread panel */}
      {threadParent && !activeCall && (
        <ThreadPanel
          channelId={channelId}
          parentId={threadParent}
          onClose={() => setThreadParent(null)}
        />
      )}

      {/* Members panel */}
      {showMembers && !threadParent && !activeCall && (
        <aside className="hidden h-full w-72 shrink-0 flex-col border-l border-border bg-surface lg:flex">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              About
            </div>
            <div className="mt-1.5 font-semibold">#{channel.name}</div>
            {channel.description && (
              <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Members · {members.length}
              </div>
              {canManageMembers ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setShowManageMembers(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add
                </Button>
              ) : locked ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              ) : null}
            </div>
            {locked && !canManageMembers && (
              <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                <span>Only channel admins can add or remove people.</span>
              </p>
            )}
            <div className="mt-2 space-y-0.5">
              {members.map((m: any) => (
                <div
                  key={m.id}
                  className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <div className="relative">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {(m.full_name ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-surface",
                        m.presence_status === "online"
                          ? "bg-success"
                          : m.presence_status === "away"
                            ? "bg-warning"
                            : "bg-muted-foreground/40",
                      )}
                    />
                  </div>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{m.full_name ?? m.email}</span>
                    {m.status_text && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {m.status_text}
                      </span>
                    )}
                  </span>
                  {canManageMembers && m.id !== user?.id && (
                    <button
                      type="button"
                      title="Remove from channel"
                      onClick={async () => {
                        if (!confirm(`Remove ${m.full_name ?? m.email} from #${channel.name}?`))
                          return;
                        const { error } = await supabase
                          .from("channel_members")
                          .delete()
                          .eq("channel_id", channelId)
                          .eq("user_id", m.id);
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Removed");
                          qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
                        }
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {showManageMembers && (
        <ManageMembersDialog
          open={showManageMembers}
          onOpenChange={setShowManageMembers}
          channelId={channelId}
          channelName={channel.name}
          orgId={channel.org_id}
          existingMemberIds={members.map((m: any) => m.id)}
        />
      )}
    </div>
  );
}

function ManageMembersDialog({
  open,
  onOpenChange,
  channelId,
  channelName,
  orgId,
  existingMemberIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channelId: string;
  channelName: string;
  orgId: string;
  existingMemberIds: string[];
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ["channel-add-candidates", orgId, channelId],
    queryFn: async () => {
      const { data } = await supabase
        .from("organisation_members")
        .select("user_id, user_profiles!inner(id, full_name, email, avatar_url)")
        .eq("org_id", orgId)
        .eq("status", "active");
      return ((data ?? []) as any[])
        .map((m) => m.user_profiles)
        .filter((p) => !existingMemberIds.includes(p.id));
    },
  });

  const filtered = candidates.filter((p: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.full_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q)
    );
  });

  const addMember = async (userId: string) => {
    setAdding(userId);
    const { error } = await supabase
      .from("channel_members")
      .insert({ channel_id: channelId, user_id: userId });
    setAdding(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Added to channel");
    qc.invalidateQueries({ queryKey: ["channel-members", channelId] });
    qc.invalidateQueries({ queryKey: ["channel-add-candidates", orgId, channelId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add people to #{channelName}</DialogTitle>
          <DialogDescription>
            Pick teammates to add. They'll see the channel in their sidebar instantly.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by name or email"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {candidates.length === 0
                ? "Everyone in the workspace is already here."
                : "No matches."}
            </div>
          ) : (
            filtered.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-0"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(p.full_name ?? p.email ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.full_name ?? p.email}</div>
                  {p.full_name && (
                    <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={adding === p.id}
                  onClick={() => addMember(p.id)}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  {adding === p.id ? "Adding…" : "Add"}
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReactionPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen((o) => !o)}>
        <Smile className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 top-8 z-10 flex gap-1 rounded-md border border-border bg-popover p-1 shadow-md">
          {REACTIONS.map((e) => (
            <button
              key={e}
              className="rounded p-1 text-base hover:bg-accent"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
