import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/me/notifications")({
  component: NotificationsPage,
});

const NOTIF_KEY = "loop_notif_prefs_v1";

interface NotifPrefs {
  channelMessages: "all" | "mentions" | "none";
  directMessages: boolean;
  threadReplies: boolean;
  mentionsEverywhere: boolean;
  emailDigest: "off" | "daily" | "weekly";
  desktop: boolean;
}

const DEFAULTS: NotifPrefs = {
  channelMessages: "mentions",
  directMessages: true,
  threadReplies: true,
  mentionsEverywhere: true,
  emailDigest: "off",
  desktop: false,
};

function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULTS);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
  }, []);

  const update = <K extends keyof NotifPrefs>(k: K, v: NotifPrefs[K]) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const requestPermission = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Desktop notifications aren't supported on this browser");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      update("desktop", true);
      toast.success("Desktop notifications enabled");
    } else {
      toast.error("Permission denied. You can enable it in your browser settings.");
    }
  };

  return (
    <div className="space-y-8">
      <Section
        title="In Loop"
        description="Decide what nudges you while you're using the app."
      >
        <SelectRow
          label="Channel messages"
          help="Default for every channel — you can override per-channel."
          value={prefs.channelMessages}
          onChange={(v) => update("channelMessages", v as NotifPrefs["channelMessages"])}
          options={[
            { value: "all", label: "Every new message" },
            { value: "mentions", label: "Mentions and DMs only" },
            { value: "none", label: "Nothing" },
          ]}
        />
        <ToggleRow
          label="Direct messages"
          help="Always notify me when someone DMs me."
          checked={prefs.directMessages}
          onChange={(v) => update("directMessages", v)}
        />
        <ToggleRow
          label="Thread replies"
          help="Notify me when someone continues a loop I'm in."
          checked={prefs.threadReplies}
          onChange={(v) => update("threadReplies", v)}
        />
        <ToggleRow
          label="@mentions everywhere"
          help="Always alert me when I'm @mentioned, even in muted channels."
          checked={prefs.mentionsEverywhere}
          onChange={(v) => update("mentionsEverywhere", v)}
        />
      </Section>

      <Section title="Desktop" description="Browser notifications on this device.">
        <div className="flex items-center justify-between gap-6 px-5 py-4">
          <div className="min-w-0">
            <Label className="text-sm">Desktop notifications</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {permission === "granted"
                ? "Allowed by your browser."
                : permission === "denied"
                ? "Blocked. Update your browser permissions to enable."
                : permission === "unsupported"
                ? "Not supported on this browser."
                : "Click enable to allow this browser to show alerts."}
            </p>
          </div>
          <div className="shrink-0">
            {permission === "granted" ? (
              <Switch
                checked={prefs.desktop}
                onCheckedChange={(v) => update("desktop", v)}
              />
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={permission === "denied" || permission === "unsupported"}
                onClick={requestPermission}
              >
                Enable
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section title="Email" description="Catch up over email when you're away.">
        <SelectRow
          label="Email digest"
          help="Summary of unread mentions and DMs."
          value={prefs.emailDigest}
          onChange={(v) => update("emailDigest", v as NotifPrefs["emailDigest"])}
          options={[
            { value: "off", label: "Off" },
            { value: "daily", label: "Daily summary" },
            { value: "weekly", label: "Weekly summary" },
          ]}
        />
      </Section>

      <p className="text-xs text-muted-foreground">
        Preferences are saved on this device. Server-driven delivery rules will follow this guidance as we
        roll out additional channels.
      </p>
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

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SelectRow({
  label,
  help,
  value,
  onChange,
  options,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
      <div className="w-56 shrink-0">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
