import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMetaCredentials() {
  return useQuery({
    queryKey: ["meta-credentials"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("meta_credentials" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching meta credentials:", error);
        return null;
      }
      return data as any;
    },
  });
}
