import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstagramContact {
  id: string;
  user_id: string;
  ig_user_id: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export function useInstagramContacts() {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["instagram_contacts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("instagram_contacts" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InstagramContact[];
    },
  });

  return { contacts, isLoading };
}
