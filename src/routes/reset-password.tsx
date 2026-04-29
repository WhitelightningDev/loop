import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./login";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase recovery links land here with a hash that gets processed by the client.
    // onAuthStateChange will fire PASSWORD_RECOVERY when the recovery session is set.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also handle the case where the session is already established.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      password: fd.get("password"),
      confirm: fd.get("confirm"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/app" });
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Set a strong password you don't use anywhere else."
    >
      {!ready ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            Validating your reset link...
          </p>
          <p className="text-xs text-muted-foreground">
            If nothing happens,{" "}
            <Link to="/forgot-password" className="font-medium text-foreground hover:underline">
              request a new link
            </Link>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full border-0 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
            style={{ background: "var(--gradient-brand)" }}
            disabled={loading}
          >
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
