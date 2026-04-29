import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Hash,
  Lock,
  Paperclip,
  Play,
  Search,
  Send,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import loopLogo from "@/assets/loop-icon.png";
import { getTeamsCount } from "@/server/stats.functions";

export const Route = createFileRoute("/")({
  component: Landing,
  loader: async () => {
    try {
      return await getTeamsCount();
    } catch {
      return { count: 0 };
    }
  },
});

function formatTeamsCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return `${n}`;
}

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [audience, setAudience] = useState<"teams" | "companies">("teams");
  const { count: teamsCount } = Route.useLoaderData();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const copy =
    audience === "teams"
      ? {
          headline: "Loop Your Team In On",
          headlineAccent: "Everything That Matters",
          subtitle:
            "Channels, direct messages, threads, and admin — one polished workspace for serious teams. \"I'll loop you in.\"",
          cta: "Create your workspace",
        }
      : {
          headline: "Bring Your Whole Company",
          headlineAccent: "Into One Conversation",
          subtitle:
            "Multi-org workspaces, granular roles, and audit-ready security — built for companies that take internal comms seriously.",
          cta: "Start your company workspace",
        };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Soft brand wash backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1100px 600px at 50% -10%, color-mix(in oklab, var(--brand-violet) 14%, transparent), transparent 70%), radial-gradient(700px 500px at 0% 30%, color-mix(in oklab, var(--brand-blue) 10%, transparent), transparent 70%), radial-gradient(700px 500px at 100% 30%, color-mix(in oklab, var(--brand-magenta) 10%, transparent), transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={loopLogo} alt="Loop" className="h-14 w-14 object-contain" />
          </Link>

          {/* Pill toggle */}
          <div
            className="hidden items-center rounded-full border bg-card/70 p-1 text-sm backdrop-blur md:flex"
            style={{ borderColor: "color-mix(in oklab, var(--brand-violet) 20%, var(--border))" }}
          >
            <button
              onClick={() => setAudience("teams")}
              className={`rounded-full px-4 py-1.5 transition ${
                audience === "teams" ? "text-white shadow-[var(--shadow-brand-sm)]" : "text-muted-foreground hover:text-foreground"
              }`}
              style={audience === "teams" ? { background: "var(--gradient-brand)" } : undefined}
            >
              Teams
            </button>
            <button
              onClick={() => setAudience("companies")}
              className={`rounded-full px-4 py-1.5 transition ${
                audience === "companies" ? "text-white shadow-[var(--shadow-brand-sm)]" : "text-muted-foreground hover:text-foreground"
              }`}
              style={audience === "companies" ? { background: "var(--gradient-brand)" } : undefined}
            >
              Companies
            </button>
          </div>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#security" className="hover:text-foreground">Security</a>
            <Link to="/signup" className="hover:text-foreground">Pricing</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button>
            <Button
              asChild
              className="rounded-full border-0 px-5 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Link to="/signup">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative">
        <section className="mx-auto max-w-6xl px-6 pt-12 pb-24 text-center md:pt-16">
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              {copy.headline}
            </span>
            <br />
            <span className="text-foreground">{copy.headlineAccent}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            {copy.subtitle}
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full border-0 px-7 text-white shadow-[var(--shadow-brand)] hover:opacity-90"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Link to="/signup">
                {copy.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Phone + floating cards stage */}
          <div className="relative mx-auto mt-16 h-[640px] w-full max-w-5xl">
            {/* Concentric rings */}
            <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[560px] w-[560px] items-end justify-center">
              {[560, 460, 360, 260].map((s, i) => (
                <div
                  key={s}
                  className="absolute rounded-full border"
                  style={{
                    width: s,
                    height: s,
                    bottom: 0,
                    borderColor: `color-mix(in oklab, var(--brand-violet) ${18 - i * 3}%, transparent)`,
                    background:
                      i === 0
                        ? "radial-gradient(circle at 50% 100%, color-mix(in oklab, var(--brand-violet) 10%, transparent), transparent 70%)"
                        : undefined,
                  }}
                />
              ))}
            </div>

            {/* Floating: voice note (top left) */}
            <FloatingCard className="absolute left-0 top-2 w-[280px] md:left-4">
              <div className="flex items-center gap-3">
                <button
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </button>
                <Waveform />
                <div className="h-7 w-7 shrink-0 rounded-full" style={{ background: "var(--gradient-brand)" }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>0:13</span>
                <span>0:42</span>
              </div>
            </FloatingCard>

            {/* Floating: channel chip (left middle) */}
            <FloatingCard className="absolute left-2 top-44 w-[220px] md:left-12">
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
            </FloatingCard>

            {/* Floating: file (bottom left) */}
            <FloatingCard className="absolute bottom-12 left-0 w-[280px] md:left-2">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-md text-white"
                  style={{ background: "linear-gradient(135deg, var(--brand-violet), var(--brand-purple))" }}
                >
                  <Paperclip className="h-4 w-4" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">Q3-roadmap.pdf</div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-2/3 rounded-full" style={{ background: "var(--gradient-brand)" }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">2.1MB</span>
              </div>
            </FloatingCard>

            {/* Floating: encryption (top right) */}
            <FloatingCard className="absolute right-0 top-6 w-[260px] md:right-6">
              <div
                className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-white"
                style={{ background: "linear-gradient(135deg, var(--brand-indigo), var(--brand-violet))" }}
              >
                <Lock className="h-4 w-4" />
              </div>
              <p className="text-left text-[13px] leading-snug text-foreground">
                Row-level security on every channel — your team's conversations stay your team's.
              </p>
            </FloatingCard>

            {/* Floating: stats (bottom right) */}
            <FloatingCard className="absolute bottom-16 right-0 w-[200px] md:right-4">
              <div
                className="mb-2 flex h-8 w-8 items-center justify-center rounded-md text-white"
                style={{ background: "linear-gradient(135deg, var(--brand-purple), var(--brand-magenta))" }}
              >
                <Users className="h-4 w-4" />
              </div>
              <div
                className="bg-clip-text text-left text-3xl font-bold text-transparent"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                {formatTeamsCount(teamsCount)}
              </div>
              <div className="text-left text-[11px] text-muted-foreground">Teams looped in</div>
            </FloatingCard>

            {/* Phone mockup (centered, on top) */}
            <div className="absolute inset-x-0 bottom-0 mx-auto flex justify-center">
              <PhoneMockup />
            </div>

            {/* Send pill (overlapping bottom right of phone) */}
            <div
              className="absolute bottom-8 left-1/2 flex translate-x-[110px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Send className="h-4 w-4" /> Send
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24">
          <div
            className="grid gap-6 rounded-2xl border bg-card/60 p-8 backdrop-blur md:grid-cols-3"
            style={{
              borderColor: "color-mix(in oklab, var(--brand-violet) 18%, var(--border))",
              boxShadow: "var(--shadow-brand-sm)",
            }}
          >
            {[
              { icon: Sparkles, title: "Built for focus", text: "Threads, mentions, and presence — without the noise.", hue: "var(--brand-blue)" },
              { icon: Shield, title: "Roles you can trust", text: "Org admins, managers, members, guests — secured by default.", hue: "var(--brand-violet)" },
              { icon: Search, title: "Find anything, fast", text: "Full-text search across every channel, DM, and thread.", hue: "var(--brand-magenta)" },
            ].map((f) => (
              <div key={f.title} className="flex gap-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ background: `linear-gradient(135deg, ${f.hue}, color-mix(in oklab, ${f.hue} 50%, var(--brand-magenta)))` }}
                >
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section id="security" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24">
          <div
            className="overflow-hidden rounded-2xl border p-10 text-center"
            style={{
              borderColor: "color-mix(in oklab, var(--brand-violet) 22%, var(--border))",
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--brand-blue) 10%, var(--card)), color-mix(in oklab, var(--brand-magenta) 10%, var(--card)))",
            }}
          >
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight md:text-4xl">
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-brand)" }}
              >
                Secure by default
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Row-level security on every table, granular roles, and audit-ready
              access controls — your team's conversations stay your team's.
            </p>
            <div className="mt-6 flex justify-center">
              <Button
                asChild
                size="lg"
                className="rounded-full border-0 px-7 text-white shadow-[var(--shadow-brand-sm)] hover:opacity-90"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Link to="/signup">Get started <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-border py-6 text-center text-sm text-muted-foreground">
        © Loop
      </footer>
    </div>
  );
}

