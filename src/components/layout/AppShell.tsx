import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrg, isAdmin } from "@/features/organisations/OrgProvider";
import { useTheme } from "@/features/theme/ThemeProvider";
import { usePresenceHeartbeat } from "@/features/messages/usePresence";
import { useIncomingCallNotifier } from "@/features/calls/useIncomingCallNotifier";
import { useDesktopNotifications } from "@/features/notifications/useDesktopNotifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import loopLogo from "@/assets/loop-icon.png";
import { RebrandModal } from "@/components/RebrandModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Hash,
  Lock,
  Plus,
  Search,
  Settings,
  Sun,
  Moon,
  LogOut,
  Shield,
  ChevronDown,
  ChevronRight,
  Compass,
  User as UserIcon,
  Sliders,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_PRESETS = [
  { label: "Working", value: "💻 Working" },
  { label: "At lunch", value: "🍱 At lunch" },
  { label: "Off sick", value: "🤒 Off sick" },
  { label: "On another call", value: "☎️ On another call" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { currentOrg, orgs, setCurrentOrg, roles } = useOrg();
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [filter, setFilter] = useState("");

  usePresenceHeartbeat(user?.id, currentOrg?.id);
  useIncomingCallNotifier();
  useDesktopNotifications(user?.id, currentOrg?.id);

  const { data: channels = [] } = useQuery({
    queryKey: ["sidebar-channels", currentOrg?.id, user?.id],
    enabled: !!currentOrg && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("channels")
        .select("id, name, type, is_archived")
        .eq("org_id", currentOrg!.id)
        .neq("type", "dm")
        .eq("is_archived", false)
        .order("name");
      return data ?? [];
    },
  });

  const { data: dms = [] } = useQuery({
    queryKey: ["sidebar-dms", currentOrg?.id, user?.id],
    enabled: !!currentOrg && !!user,
    queryFn: async () => {
      const { data: members } = await supabase
        .from("organisation_members")
        .select(
          "user_id, user_profiles!inner(id, full_name, avatar_url, presence_status, status_text)",
        )
        .eq("org_id", currentOrg!.id)
        .neq("user_id", user!.id)
        .limit(20);
      return (members ?? []).map((m: any) => m.user_profiles);
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["app-shell-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url, status_text")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const setStatusText = async (statusText: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ status_text: statusText })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(statusText ? "Status updated" : "Status cleared");
    qc.invalidateQueries({ queryKey: ["app-shell-profile", user.id] });
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    qc.invalidateQueries({ queryKey: ["sidebar-dms"] });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <RebrandModal />
      {/* ─── Sidebar ─── */}
      <aside className="relative flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        {/* slim brand accent strip — single source of color, sets the tone */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[var(--gradient-brand)] opacity-40"
        />
        {/* Workspace switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger className="group flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3 py-3 text-left transition-colors hover:bg-sidebar-accent/60">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src={loopLogo} alt="Loop" className="h-11 w-11 shrink-0 object-contain" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{currentOrg?.name ?? "Loop"}</div>
                <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="truncate">{user?.email}</span>
                </div>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-transform group-data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => setCurrentOrg(o)}>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/15 text-[10px] font-semibold text-primary">
                  {o.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="truncate">{o.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/onboarding" })}>
              <Plus className="h-4 w-4" /> Create workspace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/app/me" })}>
              <UserIcon className="h-4 w-4" /> View profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/app/me/preferences" })}>
              <Sliders className="h-4 w-4" /> Preferences
            </DropdownMenuItem>
            {isAdmin(roles) && (
              <DropdownMenuItem onClick={() => navigate({ to: "/app/admin" })}>
                <Shield className="h-4 w-4" /> Workspace admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Toggle theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void signOut();
                navigate({ to: "/" });
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick search */}
        <div className="shrink-0 px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Jump to…"
              className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 pl-8 pr-2 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:border-sidebar-ring/60 focus:outline-none focus:ring-1 focus:ring-sidebar-ring/40"
            />
          </div>
        </div>

        {/* Scrollable nav */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <SidebarSection
            title="Channels"
            defaultOpen
            action={
              <div className="flex items-center gap-0.5">
                <BrowseChannelsDialog />
                <CreateChannelDialog />
              </div>
            }
          >
            {channels
              .filter((c: any) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
              .map((c: any) => {
                const to = `/app/c/${c.id}`;
                const active = path === to;
                return (
                  <SidebarLink
                    key={c.id}
                    to="/app/c/$channelId"
                    params={{ channelId: c.id }}
                    active={active}
                    icon={c.type === "private" ? Lock : Hash}
                    label={c.name}
                  />
                );
              })}
            {channels.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-sidebar-foreground/50">No channels yet</div>
            )}
            {channels.length > 0 &&
              filter &&
              !channels.some((c: any) => c.name.toLowerCase().includes(filter.toLowerCase())) && (
                <div className="px-2 py-1.5 text-xs text-sidebar-foreground/50">
                  No channels match
                </div>
              )}
          </SidebarSection>

          <SidebarSection title="Direct messages" defaultOpen>
            {dms
              .filter(
                (p: any) =>
                  !filter || (p.full_name ?? "").toLowerCase().includes(filter.toLowerCase()),
              )
              .map((p: any) => {
                const to = `/app/dm/${p.id}`;
                const active = path === to;
                return (
                  <Link
                    key={p.id}
                    to="/app/dm/$userId"
                    params={{ userId: p.id }}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <span className="relative">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-sidebar-accent text-[10px] text-sidebar-foreground">
                          {(p.full_name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-sidebar",
                          p.presence_status === "online"
                            ? "bg-success"
                            : p.presence_status === "away"
                              ? "bg-warning"
                              : "bg-sidebar-foreground/30",
                        )}
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{p.full_name ?? "Unknown"}</span>
                      {p.status_text && (
                        <span className="truncate text-[11px] text-sidebar-foreground/55">
                          {p.status_text}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            {dms.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-sidebar-foreground/50">
                Loop in your teammates to start a conversation
              </div>
            )}
          </SidebarSection>

          <SidebarSection title="You" defaultOpen>
            <SidebarLink to="/app/me" active={path === "/app/me"} icon={UserIcon} label="Profile" />
            <SidebarLink
              to="/app/me/preferences"
              active={path.startsWith("/app/me/preferences")}
              icon={Sliders}
              label="Preferences"
            />
            <SidebarLink
              to="/app/me/notifications"
              active={path.startsWith("/app/me/notifications")}
              icon={Bell}
              label="Notifications"
            />
            {isAdmin(roles) && (
              <SidebarLink
                to="/app/admin"
                active={path.startsWith("/app/admin")}
                icon={Shield}
                label="Workspace admin"
              />
            )}
          </SidebarSection>
        </nav>
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search loops, people, channels"
              className="h-8 border-transparent bg-muted/60 pl-8 focus-visible:bg-background"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={myProfile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(myProfile?.full_name ?? user?.email ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {myProfile?.status_text && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-success" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="truncate text-sm font-medium">
                    {myProfile?.full_name ?? user?.email}
                  </div>
                  <div className="truncate text-xs font-normal text-muted-foreground">
                    {myProfile?.status_text ?? "No status set"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.value}
                    onClick={() => void setStatusText(preset.value)}
                  >
                    {preset.value}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/app/me" })}>
                  <UserIcon className="h-4 w-4" /> Custom status
                </DropdownMenuItem>
                {myProfile?.status_text && (
                  <DropdownMenuItem onClick={() => void setStatusText(null)}>
                    Clear status
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden bg-background">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  params,
  active,
  icon: Icon,
  label,
}: {
  to: string;
  params?: Record<string, string>;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to as any}
      params={params as any}
      className={cn(
        "relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--gradient-brand)]"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          active ? "text-sidebar-accent-foreground opacity-100" : "opacity-70",
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarSection({
  title,
  children,
  action,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55 hover:text-sidebar-foreground"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-0.5 space-y-px">{children}</div>}
    </div>
  );
}

function CreateChannelDialog() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !currentOrg) return;
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const description = String(fd.get("description") ?? "").trim() || null;
    const type = String(fd.get("type") ?? "public") as "public" | "private";
    if (!/^[a-z0-9-]{2,40}$/.test(name))
      return toast.error("Use 2-40 lowercase letters, numbers, dashes");
    setSubmitting(true);
    const { data, error } = await supabase
      .from("channels")
      .insert({ org_id: currentOrg.id, type, name, description, created_by: user.id })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    toast.success("Channel created");
    if (data?.id) navigate({ to: "/app/c/$channelId", params: { channelId: data.id } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="rounded p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          title="Create channel"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. design" required maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" name="description" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Visibility</Label>
            <Select name="type" defaultValue="public">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — anyone in the workspace</SelectItem>
                <SelectItem value="private">Private — invite only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BrowseChannelsDialog() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: allChannels = [], refetch } = useQuery({
    queryKey: ["browse-channels", currentOrg?.id, user?.id],
    enabled: open && !!currentOrg && !!user,
    queryFn: async () => {
      const [{ data: chs }, { data: mem }] = await Promise.all([
        supabase
          .from("channels")
          .select("id, name, description, type, is_archived")
          .eq("org_id", currentOrg!.id)
          .eq("type", "public")
          .eq("is_archived", false)
          .order("name"),
        supabase.from("channel_members").select("channel_id").eq("user_id", user!.id),
      ]);
      const memberSet = new Set((mem ?? []).map((m) => m.channel_id));
      return (chs ?? []).map((c) => ({ ...c, isMember: memberSet.has(c.id) }));
    },
  });

  const filtered = allChannels.filter(
    (c: any) => !query || c.name.toLowerCase().includes(query.toLowerCase()),
  );

  const join = async (channelId: string, name: string) => {
    if (!user || joiningId) return;
    setJoiningId(channelId);
    const { error } = await supabase
      .from("channel_members")
      .insert({ channel_id: channelId, user_id: user.id });
    setJoiningId(null);
    if (error && !/duplicate key/i.test(error.message)) {
      toast.error(error.message);
      return;
    }
    toast.success(`Joined #${name}`);
    await refetch();
    await qc.invalidateQueries({ queryKey: ["sidebar-channels"] });
    setOpen(false);
    navigate({ to: "/app/c/$channelId", params: { channelId } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="rounded p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          title="Browse channels"
        >
          <Compass className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Browse public channels</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels…"
        />
        <div className="max-h-80 overflow-y-auto -mx-1">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No channels found
            </div>
          )}
          {filtered.map((c: any) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{c.name}</span>
                </div>
                {c.description && (
                  <div className="truncate text-xs text-muted-foreground">{c.description}</div>
                )}
              </div>
              {c.isMember ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/app/c/$channelId", params: { channelId: c.id } });
                  }}
                >
                  Open
                </Button>
              ) : (
                <Button size="sm" onClick={() => join(c.id, c.name)} disabled={joiningId === c.id}>
                  {joiningId === c.id ? "Joining…" : "Join"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
