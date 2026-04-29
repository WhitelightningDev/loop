import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/admin/settings")({
  component: SettingsAdmin,
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
  logo_url: z.string().trim().url().max(500).or(z.literal("")),
});

function SettingsAdmin() {
  const { currentOrg, refresh } = useOrg();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Force re-render when org changes
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const onLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentOrg) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Max file size is 2 MB");
    if (!/^image\//.test(file.type)) return toast.error("Please pick an image file");
    setUploadingLogo(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${currentOrg.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("org-logos")
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (upErr) {
      setUploadingLogo(false);
      return toast.error(upErr.message);
    }
    const { data } = supabase.storage.from("org-logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploadingLogo(false);
    toast.success("Logo uploaded — click Save to apply.");
  };

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name);
      setSlug(currentOrg.slug);
      setLogoUrl(currentOrg.logo_url ?? "");
    }
  }, [currentOrg?.id]);

  if (!currentOrg) {
    return <div className="text-muted-foreground">Loading workspace…</div>;
  }

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ name, slug, logo_url: logoUrl });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("organisations")
      .update({
        name: parsed.data.name,
        slug: parsed.data.slug,
        logo_url: parsed.data.logo_url || null,
      })
      .eq("id", currentOrg.id);
    setSaving(false);
    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        toast.error("That URL slug is already taken.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Workspace updated");
    await refresh();
  };

  const deleteWorkspace = async () => {
    if (confirmText !== currentOrg.name) {
      toast.error("Workspace name doesn't match");
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from("organisations").delete().eq("id", currentOrg.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Workspace deleted");
    await refresh();
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Workspace settings</h2>
        <p className="text-sm text-muted-foreground">
          Update your organisation profile and manage workspace-wide controls.
        </p>
      </div>

      {/* Profile */}
      <form
        onSubmit={saveProfile}
        className="space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <h3 className="font-medium">Profile</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL slug</Label>
            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
              <span className="px-3 text-sm text-muted-foreground">loop.app/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                required
                pattern="[a-z0-9-]+"
                className="border-0 pl-0 focus-visible:ring-0"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Workspace logo</Label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {logoUrl ? (
                <img src={logoUrl} alt="Workspace logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={onLogoFile}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} onClick={() => fileInputRef.current?.click()}>
                  {uploadingLogo ? "Uploading..." : logoUrl ? "Replace logo" : "Upload logo"}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or SVG. Max 2 MB. Square works best.</p>
            </div>
          </div>
          <Input
            id="logo_url"
            type="url"
            placeholder="…or paste a URL"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>

      {/* Workspace controls (info card) */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-medium">Channel & member controls</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage privacy, lock channels, and assign job titles from the dedicated tabs.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <ControlLink to="/app/admin/members" label="Members" hint="Roles & job titles" />
          <ControlLink to="/app/admin/invites" label="Invites" hint="Bring new people in" />
          <ControlLink to="/app/admin/channels" label="Channels" hint="Lock & restrict" />
          <ControlLink to="/app/admin/email" label="Email design" hint="Invites & signature" />
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-medium text-destructive">Delete workspace</h3>
              <p className="text-sm text-muted-foreground">
                This permanently removes the workspace, channels, messages, and member
                access. This cannot be undone.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-xs">
                Type <span className="font-mono font-semibold">{currentOrg.name}</span> to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={currentOrg.name}
              />
            </div>
            <Button
              variant="destructive"
              disabled={deleting || confirmText !== currentOrg.name}
              onClick={deleteWorkspace}
            >
              {deleting ? "Deleting..." : "Delete this workspace"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlLink({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <a
      href={to}
      className="block rounded-md border border-border bg-background p-3 transition-colors hover:border-primary"
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </a>
  );
}
