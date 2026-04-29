import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrg } from "@/features/organisations/OrgProvider";
import { AuthShell } from "./login";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/accept-invite/$token")({
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const { refresh } = useOrg();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Stash token and bounce to signup so the user can sign in/create account.
      sessionStorage.setItem("pending-invite-token", token);
      navigate({ to: "/signup" });
      return;
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, token]);

  const run = async () => {
    setStatus("working");
    const { error } = await supabase.rpc("accept_invite", { _token: token });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      toast.error(error.message);
      return;
    }
    setStatus("done");
    await refresh();
    toast.success("You're in the Loop");
    navigate({ to: "/app" });
  };

  return (
    <AuthShell title="Looping you in..." subtitle="Hang tight while we add you to the workspace.">
      {status === "error" && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button onClick={run}>Try again</Button>
        </div>
      )}
      {status !== "error" && (
        <p className="text-center text-sm text-muted-foreground">Working...</p>
      )}
    </AuthShell>
  );
}
