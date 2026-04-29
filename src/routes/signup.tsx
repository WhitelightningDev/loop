import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./login";
import { ArrowLeft, Building2, Check, User } from "lucide-react";

import { useOrg } from "@/features/organisations/OrgProvider";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

type AccountType = "personal" | "organisation";

const personalSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const orgSchema = personalSchema.extend({
  org_name: z.string().trim().min(2, "Workspace name is too short").max(80),
  org_slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function SignupPage() {
  const navigate = useNavigate();
  const { refresh: refreshOrgs } = useOrg();
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");

  const handleContinue = () => {
    setStep("form");
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = {
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      password: fd.get("password"),
      org_name: fd.get("org_name"),
      org_slug: fd.get("org_slug"),
    };
    const parsed =
      accountType === "organisation"
        ? orgSchema.safeParse(raw)
        : personalSchema.safeParse(raw);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: parsed.data.full_name,
          account_type: accountType,
        },
      },
    });

    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes("already")) {
        toast.error("That email already has an account. Try signing in instead.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Ensure session
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInErr) {
        setLoading(false);
        toast.error("Account created, but we couldn't sign you in.");
        navigate({ to: "/login" });
        return;
      }
    }

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      setLoading(false);
      toast.error("Session not found. Please log in.");
      navigate({ to: "/login" });
      return;
    }

    // Persist account_type on profile (trigger created the row already)
    await supabase
      .from("user_profiles")
      .update({ account_type: accountType, full_name: parsed.data.full_name })
      .eq("id", userId);

    if (accountType === "organisation") {
      const orgPayload = parsed.data as z.infer<typeof orgSchema>;
      const { error: orgErr } = await supabase.from("organisations").insert({
        name: orgPayload.org_name,
        slug: orgPayload.org_slug,
        created_by: userId,
        account_type: "organisation",
      });
      if (orgErr) {
        setLoading(false);
        if (orgErr.message.toLowerCase().includes("duplicate")) {
          toast.error("That workspace URL is taken. Try a different slug.");
        } else {
          toast.error(orgErr.message);
        }
        return;
      }
      await refreshOrgs();
      setLoading(false);
      toast.success(`Welcome to ${orgPayload.org_name} 🎉`);
      navigate({ to: "/app" });
      return;
    }

    // Personal account → spin up a private personal workspace so DMs/notes work
    const personalSlug = `personal-${userId.slice(0, 8)}`;
    await supabase.from("organisations").insert({
      name: `${parsed.data.full_name}'s Space`,
      slug: personalSlug,
      created_by: userId,
      account_type: "personal",
    });

    await refreshOrgs();
    setLoading(false);
    toast.success("Welcome to Loop 👋");
    navigate({ to: "/app" });
  };

  if (step === "choose") {
    return (
      <AuthShell
        title="Create your account"
        subtitle="Choose how you'll use Loop. You can always change this later."
      >
        <div className="space-y-3">
          <AccountCard
            icon={<User className="h-5 w-5" />}
            title="Personal account"
            description="Just for me. Chat 1:1, take notes, try the product."
            badge="Free forever"
            selected={accountType === "personal"}
            onClick={() => setAccountType("personal")}
          />
          <AccountCard
            icon={<Building2 className="h-5 w-5" />}
            title="Organisation"
            description="A shared workspace for your team or company."
            badge="Recommended"
            selected={accountType === "organisation"}
            onClick={() => setAccountType("organisation")}
          />

          <Button
            type="button"
            size="lg"
            className="mt-2 w-full rounded-full border-0 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
            style={{ background: "var(--gradient-brand)" }}
            onClick={handleContinue}
          >
            Continue
          </Button>

          <p className="pt-1 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={accountType === "organisation" ? "Set up your workspace" : "Create your account"}
      subtitle={
        accountType === "organisation"
          ? "Tell us about you and your organisation."
          : "Just a few details to get you started."
      }
    >
      <button
        type="button"
        onClick={() => setStep("choose")}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Change account type
      </button>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Your full name</Label>
          <Input id="full_name" name="full_name" required maxLength={100} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            {accountType === "organisation" ? "Work email" : "Email"}
          </Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>

        {accountType === "organisation" && (
          <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <div className="space-y-2">
              <Label htmlFor="org_name">Organisation name</Label>
              <Input
                id="org_name"
                name="org_name"
                placeholder="Acme Inc."
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_slug">Workspace URL</Label>
              <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="px-3 text-sm text-muted-foreground">loop.app/</span>
                <Input
                  id="org_slug"
                  name="org_slug"
                  placeholder="acme"
                  required
                  pattern="[a-z0-9-]+"
                  defaultValue={slugify(orgName)}
                  key={slugify(orgName)}
                  className="border-0 pl-0 focus-visible:ring-0"
                />
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full border-0 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
          style={{ background: "var(--gradient-brand)" }}
          disabled={loading}
        >
          {loading
            ? "Creating account..."
            : accountType === "organisation"
            ? "Create workspace"
            : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}

function AccountCard({
  icon,
  title,
  description,
  badge,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group flex w-full items-start gap-4 rounded-xl border bg-card p-4 text-left transition-all"
      style={
        selected
          ? {
              borderColor: "color-mix(in oklab, var(--brand-violet) 55%, transparent)",
              boxShadow:
                "0 0 0 3px color-mix(in oklab, var(--brand-violet) 18%, transparent), 0 12px 32px -16px color-mix(in oklab, var(--brand-indigo) 40%, transparent)",
            }
          : { borderColor: "var(--border)" }
      }
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-all"
        style={{
          background: selected
            ? "var(--gradient-brand)"
            : "color-mix(in oklab, var(--brand-violet) 8%, var(--muted))",
          color: selected ? "#fff" : "var(--foreground)",
        }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{title}</h3>
          {badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={
                selected
                  ? {
                      background: "color-mix(in oklab, var(--brand-violet) 14%, transparent)",
                      color: "color-mix(in oklab, var(--brand-indigo) 70%, var(--foreground))",
                    }
                  : { background: "var(--muted)", color: "var(--muted-foreground)" }
              }
            >
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-white transition-all"
        style={
          selected
            ? { borderColor: "transparent", background: "var(--gradient-brand)" }
            : { borderColor: "var(--border)", background: "var(--background)" }
        }
      >
        {selected && <Check className="h-3 w-3" />}
      </div>
    </button>
  );
}
