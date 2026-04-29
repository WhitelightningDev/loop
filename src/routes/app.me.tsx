import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { User as UserIcon, Bell, Sliders } from "lucide-react";

export const Route = createFileRoute("/app/me")({
  component: MeLayout,
});

const tabs = [
  { to: "/app/me", label: "Profile", icon: UserIcon, exact: true },
  { to: "/app/me/preferences", label: "Preferences", icon: Sliders },
  { to: "/app/me/notifications", label: "Notifications", icon: Bell },
];

function MeLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border bg-surface px-6 pt-5">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your account
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Personal settings</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Manage your profile, preferences and notifications across Loop.
        </p>
        <nav className="mt-5 flex gap-1 -mb-px">
          {tabs.map((t) => {
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to as any}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
