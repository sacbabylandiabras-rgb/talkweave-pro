import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstagramEvent {
  id: string;
  user_id: string;
  event_type: string;
  ig_user_id: string;
  username: string;
  media_id: string;
  comment_text: string;
  payload: any;
  processed: boolean;
  created_at: string;
}

export function useInstagramEvents() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["instagram_events"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("instagram_events" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InstagramEvent[];
    },
  });

  return { events, isLoading };
}
