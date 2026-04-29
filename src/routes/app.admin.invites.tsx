import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import type { AppRole } from "@/lib/types";
import { JOB_ROLES, jobRoleLabel, type JobRole } from "@/lib/job-roles";
import loopLogo from "@/assets/loop-icon.png";

export const Route = createFileRoute("/app/admin/invites")({
  component: InvitesAdmin,
});

const schema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["org_admin", "manager", "member", "guest"]),
  job_role: z.enum([
    "employee",
    "executive",
    "manager",
    "product_manager",
    "developer",
    "designer",
    "marketer",
    "operations",
    "sales",
    "support",
    "hr",
    "finance",
    "legal",
    "other",
  ]),
});

function InvitesAdmin() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data: invites = [] } = useQuery({
    queryKey: ["admin-invites", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data } = await supabase
        .from("invites")
        .select("*")
        .eq("org_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentOrg || !user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      email: fd.get("email"),
      role: fd.get("role"),
      job_role: fd.get("job_role"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    const { data: inserted, error } = await supabase
      .from("invites")
      .insert({
        org_id: currentOrg.id,
        email: parsed.data.email,
        role: parsed.data.role as AppRole,
        job_role: parsed.data.job_role as JobRole,
        invited_by: user.id,
      })
      .select("id")
      .single();
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    // Try sending via SMTP — non-fatal if not configured
    const { data: sendRes, error: sendErr } = await supabase.functions.invoke("send-invite-email", {
      body: { invite_id: inserted!.id },
    });
    setSubmitting(false);
    if (sendErr || (sendRes as any)?.error) {
      toast.warning(
        `Invite created, but email not sent — ${(sendRes as any)?.error ?? sendErr?.message ?? "check SMTP settings."}`,
        { duration: 9000 },
      );
    } else {
      toast.success("Invite sent — they'll be looped in shortly");
    }
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["admin-invites", currentOrg.id] });
  };

  const revoke = async (id: string) => {
    if (!currentOrg) return;
    const { error } = await supabase.from("invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    qc.invalidateQueries({ queryKey: ["admin-invites", currentOrg.id] });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Invites</h2>
        <p className="text-sm text-muted-foreground">
          Loop in your teammates and assign roles upfront.
        </p>
      </div>

      <form
        onSubmit={create}
        className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_180px_180px_auto]"
      >
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="teammate@company.com" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role">Permission</Label>
          <Select name="role" defaultValue="member">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="org_admin">Org admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="guest">Guest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="job_role">Job title</Label>
          <Select name="job_role" defaultValue="employee">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {JOB_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-white text-neutral-950 hover:bg-white/90 md:w-auto"
          >
            <img src={loopLogo} alt="" className="mr-2 h-4 w-4 object-contain" />
            {submitting ? "Sending..." : "them in"}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Permission</th>
              <th className="px-4 py-3">Job title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No invites yet.
                </td>
              </tr>
            )}
            {invites.map((i) => (
              <tr key={i.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">{i.email}</td>
                <td className="px-4 py-3 capitalize">{i.role.replace("_", " ")}</td>
                <td className="px-4 py-3">{jobRoleLabel(i.job_role)}</td>
                <td className="px-4 py-3">
                  {i.accepted_at ? (
                    <Badge>Accepted</Badge>
                  ) : new Date(i.expires_at) < new Date() ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(i.expires_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {!i.accepted_at && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>
                        Revoke
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
