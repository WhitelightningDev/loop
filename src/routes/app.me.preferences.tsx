import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "@/features/theme/ThemeProvider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/me/preferences")({
  component: PreferencesPage,
});

const PREF_KEY = "loop_local_prefs_v1";

interface LocalPrefs {
  enterToSend: boolean;
  compactMode: boolean;
  showTypingIndicators: boolean;
  soundOnNewMessage: boolean;
}

const DEFAULTS: LocalPrefs = {
  enterToSend: true,
  compactMode: false,
  showTypingIndicators: true,
  soundOnNewMessage: false,
};

function PreferencesPage() {
  const { theme, toggle } = useTheme();
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
  }, []);

  const update = <K extends keyof LocalPrefs>(k: K, v: LocalPrefs[K]) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const reset = () => {
    setPrefs(DEFAULTS);
    try {
      localStorage.removeItem(PREF_KEY);
    } catch {
      // ignore
    }
    toast.success("Preferences reset");
  };

  return (
    <div className="space-y-8">
      <Section title="Appearance" description="How Loop looks on this device.">
        <Row
          label="Theme"
          help={`Currently using ${theme === "dark" ? "Dark" : "Light"} mode.`}
        >
          <Button type="button" variant="outline" size="sm" onClick={toggle}>
            Switch to {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </Row>
        <Row
          label="Compact density"
          help="Tighter spacing in channels and sidebars."
        >
          <Switch
            checked={prefs.compactMode}
            onCheckedChange={(v) => update("compactMode", v)}
          />
        </Row>
      </Section>

      <Section title="Composing" description="How messages are sent and shown.">
        <Row
          label="Enter to send"
          help="Off: Enter inserts a newline, ⌘/Ctrl+Enter sends."
        >
          <Switch
            checked={prefs.enterToSend}
            onCheckedChange={(v) => update("enterToSend", v)}
          />
        </Row>
        <Row
          label="Show typing indicators"
          help="Let teammates see when you're typing, and see theirs."
        >
          <Switch
            checked={prefs.showTypingIndicators}
            onCheckedChange={(v) => update("showTypingIndicators", v)}
          />
        </Row>
      </Section>

      <Section title="Sounds" description="Audio cues on this device.">
        <Row
          label="Play sound on new messages"
          help="A subtle chime when a new message arrives in an open loop."
        >
          <Switch
            checked={prefs.soundOnNewMessage}
            onCheckedChange={(v) => update("soundOnNewMessage", v)}
          />
        </Row>
      </Section>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={reset}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
