import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthShell } from "./login";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const orgSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
});

function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const { orgs, refresh, loading: orgLoading } = useOrg();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || orgLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (orgs.length > 0) navigate({ to: "/app" });
  }, [user, orgs, authLoading, orgLoading, navigate]);

  const createOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = orgSchema.safeParse({
      name: fd.get("name"),
      slug: fd.get("slug"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("organisations").insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Workspace created");
    await refresh();
    navigate({ to: "/app" });
  };

  const acceptInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const token = String(fd.get("token") ?? "").trim();
    if (!token) return toast.error("Enter an invite token");
    setSubmitting(true);
    const { error } = await supabase.rpc("accept_invite", { _token: token });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Joined workspace");
    await refresh();
    navigate({ to: "/app" });
  };

  return (
    <AuthShell title="Welcome to Loop" subtitle="Create a workspace or join one with an invite.">
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create workspace</TabsTrigger>
          <TabsTrigger value="join">Join with invite</TabsTrigger>
        </TabsList>
        <TabsContent value="create" className="mt-4">
          <form onSubmit={createOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input id="name" name="name" placeholder="Acme Inc." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL slug</Label>
              <Input id="slug" name="slug" placeholder="acme" required pattern="[a-z0-9-]+" />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full border-0 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
              style={{ background: "var(--gradient-brand)" }}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create workspace"}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="join" className="mt-4">
          <form onSubmit={acceptInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Invite token</Label>
              <Input id="token" name="token" placeholder="Paste your invite token" required />
              <p className="text-xs text-muted-foreground">
                Ask a workspace admin for a token, or open the invite link they sent you.
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full border-0 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
              style={{ background: "var(--gradient-brand)" }}
              disabled={submitting}
            >
              {submitting ? "Joining..." : "Join workspace"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </AuthShell>
  );
}
