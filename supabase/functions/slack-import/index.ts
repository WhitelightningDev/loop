// Imports Slack channels, members, and messages into the current workspace.
// Uses Lovable Slack connector via the gateway. Requires SLACK_API_KEY.
// Designed to be safe to re-run (idempotent on slack_channel_id / slack_message_id).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SLACK_DIRECT = "https://slack.com/api";

function makeSlackClient(token: string) {
  return async function slack(method: string, params: Record<string, any> = {}) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) body.append(k, String(v));
    }
    const res = await fetch(`${SLACK_DIRECT}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack ${method} failed: ${data.error ?? res.statusText}`);
    return data;
  };
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "channel";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { org_id, history_window = "all", slack_token } = await req.json();
    if (!org_id) throw new Error("org_id required");
    const token = typeof slack_token === "string" ? slack_token.trim() : "";
    if (!token) throw new Error("Slack token required. Paste your Bot User OAuth Token (xoxb-...) in the import form.");
    const slack = makeSlackClient(token);

    // Verify caller is org_admin (RLS will also enforce on slack_imports insert)
    const { data: roleCheck } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", org_id);
    const isAdmin = (roleCheck ?? []).some((r) => r.role === "org_admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject if a run is already active
    const { data: active } = await admin
      .from("slack_imports")
      .select("id")
      .eq("org_id", org_id)
      .in("status", ["pending", "running"])
      .limit(1);
    if (active && active.length) {
      return new Response(JSON.stringify({ error: "An import is already running" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create import row
    const { data: imp, error: impErr } = await admin
      .from("slack_imports")
      .insert({ org_id, started_by: user.id, status: "running", history_window })
      .select("id")
      .single();
    if (impErr) throw new Error(impErr.message);
    const importId = imp.id;

    const counters = { channels: 0, messages: 0, members: 0 };

    // Cutoff for messages
    const oldest = (() => {
      if (history_window === "30d") return Math.floor((Date.now() - 30 * 86400_000) / 1000);
      if (history_window === "12m") return Math.floor((Date.now() - 365 * 86400_000) / 1000);
      return 0; // all
    })();

    try {
      // 1. Members → link by email to existing user_profiles
      let userCursor = "";
      const slackToProfile = new Map<string, string>(); // slack_user_id -> profile.id
      do {
        const data = await slack("users.list", { limit: 200, cursor: userCursor || undefined });
        for (const m of data.members ?? []) {
          if (m.deleted || m.is_bot || !m.profile?.email) continue;
          const email = String(m.profile.email).toLowerCase();
          const { data: profile } = await admin
            .from("user_profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          if (profile?.id) {
            slackToProfile.set(m.id, profile.id);
            await admin.from("slack_user_map").upsert({
              org_id, slack_user_id: m.id, user_id: profile.id,
            });
            counters.members++;
          }
        }
        userCursor = data.response_metadata?.next_cursor ?? "";
      } while (userCursor);

      // 2. Channels (public only — Slack token may not see private)
      let chCursor = "";
      const channelPlan: { slack_id: string; name: string; topic?: string; purpose?: string }[] = [];
      do {
        const data = await slack("conversations.list", {
          limit: 200, types: "public_channel", exclude_archived: true,
          cursor: chCursor || undefined,
        });
        for (const c of data.channels ?? []) {
          channelPlan.push({
            slack_id: c.id, name: slugify(c.name),
            topic: c.topic?.value, purpose: c.purpose?.value,
          });
        }
        chCursor = data.response_metadata?.next_cursor ?? "";
      } while (chCursor);

      for (const ch of channelPlan) {
        // Check existing mapping
        const { data: existing } = await admin
          .from("slack_channel_map")
          .select("channel_id")
          .eq("org_id", org_id)
          .eq("slack_channel_id", ch.slack_id)
          .maybeSingle();

        let channelId = existing?.channel_id as string | undefined;

        if (!channelId) {
          // Avoid name collision
          let name = ch.name;
          for (let i = 1; i < 50; i++) {
            const { data: dup } = await admin
              .from("channels")
              .select("id")
              .eq("org_id", org_id)
              .eq("name", name)
              .maybeSingle();
            if (!dup) break;
            name = `${ch.name}-${i}`;
          }
          const { data: created, error: cErr } = await admin
            .from("channels")
            .insert({
              org_id, type: "public", name,
              description: ch.purpose ?? null, topic: ch.topic ?? null,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (cErr) throw new Error(`Channel create failed: ${cErr.message}`);
          channelId = created.id;
          await admin.from("slack_channel_map").insert({
            org_id, slack_channel_id: ch.slack_id, channel_id: channelId,
          });
        }
        counters.channels++;

        // 3. Messages
        let msgCursor = "";
        do {
          const data = await slack("conversations.history", {
            channel: ch.slack_id, limit: 200,
            cursor: msgCursor || undefined,
            oldest: oldest || undefined,
          });
          const rows: any[] = [];
          for (const m of data.messages ?? []) {
            if (m.subtype && m.subtype !== "thread_broadcast") continue;
            if (!m.text) continue;
            const author = slackToProfile.get(m.user) ?? user.id;
            rows.push({
              channel_id: channelId,
              author_id: author,
              body: m.text,
              slack_message_id: `${ch.slack_id}:${m.ts}`,
              created_at: new Date(Math.floor(parseFloat(m.ts) * 1000)).toISOString(),
            });
          }
          if (rows.length) {
            // Upsert by (channel_id, slack_message_id)
            const { error: insErr } = await admin
              .from("messages")
              .upsert(rows, { onConflict: "channel_id,slack_message_id", ignoreDuplicates: true });
            if (insErr) throw new Error(`Messages insert failed: ${insErr.message}`);
            counters.messages += rows.length;
          }
          msgCursor = data.response_metadata?.next_cursor ?? "";
          // Update progress
          await admin.from("slack_imports").update({
            channels_imported: counters.channels,
            messages_imported: counters.messages,
            members_linked: counters.members,
          }).eq("id", importId);
        } while (msgCursor);
      }

      await admin.from("slack_imports").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        channels_imported: counters.channels,
        messages_imported: counters.messages,
        members_linked: counters.members,
      }).eq("id", importId);

      return new Response(JSON.stringify({ ok: true, import_id: importId, ...counters }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("slack-import run error", e);
      await admin.from("slack_imports").update({
        status: "failed",
        error_message: String(e?.message ?? e),
        finished_at: new Date().toISOString(),
        channels_imported: counters.channels,
        messages_imported: counters.messages,
        members_linked: counters.members,
      }).eq("id", importId);
      return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e: any) {
    console.error("slack-import error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
