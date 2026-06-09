import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSelectedCampaignInstanceId } from "@/hooks/useZapi";
import type { MessageTemplate } from "./useMessageTemplates";

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  template_id?: string;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  target_audience: Record<string, any>;
  schedule_type: "immediate" | "scheduled" | "recurring";
  scheduled_at?: string;
  recurrence_pattern?: string;
  delay_seconds?: number;
  created_at: string;
  updated_at: string;
  template?: MessageTemplate;
}

export interface CampaignSend {
  id: string;
  campaign_id: string;
  phone: string;
  contact_name?: string;
  message_content: string;
  status: "pending" | "sent" | "delivered" | "failed" | "read";
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  clicked_at?: string;
  message_id?: string;
  error_message?: string;
  created_at: string;
}

const normalizeCampaignPhone = (phone?: string | null) => {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.toLowerCase().includes("@lid")) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, "");
};

const getCampaignSendPriority = (status?: string | null) => {
  if (status === "delivered") return 4;
  if (status === "sent") return 3;
  if (status === "pending") return 2;
  if (status === "failed") return 1;
  return 0;
};

const getFriendlyCampaignMessage = (
  message?: string | null,
  fallback = "Campanha pausada para que você possa retomá-la.",
) => {
  const raw = String(message || "").toLowerCase();
  if (raw.includes("disconnected") || raw.includes("desconect")) {
    return "A conexão caiu durante o envio. A campanha foi pausada e pode ser retomada de onde parou.";
  }
  if (raw.includes("temporary restriction") || raw.includes("error 463") || raw.includes("rate")) {
    return "A conta atingiu um limite temporário. A campanha foi pausada para proteger a conexão.";
  }
  return message || fallback;
};

