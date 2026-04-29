import type { Database } from "@/integrations/supabase/types";

export type JobRole = Database["public"]["Enums"]["job_role"];

export const JOB_ROLES: { value: JobRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "executive", label: "Executive" },
  { value: "manager", label: "Manager" },
  { value: "product_manager", label: "Product Manager" },
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "marketer", label: "Marketer" },
  { value: "operations", label: "Operations" },
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "hr", label: "HR" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
];

export function jobRoleLabel(role: JobRole | null | undefined): string {
  if (!role) return "—";
  return JOB_ROLES.find((r) => r.value === role)?.label ?? role;
}
