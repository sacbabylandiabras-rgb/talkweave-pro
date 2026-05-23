import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AgentConfig {
  id?: string;
  agent_name: string;
  system_prompt: string;
  prompt_triage?: string;
  prompt_service?: string;
  prompt_closing?: string;
  active: boolean;
  provider: "anthropic";
  model: string;
}

interface KnowledgeItem {
  id: string;
  type: "faq" | "document";
  question?: string;
  answer?: string;
  title?: string;
  content?: string;
  active: boolean;
  created_at: string;
}

const isMissingAgentConfigColumnError = (error: unknown, column: string) => {
  const message = error instanceof Error ? error.message : String((error as any)?.message || error || '');
  return message.toLowerCase().includes(`could not find the '${column}' column`.toLowerCase());
};

export function useAgentConfig() {
  const [config, setConfig] = useState<AgentConfig>({
    agent_name: "Assistente",
    system_prompt: "Você é um assistente virtual prestativo e educado. Responda as perguntas dos clientes de forma clara e objetiva.",
    active: false,
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
  });
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await (supabase as any)
        .from("agent_config")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (data) {
        let triage = "";
        let service = data.system_prompt || "";
        let closing = "";

        if (service.startsWith("---STAGES---")) {
          try {
            const parts = service.split("---STAGES---")[1].split("---PART---");
            triage = parts[0] || "";
            service = parts[1] || "";
            closing = parts[2] || "";
          } catch (e) {
            console.error("Error parsing stages:", e);
          }
        }

        setConfig({
          id: data.id,
          agent_name: data.agent_name || "Assistente",
          system_prompt: data.system_prompt || "",
          prompt_triage: triage,
          prompt_service: service,
          prompt_closing: closing,
          active: data.active,
          provider: "anthropic",
          model: data.model || "claude-sonnet-4-5-20250929",
        });
      }

      const { data: knowledgeData } = await (supabase as any)
        .from("agent_knowledge")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });

      setKnowledge(knowledgeData || []);
    } catch (error) {
      console.error("Error loading agent config:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async (newConfig: Partial<AgentConfig>) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      let systemPrompt = newConfig.system_prompt ?? config.system_prompt;
      
      // If we are saving using the 3 stages
      if (newConfig.prompt_triage !== undefined || newConfig.prompt_service !== undefined || newConfig.prompt_closing !== undefined) {
        const t = newConfig.prompt_triage ?? config.prompt_triage ?? "";
        const s = newConfig.prompt_service ?? config.prompt_service ?? (newConfig.system_prompt ?? config.system_prompt);
        const c = newConfig.prompt_closing ?? config.prompt_closing ?? "";
        systemPrompt = `---STAGES---${t}---PART---${s}---PART---${c}`;
      }

      const payload = {
        user_id: session.user.id,
        agent_name: newConfig.agent_name ?? config.agent_name,
        system_prompt: systemPrompt,
        active: newConfig.active ?? config.active,
        provider: newConfig.provider ?? config.provider,
        model: newConfig.model ?? config.model,
      };

      if (config.id) {
        let { error } = await (supabase as any)
          .from("agent_config")
          .update(payload)
          .eq("id", config.id);

        if (error && (isMissingAgentConfigColumnError(error, 'model') || isMissingAgentConfigColumnError(error, 'provider'))) {
          const fallbackPayload = {
            user_id: session.user.id,
            agent_name: payload.agent_name,
            system_prompt: payload.system_prompt,
            active: payload.active,
          };

          const fallback = await (supabase as any)
            .from("agent_config")
            .update(fallbackPayload)
            .eq("id", config.id);

          error = fallback.error;
        }

        if (error) throw error;
      } else {
        let { data, error } = await (supabase as any)
          .from("agent_config")
          .insert(payload)
          .select()
          .single();

        if (error && (isMissingAgentConfigColumnError(error, 'model') || isMissingAgentConfigColumnError(error, 'provider'))) {
          const fallbackPayload = {
            user_id: session.user.id,
            agent_name: payload.agent_name,
            system_prompt: payload.system_prompt,
            active: payload.active,
          };

          const fallback = await (supabase as any)
            .from("agent_config")
            .insert(fallbackPayload)
            .select()
            .single();

          data = fallback.data;
          error = fallback.error;
        }

        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
      }

      setConfig(prev => ({ ...prev, ...newConfig }));
      toast({ title: "Configuração salva!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addFaq = async (question: string, answer: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data, error } = await (supabase as any)
        .from("agent_knowledge")
        .insert({ user_id: session.user.id, type: "faq", question, answer, active: true })
        .select()
        .single();

      if (error) throw error;
      setKnowledge(prev => [...prev, data]);
      toast({ title: "FAQ adicionado!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const addDocument = async (title: string, content: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data, error } = await (supabase as any)
        .from("agent_knowledge")
        .insert({ user_id: session.user.id, type: "document", title, content, active: true })
        .select()
        .single();

      if (error) throw error;
      setKnowledge(prev => [...prev, data]);
      toast({ title: "Documento adicionado!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const removeKnowledge = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("agent_knowledge")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setKnowledge(prev => prev.filter(k => k.id !== id));
      toast({ title: "Item removido!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return { config, knowledge, loading, saving, saveConfig, addFaq, addDocument, removeKnowledge, loadConfig };
}
