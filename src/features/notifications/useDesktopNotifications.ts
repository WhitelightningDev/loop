import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const NOTIF_KEY = "loop_notif_prefs_v1";

interface NotifPrefs {
  channelMessages: "all" | "mentions" | "none";
  directMessages: boolean;
  threadReplies: boolean;
  mentionsEverywhere: boolean;
  desktop: boolean;
}

const readPrefs = (): NotifPrefs => {
  const fallback: NotifPrefs = {
    channelMessages: "mentions",
    directMessages: true,
    threadReplies: true,
    mentionsEverywhere: true,
    desktop: false,
  };
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as NotifPrefs;
  } catch {
    return fallback;
  }
};

interface ChannelMeta {
  id: string;
  type: "public" | "private" | "dm";
  name: string;
}

/**
 * Listens to new messages across the user's org and surfaces desktop
 * notifications based on the user's stored preferences. Suppresses
 * notifications for the channel currently being viewed in the foreground.
 */
export function useDesktopNotifications(userId?: string, orgId?: string) {
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const channelMapRef = useRef<Map<string, ChannelMeta>>(new Map());
  const memberSetRef = useRef<Set<string>>(new Set());
  const profileCacheRef = useRef<Map<string, { full_name: string | null; avatar_url: string | null }>>(
    new Map(),
  );

  useEffect(() => {
    if (!userId || !orgId) return;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;

    let cancelled = false;

    const loadContext = async () => {
      const { data: chans } = await supabase
        .from("channels")
        .select("id,type,name")
        .eq("org_id", orgId);
      if (cancelled) return;
      const map = new Map<string, ChannelMeta>();
      (chans ?? []).forEach((c: any) => map.set(c.id, c));
      channelMapRef.current = map;

      const { data: mems } = await supabase
        .from("channel_members")
        .select("channel_id")
        .eq("user_id", userId);
      if (cancelled) return;
      memberSetRef.current = new Set((mems ?? []).map((m: any) => m.channel_id));
    };

    loadContext();

    const channel = supabase
      .channel(`desktop-notifs-${orgId}-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload: any) => {
          const msg = payload.new;
          if (!msg || msg.author_id === userId) return;

          const prefs = readPrefs();
          if (!prefs.desktop) return;
          if (Notification.permission !== "granted") return;
          if (typeof document !== "undefined" && document.visibilityState === "visible") {
            // Only suppress if user is currently looking at this channel
            const path = pathRef.current || "";
            if (path.includes(`/channels/${msg.channel_id}`) || path.includes(`/dm/${msg.channel_id}`)) {
              return;
            }
          }

          const meta = channelMapRef.current.get(msg.channel_id);
          if (!meta) return; // not in this org / not visible to user

          const isDM = meta.type === "dm";
          const isMention =
            typeof msg.body === "string" && new RegExp(`@${userId}\\b|<@${userId}>`).test(msg.body);

          if (isDM) {
            if (!prefs.directMessages) return;
          } else {
            if (!memberSetRef.current.has(msg.channel_id)) return;
            if (prefs.channelMessages === "none" && !(isMention && prefs.mentionsEverywhere)) return;
            if (prefs.channelMessages === "mentions" && !isMention) return;
          }

          // Look up author profile
          let author = profileCacheRef.current.get(msg.author_id);
          if (!author) {
            const { data: prof } = await supabase
              .from("user_profiles")
              .select("full_name,avatar_url")
              .eq("id", msg.author_id)
              .maybeSingle();
            author = {
              full_name: prof?.full_name ?? null,
              avatar_url: prof?.avatar_url ?? null,
            };
            profileCacheRef.current.set(msg.author_id, author);
          }

          const title = isDM
            ? author.full_name || "New direct message"
            : `#${meta.name} · ${author.full_name || "New message"}`;
          const body = (msg.body || "").slice(0, 200) || "New message";

          try {
            const note = new Notification(title, {
              body,
              icon: author.avatar_url ?? "/favicon.ico",
              tag: `loop-msg-${msg.channel_id}`,
            } as NotificationOptions);
            note.onclick = () => {
              window.focus();
              const target = isDM
                ? `/app/dm/${msg.channel_id}`
                : `/app/channels/${msg.channel_id}`;
              window.location.assign(target);
              note.close();
            };
          } catch {
            // ignore notification failures
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "channel_members", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (payload.new?.channel_id) memberSetRef.current.add(payload.new.channel_id);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "channel_members", filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (payload.old?.channel_id) memberSetRef.current.delete(payload.old.channel_id);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, orgId]);
}
