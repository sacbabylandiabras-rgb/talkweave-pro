import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InstagramAutomation {
  id: string;
  user_id: string;
  name: string;
  keyword: string;
  reply_comment: string;
  dm_message: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useInstagramAutomations() {
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["instagram_automations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("instagram_automations" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InstagramAutomation[];
    },
  });

  const createAutomation = useMutation({
    mutationFn: async (automation: { name: string; keyword: string; reply_comment: string; dm_message: string; active: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("instagram_automations" as any)
        .insert({ ...automation, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as InstagramAutomation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram_automations"] });
      toast.success("Fluxo criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAutomation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InstagramAutomation> & { id: string }) => {
      const { error } = await supabase
        .from("instagram_automations" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram_automations"] });
      toast.success("Fluxo atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("instagram_automations" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram_automations"] });
      toast.success("Fluxo removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { automations, isLoading, createAutomation, updateAutomation, deleteAutomation };
}
