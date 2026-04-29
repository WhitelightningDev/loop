import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import loopLogo from "@/assets/loop-logo.png";
import { Hash, Lock, Play, Send, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
        toast.error("Wrong email or password. Need an account? Sign up below.");
      } else if (msg.includes("not confirmed") || msg.includes("email not confirmed")) {
        toast.error("Please confirm your email first, then try again.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/app" });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to your workspace.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full border-0 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
          style={{ background: "var(--gradient-brand)" }}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New to Loop?{" "}
          <Link to="/signup" className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:grid lg:grid-cols-2">
      {/* Ambient brand wash (left side, mobile full) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(800px 500px at 0% -10%, color-mix(in oklab, var(--brand-blue) 12%, transparent), transparent 70%), radial-gradient(700px 500px at 0% 110%, color-mix(in oklab, var(--brand-magenta) 10%, transparent), transparent 70%)",
        }}
      />

      {/* Left – form */}
      <div className="relative flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:min-h-0 lg:py-12">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={loopLogo} alt="Loop" className="h-9 w-auto object-contain" />
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div className="mb-8">
            <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight md:text-[36px]">
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                {title}
              </span>
            </h1>
            {subtitle && (
              <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        <p className="text-center text-xs text-muted-foreground lg:text-left">
          © {new Date().getFullYear()} Loop. Stay in the Loop.
        </p>
      </div>

      {/* Right – brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        {/* Brand wash */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 100% 0%, color-mix(in oklab, var(--brand-violet) 22%, transparent), transparent 70%), radial-gradient(700px 500px at 0% 100%, color-mix(in oklab, var(--brand-blue) 18%, transparent), transparent 70%), radial-gradient(700px 500px at 100% 100%, color-mix(in oklab, var(--brand-magenta) 18%, transparent), transparent 70%)",
          }}
        />
        {/* Concentric rings */}
        <div className="absolute inset-x-0 bottom-[-180px] flex justify-center">
          {[640, 520, 400, 280].map((s, i) => (
            <div
              key={s}
              className="absolute rounded-full border"
              style={{
                width: s,
                height: s,
                bottom: 0,
                borderColor: `color-mix(in oklab, var(--brand-violet) ${20 - i * 4}%, transparent)`,
              }}
            />
          ))}
        </div>

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="max-w-md">
            <span
              className="inline-block rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-violet) 30%, transparent)",
                background: "color-mix(in oklab, var(--brand-violet) 10%, var(--card))",
                color: "color-mix(in oklab, var(--brand-indigo) 70%, var(--foreground))",
              }}
            >
              <Sparkles className="mr-1 inline h-3 w-3" /> Loop your team in
            </span>
            <h2 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight">
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                Channels, threads & calls
              </span>
              <br />
              <span className="text-foreground">— in one polished workspace.</span>
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Built for serious teams. Same app, sharper name.
            </p>
          </div>

          {/* Floating preview cards */}
          <div className="relative mx-auto h-[300px] w-full max-w-md">
            <FloatingAuthCard className="absolute left-0 top-0 w-[260px]">
              <div className="flex items-center gap-3">
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </button>
                <Waveform />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>0:13</span>
                <span>0:42</span>
              </div>
            </FloatingAuthCard>

            <FloatingAuthCard className="absolute right-0 top-6 w-[220px]">
              <div className="flex items-center gap-2 text-sm">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white"
                  style={{ background: "linear-gradient(135deg, var(--brand-blue), var(--brand-indigo))" }}
                >
                  <Hash className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold">design-crit</div>
                  <div className="text-[11px] text-muted-foreground">12 new messages</div>
                </div>
              </div>
            </FloatingAuthCard>

            <FloatingAuthCard className="absolute bottom-8 left-6 w-[240px]">
              <div
                className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-white"
                style={{ background: "linear-gradient(135deg, var(--brand-indigo), var(--brand-violet))" }}
              >
                <Lock className="h-4 w-4" />
              </div>
              <p className="text-left text-[13px] leading-snug">
                Row-level security on every channel.
              </p>
            </FloatingAuthCard>

            <FloatingAuthCard className="absolute bottom-2 right-2 w-[180px]">
              <div
                className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-white"
                style={{ background: "linear-gradient(135deg, var(--brand-purple), var(--brand-magenta))" }}
              >
                <Users className="h-4 w-4" />
              </div>
              <div
                className="bg-clip-text text-left text-2xl font-bold text-transparent"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                10k+
              </div>
              <div className="text-left text-[11px] text-muted-foreground">Teams looped in</div>
            </FloatingAuthCard>
          </div>

          <ul className="space-y-3 text-sm">
            <BrandBullet icon={<Zap className="h-4 w-4" />} text="Fast, keyboard-first interface" hue="var(--brand-blue)" />
            <BrandBullet icon={<ShieldCheck className="h-4 w-4" />} text="Granular roles and channel privacy" hue="var(--brand-violet)" />
            <BrandBullet icon={<Send className="h-4 w-4" />} text="Calls, video, and screen sharing built in" hue="var(--brand-magenta)" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function BrandBullet({ icon, text, hue }: { icon: React.ReactNode; text: string; hue: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-md text-white"
        style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in oklab, ${hue} 50%, var(--brand-magenta)))` }}
      >
        {icon}
      </span>
      <span className="text-foreground/90">{text}</span>
    </li>
  );
}

function FloatingAuthCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border bg-card/90 p-3.5 backdrop-blur-md ${className ?? ""}`}
      style={{
        borderColor: "color-mix(in oklab, var(--brand-violet) 22%, var(--border))",
        boxShadow:
          "0 1px 0 0 color-mix(in oklab, var(--brand-violet) 10%, transparent), 0 20px 50px -20px color-mix(in oklab, var(--brand-indigo) 35%, transparent)",
      }}
    >
      {children}
    </div>
  );
}

function Waveform() {
  const bars = [4, 8, 12, 16, 20, 14, 18, 10, 22, 12, 8, 14, 18, 10, 6, 12];
  return (
    <div className="flex h-6 flex-1 items-center gap-[2px]">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full"
          style={{
            height: h,
            background:
              i < bars.length / 2
                ? "var(--brand-indigo)"
                : "color-mix(in oklab, var(--brand-violet) 30%, var(--muted-foreground))",
          }}
        />
      ))}
    </div>
  );
}
