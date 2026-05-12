import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_META_APP_ID = "1629147191696096";

export function useMetaCredentials(appId: string = WHATSAPP_META_APP_ID) {
  return useQuery({
    queryKey: ["meta-credentials", appId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("meta_credentials" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("app_id", appId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching meta credentials:", error);
        return null;
      }
      return data as any;
    },
  });
}
