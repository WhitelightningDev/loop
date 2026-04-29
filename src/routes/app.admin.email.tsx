import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus, Loader2, MailCheck, Palette, Save, Signature, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/admin/email")({
  component: EmailDesignAdmin,
});

const schema = z.object({
  brand_name: z.string().trim().max(120),
  accent_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #111111"),
  logo_url: z.string().trim().url().or(z.literal("")),
  invite_subject: z.string().trim().max(160),
  invite_heading: z.string().trim().max(160),
  invite_body: z.string().trim().max(800),
  signature_name: z.string().trim().max(120),
  signature_title: z.string().trim().max(120),
  signature_company: z.string().trim().max(120),
  signature_phone: z.string().trim().max(80),
  signature_website: z.string().trim().max(180),
  signature_disclaimer: z.string().trim().max(600),
  signature_logo_url: z.string().trim().url().or(z.literal("")),
});

type EmailSettings = z.infer<typeof schema>;

const defaults: EmailSettings = {
  brand_name: "",
  accent_color: "#111111",
  logo_url: "",
  invite_subject: "",
  invite_heading: "",
  invite_body: "",
  signature_name: "",
  signature_title: "",
  signature_company: "",
  signature_phone: "",
  signature_website: "",
  signature_disclaimer: "",
  signature_logo_url: "",
};

