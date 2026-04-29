import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getTeamsCount = createServerFn({ method: "GET" }).handler(
  async () => {
    const { count, error } = await supabaseAdmin
      .from("organisations")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return { count: count ?? 0 };
  },
);
