import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const STATUS_PRESETS = ["💻 Working", "🍱 At lunch", "🤒 Off sick", "☎️ On another call"];

export const Route = createFileRoute("/app/me/")({
  component: ProfilePage,
});

const schema = z.object({
  full_name: z.string().trim().min(1, "Name can't be empty").max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-z0-9_.]+$/, "Only lowercase letters, numbers, _ and . are allowed"),
  job_title: z.string().trim().max(100).optional().or(z.literal("")),
  department: z.string().trim().max(100).optional().or(z.literal("")),
  status_text: z.string().trim().max(140).optional().or(z.literal("")),
  timezone: z.string().trim().max(80).optional().or(z.literal("")),
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    job_title: "",
    department: "",
    status_text: "",
    timezone: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select(
          "id, username, full_name, email, avatar_url, job_title, department, status_text, timezone",
        )
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        username: profile.username ?? "",
        job_title: profile.job_title ?? "",
        department: profile.department ?? "",
        status_text: profile.status_text ?? "",
        timezone: profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      });
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({
        full_name: parsed.data.full_name,
        username: parsed.data.username,
        job_title: parsed.data.job_title || null,
        department: parsed.data.department || null,
        status_text: parsed.data.status_text || null,
        timezone: parsed.data.timezone || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        return toast.error("That username is already taken — try another.");
      }
      return toast.error(error.message);
    }
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    qc.invalidateQueries({ queryKey: ["app-shell-profile", user.id] });
    qc.invalidateQueries({ queryKey: ["sidebar-dms"] });
    qc.invalidateQueries({ queryKey: ["channel-members"] });
  };

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setAvatarUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      setAvatarUploading(false);
      return toast.error(upErr.message);
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("user_profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", user.id);
    setAvatarUploading(false);
    if (updErr) return toast.error(updErr.message);
    toast.success("Photo updated");
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
  };

  const initials = (form.full_name || profile?.email || "?").slice(0, 2).toUpperCase();

  return (
    <form onSubmit={save} className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={form.full_name} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="text-base font-semibold">{form.full_name || "Your name"}</div>
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" hidden onChange={onAvatar} />
            <Button type="button" variant="outline" size="sm" asChild>
              <span>{avatarUploading ? "Uploading…" : "Change photo"}</span>
            </Button>
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="full_name">Display name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="username">Username (tag name)</Label>
            <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 text-sm text-muted-foreground">@</span>
              <Input
                id="username"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_.]/g, "")
                      .slice(0, 30),
                  }))
                }
                maxLength={30}
                required
                placeholder="jetlag"
                className="border-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Teammates can mention you with{" "}
              <span className="font-mono">@{form.username || "username"}</span>. 3–30 characters,
              lowercase letters, numbers, <span className="font-mono">_</span> and{" "}
              <span className="font-mono">.</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job_title">Job title</Label>
            <Input
              id="job_title"
              value={form.job_title}
              onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
              maxLength={100}
              placeholder="e.g. Product Designer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              maxLength={100}
              placeholder="e.g. Design"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="status_text">Status</Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_PRESETS.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={form.status_text === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, status_text: status }))}
                >
                  {status}
                </Button>
              ))}
              {form.status_text && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, status_text: "" }))}
                >
                  Clear
                </Button>
              )}
            </div>
            <Textarea
              id="status_text"
              value={form.status_text}
              onChange={(e) => setForm((f) => ({ ...f, status_text: e.target.value }))}
              maxLength={140}
              rows={2}
              placeholder="What you're up to — heads down, in a meeting, on holiday…"
            />
            <p className="text-xs text-muted-foreground">{form.status_text.length}/140</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              maxLength={80}
              placeholder="Europe/London"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
