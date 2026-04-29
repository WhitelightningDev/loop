# FlowChat — Slack-style Internal Messaging Platform

A production-ready, multi-organisation messaging app with channels, DMs, threads, presence, and an admin dashboard. Built on TanStack Start + Lovable Cloud (Supabase) with full RLS, structured to scale toward voice, video, AI, and integrations later.

## 1. Product Scope (MVP)

**Onboarding (hybrid):** Open email/password + Google signup. After signup the user lands in a "no org" state with two paths: **Create organisation** (becomes Org Admin) or **Accept invite** (via emailed link/token). Super Admin role is bootstrapped manually for the platform owner.

**Roles & permissions:**
- Super Admin — platform-wide
- Organisation Admin — manage org, members, channels, billing later
- Manager — manage assigned channels, invite members
- Member — full chat, create channels they belong to
- Guest — limited to specific channels they're invited to, no DMs by default

**Messaging features in v1:**
- Public + private channels, group chats, 1:1 DMs
- Real-time messages with history & full-text search
- File/image attachments (Supabase Storage with previews)
- Emoji reactions, threaded replies, pinned messages
- Read/unread state per channel & DM, typing indicators, online/offline presence
- Channel descriptions, member lists, archive channels
- Per-user and per-channel notification preferences (mute, all, mentions)

**Admin dashboard in v1:** organisation settings, members table (role change, remove, deactivate), invites (create, revoke, resend), channels overview (archive/restore), audit-ready activity feed (basic).

## 2. UX & Visual Direction

