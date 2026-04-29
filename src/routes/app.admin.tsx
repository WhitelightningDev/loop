import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useOrg, isAdmin } from "@/features/organisations/OrgProvider";
import { LayoutDashboard, Users, MailPlus, Hash, Settings2, AtSign, Download, Plug, Signature } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin")({
  component: AdminLayout,
});

const tabs: { to: string; label: string; icon: typeof Settings2; exact?: boolean }[] = [
  { to: "/app/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/admin/members", label: "Members", icon: Users },
  { to: "/app/admin/invites", label: "Invites", icon: MailPlus },
  { to: "/app/admin/channels", label: "Channels", icon: Hash },
  { to: "/app/admin/smtp", label: "Email (SMTP)", icon: AtSign },
  { to: "/app/admin/email", label: "Email design", icon: Signature },
  { to: "/app/admin/slack", label: "Slack import", icon: Download },
  { to: "/app/admin/integrations", label: "Integrations", icon: Plug },
  { to: "/app/admin/settings", label: "Settings", icon: Settings2 },
];

function AdminLayout() {
  const { roles } = useOrg();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (!isAdmin(roles)) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        You need admin permissions to view this area.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-6 pt-4">
        <h1 className="text-xl font-semibold">Admin</h1>
        <nav className="mt-3 flex gap-1">
          {tabs.map((t) => {
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto bg-muted/30 p-6">
        <Outlet />
      </div>
    </div>
  );
}