export const useCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [lastRefetch, setLastRefetch] = useState(Date.now());

  const loadCampaigns = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);
        const { data, error } = await supabase
          .from("campaigns")
          .select(
            `
          *,
          template:message_templates(*)
        `,
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCampaigns(
          (data || []).map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description || undefined,
            template_id: item.template_id || undefined,
            status: (item.status as Campaign["status"]) || "draft",
            target_audience:
              typeof item.target_audience === "object" && item.target_audience !== null
                ? (item.target_audience as Record<string, any>)
                : {},
            schedule_type: (item.schedule_type as Campaign["schedule_type"]) || "immediate",
            scheduled_at: item.scheduled_at || undefined,
            recurrence_pattern: item.recurrence_pattern || undefined,
            delay_seconds: item.delay_seconds ?? undefined,
            created_at: item.created_at,
            updated_at: item.updated_at,
            template: item.template
              ? {
                  id: item.template.id,
                  name: item.template.name,
                  category: item.template.category,
                  content: item.template.content,
                  variables: Array.isArray(item.template.variables)
                    ? item.template.variables.filter((v) => typeof v === "string")
                    : [],
                  usage_count: item.template.usage_count || 0,
                  active: item.template.active || false,
                  created_at: item.template.created_at,
                  updated_at: item.template.updated_at,
                }
              : undefined,
          })),
        );
      } catch (error) {
        console.error("Error loading campaigns:", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar campanhas",
          variant: "destructive",
        });
      } finally {
        if (!isSilent) setLoading(false);
      }
      setLastRefetch(Date.now());
    },
    [toast],
  );

  const createCampaign = async (campaignData: {
    name: string;
    description?: string;
    template_id?: string;
    target_audience?: Record<string, any>;
    schedule_type?: "immediate" | "scheduled" | "recurring";
    scheduled_at?: string;
    recurrence_pattern?: string;
    delay_seconds?: number;
  }) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("campaigns" as any)
        .insert({
          user_id: user.id,
          name: campaignData.name,
          description: campaignData.description,
          template_id: campaignData.template_id,
          target_audience: campaignData.target_audience || {},
          schedule_type: campaignData.schedule_type || "immediate",
          scheduled_at: campaignData.scheduled_at,
          recurrence_pattern: campaignData.recurrence_pattern,
          delay_seconds: campaignData.delay_seconds || 2,
        })
        .select(
          `
          *,
          template:message_templates(*)
        `,
        )
        .single();

      if (error) throw error;

      setCampaigns((prev) => [
        {
          id: data.id,
          name: data.name,
          description: data.description || undefined,
          template_id: data.template_id || undefined,
          status: (data.status as Campaign["status"]) || "draft",
          target_audience:
            typeof data.target_audience === "object" && data.target_audience !== null
              ? (data.target_audience as Record<string, any>)
              : {},
          schedule_type: (data.schedule_type as Campaign["schedule_type"]) || "immediate",
          scheduled_at: data.scheduled_at || undefined,
          recurrence_pattern: data.recurrence_pattern || undefined,
          delay_seconds: data.delay_seconds ?? undefined,
          created_at: data.created_at,
          updated_at: data.updated_at,
          template: data.template
            ? {
                id: data.template.id,
                name: data.template.name,
                category: data.template.category,
                content: data.template.content,
                variables: Array.isArray(data.template.variables)
                  ? data.template.variables.filter((v) => typeof v === "string")
                  : [],
                usage_count: data.template.usage_count || 0,
                active: data.template.active || false,
                created_at: data.template.created_at,
                updated_at: data.template.updated_at,
              }
            : undefined,
        },
        ...prev,
      ]);

      toast({
        title: "Sucesso",
        description: "Campanha criada com sucesso",
      });

      return data;
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .update(updates)
        .eq("id", id)
        .select(
          `
          *,
          template:message_templates(*)
        `,
        )
        .single();

      if (error) throw error;

      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.id === id
            ? {
                id: data.id || campaign.id,
                name: data.name || campaign.name,
                description: data.description !== undefined ? data.description : campaign.description,
                template_id: data.template_id !== undefined ? data.template_id : campaign.template_id,
                status: (data.status as Campaign["status"]) || campaign.status,
                target_audience:
                  typeof data.target_audience === "object" && data.target_audience !== null
                    ? (data.target_audience as Record<string, any>)
                    : campaign.target_audience,
                schedule_type: (data.schedule_type as Campaign["schedule_type"]) || campaign.schedule_type,
                scheduled_at: data.scheduled_at !== undefined ? data.scheduled_at : campaign.scheduled_at,
                recurrence_pattern:
                  data.recurrence_pattern !== undefined ? data.recurrence_pattern : campaign.recurrence_pattern,
                delay_seconds: data.delay_seconds !== undefined ? data.delay_seconds : campaign.delay_seconds,
                created_at: data.created_at || campaign.created_at,
                updated_at: data.updated_at || campaign.updated_at,
                template: data.template
                  ? {
                      id: data.template.id,
                      name: data.template.name,
                      category: data.template.category,
                      content: data.template.content,
                      variables: Array.isArray(data.template.variables)
                        ? data.template.variables.filter((v) => typeof v === "string")
                        : [],
                      usage_count: data.template.usage_count || 0,
                      active: data.template.active || false,
                      created_at: data.template.created_at,
                      updated_at: data.template.updated_at,
                    }
                  : campaign.template,
              }
            : campaign,
        ),
      );

      toast({
        title: "Sucesso",
        description: "Campanha atualizada com sucesso",
      });

      return data;
    } catch (error) {
      console.error("Error updating campaign:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);

      if (error) throw error;

      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== id));
      toast({
        title: "Sucesso",
        description: "Campanha removida com sucesso",
      });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast({
        title: "Erro",
        description: "Erro ao remover campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const sendCampaign = async (
    campaignId: string,
    contacts: Array<{ phone: string; name?: string; variables?: Record<string, string> }>,
    instanceId?: string,
    forceSend?: boolean,
  ) => {
    try {
      let currentCampaign = campaigns.find((campaign) => campaign.id === campaignId);

      if (!currentCampaign) {
        console.log(`🔍 Campanha ${campaignId} não encontrada no estado local, buscando no banco...`);
        const { data: dbCampaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).maybeSingle();

        if (dbCampaign) {
          currentCampaign = {
            ...dbCampaign,
            target_audience:
              typeof dbCampaign.target_audience === "object" && dbCampaign.target_audience !== null
                ? (dbCampaign.target_audience as Record<string, any>)
                : {},
          } as any;
        }
      }

      const isRotation =
        instanceId === "__rotate_all__" || (typeof instanceId === "string" && instanceId.startsWith("rotate:"));
      const sendConfig = {
        instanceId: instanceId || null,
        rotateAll: isRotation,
      };

      const updatedTargetAudience = {
        ...(currentCampaign?.target_audience || {}),
        __sendConfig: sendConfig,
      };

      await updateCampaign(campaignId, {
        status: "active",
        target_audience: updatedTargetAudience,
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        await supabase.from("campaigns").update({ status: "draft" }).eq("id", campaignId);
        throw new Error("Usuário não autenticado");
      }

      console.log(
        `📤 Invoking send-campaign Edge Function for campaign ${campaignId} with ${contacts.length} contacts`,
      );

      const { data, error } = await supabase.functions.invoke("send-campaign", {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          campaignId,
          contacts,
          instanceId,
          forceSend,
        },
      });

      if (error) {
        console.error("❌ Edge Function send-campaign error:", error);
        let errorMessage = "Erro ao enviar campanha";
        try {
          if (error instanceof Object && "context" in error) {
            const ctx = (error as any).context;
            if (ctx?.body) {
              const bodyText = await new Response(ctx.body).text();
              const parsed = JSON.parse(bodyText);
              errorMessage = parsed?.error || parsed?.message || errorMessage;
            }
          }
        } catch {}

        const { count: sentCount } = await supabase
          .from("campaign_sends")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .in("status", ["sent", "delivered"]);

        if ((sentCount ?? 0) > 0) {
          await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
          setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "paused" } : c)));
          toast({
            title: "Campanha pausada",
            description: `${sentCount} mensagem(ns) já entregue(s). A campanha foi pausada para que você possa retomá-la.`,
          });
          return;
        }

        await supabase.from("campaigns").update({ status: "draft" }).eq("id", campaignId);
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "draft" } : c)));
        throw new Error(errorMessage);
      }

      if (data && typeof data === "object" && data.error) {
        console.error("❌ Edge Function returned error in response:", data.error);

        const { count: sentCount } = await supabase
          .from("campaign_sends")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .in("status", ["sent", "delivered"]);

        if ((sentCount ?? 0) > 0) {
          await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
          setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "paused" } : c)));
          toast({
            title: "Campanha pausada",
            description: `${sentCount} mensagem(ns) já entregue(s). A campanha foi pausada para que você possa retomá-la.`,
          });
          return;
        }

        await supabase.from("campaigns").update({ status: "draft" }).eq("id", campaignId);
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "draft" } : c)));
        throw new Error(data.error);
      }

      console.log("✅ send-campaign invoked successfully:", data);

      if (data && typeof data === "object" && "stopped" in data && data.stopped) {
        await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, status: "paused" } : c)));
        toast({
          title: "Campanha pausada",
          description: getFriendlyCampaignMessage(
            (data as { error?: string; message?: string }).message || (data as { error?: string }).error,
          ),
        });
        return data;
      }

      const batchResults =
        data && typeof data === "object" && Array.isArray((data as { results?: unknown[] }).results)
          ? (data as { results: Array<{ success?: boolean }> }).results
          : [];
      const acceptedCount = batchResults.filter((result) => result?.success).length;
      const failedCount = batchResults.filter((result) => result?.success === false).length;
      const hasRemaining = Boolean(
        data && typeof data === "object" && Number((data as { remaining?: number }).remaining || 0) > 0,
      );

      if (failedCount > 0) {
        toast({
          title: acceptedCount > 0 ? "Atenção" : "Erro",
          description:
            acceptedCount > 0
              ? `Campanha iniciada com ${acceptedCount} mensagem(ns) aguardando confirmação e ${failedCount} falha(s) neste lote`
              : "Nenhuma mensagem foi enviada neste lote",
          variant: acceptedCount > 0 ? undefined : "destructive",
        });
      } else {
        toast({
          title: "Campanha iniciada",
          description: hasRemaining
            ? `Campanha iniciada para ${contacts.length} contatos`
            : `${acceptedCount || contacts.length} contato(s) aguardando confirmação real do WhatsApp`,
        });
      }

      return data;
    } catch (error) {
      console.error("Error sending campaign:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getCampaignStats = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from("campaign_sends")
        .select("phone, status")
        .eq("campaign_id", campaignId);

      if (error) throw error;

      const campaign = campaigns.find((c) => c.id === campaignId);
      const totalContacts = campaign?.target_audience?.contacts?.length || 0;
      const latestByPhone = new Map<string, (typeof data)[number]>();
      data.forEach((send) => {
        const phoneKey = normalizeCampaignPhone(send.phone) || send.phone;
        const existing = latestByPhone.get(phoneKey);
        const nextPriority = getCampaignSendPriority(send.status);
        const currentPriority = getCampaignSendPriority(existing?.status);

        if (!existing || nextPriority >= currentPriority) {
          latestByPhone.set(phoneKey, send);
        }
      });

      const latestSends = Array.from(latestByPhone.values());
      const pendingCount = latestSends.filter((send) => send.status === "pending" || send.status === "sent").length;
      const processedCount = latestSends.filter((send) =>
        ["pending", "sent", "delivered", "failed"].includes(send.status || ""),
      ).length;
      const remaining = Math.max(0, totalContacts - processedCount);

      return {
        total: latestSends.length,
        totalContacts,
        remaining,
        pending: pendingCount,
        sent: latestSends.filter((send) => send.status === "delivered").length,
        delivered: latestSends.filter((send) => send.status === "delivered").length,
        failed: latestSends.filter((send) => send.status === "failed").length,
      };
    } catch (error) {
      console.error("Error getting campaign stats:", error);
      return {
        total: 0,
        totalContacts: 0,
        remaining: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
      };
    }
  };

  const pauseCampaign = async (id: string) => {
    const result = await updateCampaign(id, { status: "paused" });
    return result;
  };

  const resumeCampaign = async (id: string, overrideInstanceId?: string, forceSend?: boolean) => {
    try {
      const campaign = campaigns.find((c) => c.id === id);
      if (!campaign) throw new Error("Campaign not found");

      const storedSendConfig = campaign.target_audience?.__sendConfig;
      const resumeInstanceId =
        overrideInstanceId ||
        storedSendConfig?.instanceId ||
        (storedSendConfig?.rotateAll ? "__rotate_all__" : getSelectedCampaignInstanceId());

      console.log("=== RESUMING CAMPAIGN ===");
      console.log("Campaign ID:", id);

      const { data: allSends, error: sendsError } = await supabase
        .from("campaign_sends")
        .select("phone, status, contact_name")
        .eq("campaign_id", id);

      if (sendsError) throw sendsError;

      console.log("All sends in database:", allSends?.length);

      const latestByPhone = new Map<string, { phone: string; status: string | null; contact_name?: string | null }>();

      for (const send of allSends || []) {
        const phoneKey = normalizeCampaignPhone(send.phone) || send.phone;
        const existing = latestByPhone.get(phoneKey);
        const nextPriority = getCampaignSendPriority(send.status);
        const currentPriority = getCampaignSendPriority(existing?.status);

        if (!existing || nextPriority >= currentPriority) {
          latestByPhone.set(phoneKey, send);
        }
      }

      const successfulPhones = new Set<string>();
      const failedPhones: Array<{ phone: string; name?: string }> = [];
      const pendingRetryPhones: Array<{ phone: string; name?: string }> = [];
      const cancelledRetryPhones: Array<{ phone: string; name?: string }> = [];

      for (const [phoneKey, send] of latestByPhone.entries()) {
        if (send.status === "delivered") {
          successfulPhones.add(phoneKey);
        } else if (send.status === "pending" || send.status === "sent") {
          pendingRetryPhones.push({
            phone: send.phone,
            name: send.contact_name || undefined,
          });
        } else if (send.status === "failed") {
          failedPhones.push({
            phone: send.phone,
            name: send.contact_name || undefined,
          });
        } else if (
          send.status === "cancelled" ||
          send.status === "canceled" ||
          send.status === "error" ||
          send.status === "rejected"
        ) {
          cancelledRetryPhones.push({
            phone: send.phone,
            name: send.contact_name || undefined,
          });
        }
      }

      console.log("Successfully sent phones:", successfulPhones.size);
      console.log("Pending phones to retry:", pendingRetryPhones.length);
      console.log("Failed phones to retry:", failedPhones.length);
      console.log("Cancelled phones to retry:", cancelledRetryPhones.length);

      const targetContacts: Array<{ phone: string; name?: string }> = (campaign.target_audience?.contacts || []).map(
        (c: any) => ({
          phone: c.phone,
          name: c.name,
        }),
      );

      console.log("Total target contacts:", targetContacts.length);

      const allProcessedPhones = new Set(Array.from(latestByPhone.keys()));
      const neverProcessedContacts = targetContacts.filter(
        (c) => !allProcessedPhones.has(normalizeCampaignPhone(c.phone) || c.phone),
      );

      const remainingContactsMap = new Map<string, { phone: string; name?: string }>();

      [...failedPhones, ...pendingRetryPhones, ...cancelledRetryPhones, ...neverProcessedContacts].forEach(
        (contact) => {
          const phoneKey = normalizeCampaignPhone(contact.phone) || contact.phone;
          if (!phoneKey || (!forceSend && successfulPhones.has(phoneKey))) return;
          if (!remainingContactsMap.has(phoneKey)) {
            remainingContactsMap.set(phoneKey, contact);
          }
        },
      );

      const remainingContacts = Array.from(remainingContactsMap.values());

      console.log("Never processed:", neverProcessedContacts.length);
      console.log("Total remaining to send:", remainingContacts.length);
      console.log("=== END RESUME INFO ===");

      if (remainingContacts.length === 0) {
        toast({
          title: "Campanha Finalizada",
          description: "Todos os contatos já foram processados com sucesso. Verifique em Relatórios.",
          variant: "default",
        });
        await updateCampaign(id, { status: "completed" });
        return;
      }

      toast({
        title: "Retomando Campanha",
        description: `Enviando para ${remainingContacts.length} contato(s) restante(s)`,
      });

      // Atualiza status e config antes de invocar
      await updateCampaign(id, {
        status: "active",
        target_audience: {
          ...(campaign.target_audience || {}),
          __sendConfig: {
            instanceId: resumeInstanceId && resumeInstanceId !== "__rotate_all__" ? resumeInstanceId : null,
            rotateAll:
              resumeInstanceId === "__rotate_all__" ||
              (typeof resumeInstanceId === "string" && resumeInstanceId.startsWith("rotate:")),
          },
        },
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        await supabase.from("campaigns").update({ status: "paused" }).eq("id", id);
        throw new Error("Usuário não autenticado");
      }

      console.log(`📤 Invoking send-campaign for resume of campaign ${id}`);

      // ✅ CORREÇÃO BUG 2: invoca a edge function PRIMEIRO,
      // só limpa os registros antigos se a invocação for bem-sucedida.
      const { data, error } = await supabase.functions.invoke("send-campaign", {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          campaignId: id,
          contacts: remainingContacts,
          instanceId: resumeInstanceId,
          forceSend,
        },
      });

      if (error) {
        console.error("❌ Erro ao invocar edge function:", error);
        let errorMessage = "Erro ao retomar campanha";
        try {
          if (error instanceof Object && "context" in error) {
            const ctx = (error as any).context;
            if (ctx?.body) {
              const bodyText = await new Response(ctx.body).text();
              const parsed = JSON.parse(bodyText);
              errorMessage = parsed?.error || parsed?.message || errorMessage;
            }
          }
        } catch {}
        // Rollback para pausado — NÃO deletamos nada pois a invocação falhou
        await supabase.from("campaigns").update({ status: "paused" }).eq("id", id);
        setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "paused" } : c)));
        throw new Error(errorMessage);
      }

      if (data && typeof data === "object" && data.error) {
        console.error("❌ Edge Function returned error:", data.error);
        await supabase.from("campaigns").update({ status: "paused" }).eq("id", id);
        setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "paused" } : c)));
        throw new Error(data.error);
      }

      console.log("✅ Edge function invocada com sucesso:", data);

      // ✅ Só limpa os registros antigos DEPOIS de confirmar que a edge function aceitou
      if (pendingRetryPhones.length > 0) {
        const phonesToClean = pendingRetryPhones.map((c) => c.phone);
        const { error: cleanError } = await supabase
          .from("campaign_sends")
          .delete()
          .eq("campaign_id", id)
          .in("status", ["pending", "sent"])
          .in("phone", phonesToClean);
        if (cleanError) console.warn("⚠️ Falha ao limpar envios pendentes antigos:", cleanError.message);
      }

      if (cancelledRetryPhones.length > 0) {
        const phonesToClean = cancelledRetryPhones.map((c) => c.phone);
        const { error: cleanError } = await supabase
          .from("campaign_sends")
          .delete()
          .eq("campaign_id", id)
          .in("status", ["cancelled", "canceled", "error", "rejected"])
          .in("phone", phonesToClean);
        if (cleanError) console.warn("⚠️ Falha ao limpar cancelados antigos:", cleanError.message);
        else console.log(`🧹 Limpou ${phonesToClean.length} registros cancelados antigos para reenvio`);
      }

      return data;
    } catch (error) {
      console.error("Error resuming campaign:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao retomar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const cancelCampaign = async (id: string) => {
    const result = await updateCampaign(id, { status: "cancelled" });
    return result;
  };

  const duplicateCampaign = async (campaign: Campaign) => {
    try {
      const newCampaign = {
        name: `${campaign.name} (Cópia)`,
        description: campaign.description,
        template_id: campaign.template_id,
        target_audience: campaign.target_audience ? JSON.parse(JSON.stringify(campaign.target_audience)) : {},
        schedule_type: campaign.schedule_type || "immediate",
        scheduled_at: campaign.scheduled_at,
        recurrence_pattern: campaign.recurrence_pattern,
        delay_seconds: campaign.delay_seconds || 2,
      };

      return await createCampaign(newCampaign);
    } catch (error) {
      console.error("Error duplicating campaign:", error);
      toast({
        title: "Erro ao duplicar",
        description: error instanceof Error ? error.message : "Não foi possível duplicar a campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    loadCampaigns();

    const channelName = `campaigns-local-sync-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, (payload) => {
        const currentCampaignId = (window as any)._currentViewingCampaignId;
        if (payload.new && (payload.new as any).id === currentCampaignId) {
           console.log("🔄 Ignorando atualização automática para campanha em visualização ativa");
           return;
        }
        console.log("🔄 Mudança detectada na tabela campaigns:", payload.eventType);
        loadCampaigns(true);
      })
      .subscribe((status) => {
        console.log(`📡 Status da inscrição realtime (campaigns): ${status}`);
      });

    const handleFocus = () => {
      console.log("🪟 Janela focada, atualizando campanhas...");
      loadCampaigns(true);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadCampaigns]);

  return {
    campaigns,
    loading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    sendCampaign,
    getCampaignStats,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    duplicateCampaign,
    refetch: loadCampaigns,
  };
};