Slack-style, default light mode, with a polished dark mode toggle.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Top bar:  [Org switcher]      [⌕ Search messages, people, channels]  [👤]│
├──────────┬───────────────────────────────────────────────┬───────────────┤
│ Sidebar  │  Channel header: # design  ★ pin  members(12) │ Details panel │
│          │  ─────────────────────────────────────────────│               │
│ Workspace│                                               │ About         │
│  Threads │   message stream                              │ Members       │
│  DMs     │   - grouped by author                         │ Pinned        │
│  Mentions│   - reactions row                             │ Files         │
│          │   - inline thread preview                     │ Notifications │
│ Channels │                                               │               │
│  # general                                               │               │
│  # design                                                │               │
│  + Add   │  ─────────────────────────────────────────────│               │
│          │  [ message composer  📎 😀 @ ]                │               │
│ DMs      │                                               │               │
│  Alice ● │                                               │               │
│  Bob  ○  │                                               │               │
│          │                                               │               │
│ Admin    │                                               │               │
└──────────┴───────────────────────────────────────────────┴───────────────┘
```

- Slack-inspired warm neutrals, single accent (indigo/violet), generous spacing, small caps section labels in sidebar, subtle dividers.
- Sidebar is collapsible on tablet; details panel is toggleable.
- Responsive: desktop & tablet first; mobile gets a stacked single-pane fallback in v1.
- Light + dark themes equally polished, persisted per user.

## 3. App Structure

```text
src/
├─ routes/
│  ├─ __root.tsx              # shell + providers + theme
│  ├─ index.tsx               # marketing/landing → redirects if signed in
│  ├─ login.tsx
│  ├─ signup.tsx
│  ├─ accept-invite.$token.tsx
│  ├─ onboarding.tsx          # create org or accept invite
│  ├─ _app.tsx                # auth + org guard layout (sidebar shell)
│  ├─ _app/
│  │  ├─ index.tsx            # redirect to last channel or #general
│  │  ├─ c.$channelId.tsx     # channel view
│  │  ├─ dm.$userId.tsx       # 1:1 DM
│  │  ├─ g.$groupId.tsx       # group DM
│  │  ├─ threads.tsx
│  │  ├─ mentions.tsx
│  │  └─ admin/
│  │     ├─ index.tsx         # overview
│  │     ├─ members.tsx
│  │     ├─ invites.tsx
│  │     ├─ channels.tsx
│  │     └─ settings.tsx
│  └─ api/public/             # webhooks (future)
├─ features/
│  ├─ auth/                   # signup, login, session, guards
│  ├─ organisations/          # create, switch, settings
│  ├─ users/                  # profile, avatar, status
│  ├─ roles/                  # role helpers, permission gates
│  ├─ channels/               # list, create, archive, members
│  ├─ messages/               # composer, list, threads, reactions, pins, search
│  ├─ admin/                  # admin tables and actions
│  └─ notifications/          # prefs + in-app toasts
├─ components/
│  ├─ layout/                 # AppShell, Sidebar, TopBar, DetailsPanel
│  └─ ui/                     # shadcn primitives (existing)
├─ hooks/                     # useOrg, useChannel, usePresence, useTyping, useRealtime
├─ lib/supabase/              # already present (client, server, admin, auth-middleware)
└─ types/                     # generated DB types + domain types
```

## 4. Database Schema (Supabase / Postgres)

All tables enable RLS. Roles use the enum-and-helper pattern (no role columns on profiles).

**Enums**
- `app_role`: super_admin, org_admin, manager, member, guest
- `channel_type`: public, private, group, dm
- `member_status`: active, invited, suspended
- `presence_status`: online, away, offline
- `notif_level`: all, mentions, none

**Tables**
- `organisations` — id, name, slug, logo_url, created_by, created_at
- `user_profiles` — id (= auth.users.id), full_name, avatar_url, email, job_title, department, status_text, presence_status, timezone
- `organisation_members` — id, org_id, user_id, status, joined_at, **unique (org_id, user_id)**
- `user_roles` — id, org_id (nullable for super_admin), user_id, role (app_role), unique (org_id, user_id, role)
- `invites` — id, org_id, email, role, token (random), invited_by, expires_at, accepted_at
- `channels` — id, org_id, type (channel_type), name, description, topic, created_by, is_archived, created_at
- `channel_members` — id, channel_id, user_id, role (admin/member), notif_level, last_read_at, joined_at, **unique (channel_id, user_id)**
- `messages` — id, channel_id, author_id, body (text), parent_id (nullable, for threads), edited_at, deleted_at, created_at, ts_search (tsvector, generated)
- `message_reactions` — id, message_id, user_id, emoji, **unique (message_id, user_id, emoji)**
- `attachments` — id, message_id, storage_path, mime_type, size, width, height, created_by
- `pinned_messages` — id, channel_id, message_id, pinned_by, pinned_at
- `notifications` — id, user_id, org_id, type, payload jsonb, read_at, created_at
- `user_presence` — user_id (pk), org_id, status (presence_status), last_seen_at
- `typing_indicators` — channel_id, user_id, expires_at (pk composite) — short-lived
- `audit_logs` — id, org_id, actor_id, action, target_type, target_id, payload, created_at

**Storage buckets**
- `avatars` (public read)
- `attachments` (private; signed URLs via server fn)

**Indexes**: messages(channel_id, created_at desc), messages ts_search GIN, channel_members(user_id), channel_members(channel_id), notifications(user_id, read_at).

## 5. RLS Strategy

All policies use SECURITY DEFINER helpers to avoid recursion:

- `is_org_member(_user, _org) → bool`
- `has_role(_user, _org, _role app_role) → bool`
- `is_channel_member(_user, _channel) → bool`
- `can_read_channel(_user, _channel) → bool` (public channel in user's org OR member of private/group/dm)

Policy highlights:
- `organisations`: select if `is_org_member(auth.uid(), id)` or super_admin; insert by any authenticated user (creator becomes Org Admin via trigger); update by org_admin.
- `organisation_members`: select within same org; insert/update/delete by org_admin or via accept-invite RPC.
- `user_roles`: select within same org; mutate only by org_admin (super_admin role gated to super_admin).
- `invites`: select/mutate by org_admin; public RPC `accept_invite(token)` runs SECURITY DEFINER.
- `channels`: select if `can_read_channel`; insert if org member (managers+); update/archive by channel admin or org_admin.
- `channel_members`: select if `is_channel_member` or org_admin; mutate by channel admin / org_admin (joining public channels via RPC).
- `messages`: select if `can_read_channel(channel_id)`; insert if `is_channel_member` and channel not archived; update/delete only by author (soft delete) or org_admin.
- `message_reactions`, `attachments`, `pinned_messages`: gated through parent message's channel.
- `notifications`, `user_presence`: row owner only.
- `audit_logs`: select by org_admin; insert via SECURITY DEFINER triggers/functions.

Triggers:
- On `organisations` insert → add creator to `organisation_members` + grant `org_admin`.
- On `auth.users` insert → create `user_profiles` row.
- On `messages` insert → fan-out `notifications` for @mentions and DMs (queued via function).
- `messages.ts_search` generated column from `body` (English config).

## 6. Realtime & Presence

- Supabase Realtime on `messages`, `message_reactions`, `pinned_messages`, `channel_members`, `typing_indicators`, `user_presence`.
- Presence: heartbeat every 30s from client → upsert `user_presence`; mark offline if `last_seen_at > 90s`.
- Typing: client writes `typing_indicators` with 4s expiry; consumers filter by `expires_at > now()`.
- Unread: `channel_members.last_read_at` updated on view; badge = count of messages newer than `last_read_at`.

## 7. Server Functions (TanStack Start)

Auth-protected via `requireSupabaseAuth` middleware:
- `createOrganisation`, `switchOrganisation`, `updateOrganisation`
- `createInvite`, `revokeInvite`, `resendInvite`, `acceptInvite(token)`
- `updateMemberRole`, `removeMember`, `suspendMember`
- `createChannel`, `archiveChannel`, `joinChannel`, `leaveChannel`, `addChannelMembers`
- `sendMessage`, `editMessage`, `deleteMessage`, `togglePin`, `toggleReaction`
- `getAttachmentSignedUrl`, `searchMessages(query, scope)`
- `updateNotificationPrefs`, `markChannelRead`

Public route: `/accept-invite/$token` resolves token then calls `acceptInvite`.

## 8. MVP Build Phases

1. Schema + RLS + storage buckets + helpers + seed of `app_role` enum.
2. Auth (email/password + Google) + profile bootstrap trigger.
3. Onboarding (create org / accept invite) + org switcher.
4. App shell: sidebar, top bar, details panel, theming (light default + dark).
5. Channels: list, create public/private, members, archive.
6. Messages: list, composer, realtime, edit/delete, attachments, reactions, threads, pins.
7. DMs + group chats.
8. Presence, typing, unread badges, mentions, in-app notifications + per-channel prefs.
9. Search (Postgres FTS over messages, scoped by RLS).
10. Admin dashboard: members, invites, channels, settings, basic audit log.

## 9. Out of Scope for v1 (Architected For)

Voice notes, video meetings, AI summaries / semantic search, GitHub/Calendar/Gmail integrations, task creation from messages, announcements channel type, full audit log UI, billing. Schema leaves room: `audit_logs` table exists, `messages.payload` extensibility via future `metadata jsonb`, channel_type enum extendable.

## 10. Technical Notes (for engineers)

- Stack: TanStack Start + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Lovable Cloud (Supabase).
- Data fetching: TanStack Query + route loaders using `ensureQueryData`; realtime updates patch the query cache.
- Type safety: generated DB types from Supabase; never cast route hook results.
- Permissions enforced in three layers: RLS (source of truth), server function checks, UI gates via `usePermissions()`.
- Storage: `attachments` bucket private, served via short-lived signed URLs from a server function; `avatars` public.
- No service-role key usage on client; admin actions go through `createServerFn` handlers.

Approve this plan and I'll switch to build mode and start with Phase 1 (schema + RLS) followed by the auth + onboarding + app shell so you have a clickable foundation quickly.
