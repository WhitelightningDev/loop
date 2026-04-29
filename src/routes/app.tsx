import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrg } from "@/features/organisations/OrgProvider";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading: authLoading } = useAuth();
  const { currentOrg, loading: orgLoading, orgs } = useOrg();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!orgLoading && orgs.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [user, authLoading, orgLoading, orgs, navigate]);

  if (authLoading || orgLoading || !user || !currentOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
