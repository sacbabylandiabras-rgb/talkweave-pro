import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AgentTool {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
}

export const ALL_TOOLS: Omit<AgentTool, "enabled">[] = [
  { name: "enviar_botoes", label: "Enviar botões", description: "Permite o agente enviar botões de resposta rápida (até 3) via WhatsApp." },
  { name: "enviar_lista", label: "Enviar lista", description: "Envia menu em formato de lista (até 10 opções)." },
  { name: "enviar_imagem", label: "Enviar imagem", description: "Envia imagem com legenda a partir de uma URL." },
  { name: "enviar_link", label: "Enviar link", description: "Envia mensagem de texto contendo um link/URL." },
  { name: "transferir_humano", label: "Transferir para humano", description: "Marca a conversa para atendimento humano e pausa o agente nela." },
  { name: "buscar_faq", label: "Buscar na base de conhecimento", description: "Pesquisa FAQs e documentos cadastrados antes de responder." },
  { name: "gerar_pix", label: "Gerar cobrança PIX", description: "Cria uma cobrança PIX no gateway e envia o código copia-e-cola." },
];

export function useAgentTools() {
  const [tools, setTools] = useState<AgentTool[]>(ALL_TOOLS.map(t => ({ ...t, enabled: false })));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await (supabase as any)
        .from("agent_tools_config")
        .select("tool_name, enabled")
        .eq("user_id", session.user.id);
      const map = new Map<string, boolean>();
      (data || []).forEach((r: any) => map.set(r.tool_name, !!r.enabled));
      setTools(ALL_TOOLS.map(t => ({ ...t, enabled: map.get(t.name) ?? false })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (name: string, enabled: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setTools(prev => prev.map(t => t.name === name ? { ...t, enabled } : t));
    const { error } = await (supabase as any)
      .from("agent_tools_config")
      .upsert(
        { user_id: session.user.id, tool_name: name, enabled },
        { onConflict: "user_id,tool_name" }
      );
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setTools(prev => prev.map(t => t.name === name ? { ...t, enabled: !enabled } : t));
    } else {
      toast({ title: enabled ? "Ferramenta ativada" : "Ferramenta desativada" });
    }
  };

  return { tools, loading, toggle };
}