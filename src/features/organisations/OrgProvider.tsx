import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import type { AppRole, Organisation } from "@/lib/types";

interface OrgContextValue {
  orgs: Organisation[];
  currentOrg: Organisation | null;
  setCurrentOrg: (org: Organisation) => void;
  roles: AppRole[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

const STORAGE_KEY = "loop-current-org";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organisation | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrgs = async () => {
    if (!user) {
      setOrgs([]);
      setCurrentOrgState(null);
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Get orgs the user is a member of via the join
    const { data: memberships } = await supabase
      .from("organisation_members")
      .select("org_id, organisations(*)")
      .eq("user_id", user.id)
      .eq("status", "active");

    const orgList: Organisation[] = (memberships ?? [])
      .map((m: any) => m.organisations)
      .filter(Boolean);
    setOrgs(orgList);

    // Pick current org
    const stored = localStorage.getItem(STORAGE_KEY);
    const chosen = orgList.find((o) => o.id === stored) ?? orgList[0] ?? null;
    setCurrentOrgState(chosen);
    if (chosen) localStorage.setItem(STORAGE_KEY, chosen.id);

    if (chosen) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .or(`org_id.eq.${chosen.id},org_id.is.null`);
      setRoles((roleRows ?? []).map((r) => r.role as AppRole));
    } else {
      setRoles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadOrgs();
    const onInvite = () => { void loadOrgs(); };
    window.addEventListener("loop:invite-accepted", onInvite);
    return () => window.removeEventListener("loop:invite-accepted", onInvite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setCurrentOrg = (org: Organisation) => {
    setCurrentOrgState(org);
    localStorage.setItem(STORAGE_KEY, org.id);
    void loadOrgs();
  };

  return (
    <OrgContext.Provider
      value={{ orgs, currentOrg, setCurrentOrg, roles, loading, refresh: loadOrgs }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be inside OrgProvider");
  return ctx;
}

export function hasRole(roles: AppRole[], role: AppRole) {
  return roles.includes(role) || roles.includes("super_admin");
}

export function isAdmin(roles: AppRole[]) {
  return roles.includes("super_admin") || roles.includes("org_admin");
}
