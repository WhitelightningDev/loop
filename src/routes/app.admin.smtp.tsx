import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Mail,
  Send,
  Server,
  AtSign,
  KeyRound,
  User as UserIcon,
  ShieldCheck,
  TestTube2,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

export const Route = createFileRoute("/app/admin/smtp")({
  component: SmtpAdmin,
});

const schema = z.object({
  host: z.string().trim().min(2).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().min(1).max(255),
  password: z.string().trim().min(1).max(255),
  from_email: z.string().trim().email().max(255),
  from_name: z.string().trim().max(120).default(""),
  use_tls: z.boolean().default(true),
  incoming_host: z.string().trim().max(255).default(""),
  outgoing_protocols: z.string().trim().max(120).default("SMTP"),
  incoming_protocols: z.string().trim().max(120).default("POP3, IMAP"),
  pop3_port: z.coerce.number().int().min(1).max(65535).default(995),
  imap_port: z.coerce.number().int().min(1).max(65535).default(993),
});

const withTimeout = async <T,>(promise: Promise<T>, ms = 45_000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () =>
        reject(new Error("The SMTP test took too long. Check the host, port, and TLS settings.")),
      ms,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

function SmtpAdmin() {
  const { currentOrg } = useOrg();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [exists, setExists] = useState(false);

  const [host, setHost] = useState("");
  const [port, setPort] = useState(465);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [useTls, setUseTls] = useState(true);
  const [incomingHost, setIncomingHost] = useState("");
  const [outgoingProtocols, setOutgoingProtocols] = useState("SMTP");
  const [incomingProtocols, setIncomingProtocols] = useState("POP3, IMAP");
  const [pop3Port, setPop3Port] = useState(995);
  const [imapPort, setImapPort] = useState(993);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    supabase
      .from("org_smtp_settings")
      .select("*")
      .eq("org_id", currentOrg.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const smtp = data as any;
          setExists(true);
          setHost(smtp.host);
          setPort(smtp.port);
          setUsername(smtp.username);
          setPassword(smtp.password);
          setFromEmail(smtp.from_email);
          setFromName(smtp.from_name ?? "");
          setUseTls(smtp.use_tls);
          setIncomingHost(smtp.incoming_host ?? "");
          setOutgoingProtocols(smtp.outgoing_protocols ?? "SMTP");
          setIncomingProtocols(smtp.incoming_protocols ?? "POP3, IMAP");
          setPop3Port(smtp.pop3_port ?? 995);
          setImapPort(smtp.imap_port ?? 993);
        }
        setLoading(false);
      });
  }, [currentOrg?.id]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    const parsed = schema.safeParse({
      host,
      port,
      username,
      password,
      from_email: fromEmail,
      from_name: fromName,
      use_tls: useTls,
      incoming_host: incomingHost,
      outgoing_protocols: outgoingProtocols,
      incoming_protocols: incomingProtocols,
      pop3_port: pop3Port,
      imap_port: imapPort,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (parsed.data.port === 993 || parsed.data.port === 995) {
      return toast.error("That looks like an IMAP/POP3 port. SMTP is usually 465 (SSL) or 587 (TLS).");
    }
    setSaving(true);
    const payload = { org_id: currentOrg.id, ...parsed.data } as any;
    const { error } = exists
      ? await supabase.from("org_smtp_settings").update(payload).eq("org_id", currentOrg.id)
      : await supabase.from("org_smtp_settings").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    setExists(true);
    toast.success("SMTP settings saved");
  };

  const sendTest = async () => {
    if (!currentOrg) return;
    if (!testTo) return toast.error("Enter a test email address");
    setTesting(true);
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke("send-invite-email", {
          body: { test: { to: testTo, org_id: currentOrg.id } },
        }),
      );
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error ?? error?.message ?? "Test failed", { duration: 8000 });
        return;
      }
      toast.success("Test email sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-border bg-gradient-to-br from-primary/15 to-primary/5 p-2.5">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Email (SMTP)</h2>
          <p className="text-sm text-muted-foreground">
            Configure your own SMTP server to send invite emails from your domain.
          </p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6 rounded-lg border border-border bg-card p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Outgoing mail server</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="host">Outgoing mail server (requires authentication)</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="hkftservices.co.za"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="port">SMTP port</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                placeholder="465 or 587"
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label htmlFor="outgoing_protocols">Supported outgoing mail protocols</Label>
              <Input
                id="outgoing_protocols"
                value={outgoingProtocols}
                onChange={(e) => setOutgoingProtocols(e.target.value)}
                placeholder="SMTP"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Incoming mail server</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-3">
              <Label htmlFor="incoming_host">Incoming mail server</Label>
              <Input
                id="incoming_host"
                value={incomingHost}
                onChange={(e) => setIncomingHost(e.target.value)}
                placeholder="hkftservices.co.za"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pop3_port">POP3</Label>
              <Input
                id="pop3_port"
                type="number"
                value={pop3Port}
                onChange={(e) => setPop3Port(Number(e.target.value))}
                placeholder="995"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imap_port">IMAP</Label>
              <Input
                id="imap_port"
                type="number"
                value={imapPort}
                onChange={(e) => setImapPort(Number(e.target.value))}
                placeholder="993"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="incoming_protocols">Supported incoming mail protocols</Label>
              <Input
                id="incoming_protocols"
                value={incomingProtocols}
                onChange={(e) => setIncomingProtocols(e.target.value)}
                placeholder="POP3, IMAP"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Credentials</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="username">Mail server username</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  className="pl-8"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  className="pl-8 pr-9"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center gap-2">
            <AtSign className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Sender identity</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="from_email">From email</Label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="from_email"
                  className="pl-8"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="invites@company.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from_name">From name</Label>
              <Input
                id="from_name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Company Name"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck
              className={`h-5 w-5 ${useTls ? "text-emerald-500" : "text-muted-foreground"}`}
            />
            <div>
              <Label htmlFor="use_tls" className="cursor-pointer">
                Use TLS
              </Label>
              <p className="text-xs text-muted-foreground">Recommended for ports 465 and 587.</p>
            </div>
          </div>
          <Switch id="use_tls" checked={useTls} onCheckedChange={setUseTls} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>

      <div className="space-y-3 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-border bg-muted p-2">
            <TestTube2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium">Send a test email</h3>
            <p className="text-sm text-muted-foreground">
              Save your settings first, then try a test send.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AtSign className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button type="button" variant="outline" disabled={testing || !exists} onClick={sendTest}>
            <Send className="mr-2 h-4 w-4" />
            {testing ? "Sending…" : "Send test"}
          </Button>
        </div>
      </div>
    </div>
  );
}
