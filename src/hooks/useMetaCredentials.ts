import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

  const WHATSAPP_META_APP_ID = "26985190684454065";

export function useMetaCredentials(appId: string = WHATSAPP_META_APP_ID) {
  return useQuery({
    queryKey: ["meta-credentials", appId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from("meta_credentials" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .eq("app_id", appId)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("Error fetching meta credentials:", error);
        return null;
      }

      // Enrich with cached display info
      const cachedInfo = localStorage.getItem(`meta_info_${session.user.id}`);
      if (cachedInfo) {
        try {
          const info = JSON.parse(cachedInfo);
          return { ...(data as Record<string, any>), ...info } as any;
        } catch (e) {}
      }

      return data as any;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}
