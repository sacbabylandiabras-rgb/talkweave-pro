import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCampaigns, Campaign } from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { setZapiInstanceOverride, getSelectedCampaignInstanceId, setZapiRotateMode } from "@/hooks/useZapi";
import InstanceSelector from "@/components/envio/InstanceSelector";
import {
  Play,
  Pause,
  Trash2,
  Copy,
  Users,
  Calendar,
  FileText,
  BarChart3,
  Plus,
  XCircle,
  Edit,
  Send,
  CheckCircle,
  Clock as ClockIcon,
  RefreshCw,
  Filter,
  Download,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateCampaignDialog } from "@/components/campanhas/CreateCampaignDialog";
import { CreateGroupCampaignDialog } from "@/components/campanhas/CreateGroupCampaignDialog";
import { EditCampaignDialog } from "@/components/campanhas/EditCampaignDialog";
import { SendProgressDialog } from "@/components/campanhas/SendProgressDialog";
import { FilterNumbersDialog } from "@/components/campanhas/FilterNumbersDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useCampaignSendsRealtime } from "@/hooks/useCampaignRealtime";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampanhasProps {
  mode?: "contacts" | "groups";
}

type CampaignContactStatus = "entregue" | "enviado" | "enviando" | "pendente" | "cancelado";

interface ContactEntry {
  id: string;
  phone: string;
  name: string;
  status: CampaignContactStatus;
  sentAt: string | null;
  errorMessage: string | null;
  readAt: string | null;
  clickedAt: string | null;
}

interface LinkClick {
  id: string;
  created_at: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  user_agent: string | null;
  phone: string | null;
  btn_text: string | null;
}

// ─── Pure helpers (defined outside component — no closure issues) ─────────────

const formatErrorMessage = (msg: unknown): string | null => {
  if (!msg) return null;
  const strMsg = typeof msg === "string" ? msg : JSON.stringify(msg);
  const raw = strMsg.toLowerCase();
  if (raw.includes("shadow ban") || raw.includes("restrição") || raw.includes("shadowban"))
    return "⚠️ Shadowban detectado: Seu número está com restrições de envio pelo WhatsApp";
  if (strMsg === "NOT_FOUND" || raw.includes("user_not_found") || raw.includes("not on whatsapp"))
    return "Número não cadastrado no WhatsApp";
  if (raw.includes("disconnected") || raw.includes("desconectado") || strMsg.includes("Enqueue message is disabled"))
    return "Conexão interrompida (WhatsApp desconectado)";
  return strMsg;
};

const safeFormat = (date: unknown, formatStr: string, options?: object) => {
  if (!date) return "";
  const d = new Date(date as string);
  if (!isValid(d)) return "Data inválida";
  return format(d, formatStr, options);
};

const normalizePhoneKey = (phone?: string | null) => {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.toLowerCase().includes("@lid")) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, "");
};

const normalizeGroupDisplayPhone = (phone?: string | null) => {
  if (!phone) return "";
  if (phone.includes("-group@g.us")) return phone.replace(/-group@g\.us$/i, "@g.us");
  if (phone.endsWith("-group")) return phone.replace(/-group$/i, "@g.us");
  return phone;
};

const isCancelledSendStatus = (status?: string | null) =>
  ["failed", "cancelled", "canceled", "error", "rejected"].includes(status ?? "");

const getSendPriority = (status?: string | null, row?: { message_id?: string; sent_at?: string }) => {
  if (status === "delivered") return 5;
  if (status === "failed" || (row && !status)) return 4; // has error_message
  if (status === "sent") return 3;
  if (status === "pending" && (row?.message_id || row?.sent_at)) return 2.5;
  if (status === "pending") return 2;
  if (isCancelledSendStatus(status)) return 1;
  return 0;
};

// ─── Sub-component: shared InstanceSelector block ────────────────────────────
// FIX #9 — deduplicated from two identical copies in the dialogs

interface InstancePickerProps {
  instances: ReturnType<typeof useZapiInstances>["instances"];
  onSelect: (instanceId: string) => void;
}

const InstancePicker = ({ instances, onSelect }: InstancePickerProps) => (
  <InstanceSelector
    providerFilter="all"
    allowMultiple={true}
    useSavedSelection={false}
    onMultiInstanceChange={(ids) => {
      if (ids.length > 1) {
        const selected = instances.filter((i) => ids.includes(i.id));
        setZapiRotateMode(selected);
        onSelect(`rotate:${ids.join(",")}`);
      } else if (ids.length === 1) {
        const inst = instances.find((i) => i.id === ids[0]);
        if (inst) {
          setZapiInstanceOverride(inst);
          onSelect(ids[0]);
        }
      }
    }}
  />
);