function EmailDesignAdmin() {
  const { currentOrg } = useOrg();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [form, setForm] = useState<EmailSettings>(defaults);
  const [uploading, setUploading] = useState<"logo_url" | "signature_logo_url" | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    supabase
      .from("org_email_settings" as any)
      .select("*")
      .eq("org_id", currentOrg.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        if (data) {
          const row = data as Partial<EmailSettings>;
          setExists(true);
          setForm({
            brand_name: row.brand_name ?? "",
            accent_color: row.accent_color ?? "#111111",
            logo_url: row.logo_url ?? "",
            invite_subject: row.invite_subject ?? "",
            invite_heading: row.invite_heading ?? "",
            invite_body: row.invite_body ?? "",
            signature_name: row.signature_name ?? "",
            signature_title: row.signature_title ?? "",
            signature_company: row.signature_company ?? "",
            signature_phone: row.signature_phone ?? "",
            signature_website: row.signature_website ?? "",
            signature_disclaimer: row.signature_disclaimer ?? "",
            signature_logo_url: row.signature_logo_url ?? "",
          });
        } else {
          setExists(false);
          setForm(defaults);
        }
        setLoading(false);
      });
  }, [currentOrg?.id]);

  const preview = useMemo(() => {
    const brand = form.brand_name || currentOrg?.name || "Loop";
    return {
      brand,
      subject: form.invite_subject || `${brand} is looping you in on Loop`,
      heading: form.invite_heading || `You're being looped in to ${brand}`,
      body:
        form.invite_body ||
        "Your team is using Loop — premium internal messaging. Click below to join the workspace and stay in the loop.",
    };
  }, [currentOrg?.name, form]);

  const update = (key: keyof EmailSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpload = async (key: "logo_url" | "signature_logo_url", file: File) => {
    if (!currentOrg) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2MB");
    setUploading(key);
    const ext = file.name.split(".").pop() || "png";
    const path = `${currentOrg.id}/email/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploading(null);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("org-logos").getPublicUrl(path);
    update(key, data.publicUrl);
    setUploading(null);
    toast.success("Logo uploaded");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const payload = {
      org_id: currentOrg.id,
      ...parsed.data,
      logo_url: parsed.data.logo_url || null,
      signature_logo_url: parsed.data.signature_logo_url || null,
    } as any;
    const { error } = exists
      ? await supabase.from("org_email_settings" as any).update(payload).eq("org_id", currentOrg.id)
      : await supabase.from("org_email_settings" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    setExists(true);
    toast.success("Email design saved");
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-border bg-gradient-to-br from-primary/15 to-primary/5 p-2.5">
          <Signature className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Email design</h2>
          <p className="text-sm text-muted-foreground">
            Customize invite emails and the workspace signature that appears at the bottom.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={save} className="space-y-6 rounded-lg border border-border bg-card p-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Branding</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Brand name">
                <Input value={form.brand_name} onChange={(e) => update("brand_name", e.target.value)} placeholder={currentOrg?.name ?? "Company"} />
              </Field>
              <Field label="Accent color">
                <div className="flex gap-2">
                  <Input type="color" value={form.accent_color} onChange={(e) => update("accent_color", e.target.value)} className="h-10 w-14 p-1" />
                  <Input value={form.accent_color} onChange={(e) => update("accent_color", e.target.value)} placeholder="#111111" />
                </div>
              </Field>
              <Field label="Header logo" className="md:col-span-2">
                <LogoUploader
                  value={form.logo_url}
                  onChange={(v) => update("logo_url", v)}
                  onUpload={(file) => handleUpload("logo_url", file)}
                  uploading={uploading === "logo_url"}
                  placeholder="https://company.com/logo.png"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <MailCheck className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Invite email</h3>
            </div>
            <Field label="Subject">
              <Input value={form.invite_subject} onChange={(e) => update("invite_subject", e.target.value)} placeholder="Company is looping you in on Loop" />
            </Field>
            <Field label="Heading">
              <Input value={form.invite_heading} onChange={(e) => update("invite_heading", e.target.value)} placeholder="You're being looped in" />
            </Field>
            <Field label="Message">
              <Textarea rows={5} value={form.invite_body} onChange={(e) => update("invite_body", e.target.value)} placeholder="Add the welcome message admins want invitees to see." />
            </Field>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <Signature className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Signature</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input value={form.signature_name} onChange={(e) => update("signature_name", e.target.value)} placeholder="Admin Team" />
              </Field>
              <Field label="Title">
                <Input value={form.signature_title} onChange={(e) => update("signature_title", e.target.value)} placeholder="People Operations" />
              </Field>
              <Field label="Company">
                <Input value={form.signature_company} onChange={(e) => update("signature_company", e.target.value)} placeholder={currentOrg?.name ?? "Company"} />
              </Field>
              <Field label="Phone">
                <Input value={form.signature_phone} onChange={(e) => update("signature_phone", e.target.value)} placeholder="+27 00 000 0000" />
              </Field>
              <Field label="Website" className="md:col-span-2">
                <Input value={form.signature_website} onChange={(e) => update("signature_website", e.target.value)} placeholder="https://company.com" />
              </Field>
              <Field label="Disclaimer" className="md:col-span-2">
                <Textarea rows={4} value={form.signature_disclaimer} onChange={(e) => update("signature_disclaimer", e.target.value)} placeholder="Optional legal or confidentiality footer." />
              </Field>
              <Field label="Signature logo" className="md:col-span-2">
                <LogoUploader
                  value={form.signature_logo_url}
                  onChange={(v) => update("signature_logo_url", v)}
                  onUpload={(file) => handleUpload("signature_logo_url", file)}
                  uploading={uploading === "signature_logo_url"}
                  placeholder="https://company.com/signature-logo.png"
                />
              </Field>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save email design"}
            </Button>
          </div>
        </form>

        <aside className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium">Live preview</h3>
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white text-neutral-950 shadow-sm">
            <div className="border-b border-neutral-200 px-5 py-3 text-xs text-neutral-500">
              Subject: {preview.subject}
            </div>
            <div className="p-6">
              {form.logo_url ? <img src={form.logo_url} alt="" className="mb-5 max-h-10 max-w-36 object-contain" /> : null}
              <h4 className="m-0 text-xl font-semibold text-neutral-950">{preview.heading}</h4>
              <p className="mt-3 text-sm leading-6 text-neutral-600">{preview.body}</p>
              <div className="mt-5">
                <span className="inline-flex rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: form.accent_color }}>
                  Join the Loop
                </span>
              </div>
              <div className="mt-6 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500">
                {form.signature_logo_url ? <img src={form.signature_logo_url} alt="" className="mb-2 max-h-12 max-w-40 object-contain" /> : null}
                <div className="font-semibold text-neutral-700">{form.signature_name || preview.brand}</div>
                {(form.signature_title || form.signature_company) && <div>{[form.signature_title, form.signature_company || preview.brand].filter(Boolean).join(" · ")}</div>}
                {form.signature_phone && <div>{form.signature_phone}</div>}
                {form.signature_website && <div>{form.signature_website}</div>}
                {form.signature_disclaimer && <p className="mt-3">{form.signature_disclaimer}</p>}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LogoUploader({
  value,
  onChange,
  onUpload,
  uploading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <div className="flex h-14 w-24 items-center justify-center rounded-md border border-border bg-white p-1">
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-14 w-24 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
            <label className="cursor-pointer">
              {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-2 h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="mr-1 h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
