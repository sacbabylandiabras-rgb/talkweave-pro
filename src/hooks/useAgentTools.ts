import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AgentTool {
  name: string;
  label: string;
  description: string;
  category: string;
  enabled: boolean;
}

export const ALL_TOOLS: Omit<AgentTool, "enabled">[] = [
  // WhatsApp Meta Cloud API
  { category: "WhatsApp (Meta Cloud API)", name: "meta_enviar_texto", label: "Meta — Enviar texto", description: "Envia mensagem de texto via API oficial Meta (Cloud API)." },
  { category: "WhatsApp (Meta Cloud API)", name: "meta_enviar_template", label: "Meta — Enviar template", description: "Envia template aprovado pela Meta (necessário fora da janela 24h)." },
  // Instagram
  { category: "Instagram", name: "instagram_listar_comentarios", label: "Listar comentários", description: "Lista comentários recebidos recentemente no Instagram." },
  { category: "Instagram", name: "instagram_responder_comentario", label: "Responder comentário", description: "Responde publicamente a um comentário no Instagram." },
  { category: "Instagram", name: "instagram_enviar_dm", label: "Enviar DM", description: "Envia mensagem direta no Instagram (suporta private reply de comentário)." },
  // Gateway
  { category: "Gateway (ZapLynxPay)", name: "gateway_consultar_saldo", label: "Consultar saldo", description: "Consulta saldo disponível, total recebido e total de saques." },
  { category: "Gateway (ZapLynxPay)", name: "gateway_listar_vendas", label: "Listar vendas", description: "Lista últimas transações com filtro opcional por status." },
  { category: "Gateway (ZapLynxPay)", name: "gateway_listar_produtos", label: "Listar produtos", description: "Lista produtos ativos cadastrados no gateway." },
  { category: "Gateway (ZapLynxPay)", name: "gateway_buscar_plano_checkout", label: "Buscar plano + checkout", description: "Encontra o plano ideal e retorna o checkout existente para pagamento." },
  { category: "Gateway (ZapLynxPay)", name: "gerar_pix", label: "Gerar cobrança PIX", description: "Cria cobrança PIX e envia o código copia-e-cola." },
  // Geral
  { category: "Geral", name: "buscar_faq", label: "Buscar na base de conhecimento", description: "Pesquisa FAQs e documentos cadastrados antes de responder." },
  { category: "Geral", name: "transferir_humano", label: "Transferir para humano", description: "Marca a conversa para atendimento humano e pausa o agente nela." },
];

export function useAgentTools() {
  const [tools, setTools] = useState<AgentTool[]>(ALL_TOOLS.map(t => ({ ...t, enabled: false })));
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const isMissingAgentToolsTableError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String((error as any)?.message || error || "");
    const normalizedMessage = message.toLowerCase();
    const code = String((error as any)?.code || "").toLowerCase();
    return (
      normalizedMessage.includes("agent_tools_config") && (
        normalizedMessage.includes("could not find the table") ||
        normalizedMessage.includes("does not exist") ||
        normalizedMessage.includes("relation") ||
        normalizedMessage.includes("schema cache")
      )
    ) || code === "42p01" || code === "pgrst205";
  };

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await (supabase as any)
        .from("agent_tools_config")
        .select("tool_name, enabled")
        .eq("user_id", session.user.id);

      if (error) {
        if (isMissingAgentToolsTableError(error)) {
          setUnavailable(true);
          setTools(ALL_TOOLS.map(t => ({ ...t, enabled: false })));
          return;
        }
        throw error;
      }

      setUnavailable(false);
      const map = new Map<string, boolean>();
      (data || []).forEach((r: any) => map.set(r.tool_name, !!r.enabled));
      setTools(ALL_TOOLS.map(t => ({ ...t, enabled: map.get(t.name) ?? false })));
    } catch (error) {
      console.error("Erro ao carregar ferramentas do agente:", error);
      setUnavailable(false);
      setTools(ALL_TOOLS.map(t => ({ ...t, enabled: false })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (name: string, enabled: boolean) => {
    if (unavailable) {
      return;
    }

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
      if (isMissingAgentToolsTableError(error)) {
        setUnavailable(true);
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
      setTools(prev => prev.map(t => t.name === name ? { ...t, enabled: !enabled } : t));
    } else {
      toast({ title: enabled ? "Ferramenta ativada" : "Ferramenta desativada" });
    }
  };

  return { tools, loading, unavailable, toggle };
}