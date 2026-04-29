import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/features/organisations/OrgProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { AppRole } from "@/lib/types";
import { JOB_ROLES, jobRoleLabel, type JobRole } from "@/lib/job-roles";

export const Route = createFileRoute("/app/admin/members")({
  component: MembersAdmin,
});

const ROLES: AppRole[] = ["org_admin", "manager", "member", "guest"];

function MembersAdmin() {
  const { currentOrg } = useOrg();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-members", currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async () => {
      const { data } = await supabase
        .from("organisation_members")
        .select("user_id, status, joined_at, job_role, user_profiles!inner(id, full_name, email, avatar_url, job_title)")
        .eq("org_id", currentOrg!.id);
      const ids = (data ?? []).map((m: any) => m.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("org_id", currentOrg!.id)
        .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (data ?? []).map((m: any) => ({
        ...m,
        profile: m.user_profiles,
        roles: (roles ?? []).filter((r) => r.user_id === m.user_id).map((r) => r.role as AppRole),
      }));
    },
  });

  const setJobRole = async (userId: string, jobRole: JobRole) => {
    if (!currentOrg) return;
    const { error } = await supabase
      .from("organisation_members")
      .update({ job_role: jobRole })
      .eq("user_id", userId)
      .eq("org_id", currentOrg.id);
    if (error) return toast.error(error.message);
    toast.success("Job title updated");
    qc.invalidateQueries({ queryKey: ["admin-members", currentOrg.id] });
  };

  const setRole = async (userId: string, role: AppRole) => {
    if (!currentOrg) return;
    // Remove other org-scoped roles for this user, then insert chosen role
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("org_id", currentOrg.id)
      .neq("role", "super_admin");
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, org_id: currentOrg.id, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["admin-members", currentOrg.id] });
  };

  const removeMember = async (userId: string) => {
    if (!currentOrg) return;
    if (!confirm("Remove this member from the workspace?")) return;
    const { error } = await supabase
      .from("organisation_members")
      .delete()
      .eq("user_id", userId)
      .eq("org_id", currentOrg.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Member removed");
    qc.invalidateQueries({ queryKey: ["admin-members", currentOrg.id] });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m: any) => {
      const name = (m.profile?.full_name ?? "").toLowerCase();
      const email = (m.profile?.email ?? "").toLowerCase();
      const job = jobRoleLabel(m.job_role).toLowerCase();
      return name.includes(q) || email.includes(q) || job.includes(q);
    });
  }, [members, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">
            Manage roles and access for everyone in your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {members.length} {members.length === 1 ? "member" : "members"}
          </Badge>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-64 pl-8"
            />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">Job title</th>
              <th className="px-4 py-2.5 font-medium">Permission</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                {query ? "No matches found." : "No members yet."}
              </td></tr>
            )}
            {filtered.map((m: any) => {
              const currentRole: AppRole = m.roles[0] ?? "member";
              const currentJobRole: JobRole = (m.job_role as JobRole) ?? "employee";
              return (
                <tr key={m.user_id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                        <AvatarFallback>{(m.profile?.full_name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{m.profile?.full_name ?? "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={currentJobRole} onValueChange={(v) => setJobRole(m.user_id, v as JobRole)}>
                      <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {JOB_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={currentRole} onValueChange={(v) => setRole(m.user_id, v as AppRole)}>
                      <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3"><Badge variant="secondary">{m.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => removeMember(m.user_id)}>Remove</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
