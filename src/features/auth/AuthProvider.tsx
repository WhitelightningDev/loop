import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PENDING_INVITE_KEY = "pending-invite-token";

async function consumePendingInvite() {
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return;
  }
  if (!token) return;
  const { error } = await supabase.rpc("accept_invite", { _token: token });
  try { sessionStorage.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
  if (error) {
    // Quietly ignore "Invite already used" so we don't nag returning users.
    if (!/already used/i.test(error.message)) {
      toast.error(`Invite: ${error.message}`);
    }
    return;
  }
  toast.success("You're in the Loop");
  // Trigger a soft refresh so OrgProvider picks up the new membership.
  window.dispatchEvent(new CustomEvent("loop:invite-accepted"));
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      // Auto-consume any pending invite token after sign-in / sign-up.
      if (s?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        // Defer so we don't block the auth callback.
        setTimeout(() => { void consumePendingInvite(); }, 0);
      }
    });
    // THEN check existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        setTimeout(() => { void consumePendingInvite(); }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
