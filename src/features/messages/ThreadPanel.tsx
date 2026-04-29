import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { X, Send } from "lucide-react";
import { Attachment } from "./Attachment";
import { MentionTextarea } from "./MentionTextarea";
import { renderMessageBody } from "./renderMessageBody";

interface MessageRow {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
}

export function ThreadPanel({
  channelId,
  parentId,
  onClose,
}: {
  channelId: string;
  parentId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: parent } = useQuery({
    queryKey: ["message", parentId],
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("id", parentId).maybeSingle();
      return data as MessageRow | null;
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["thread", parentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("parent_id", parentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      return (data ?? []) as MessageRow[];
    },
  });

  const allIds = [parentId, ...replies.map((r) => r.id)];
  const { data: attachments = [] } = useQuery({
    queryKey: ["thread-attachments", parentId, replies.length],
    enabled: allIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("attachments").select("*").in("message_id", allIds);
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["thread-profiles", parentId, replies.length],
    queryFn: async () => {
      const ids = Array.from(new Set([parent?.author_id, ...replies.map((r) => r.author_id)].filter(Boolean) as string[]));
      if (ids.length === 0) return [];
      const { data } = await supabase.from("user_profiles").select("id, username, full_name, email, avatar_url").in("id", ids);
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`thread-${parentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `parent_id=eq.${parentId}` },
        () => qc.invalidateQueries({ queryKey: ["thread", parentId] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [parentId, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [replies.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !body.trim()) return;
    const text = body.trim().slice(0, 4000);
    setBody("");
    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      author_id: user.id,
      body: text,
      parent_id: parentId,
    });
    if (error) {
      toast.error(error.message);
      setBody(text);
    }
  };

  const renderMessage = (m: MessageRow) => {
    const author = profiles.find((p: any) => p.id === m.author_id);
    const atts = attachments.filter((a: any) => a.message_id === m.id);
    return (
      <div key={m.id} className="flex gap-3 px-1 py-1.5">
        <Avatar className="h-8 w-8">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback>{(author?.full_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{author?.full_name ?? "Member"}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {m.body && <div className="whitespace-pre-wrap break-words text-sm">{renderMessageBody(m.body, profiles as any, user?.id)}</div>}
          {atts.map((a: any) => <Attachment key={a.id} att={a} />)}
        </div>
      </div>
    );
  };

  return (
    <aside className="flex w-[380px] flex-col border-l border-border bg-card">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div>
          <div className="text-sm font-semibold">Thread</div>
          <div className="text-xs text-muted-foreground">{replies.length} {replies.length === 1 ? "reply" : "replies"}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {parent && renderMessage(parent)}
        {replies.length > 0 && (
          <div className="my-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>{replies.length} {replies.length === 1 ? "reply" : "replies"}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
        {replies.map(renderMessage)}
      </div>
      <div className="border-t border-border p-3">
        <form onSubmit={send} className="flex items-end gap-2">
          <div className="flex-1">
            <MentionTextarea
              value={body}
              onChange={setBody}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(e as any);
                }
              }}
              users={profiles as any}
              placeholder="Continue the loop…"
              maxLength={4000}
              rows={1}
              className="min-h-[40px] resize-none"
            />
          </div>
          <Button type="submit" size="icon" disabled={!body.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