// ─── Sub-component: Campaign Progress ──────────────────────────────────────
const CampaignProgress = ({ campaignId, totalTarget }: { campaignId: string, totalTarget: number }) => {
  const { sends, loading } = useCampaignSendsRealtime(campaignId);
  
  const stats = useMemo(() => {
    if (loading) return null;
    const read = sends.filter(s => (s.status as string) === 'read' || Boolean(s.read_at)).length;
    const delivered = sends.filter(s => (s.status as string) === 'delivered' || Boolean(s.delivered_at) || (s.status as string) === 'read').length;
    const sent = sends.filter(s => ((s.status as string) === 'sent' || Boolean(s.sent_at)) && (!s.delivered_at && (s.status as string) !== 'delivered' && (s.status as string) !== 'read')).length;
    const failed = sends.filter(s => ((s.status as string) === 'failed' || Boolean(s.error_message)) && (!s.delivered_at && (s.status as string) !== 'delivered' && (s.status as string) !== 'read')).length;
    const processing = sends.filter(s => (s.status as string) === 'pending' && (Boolean(s.message_id) || Boolean(s.sent_at)) && (!s.delivered_at && (s.status as string) !== 'delivered' && (s.status as string) !== 'read')).length;
    
    const processed = delivered + sent + failed + processing;
    const total = Math.max(totalTarget, sends.length);
    const progress = total > 0 ? (processed / total) * 100 : 0;
    
    return { delivered, sent, failed, processed, total, progress, read };
  }, [sends, loading, totalTarget]);

  if (loading || !stats || stats.total === 0) return null;

  return (
    <div className="space-y-1 mt-2">
      <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
        <span>Progresso: {stats.processed}/{stats.total}</span>
        <span className="flex gap-2">
          <span className="text-indigo-600" title="Lidas">👀 {stats.read}</span>
          <span className="text-green-600" title="Entregues">✓✓ {stats.delivered}</span>
          <span className="text-blue-600" title="Enviadas">✓ {stats.sent}</span>
          {stats.failed > 0 && <span className="text-red-600" title="Canceladas">✗ {stats.failed}</span>}
        </span>
      </div>
      <Progress value={stats.progress} className="h-1" />
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const Campanhas = ({ mode = "contacts" }: CampanhasProps) => {
  const isGroupsMode = mode === "groups";
  const navigate = useNavigate();
  const {
    campaigns,
    loading,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    deleteCampaign,
    duplicateCampaign,
    sendCampaign,
    refetch: refetchCampaigns,
  } = useCampaigns();

  const { toast } = useToast();
  const { instances, activeInstance } = useZapiInstances({ provider: "zapi" });

  // ── Dialog states ──────────────────────────────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [campaignToCancel, setCampaignToCancel] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [campaignToResume, setCampaignToResume] = useState<string | null>(null);
  const [forceSendOnResume, setForceSendOnResume] = useState(false);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<Campaign | null>(null);
  const [sendDialogRemoveDuplicates, setSendDialogRemoveDuplicates] = useState(true);

  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [totalContactsCount, setTotalContactsCount] = useState(0);

  // FIX #8 — single source of truth for selected instance across both dialogs
  const [dialogInstanceId, setDialogInstanceId] = useState<string | null>(null);

  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [removeDuplicatesGlobal, setRemoveDuplicatesGlobal] = useState(true);

  // ── Stats dialog ───────────────────────────────────────────────────────────
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogCampaignId, setStatsDialogCampaignId] = useState<string | null>(null);
  const [statsDialogCampaignName, setStatsDialogCampaignName] = useState("");
  const [statsDialogHasUrlButton, setStatsDialogHasUrlButton] = useState(false);
  const [statsDialogClickMap, setStatsDialogClickMap] = useState<Map<string, string>>(new Map());
  const [statsDialogTargetContacts, setStatsDialogTargetContacts] = useState<Array<{ phone: string; name?: string }>>(
    [],
  );
  const [statsDialogLinkClicks, setStatsDialogLinkClicks] = useState<LinkClick[]>([]);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const [removedDuplicates, setRemovedDuplicates] = useState<string[]>([]);

  // FIX #5 — safe destructuring with fallback
  const statsDialogSendsRaw = useCampaignSendsRealtime(statsDialogOpen ? statsDialogCampaignId : null);
  const statsDialogSends = statsDialogSendsRaw?.sends ?? [];
  const statsDialogLoading = statsDialogSendsRaw?.loading ?? false;

  // ── Active session tracking ────────────────────────────────────────────────
  const [sessionActiveIds, setSessionActiveIds] = useState<Set<string>>(new Set());
  // FIX #3 — use a ref to avoid stale closure in campaignStatusKey effect
  const sessionActiveIdsRef = useRef(sessionActiveIds);
  sessionActiveIdsRef.current = sessionActiveIds;

  const campaignStatusKey = campaigns.map((c) => `${c.id}-${c.status}`).join(",");

  useEffect(() => {
    const currentActiveIds = campaigns.filter((c) => c.status === "active").map((c) => c.id);
    setSessionActiveIds((prev) => {
      const next = new Set(prev);
      currentActiveIds.forEach((id) => next.add(id));
      return next;
    });

    campaigns.forEach((c) => {
      if (sessionActiveIdsRef.current.has(c.id) && c.status === "completed") {
        toast({
          title: "✅ Campanha Concluída",
          description: `"${c.name}" terminou de enviar. Disponível em Relatórios.`,
        });
        setSessionActiveIds((prev) => {
          const next = new Set(prev);
          next.delete(c.id);
          return next;
        });
      }
    });
  }, [campaignStatusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Instance override on mount/unmount ────────────────────────────────────
  useEffect(() => {
    if (activeInstance) setZapiInstanceOverride(activeInstance);
  }, [activeInstance]);

  useEffect(() => () => setZapiInstanceOverride(null), []);

  // ── Stats dialog effects ───────────────────────────────────────────────────

  // Reset click map when dialog closes
  useEffect(() => {
    if (!statsDialogOpen) {
      setStatsDialogClickMap(new Map());
      setStatsDialogLinkClicks([]);
      setStatsDialogTargetContacts([]);
      setStatsDialogHasUrlButton(false);
    }
  }, [statsDialogOpen]);

  // Fetch template buttons
  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId) return;
    let active = true;
    (async () => {
      const { data: campaignRow } = await supabase
        .from("campaigns")
        .select("template_id")
        .eq("id", statsDialogCampaignId)
        .maybeSingle();
      if (!active || !campaignRow?.template_id) return;
      const { data: tpl } = await supabase
        .from("message_templates")
        .select("buttons")
        .eq("id", campaignRow.template_id)
        .maybeSingle();
      if (!active) return;
      const buttons = Array.isArray((tpl as any)?.buttons) ? (tpl as any).buttons : [];
      setStatsDialogHasUrlButton(
        buttons.some((b: any) => {
          const type = String(b?.type ?? "").toUpperCase();
          return type === "URL" || Boolean(b?.url || b?.value);
        }),
      );
    })();
    return () => {
      active = false;
    };
  }, [statsDialogOpen, statsDialogCampaignId]);

  // Fetch target contacts
  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("target_audience")
        .eq("id", statsDialogCampaignId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Erro ao carregar audiência:", error);
        return;
      }
      const rawContacts = (data?.target_audience as any)?.contacts;
      setStatsDialogTargetContacts(
        Array.isArray(rawContacts)
          ? rawContacts
              .map((c: any) => ({ phone: String(c?.phone ?? "").trim(), name: c?.name ? String(c.name) : undefined }))
              .filter((c) => Boolean(c.phone))
          : [],
      );
    })();
    return () => {
      active = false;
    };
  }, [statsDialogOpen, statsDialogCampaignId]);

  // Fetch click map
  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId || !statsDialogCampaignName) return;
    let active = true;
    (async () => {
      const campaign = campaigns.find((c) => c.id === statsDialogCampaignId);
      const campaignStartedAt = campaign?.created_at;

      let query = supabase
        .from("message_logs")
        .select("phone, created_at")
        .eq("response_sent", `[Fluxo: ${statsDialogCampaignName}]`)
        .ilike("message_received", "[URL Click]%")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (campaignStartedAt) query = query.gte("created_at", campaignStartedAt);

      const { data, error } = await query;
      if (error) {
        console.error("Erro ao carregar cliques:", error);
      }
      if (!active) return;

      const nextMap = new Map<string, string>();
      (data ?? []).forEach((row: any) => {
        const key = normalizePhoneKey(row.phone);
        if (key && !nextMap.has(key)) nextMap.set(key, row.created_at);
      });

      // Merge link_clicks table
      const { data: linkRows } = await supabase
        .from("link_clicks" as any)
        .select("phone, created_at")
        .eq("campaign_id", statsDialogCampaignId)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (!active) return;
      (linkRows ?? []).forEach((row: any) => {
        const key = normalizePhoneKey(row.phone);
        if (key && !nextMap.has(key)) nextMap.set(key, row.created_at);
      });

      setStatsDialogClickMap(nextMap);
    })();
    return () => {
      active = false;
    };
  }, [statsDialogOpen, statsDialogCampaignId, statsDialogCampaignName, campaigns]);

  // FIX #1 — link_clicks realtime subscription: channel is always cleaned up
  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId) return;

    let active = true;
    (async () => {
      const { data } = await supabase
        .from("link_clicks" as any)
        .select("id, created_at, ip, country, city, region, user_agent, phone, btn_text")
        .eq("campaign_id", statsDialogCampaignId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (active) setStatsDialogLinkClicks((data ?? []) as unknown as LinkClick[]);
    })();

    // FIX #1: channel always gets a cleanup regardless of whether statsDialogOpen changes
    const channelName = `campaign-link-clicks-${statsDialogCampaignId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "link_clicks", filter: `campaign_id=eq.${statsDialogCampaignId}` },
        (payload) => {
          const row = payload.new as LinkClick & { phone?: string };
          setStatsDialogLinkClicks((prev) => [row, ...prev].slice(0, 500));
          const key = normalizePhoneKey(row.phone);
          if (key) {
            setStatsDialogClickMap((prev) => {
              if (prev.has(key)) return prev;
              const next = new Map(prev);
              next.set(key, row.created_at);
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [statsDialogOpen, statsDialogCampaignId]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const contactCampaigns = useMemo(() => {
    return isGroupsMode
      ? campaigns.filter((c) => {
          const a = c.target_audience ?? {};
          return a.type === "groups" || (a.groupIds && Array.isArray(a.groupIds));
        })
      : campaigns.filter((c) => {
          const a = c.target_audience ?? {};
          return a.type !== "groups" && !(a.groupIds && Array.isArray(a.groupIds));
        });
  }, [campaigns, isGroupsMode]);

  // FIX #4 — moved out of JSX IIFE into useMemo so it doesn't re-run on every render
  const statsData = useMemo(() => {
    if (!statsDialogOpen || !statsDialogCampaignId) return null;

    const campaign = campaigns.find((c) => c.id === statsDialogCampaignId);
    const targetContacts: Array<{ phone: string; name?: string }> =
      statsDialogTargetContacts.length > 0 ? statsDialogTargetContacts : (campaign?.target_audience?.contacts ?? []);

    const campaignCancelled = campaign?.status === "cancelled";
    const canTreatPendingAsCancelled = campaignCancelled && !showProgressDialog;

    const getSendTimestamp = (send: (typeof statsDialogSends)[number]) =>
      send?.delivered_at || send?.sent_at || send?.created_at || "";

    // Deduplicate sends: keep the one with highest priority
    const sendsByPhone = new Map<string, (typeof statsDialogSends)[0]>();
    for (const send of statsDialogSends) {
      if (!send) continue;
      const key = normalizePhoneKey(send.phone);
      const existing = sendsByPhone.get(key);
      const p = getSendPriority(send.status, send as any);
      const ep = getSendPriority(existing?.status, existing as any);
      if (!existing || p > ep || (p === ep && getSendTimestamp(send) > getSendTimestamp(existing))) {
        sendsByPhone.set(key, send);
      }
    }

    const targetPhoneKeys = new Set(targetContacts.map((c) => normalizePhoneKey(c.phone)).filter(Boolean));

    const toStatus = (
      send: (typeof statsDialogSends)[0] | undefined,
      canCancelPending: boolean,
    ): CampaignContactStatus => {
      if (!send) return "pendente";
      if (send.status === "delivered") return "entregue";
      if (send.status === "sent" || (send.status === "pending" && Boolean((send as any).message_id || send.sent_at)))
        return "enviado";
      if (send.status === "failed" || (send as any).error_message) return "cancelado";
      if (send.status === "pending") return canCancelPending ? "cancelado" : "pendente";
      if (isCancelledSendStatus(send.status)) return "cancelado";
      return "pendente";
    };

    const fullContactList: ContactEntry[] = targetContacts.map((contact, index) => {
      const key = normalizePhoneKey(contact.phone);
      const send = sendsByPhone.get(key);
      const status = toStatus(send, canTreatPendingAsCancelled);
      return {
        id: send?.id ?? `target-${index}`,
        phone: normalizeGroupDisplayPhone(contact.phone) || normalizeGroupDisplayPhone(send?.phone),
        name: send?.contact_name || contact.name || "",
        status,
        sentAt: send?.sent_at || null,
        errorMessage: (send as any)?.error_message || null,
        readAt: (send as any)?.read_at || null,
        clickedAt: statsDialogClickMap.get(key) || (send as any)?.clicked_at || null,
      };
    });

    // Append sends not in target list
    for (const send of statsDialogSends) {
      if (!send) continue;
      const key = normalizePhoneKey(send.phone);
      if (!targetPhoneKeys.has(key)) {
        const status = toStatus(send, canTreatPendingAsCancelled);
        fullContactList.push({
          id: send.id,
          phone: normalizeGroupDisplayPhone(send.phone),
          name: send.contact_name || "",
          status,
          sentAt: send.sent_at || null,
          errorMessage: (send as any)?.error_message || null,
          readAt: (send as any)?.read_at || null,
          clickedAt: statsDialogClickMap.get(key) || (send as any)?.clicked_at || null,
        });
      }
    }

    const deliveredCount = fullContactList.filter((c) => c.status === "entregue").length;
    const sentCount = fullContactList.filter((c) => c.status === "enviado" || c.status === "entregue").length;
    const pendingCount = fullContactList.filter((c) => c.status === "pendente").length;
    const cancelledCount = fullContactList.filter((c) => c.status === "cancelado").length;
    const totalCount = fullContactList.length;
    const readCount = fullContactList.filter((c) => c.readAt).length;
    const identifiedClickCount = fullContactList.filter((c) => c.clickedAt).length;
    const clickedCount = Math.max(identifiedClickCount, statsDialogLinkClicks.length);
    const isLive = pendingCount > 0 && campaign?.status === "active";

    return {
      fullContactList,
      deliveredCount,
      sentCount,
      pendingCount,
      cancelledCount,
      totalCount,
      readCount,
      clickedCount,
      isLive,
    };
  }, [
    statsDialogOpen,
    statsDialogCampaignId,
    campaigns,
    statsDialogTargetContacts,
    statsDialogSends,
    statsDialogClickMap,
    statsDialogLinkClicks,
    showProgressDialog,
  ]);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const openStatsDialog = useCallback((campaignId: string, campaignName: string) => {
    setStatsDialogCampaignId(campaignId);
    setStatsDialogCampaignName(campaignName);
    setStatsDialogOpen(true);
  }, []);

  const handlePauseCampaign = useCallback((id: string) => pauseCampaign(id), [pauseCampaign]);

  const handleResumeCampaign = useCallback((id: string) => {
    setDialogInstanceId(null); // FIX #8 — always reset to null, not undefined
    setCampaignToResume(id);
    setForceSendOnResume(false);
    setResumeDialogOpen(true);
  }, []);

  const confirmResumeCampaign = useCallback(async () => {
    if (!campaignToResume) return;
    setResumeDialogOpen(false);

    // FIX #8 — safe fallback with explicit null check
    const selectedInstanceId = dialogInstanceId ?? getSelectedCampaignInstanceId() ?? undefined;

    const campaign = campaigns.find((c) => c.id === campaignToResume);
    setTotalContactsCount(campaign?.target_audience?.contacts?.length ?? 0);
    setSendingCampaignId(campaignToResume);

    try {
      const resumePromise = resumeCampaign(campaignToResume, selectedInstanceId, forceSendOnResume);
      await new Promise((r) => setTimeout(r, 500));
      setShowProgressDialog(true);
      await resumePromise;
    } catch (error) {
      console.error("Error resuming campaign:", error);
      setShowProgressDialog(false);
    }
    setCampaignToResume(null);
  }, [campaignToResume, dialogInstanceId, campaigns, resumeCampaign, forceSendOnResume]);

  const handleDeleteCampaign = useCallback((id: string) => {
    setCampaignToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteCampaign = useCallback(async () => {
    if (!campaignToDelete) return;
    await deleteCampaign(campaignToDelete);
    setDeleteDialogOpen(false);
    setCampaignToDelete(null);
  }, [campaignToDelete, deleteCampaign]);

  const handleDuplicateCampaign = useCallback((campaign: Campaign) => duplicateCampaign(campaign), [duplicateCampaign]);

  const handleForceStopQueue = useCallback(
    async (campaignId: string) => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
          return;
        }
        await supabase.functions.invoke("clear-zapi-queue", {
          headers: { Authorization: `Bearer ${token}` },
          body: { clearAllActive: true },
        });
        toast({ title: "Fila limpa", description: "Filas de todas as instâncias foram limpas com sucesso." });
      } catch (error) {
        console.error("Error clearing queue:", error);
        toast({ title: "Erro", description: "Erro ao limpar fila de envio", variant: "destructive" });
      }
    },
    [toast],
  );

  const handleCancelCampaign = useCallback(async () => {
    if (!campaignToCancel) return;
    await cancelCampaign(campaignToCancel);
    setCancelDialogOpen(false);
    setCampaignToCancel(null);
  }, [campaignToCancel, cancelCampaign]);

  const openCancelDialog = useCallback((id: string) => {
    setCampaignToCancel(id);
    setCancelDialogOpen(true);
  }, []);

  const handleEditCampaign = useCallback((campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowEditDialog(true);
  }, []);

  const handleSendCampaign = useCallback(
    (campaign: Campaign) => {
      if (!campaign.target_audience?.contacts?.length) {
        toast({ title: "Erro", description: "Esta campanha não possui contatos configurados", variant: "destructive" });
        return;
      }
      setDialogInstanceId(null);
      setCampaignToSend(campaign);
      setSendDialogOpen(true);
    },
    [toast],
  );

  const confirmSendCampaign = useCallback(async () => {
    if (!campaignToSend) return;
    const campaign = campaignToSend;
    setSendDialogOpen(false);
    setCampaignToSend(null);

    const selectedInstanceId = dialogInstanceId ?? getSelectedCampaignInstanceId() ?? undefined;

    let contactsToSend = campaign.target_audience?.contacts ?? [];
    if (sendDialogRemoveDuplicates) {
      const seen = new Set<string>();
      const before = contactsToSend.length;
      contactsToSend = contactsToSend.filter((c: any) => {
        const phone = String(c?.phone ?? "");
        const key = phone.toLowerCase().includes("@lid") 
          ? phone.toLowerCase() 
          : phone.replace(/\D/g, "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const removed = before - contactsToSend.length;
      if (removed > 0)
        toast({ title: "Duplicados removidos", description: `${removed} número(s) duplicado(s) foram ignorados.` });
    }

    setTotalContactsCount(contactsToSend.length);
    setSendingCampaignId(campaign.id);
    setShowProgressDialog(true);

    try {
      await sendCampaign(campaign.id, contactsToSend, selectedInstanceId);
    } catch (error) {
      console.error("Error sending campaign:", error);
      setShowProgressDialog(false);
      setSendingCampaignId(null);
    }
  }, [campaignToSend, dialogInstanceId, sendDialogRemoveDuplicates, sendCampaign, toast]);

  // FIX #7 — moved out of JSX IIFE into a useCallback
  const handleRetryCancelled = useCallback(async () => {
    if (!statsData || !statsDialogCampaignId) return;
    const cancelledContacts = statsData.fullContactList
      .filter((c) => c.status === "cancelado")
      .map((c) => ({ phone: c.phone, name: c.name || undefined }));
    if (!cancelledContacts.length) return;

    setStatsDialogOpen(false);
    setStatsDialogCampaignId(null);
    setTotalContactsCount(cancelledContacts.length);
    setSendingCampaignId(statsDialogCampaignId);
    setShowProgressDialog(true);

    try {
      await sendCampaign(statsDialogCampaignId, cancelledContacts, getSelectedCampaignInstanceId() ?? undefined);
    } catch (error) {
      console.error("Error retrying cancelled contacts:", error);
      toast({ title: "Erro", description: "Erro ao reenviar para contatos cancelados", variant: "destructive" });
      setShowProgressDialog(false);
      setSendingCampaignId(null);
    }
  }, [statsData, statsDialogCampaignId, sendCampaign, toast]);

  // FIX #7 — moved out of JSX IIFE into a useCallback
  const handleRemoveDuplicates = useCallback(async () => {
    if (!statsDialogCampaignId || removingDuplicates) return;
    setRemovingDuplicates(true);
    setRemovedDuplicates([]);
    try {
      const { data: row } = await supabase
        .from("campaigns")
        .select("target_audience")
        .eq("id", statsDialogCampaignId)
        .maybeSingle();
      const ta: any = row?.target_audience ?? {};
      const contacts: Array<{ phone: string; name?: string }> = Array.isArray(ta?.contacts) ? ta.contacts : [];
      const seen = new Set<string>();
      const unique: typeof contacts = [];
      const removed: string[] = [];

      for (const c of contacts) {
        const phone = String(c?.phone ?? "");
        const key = phone.toLowerCase().includes("@lid") 
          ? phone.toLowerCase() 
          : phone.replace(/\D/g, "");
        if (!key) {
          unique.push(c);
          continue;
        }
        if (seen.has(key)) {
          removed.push(c.phone);
          setRemovedDuplicates((prev) => [...prev, c.phone]);
          await new Promise((r) => setTimeout(r, 15));
        } else {
          seen.add(key);
          unique.push(c);
        }
      }

      if (removed.length === 0) {
        toast({ title: "Sem duplicados", description: "Nenhum número duplicado foi encontrado." });
      } else {
        const { error } = await supabase
          .from("campaigns")
          .update({ target_audience: { ...ta, contacts: unique } })
          .eq("id", statsDialogCampaignId);
        if (error) throw error;
        setStatsDialogTargetContacts(unique);
        await refetchCampaigns();
        toast({ title: "Duplicados removidos", description: `${removed.length} número(s) duplicado(s) removido(s).` });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha ao remover duplicados", variant: "destructive" });
    } finally {
      setRemovingDuplicates(false);
    }
  }, [statsDialogCampaignId, removingDuplicates, refetchCampaigns, toast]);

  const handleExportCsv = useCallback(() => {
    if (!statsData) return;
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = [
      "Nome",
      "Telefone",
      "Status",
      "Lida",
      ...(statsDialogHasUrlButton ? ["Clique no link"] : []),
      "Data",
      "Erro",
    ];
    const rows = statsData.fullContactList.map((c) => [
      c.name,
      c.phone,
      c.status,
      c.readAt ? "Sim" : "Não",
      ...(statsDialogHasUrlButton ? [c.clickedAt ? "Sim" : "Não"] : []),
      c.sentAt ? safeFormat(c.sentAt, "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "",
      c.errorMessage ?? "",
    ]);
    const branding = [
      ["ZapLynx - Relatório de Campanha"],
      ["Campanha", statsDialogCampaignName],
      ["Gerado em", safeFormat(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })],
      [],
    ];
    const csv = "\uFEFF" + [...branding, headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (statsDialogCampaignName || "campanha").replace(/[^a-z0-9-_]+/gi, "_");
    a.href = url;
    a.download = `zaplynx_relatorio_${safeName}_${safeFormat(new Date(), "yyyyMMdd_HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [statsData, statsDialogHasUrlButton, statsDialogCampaignName]);

  // ── Badge helpers ──────────────────────────────────────────────────────────

  const getStatusBadge = (status: string, campaign?: Campaign) => {
    if (status === "draft" && campaign?.schedule_type === "scheduled" && campaign?.scheduled_at) {
      return (
        <Badge className="bg-purple-500 text-white">
          <ClockIcon className="w-3 h-3 mr-1" />
          Agendada
        </Badge>
      );
    }
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativa</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500">Pausada</Badge>;
      case "completed":
        return <Badge className="bg-blue-500">Concluída</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500">Cancelada</Badge>;
      case "draft":
        return <Badge variant="outline">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando campanhas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{isGroupsMode ? "Campanhas em Grupo" : "Campanhas"}</h1>
        <div className="flex items-center gap-2">
          {campaigns.length > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setDeleteAllDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" />
              Apagar todas
            </Button>
          )}
          <div className="flex items-center bg-accent/30 rounded-lg border border-border/50 px-2 py-1 mr-2">
            <label htmlFor="remove-duplicates-global" className="flex items-center gap-2 cursor-pointer">
              <div className="flex flex-col items-end mr-1">
                <span className="text-[10px] font-semibold text-foreground leading-none">Remover</span>
                <span className="text-[9px] text-muted-foreground leading-none">Duplicados</span>
              </div>
              <input
                id="remove-duplicates-global"
                type="checkbox"
                className="w-3.5 h-3.5 accent-primary cursor-pointer"
                checked={removeDuplicatesGlobal}
                onChange={(e) => setRemoveDuplicatesGlobal(e.target.checked)}
              />
            </label>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowFilterDialog(true)}>
            <Filter className="w-4 h-4 mr-1" />
            Filtrar Números
          </Button>
          <Button
            size="sm"
            onClick={() => (isGroupsMode ? navigate("/campanhas-grupo/nova") : setShowCreateDialog(true))}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova
          </Button>
        </div>
      </div>

      <FilterNumbersDialog
        open={showFilterDialog}
        onOpenChange={setShowFilterDialog}
        removeDuplicates={removeDuplicatesGlobal}
        onRemoveDuplicatesChange={setRemoveDuplicatesGlobal}
      />

      {/* Delete all dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todas as campanhas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as {campaigns.length} campanhas e seus envios serão removidos
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingAll}
              onClick={async (e) => {
                e.preventDefault();
                setDeletingAll(true);
                try {
                  for (const c of campaigns) await deleteCampaign(c.id);
                  toast({ title: "Campanhas apagadas", description: "Todas as campanhas foram removidas." });
                  setDeleteAllDialogOpen(false);
                  refetchCampaigns();
                } catch (err) {
                  toast({
                    title: "Erro ao apagar",
                    description: err instanceof Error ? err.message : "Tente novamente.",
                    variant: "destructive",
                  });
                } finally {
                  setDeletingAll(false);
                }
              }}
            >
              {deletingAll ? "Apagando..." : "Apagar todas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create dialogs */}
      {isGroupsMode ? (
        <CreateGroupCampaignDialog
          open={showCreateDialog}
          onOpenChange={(o) => {
            setShowCreateDialog(o);
            if (!o) refetchCampaigns();
          }}
        />
      ) : (
        <CreateCampaignDialog
          open={showCreateDialog}
          onOpenChange={(o) => {
            setShowCreateDialog(o);
            if (!o) refetchCampaigns();
          }}
        />
      )}

      <EditCampaignDialog open={showEditDialog} onOpenChange={setShowEditDialog} campaign={editingCampaign} />

      <SendProgressDialog
        open={showProgressDialog}
        onOpenChange={(open) => {
          setShowProgressDialog(open);
          if (!open) {
            setSendingCampaignId(null);
            setTotalContactsCount(0);
          }
        }}
        campaignId={sendingCampaignId}
        totalContacts={totalContactsCount}
        onPause={() => {
          if (sendingCampaignId) console.log("🛑 Pause triggered");
        }}
      />

      {/* Campaign cards */}
      <div className="grid gap-4">
        {contactCampaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {isGroupsMode ? "Nenhuma campanha em grupo." : "Nenhuma campanha de contatos."} Crie uma nova!
              </p>
              <Button onClick={() => (isGroupsMode ? navigate("/campanhas-grupo/nova") : setShowCreateDialog(true))}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Campanha
              </Button>
            </CardContent>
          </Card>
        ) : (
          contactCampaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {getStatusBadge(campaign.status, campaign)}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {campaign.schedule_type === "scheduled" && campaign.scheduled_at
                            ? `Agendada: ${safeFormat(campaign.scheduled_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                            : safeFormat(campaign.created_at, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(campaign.status === "draft" || campaign.status === "paused") && (
                      <Button variant="outline" size="sm" onClick={() => handleEditCampaign(campaign)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                    )}
                    {campaign.status === "draft" && (
                      <Button variant="default" size="sm" onClick={() => handleSendCampaign(campaign)}>
                        <Send className="w-4 h-4 mr-1" />
                        Enviar
                      </Button>
                    )}
                    {campaign.status === "active" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handlePauseCampaign(campaign.id)}>
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCancelDialog(campaign.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </>
                    )}
                    {campaign.status === "paused" && (
                      <>
                        <Button variant="default" size="sm" onClick={() => handleResumeCampaign(campaign.id)}>
                          <Play className="w-4 h-4 mr-1" />
                          Retomar de onde parou
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCancelDialog(campaign.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </>
                    )}
                    {campaign.status === "cancelled" && (
                      <>
                        <Button variant="default" size="sm" onClick={() => handleResumeCampaign(campaign.id)}>
                          <Play className="w-4 h-4 mr-1" />
                          Continuar Envio
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDuplicateCampaign(campaign)}>
                          <Copy className="w-4 h-4 mr-1" />
                          Duplicar
                        </Button>
                      </>
                    )}
                    {campaign.status === "completed" && (
                      <>
                        <Button variant="default" size="sm" onClick={() => handleResumeCampaign(campaign.id)}>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Retomar de onde parou
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleForceStopQueue(campaign.id)}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Forçar Parada
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDuplicateCampaign(campaign)}>
                          <Copy className="w-4 h-4 mr-1" />
                          Duplicar
                        </Button>
                      </>
                    )}
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteCampaign(campaign.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaign.description && <p className="text-sm text-muted-foreground">{campaign.description}</p>}
                {campaign.template && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Modelo: {campaign.template.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{campaign.template.content}</p>
                  </div>
                )}
                
                <CampaignProgress 
                  campaignId={campaign.id} 
                  totalTarget={
                    Array.isArray(campaign.target_audience?.contacts) 
                      ? campaign.target_audience.contacts.length 
                      : 0
                  } 
                />

                <Button variant="secondary" size="sm" onClick={() => openStatsDialog(campaign.id, campaign.name)} className="w-full mt-2">
                  <BarChart3 className="w-4 h-4 mr-1" />
                  Ver Detalhes
                </Button>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>
                    Tipo:{" "}
                    {campaign.schedule_type === "immediate"
                      ? "Imediato"
                      : campaign.schedule_type === "scheduled"
                        ? "Agendado"
                        : "Recorrente"}
                  </span>
                  {campaign.scheduled_at && (
                    <>
                      <span>•</span>
                      <span>
                        Agendado para: {safeFormat(campaign.scheduled_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Cancel dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta campanha? Os envios já realizados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelCampaign} className="bg-red-600 hover:bg-red-700">
              Sim, Cancelar Campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCampaign} className="bg-destructive hover:bg-destructive/90">
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume dialog */}
      <AlertDialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retomar Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente retomar esta campanha? A campanha continuará de onde parou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            {/* FIX #9 — single reusable InstancePicker */}
            <InstancePicker instances={instances} onSelect={setDialogInstanceId} />
          </div>
          <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg border border-border/50 mt-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Remover Duplicados</p>
                <p className="text-[10px] text-muted-foreground">Filtra números repetidos antes de iniciar o envio</p>
              </div>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary cursor-pointer"
              checked={sendDialogRemoveDuplicates}
              onChange={(e) => setSendDialogRemoveDuplicates(e.target.checked)}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20 mt-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Forçar Reenvio</p>
                <p className="text-[10px] text-muted-foreground">Ignora envios anteriores e reenvia para todos</p>
              </div>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 accent-red-500 cursor-pointer"
              checked={forceSendOnResume}
              onChange={(e) => setForceSendOnResume(e.target.checked)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResumeCampaign}>Sim, Retomar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar Campanha</AlertDialogTitle>
            {/* FIX #10 — removed asChild+div (invalid HTML); use plain AlertDialogDescription */}
            <AlertDialogDescription>
              {campaignToSend && (
                <>
                  Deseja realmente enviar a campanha <strong>{campaignToSend.name}</strong>? 👥 Total de contatos:{" "}
                  {campaignToSend.target_audience?.contacts?.length ?? 0}. Esta ação não pode ser desfeita!
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            {/* FIX #9 — reusing InstancePicker */}
            <InstancePicker instances={instances} onSelect={setDialogInstanceId} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSendCampaign}>Sim, Enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats dialog */}
      <Dialog
        open={statsDialogOpen}
        onOpenChange={(open) => {
          setStatsDialogOpen(open);
          if (!open) setStatsDialogCampaignId(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Estatísticas - {statsDialogCampaignName}
            </DialogTitle>
          </DialogHeader>

          {statsDialogLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : !statsData || statsData.totalCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum envio registrado para esta campanha</div>
          ) : (
            <>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-2">
                    Progresso do envio
                    {statsData.isLive && (
                      <Badge variant="secondary" className="animate-pulse text-[10px]">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Tempo real
                      </Badge>
                    )}
                  </span>
                  <span>
                    {statsData.totalCount > 0
                      ? (((statsData.sentCount + statsData.cancelledCount) / statsData.totalCount) * 100).toFixed(0)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    statsData.totalCount > 0
                      ? ((statsData.sentCount + statsData.cancelledCount) / statsData.totalCount) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              {/* Stats grid */}
              <div
                className={`grid grid-cols-2 ${statsDialogHasUrlButton ? "md:grid-cols-8" : "md:grid-cols-7"} gap-2`}
              >
                {[
                  { label: "Total", value: statsData.totalCount, cls: "bg-muted/50" },
                  {
                    label: "Enviados (✓)",
                    value: statsData.sentCount,
                    cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  },
                  {
                    label: "Entregues (✓✓)",
                    value: statsData.deliveredCount,
                    cls: "bg-green-500/10 text-green-600 dark:text-green-400",
                  },
                  { label: "Em trânsito", value: 0, cls: "bg-muted/50" },
                  {
                    label: "Pendentes",
                    value: statsData.pendingCount,
                    cls: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
                  },
                  {
                    label: "Canceladas",
                    value: statsData.cancelledCount,
                    cls: "bg-red-500/10 text-red-600 dark:text-red-400",
                  },
                  {
                    label: "Lidas",
                    value: statsData.readCount,
                    cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                  },
                ].map(({ label, value, cls }) => (
                  <div key={label} className={`p-2 rounded-lg text-center ${cls}`}>
                    <p className="text-[10px]">{label}</p>
                    <p className="font-bold text-md">{value}</p>
                  </div>
                ))}
                {statsDialogHasUrlButton && (
                  <div className="p-3 bg-purple-500/10 rounded-lg text-center">
                    <p className="text-xs text-purple-600 dark:text-purple-400">Cliques</p>
                    <p className="font-bold text-lg text-purple-600 dark:text-purple-400">{statsData.clickedCount}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {statsData.cancelledCount > 0 && (
                <Button onClick={handleRetryCancelled} className="w-full" variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reenviar {statsData.cancelledCount} contato(s) cancelado(s)
                </Button>
              )}

              <Button
                onClick={handleRemoveDuplicates}
                className="w-full"
                variant="outline"
                disabled={removingDuplicates}
              >
                <Filter className="w-4 h-4 mr-2" />
                {removingDuplicates ? `Removendo duplicados... (${removedDuplicates.length})` : "Remover Duplicados"}
              </Button>

              {(removingDuplicates || removedDuplicates.length > 0) && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium">Números duplicados removidos ({removedDuplicates.length})</p>
                    {removingDuplicates && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="flex flex-wrap gap-1">
                      {removedDuplicates.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Verificando...</span>
                      ) : (
                        removedDuplicates.map((p, i) => (
                          <Badge key={`${p}-${i}`} variant="secondary" className="text-[10px] font-mono">
                            {p}
                          </Badge>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button onClick={handleExportCsv} className="w-full" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Baixar relatório (CSV)
              </Button>

              {/* Contacts table */}
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lida</TableHead>
                      {statsDialogHasUrlButton && <TableHead>Clique no link</TableHead>}
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statsData.fullContactList.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name || "-"}</TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              contact.status === "entregue"
                                ? "default"
                                : contact.status === "cancelado"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={`flex items-center gap-1 w-fit ${contact.status === "enviado" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : ""}`}
                          >
                            {contact.status === "entregue" && (
                              <>
                                <div className="flex -space-x-1">
                                  <CheckCircle className="w-3 h-3" />
                                  <CheckCircle className="w-3 h-3" />
                                </div>{" "}
                                Entregue
                              </>
                            )}
                            {contact.status === "enviado" && (
                              <>
                                <CheckCircle className="w-3 h-3" /> Enviado
                              </>
                            )}
                            {contact.status === "enviando" && (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" /> Enviando
                              </>
                            )}
                            {contact.status === "pendente" && (
                              <>
                                <ClockIcon className="w-3 h-3" /> Pendente
                              </>
                            )}
                            {contact.status === "cancelado" && (
                              <>
                                <XCircle className="w-3 h-3" /> Cancelado
                              </>
                            )}
                          </Badge>
                          {contact.errorMessage && (
                            <p className="text-xs text-destructive mt-1" title={contact.errorMessage}>
                              {formatErrorMessage(contact.errorMessage)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.readAt ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1 w-fit"
                            >
                              <CheckCircle className="w-3 h-3" /> Lida
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {statsDialogHasUrlButton && (
                          <TableCell>
                            {contact.clickedAt ? (
                              (() => {
                                const phoneKey = normalizePhoneKey(contact.phone);
                                const click = statsDialogLinkClicks.find(
                                  (c) => normalizePhoneKey(c.phone) === phoneKey,
                                );
                                const loc = click
                                  ? [click.city, click.region, click.country].filter(Boolean).join(", ")
                                  : "";
                                return (
                                  <div className="flex flex-col gap-1">
                                    <Badge
                                      variant="outline"
                                      className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1 w-fit"
                                    >
                                      <CheckCircle className="w-3 h-3" /> Clicou
                                    </Badge>
                                    {click?.ip && (
                                      <span className="text-[10px] font-mono text-muted-foreground" title={loc}>
                                        {click.ip}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-muted-foreground">
                          {contact.sentAt ? safeFormat(contact.sentAt, "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {statsDialogHasUrlButton && statsDialogLinkClicks.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {statsDialogLinkClicks.length} clique(s) registrado(s). IP e localização aproximada exibidos ao lado
                  de cada contato que clicou.
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campanhas;