function FloatingCard({ children, className }: { children: React.ReactNode; className?: string }) {
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
  const bars = [4, 8, 12, 16, 20, 14, 18, 10, 22, 12, 8, 14, 18, 10, 6, 12, 16, 8];
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

function PhoneMockup() {
  return (
    <div
      className="relative h-[520px] w-[260px] rounded-[44px] border-[10px] border-foreground/90 bg-background shadow-2xl"
      style={{ boxShadow: "0 30px 80px -20px color-mix(in oklab, var(--brand-violet) 50%, transparent)" }}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-0 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-foreground/90" />

      <div className="flex h-full flex-col overflow-hidden rounded-[32px]">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-4 text-[10px] font-semibold text-foreground">
          <span>9:41</span>
          <span>•••</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="text-xs text-muted-foreground">Edit</span>
          <span className="text-[10px]" style={{ color: "var(--brand-indigo)" }}>+ New</span>
        </div>
        <h3 className="px-5 pt-1 text-left text-2xl font-bold">Loops</h3>

        {/* Search */}
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Search</span>
        </div>

        <div className="mt-3 flex justify-between px-5 text-[10px]">
          <span className="font-semibold text-foreground">Channels</span>
          <span style={{ color: "var(--brand-indigo)" }}>New thread</span>
        </div>

        {/* Conversation list */}
        <div className="mt-2 flex-1 space-y-3 overflow-hidden px-3">
          {[
            { name: "design-crit", msg: "Pushed v3 mock — peep when free", color: "var(--brand-blue)" },
            { name: "Eleanor Pena", msg: "Looping you in on the launch plan", color: "var(--brand-violet)" },
            { name: "eng-standup", msg: "Standup notes are pinned ☝️", color: "var(--brand-purple)" },
            { name: "Maya Robins", msg: "Sounds good — Friday works", color: "var(--brand-magenta)" },
          ].map((c) => (
            <div key={c.name} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${c.color}, color-mix(in oklab, ${c.color} 50%, var(--brand-magenta)))` }}
              >
                {c.name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-[11px] font-semibold">{c.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">{c.msg}</div>
              </div>
              <span className="text-[9px] text-muted-foreground">Fri</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
