import { supabaseAdmin } from "../../integrations/supabase/client.server";

export async function requireOrgAdmin(userId: string, orgId: string) {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", userId);

  if (error) throw error;

  const isAdmin =
    (roles ?? []).some((r) => r.org_id === orgId && r.role === "org_admin") ||
    (roles ?? []).some((r) => r.org_id === null && r.role === "super_admin");

  if (!isAdmin) {
    throw new Error("forbidden");
  }
}
