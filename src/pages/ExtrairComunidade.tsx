import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Download, Loader2, Copy, Check, Search, RefreshCw, AlertCircle, Smartphone, QrCode, Phone, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import QRCodeLib from "qrcode";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface ExtractedParticipant {
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name: string;
}

interface GroupInfo {
  id: string;
  name: string;
  size: number;
  raw?: any;
  sourceInstanceId?: string | null;
  isCommunity?: boolean;
}

interface MemberCountState {
  count: number;
  loading: boolean;
}

const getInvokeErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      return payload?.message || payload?.error || fallback;
    } catch {
      return fallback;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const normalizeQrImageValue = (value: unknown) => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image")) return trimmed;
  if (trimmed.startsWith("iVBOR")) return `data:image/png;base64,${trimmed}`;
  if (trimmed.startsWith("/9j/")) return `data:image/jpeg;base64,${trimmed}`;
  if (trimmed.startsWith("R0lGOD")) return `data:image/gif;base64,${trimmed}`;
  if (trimmed.startsWith("UklGR")) return `data:image/webp;base64,${trimmed}`;
  if (trimmed.startsWith("PHN2Zy")) return `data:image/svg+xml;base64,${trimmed}`;
  return trimmed;
};

const getUazapiConnectionState = (payload: any) => {
  const instanceStatus = pickFirstString(payload?.instance?.status);
  const rawStatus = pickFirstString(
    payload?.connectionStatus,
    payload?.state,
    typeof payload?.status === "string" ? payload.status : null,
    instanceStatus,
  );

  const connected =
    payload?.connected === true ||
    payload?.loggedIn === true ||
    payload?.status?.connected === true ||
    payload?.status?.loggedIn === true ||
    rawStatus === "connected";

  if (connected) return "connected";

  const hasPendingArtifacts = Boolean(
    pickFirstString(
      payload?.qrCode,
      payload?.qrcode,
      payload?.qr,
      payload?.value,
      payload?.pairingCode,
      payload?.paircode,
      payload?.code,
      payload?.instance?.qrcode,
      payload?.instance?.paircode,
      payload?.response?.qrCode,
      payload?.response?.qrcode,
      payload?.response?.pairingCode,
      payload?.response?.paircode,
      payload?.response?.code,
    ),
  );

  if (rawStatus === "connecting" || hasPendingArtifacts) return "connecting";
  return "disconnected";
};

const getUazapiQrValue = (payload: any) => {
  return normalizeQrImageValue(
    pickFirstString(
      payload?.qrCode,
      payload?.qrcode,
      payload?.qr,
      payload?.value,
      payload?.data?.qrCode,
      payload?.data?.qrcode,
      payload?.data?.qr,
      payload?.data?.value,
      payload?.instance?.qrCode,
      payload?.instance?.qrcode,
      payload?.response?.qrCode,
      payload?.response?.qrcode,
      payload?.response?.qr,
      payload?.response?.value,
    ),
  );
};

const getUazapiPairingValue = (payload: any) => {
  return pickFirstString(
    payload?.pairingCode,
    payload?.paircode,
    payload?.code,
    payload?.data?.pairingCode,
    payload?.data?.paircode,
    payload?.data?.code,
    payload?.instance?.pairingCode,
    payload?.instance?.paircode,
    payload?.response?.pairingCode,
    payload?.response?.paircode,
    payload?.response?.code,
  );
};

const normalizeParticipantIdentifier = (value: any) => {
  const raw = String(value ?? "").trim();

  if (!raw) return "";
  if (/@lid$/i.test(raw)) return raw;

  return raw.replace(/@.*/, "");
};

const isWhatsAppGroupId = (value: unknown) => {
  if (typeof value !== "string") return false;
  return value.includes("@g.us") || value.includes("-group");
};

const getGroupId = (group: any) => {
  if (typeof group === "string") return group;
  return group?.JID || group?.jid || group?.groupId || group?.remoteJid || group?.phone || group?.id || "";
};

const getGroupName = (group: any, fallbackId: string) => {
  if (typeof group === "string") return fallbackId.replace(/(@g\.us|-group)$/i, "");
  return (
    group?.nome ||
    group?.Name ||
    group?.subject ||
    group?.name ||
    group?.groupName ||
    group?.title ||
    group?.contact ||
    group?.pushName ||
    fallbackId.replace(/(@g\.us|-group)$/i, "")
  );
};

const getGroupSize = (group: any) => {
  if (typeof group === "string") return 0;
   return extractMemberCountFromPayload(group);
};

const buildGroupList = (rawGroups: any[]): GroupInfo[] => {
  return rawGroups
    .map((group: any) => {
      const id = getGroupId(group);
      return {
        id,
        name: getGroupName(group, id),
        size: getGroupSize(group),
        raw: typeof group === "string" ? undefined : group,
        sourceInstanceId:
          typeof group === "string"
            ? null
            : group?.sourceInstanceId || group?.__sourceInstanceId || null,
        isCommunity:
          typeof group === "string"
            ? false
            : Boolean(group?.isCommunity || group?.isCommunityAnnounce || group?.isGroupAnnouncement),
      };
    })
    .filter((group) => isWhatsAppGroupId(group.id))
    .filter((group, index, self) => self.findIndex((item) => item.id === group.id) === index);
};


const extractParticipantsFromPayload = (payload: any): any[] => {
  const candidates = [
    payload?.participants,
    payload?.participantes,
    payload?.Participants,
    payload?.members,
    payload?.Members,
    payload?.groupParticipants,
    payload?.communityParticipants,
    payload?.participantIds,
    payload?.data?.participants,
    payload?.data?.participantes,
    payload?.data?.Participants,
    payload?.data?.members,
    payload?.data?.Members,
    payload?.data?.groupParticipants,
    payload?.data?.communityParticipants,
    payload?.result?.participants,
    payload?.result?.participantes,
    payload?.result?.members,
    payload?.group?.participants,
    payload?.group?.participantes,
    payload?.group?.Participants,
    payload?.group?.members,
    payload?.group?.Members,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }

  return [];
};

const collectNestedMemberCounts = (payload: any, seen = new WeakSet<object>()): number[] => {
  if (!payload || typeof payload !== "object") return [];
  if (seen.has(payload)) return [];
  seen.add(payload);

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectNestedMemberCounts(item, seen));
  }

  const directCounts = [
    payload?.membros,
    payload?.ParticipantCount,
    payload?.participantCount,
    payload?.participantsCount,
    payload?.participantsTotal,
    payload?.memberCount,
    payload?.MemberCount,
    payload?.membersCount,
    payload?.totalMembers,
    payload?.totalParticipants,
    payload?.size,
    payload?.communitySize,
    payload?.groupSize,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const nestedCounts = Object.values(payload).flatMap((value) => collectNestedMemberCounts(value, seen));

  return [...directCounts, ...nestedCounts];
};

const extractMemberCountFromPayload = (payload: any) => {
  const directCounts = [
    payload?.membros,
    payload?.ParticipantCount,
    payload?.participantCount,
    payload?.participantsCount,
    payload?.participantsTotal,
    payload?.memberCount,
    payload?.MemberCount,
    payload?.membersCount,
    payload?.totalMembers,
    payload?.totalParticipants,
    payload?.size,
    payload?.communitySize,
    payload?.groupSize,
    payload?.data?.membros,
    payload?.data?.ParticipantCount,
    payload?.data?.participantCount,
    payload?.data?.participantsCount,
    payload?.data?.participantsTotal,
    payload?.data?.memberCount,
    payload?.data?.MemberCount,
    payload?.data?.membersCount,
    payload?.data?.totalMembers,
    payload?.data?.totalParticipants,
    payload?.data?.size,
    payload?.result?.membros,
    payload?.result?.ParticipantCount,
    payload?.result?.participantCount,
    payload?.result?.participantsCount,
    payload?.result?.participantsTotal,
    payload?.result?.memberCount,
    payload?.result?.MemberCount,
    payload?.result?.membersCount,
    payload?.result?.totalMembers,
    payload?.result?.totalParticipants,
    payload?.result?.size,
    payload?.group?.membros,
    payload?.group?.ParticipantCount,
    payload?.group?.participantCount,
    payload?.group?.participantsCount,
    payload?.group?.memberCount,
    payload?.group?.MemberCount,
    payload?.group?.membersCount,
    payload?.group?.totalMembers,
    payload?.group?.totalParticipants,
    payload?.group?.size,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const participantCount = extractParticipantsFromPayload(payload).length;

  if (directCounts.length > 0) {
    return Math.max(...directCounts, participantCount, 0);
  }

  const nestedTotal = collectNestedMemberCounts(payload).reduce((sum, count) => sum + count, 0);
  return Math.max(participantCount, nestedTotal, 0);
};

const normalizeParticipant = (p: any): ExtractedParticipant | null => {
  const realPhone = normalizeParticipantIdentifier(
    p?.PN || p?.PhoneNumber || p?.phone || p?.number || p?.waId || "",
  );

  const encryptedId = normalizeParticipantIdentifier(
    p?.LID || p?.lid || p?.JID || p?.jid || p?.id || p?.userJid || p?.participant || "",
  );

  const phone = realPhone || encryptedId;

  if (phone.length <= 3) return null;

  return {
    phone,
    isAdmin:
      p?.isAdmin === true ||
      p?.IsAdmin === true ||
      p?.admin === "admin" ||
      p?.role === "admin" ||
      p?.IsAdmin === "admin",
    isSuperAdmin:
      p?.isSuperAdmin === true ||
      p?.IsSuperAdmin === true ||
      p?.admin === "superadmin" ||
      p?.role === "superadmin" ||
      p?.IsAdmin === "superadmin",
    name: p?.DisplayName || p?.displayName || p?.name || p?.Name || p?.pushName || p?.notify || "",
  };
};

const ExtrairComunidade = () => {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [participants, setParticipants] = useState<ExtractedParticipant[]>([]);
  const [metadata, setMetadata] = useState<{ groupName: string; totalMembers: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");

  // Groups list
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [uazapiMemberCounts, setUazapiMemberCounts] = useState<Record<string, MemberCountState>>({});

  // Connection state (uazapi only — no Z-API on this page)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const { isAdmin } = useUserRole(currentUserId);
  const [savingUazapi, setSavingUazapi] = useState(false);
  const [uazapiConnected, setUazapiConnected] = useState<boolean | null>(null);
  const [checkingUazapi, setCheckingUazapi] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // QR Code / Pairing state (uazapi native)
  const [connectionTab, setConnectionTab] = useState("qr-code");
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [connectionPolling, setConnectionPolling] = useState(false);

  // Get current user id for role check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id);
    });
  }, []);

  const hasCredentials = !!(apiUrl.trim() && apiToken.trim());
  const canOperate = hasCredentials;

  // Connected state must fully block the QR dialog until a real disconnection happens.
  const effectiveConnected = hasCredentials ? (uazapiConnected === true || groups.length > 0) : false;
  const effectiveChecking = hasCredentials ? checkingUazapi : false;
  const allowConnectionDialog = !effectiveConnected;

  const buildQrCodeImage = async (payload: any) => {
    const qrValue = getUazapiQrValue(payload);
    if (!qrValue) return null;

    if (qrValue.startsWith("data:image") || qrValue.startsWith("http")) {
      return qrValue;
    }

    try {
      return await QRCodeLib.toDataURL(qrValue, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
    } catch {
      return null;
    }
  };

  const applyConnectionArtifacts = async (payload: any) => {
    const qrImage = await buildQrCodeImage(payload);
    const pairing = getUazapiPairingValue(payload);

    if (qrImage) setQrCodeImage(qrImage);
    if (pairing) setPairingCode(pairing);

    return { qrImage, pairingCode: pairing };
  };

  useEffect(() => {
    if (!hasCredentials || groups.length === 0) return;

    let cancelled = false;

    const groupsNeedingCount = groups.filter((group) => group.size <= 0 || group.isCommunity);

    if (groupsNeedingCount.length === 0) return;

    const loadUazapiCounts = async () => {
      for (const group of groupsNeedingCount) {
        if (cancelled) return;

        const alreadyCached = uazapiMemberCounts[group.id];
        if (alreadyCached && (alreadyCached.loading || alreadyCached.count > 0)) continue;

        setUazapiMemberCounts((prev) => ({
          ...prev,
          [group.id]: { count: prev[group.id]?.count ?? 0, loading: true },
        }));

        try {
          const { data, error } = await supabase.functions.invoke("uazapi-group-info", {
            body: { groupId: group.id, apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
          });

          if (error) throw error;

          const count = Math.max(extractMemberCountFromPayload(data), group.size || 0);

          if (!cancelled) {
            setUazapiMemberCounts((prev) => ({
              ...prev,
              [group.id]: { count, loading: false },
            }));
          }
        } catch {
          if (!cancelled) {
            setUazapiMemberCounts((prev) => ({
              ...prev,
              [group.id]: { count: group.size || 0, loading: false },
            }));
          }
        }
      }
    };

    void loadUazapiCounts();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken, apiUrl, groups, hasCredentials]);

  // Load credentials from database (set by admin)
  useEffect(() => {
    const loadCredentials = async () => {
      setLoadingCredentials(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from("profiles")
          .select("uazapi_url, uazapi_token")
          .eq("id", session.user.id)
          .single();
        const profile = data as any;
        const firstUrl = String(profile?.uazapi_url || '').split('|')[0]?.trim();
        const firstToken = String(profile?.uazapi_token || '').split('|')[0]?.trim();
        if (firstUrl) setApiUrl(firstUrl);
        if (firstToken) setApiToken(firstToken);

        // Auto-provision an isolated UAZAPI extractor instance for new users
        if (!profile?.uazapi_url || !profile?.uazapi_token) {
          try {
            const { data: prov, error: provErr } = await supabase.functions.invoke(
              "uazapi-provision-extractor",
              { body: {} }
            );
            if (provErr) throw provErr;
            if (prov?.error) throw new Error(prov.error);
            if (prov?.apiUrl && prov?.apiToken) {
              setApiUrl(prov.apiUrl);
              setApiToken(prov.apiToken);
            }
          } catch (provError: any) {
            console.error("Erro ao provisionar extrator:", provError);
            toast.error(provError?.message || "Não foi possível provisionar o extrator. Contate o suporte.");
          }
        }
      } catch (err) {
        console.error("Erro ao carregar credenciais:", err);
      } finally {
        setLoadingCredentials(false);
      }
    };
    loadCredentials();
  }, []);

  // No Z-API QR/pairing on this page — uazapi only

  const saveUazapiCredentials = async () => {
    setSavingUazapi(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Usuário não autenticado");

      const cleanUrl = apiUrl.trim();
      const cleanToken = apiToken.trim();

      const { error } = await supabase
        .from("profiles")
        .update({
          uazapi_url: cleanUrl || null,
          uazapi_token: cleanToken || null,
        } as any)
        .eq("id", session.user.id);

      if (error) throw error;

      toast.success(cleanUrl && cleanToken ? "Credenciais UAZAPI salvas!" : "Credenciais UAZAPI removidas!");

      if (cleanUrl && cleanToken) {
        setConnectDialogOpen(false);
        fetchGroups();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar credenciais UAZAPI");
    } finally {
      setSavingUazapi(false);
    }
  };

  // Auto-fetch groups when credentials are loaded
  useEffect(() => {
    if (!loadingCredentials && apiUrl && apiToken) {
      checkUazapiConnection();
    }
  }, [loadingCredentials, apiUrl, apiToken]);

  const checkUazapiConnection = async () => {
    setCheckingUazapi(true);
    try {
      // First check native status endpoint
      const { data: statusData } = await supabase.functions.invoke("uazapi-status", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      const resolvedState = getUazapiConnectionState(statusData);
      const artifacts = await applyConnectionArtifacts(statusData);

      if (resolvedState === "connected") {
        setUazapiConnected(true);
        toast.success("Instância conectada!");
        // Also fetch groups
        const { data } = await supabase.functions.invoke("uazapi-group-list", {
          body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
        });
        if (data && !data.error) {
          const rawGroups = Array.isArray(data) ? data : Array.isArray(data?.groups) ? data.groups : [];
          const list = buildGroupList(rawGroups);
          setGroups(list);
          if (list.length > 0) toast.success(`${list.length} grupos carregados!`);
        }
        return;
      }

      if (resolvedState === "connecting" || artifacts.qrImage || artifacts.pairingCode) {
        setUazapiConnected(false);
        setConnectionPolling(true);
        toast.warning("Instância aguardando leitura do QR Code ou código de pareamento.");
        return;
      }

      if (resolvedState === "disconnected") {
        setUazapiConnected(false);
        toast.warning("Instância desconectada.");
        return;
      }

      // Fallback: try group list
      const { data, error } = await supabase.functions.invoke("uazapi-group-list", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      if (error || data?.error) {
        setUazapiConnected(false);
        return;
      }
      const rawGroups = Array.isArray(data) ? data : Array.isArray(data?.groups) ? data.groups : [];
      const list = buildGroupList(rawGroups);
      setGroups(list);
      setUazapiConnected(true);
      if (list.length > 0) {
        toast.success(`${list.length} grupos carregados!`);
      } else {
        toast.success("Conexão validada com sucesso.");
      }
    } catch {
      setUazapiConnected(false);
    } finally {
      setCheckingUazapi(false);
    }
  };

  const handleDisconnect = async () => {
    if (!hasCredentials) return;
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-disconnect", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUazapiConnected(false);
      setGroups([]);
      toast.success("WhatsApp desconectado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  // Check uazapi status (native endpoint)
  const checkUazapiStatus = async (options?: { silent?: boolean }) => {
    if (!hasCredentials) return;
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-status", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      if (error || data?.error) return;

      const resolvedState = getUazapiConnectionState(data);
      const artifacts = await applyConnectionArtifacts(data);

      if (resolvedState === "connected") {
        setUazapiConnected(true);
        if (!options?.silent) toast.success("WhatsApp conectado com sucesso!");
        setConnectDialogOpen(false);
        setQrCodeImage(null);
        setPairingCode(null);
        setConnectionPolling(false);
        fetchGroups();
        return true;
      }

      if (resolvedState === "connecting" || artifacts.qrImage || artifacts.pairingCode) {
        setUazapiConnected(false);
        setConnectionPolling(true);
        return false;
      }

      setUazapiConnected(false);
      return false;
    } catch {
      return false;
    }
  };

  // Always force-close the dialog whenever the instance becomes connected.
  useEffect(() => {
    if (!effectiveConnected) return;

    setConnectDialogOpen(false);
    setConnectionPolling(false);
    setQrCodeImage(null);
    setPairingCode(null);
  }, [effectiveConnected]);

  // Poll connection status after QR/pairing is shown
  useEffect(() => {
    if (!connectionPolling || !hasCredentials) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data, error } = await supabase.functions.invoke("uazapi-status", {
          body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
        });
        if (cancelled) return;
        if (error || data?.error) return;

        const resolvedState = getUazapiConnectionState(data);

        if (resolvedState === "connected") {
          setUazapiConnected(true);
          setConnectionPolling(false);
          setConnectDialogOpen(false);
          setQrCodeImage(null);
          setPairingCode(null);
          toast.success("WhatsApp conectado com sucesso!");
          fetchGroups();
          return;
        }

        await applyConnectionArtifacts(data);
      } catch {
        // ignore polling errors
      }
    };

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connectionPolling, hasCredentials, apiUrl, apiToken, effectiveConnected]);

  // Generate QR Code via uazapi
  const fetchQrCode = async () => {
    if (!hasCredentials) { toast.error("Credenciais não configuradas"); return; }
    setQrLoading(true);
    setQrCodeImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-connect", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const resolvedState = getUazapiConnectionState(data);
      const artifacts = await applyConnectionArtifacts(data);

      if (resolvedState === "connected") {
        toast.success("Dispositivo já conectado!");
        setUazapiConnected(true);
        setConnectDialogOpen(false);
        fetchGroups();
        return;
      }

      if (artifacts.qrImage) {
        toast.success("QR Code gerado! Escaneie com o WhatsApp.");
        setConnectionPolling(true);
      } else {
        await checkUazapiStatus({ silent: true });
        toast.warning("QR Code ainda não disponível. Verifique o status da instância.");
        setConnectionPolling(true);
      }
    } catch (error) {
      const message = await getInvokeErrorMessage(error, "Erro ao gerar QR Code");
      toast.error(message);
    } finally {
      setQrLoading(false);
    }
  };

  // Generate pairing code via uazapi
  const fetchPairingCode = async () => {
    if (!hasCredentials) { toast.error("Credenciais não configuradas"); return; }
    if (!pairingPhone) { toast.error("Digite seu número de telefone"); return; }
    setPairingLoading(true);
    setPairingCode(null);
    try {
      let cleanPhone = pairingPhone.replace(/\D/g, "");
      if (cleanPhone && !cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

      const { data, error } = await supabase.functions.invoke("uazapi-connect", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim(), phone: cleanPhone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const resolvedState = getUazapiConnectionState(data);
      const artifacts = await applyConnectionArtifacts(data);

      if (resolvedState === "connected") {
        toast.success("Dispositivo já conectado!");
        setUazapiConnected(true);
        setConnectDialogOpen(false);
        fetchGroups();
        return;
      }

      if (artifacts.pairingCode) {
        toast.success("Código de conexão gerado!");
        setConnectionPolling(true);
      } else if (artifacts.qrImage) {
        setConnectionTab("qr-code");
        toast.warning("Use o QR Code retornado para concluir a conexão.");
        setConnectionPolling(true);
      } else {
        toast.error("Código de conexão indisponível");
      }
    } catch (error) {
      const message = await getInvokeErrorMessage(error, "Erro ao solicitar código de conexão");
      toast.error(message);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleOpenConnectionDialog = async () => {
    if (!hasCredentials) {
      setConnectDialogOpen(true);
      return;
    }

    if (groups.length > 0 || uazapiConnected === true) {
      setUazapiConnected(true);
      setConnectionPolling(false);
      setQrCodeImage(null);
      setPairingCode(null);
      setConnectDialogOpen(false);
      toast.success("WhatsApp já está conectado.");
      return;
    }

    setCheckingUazapi(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-status", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });

      if (error || data?.error) {
        setConnectDialogOpen(true);
        return;
      }

      const resolvedState = getUazapiConnectionState(data);

      if (resolvedState === "connected") {
        setUazapiConnected(true);
        setConnectionPolling(false);
        setQrCodeImage(null);
        setPairingCode(null);
        setConnectDialogOpen(false);
        fetchGroups();
        toast.success("WhatsApp já está conectado.");
        return;
      }

      await applyConnectionArtifacts(data);
      setUazapiConnected(false);
      setConnectDialogOpen(true);
    } catch {
      setConnectDialogOpen(true);
    } finally {
      setCheckingUazapi(false);
    }
  };

  const fetchGroups = async () => {
    if (!apiUrl.trim() || !apiToken.trim()) return;
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-group-list", {
        body: { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(`Erro ao carregar grupos: ${data.error}. Verifique suas credenciais.`);
        setLoadingGroups(false);
        return;
      }

      const rawGroups = Array.isArray(data)
        ? data
        : Array.isArray(data?.groups)
          ? data.groups
          : [];

      const list = buildGroupList(rawGroups);

      setGroups(list);
      setUazapiConnected(true);
      setConnectionPolling(false);
      if (list.length === 0) {
        toast.warning("Nenhum grupo encontrado nesta instância.");
      } else {
        toast.success(`${list.length} grupos carregados!`);
      }
    } catch (err: any) {
      console.error("Erro ao listar grupos:", err);
      toast.error(err?.message || "Erro ao listar grupos");
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleExtract = async (groupId: string) => {
    if (!groupId.trim() || !canOperate) return;

    setExtracting(true);
    setParticipants([]);
    setMetadata(null);
    setSelectedGroupId(groupId);

    try {
      const selectedGroup = groups.find((group) => group.id === groupId.trim());
      const sourceInstanceId =
        selectedGroup?.sourceInstanceId ||
        selectedGroup?.raw?.sourceInstanceId ||
        selectedGroup?.raw?.__sourceInstanceId ||
        null;
      const listParticipants = extractParticipantsFromPayload(selectedGroup?.raw);
      const normalizedMap = new Map<string, ExtractedParticipant>();
      let resolvedGroupName = selectedGroup?.name || "Comunidade";
      let resolvedTotalMembers = Number(selectedGroup?.size) || 0;

      const pushParticipants = (values: any[]) => {
        values.forEach((participant) => {
          const normalized = normalizeParticipant(participant);
          if (!normalized) return;

          const existing = normalizedMap.get(normalized.phone);
          if (!existing) {
            normalizedMap.set(normalized.phone, normalized);
            return;
          }

          normalizedMap.set(normalized.phone, {
            phone: normalized.phone,
            name: existing.name || normalized.name,
            isAdmin: existing.isAdmin || normalized.isAdmin,
            isSuperAdmin: existing.isSuperAdmin || normalized.isSuperAdmin,
          });
        });
      };

      // Always use uazapi on this page
      const { data, error } = await supabase.functions.invoke("uazapi-group-info", {
        body: { groupId: groupId.trim(), apiUrl: apiUrl.trim(), apiToken: apiToken.trim() },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const responseParticipants = extractParticipantsFromPayload(data);
      const localParticipants = [...responseParticipants, ...listParticipants];

      pushParticipants(localParticipants);

      resolvedGroupName =
        data?.subject ||
        data?.Subject ||
        data?.name ||
        data?.Name ||
        data?.groupName ||
        data?.data?.subject ||
        data?.data?.name ||
        selectedGroup?.name ||
        "Comunidade";
      resolvedTotalMembers = Math.max(
        extractMemberCountFromPayload(data),
        localParticipants.length,
        Number(selectedGroup?.size) || 0,
      );

      const extracted = Array.from(normalizedMap.values());

      setParticipants(extracted);
      setMetadata({
        groupName: resolvedGroupName,
        totalMembers: Number(resolvedTotalMembers) || extracted.length,
      });

      if (extracted.length === 0) {
        toast.warning(
          selectedGroup?.isCommunity
            ? "Nenhum membro retornado para esta comunidade. Agora os subgrupos estão sendo interpretados com mais formatos."
            : "Nenhum membro encontrado ou a API retornou em formato diferente.",
        );
      } else {
        toast.success(`${extracted.length} membros extraídos!`);
      }
    } catch (err: any) {
      console.error("Erro ao extrair membros:", err);
      toast.error(err?.message || "Erro ao extrair membros");
    } finally {
      setExtracting(false);
    }
  };

  const phones = participants
    .map((p) => p.phone)
    .filter((p) => p.length > 3);

  const filteredParticipants = filter
    ? participants.filter(
        (p) => p.phone.includes(filter) || p.name.toLowerCase().includes(filter.toLowerCase())
      )
    : participants;

  const filteredGroups = groupFilter
    ? groups.filter(
        (g) => g.name.toLowerCase().includes(groupFilter.toLowerCase()) || g.id.includes(groupFilter)
      )
    : groups;

  const copyAll = () => {
    if (phones.length === 0) return;
    navigator.clipboard.writeText(phones.join("\n"));
    setCopied(true);
    toast.success(`${phones.length} números copiados!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (phones.length === 0) return;
    const blob = new Blob([phones.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `membros_${selectedGroupId.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = () => {
    if (participants.length === 0) return;
    const header = "Telefone\n";
    const rows = participants
      .filter((p) => p.phone.length > 3)
      .map((p) => p.phone)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `membros_${selectedGroupId.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Extrair Membros de Comunidade</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Extraia membros de comunidades e grupos do WhatsApp
        </p>
      </div>

      {/* Connection status */}
      {!loadingCredentials && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium">Status da instância</p>
                 <p className="text-xs text-muted-foreground">
                   {effectiveConnected
                     ? "Instância conectada."
                     : "Conecte seu WhatsApp para continuar"}
                 </p>
               </div>
             </div>
             <div className="flex items-center gap-2">
               <Badge variant="outline" className="text-[10px]">
                 {effectiveChecking ? "Verificando..." : effectiveConnected ? "Conectado" : "Desconectado"}
               </Badge>
               {hasCredentials && !effectiveConnected && !effectiveChecking && (
                 <Button size="sm" variant="outline" onClick={checkUazapiConnection} className="gap-1.5 text-xs">
                   <RefreshCw className="w-3 h-3" />
                   Verificar
                 </Button>
               )}
                {effectiveConnected && (
                  <Button size="sm" variant="destructive" onClick={handleDisconnect} className="gap-1.5" disabled={disconnecting}>
                    <LogOut className="w-4 h-4" />
                    {disconnecting ? "Desconectando..." : "Desconectar"}
                  </Button>
                )}
                {!effectiveConnected && (
                  <Button size="sm" onClick={handleOpenConnectionDialog} className="gap-1.5" disabled={checkingUazapi}>
                    <Smartphone className="w-4 h-4" />
                    {checkingUazapi ? "Verificando..." : "Conectar WhatsApp"}
                  </Button>
                )}
             </div>
           </CardContent>
         </Card>
       )}
 
       {/* Connection dialog */}
      <Dialog open={allowConnectionDialog && connectDialogOpen} onOpenChange={(open) => { setConnectDialogOpen(allowConnectionDialog ? open : false); if (!open) setConnectionPolling(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Smartphone className="w-5 h-5 text-primary" />
              Conectar WhatsApp
            </DialogTitle>
          </DialogHeader>

          {hasCredentials && effectiveConnected ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-base">WhatsApp Conectado</p>
                <p className="text-xs text-muted-foreground mt-1">Sua instância está ativa e pronta para uso.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setConnectDialogOpen(false)}>
                Fechar
              </Button>
            </div>
          ) : hasCredentials ? (
            <Tabs value={connectionTab} onValueChange={setConnectionTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qr-code" className="text-xs">
                  <QrCode className="w-3 h-3 mr-1" /> QR Code
                </TabsTrigger>
                <TabsTrigger value="pairing" className="text-xs">
                  <Phone className="w-3 h-3 mr-1" /> Código de Pareamento
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qr-code" className="mt-4">
                <div className="flex flex-col items-center gap-3">
                  {qrCodeImage ? (
                    <div className="p-2 bg-white rounded-lg">
                      <img src={qrCodeImage} alt="QR Code" className="w-52 h-52" />
                    </div>
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20">
                      <p className="text-xs text-muted-foreground text-center px-4">
                        Clique para gerar o QR Code
                      </p>
                    </div>
                  )}
                  <Button size="sm" onClick={fetchQrCode} disabled={qrLoading}>
                    {qrLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <QrCode className="w-3 h-3 mr-1" />}
                    {qrCodeImage ? "Atualizar QR Code" : "Gerar QR Code"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="pairing" className="mt-4">
                <div className="flex flex-col gap-3">
                  <Input
                    placeholder="Seu número (ex: 11999999999)"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={fetchPairingCode} disabled={pairingLoading || !pairingPhone}>
                    {pairingLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Phone className="w-3 h-3 mr-1" />}
                    Gerar Código
                  </Button>
                  {pairingCode && (
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <p className="text-2xl font-mono font-bold tracking-widest">{pairingCode}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Abra o WhatsApp → Dispositivos conectados → Conectar por número
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>As credenciais de conexão são configuradas pelo administrador.</p>
              <p className="text-xs mt-1">Entre em contato com o administrador para configurar sua instância.</p>
            </div>
          )}

          {isAdmin && (
            <details className="mt-2">
               <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground" />
              <div className="space-y-3 mt-3">
                <div className="space-y-1.5">
                   <label className="text-xs font-medium">URL</label>
                  <Input placeholder="https://..." value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="text-xs h-8" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-xs font-medium">Token</label>
                  <Input placeholder="Token de acesso" value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="text-xs h-8" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={saveUazapiCredentials} disabled={savingUazapi || !apiUrl.trim() || !apiToken.trim()} className="text-xs h-7">
                    {savingUazapi ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={checkUazapiConnection} disabled={checkingUazapi || !hasCredentials} className="text-xs h-7">
                    {checkingUazapi ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Testar
                  </Button>
                </div>
              </div>
            </details>
          )}
        </DialogContent>
      </Dialog>

      {loadingCredentials && (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando credenciais...
        </div>
      )}

      {/* Groups List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              Grupos da Instância
              {effectiveConnected && <Badge variant="secondary" className="text-[10px]">Conectado</Badge>}
              {groups.length > 0 && <Badge variant="secondary" className="text-[10px]">{groups.length}</Badge>}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchGroups}
              disabled={loadingGroups || !canOperate}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingGroups ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingGroups && groups.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando grupos...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {canOperate
                ? "Nenhum grupo encontrado. Clique em Atualizar."
                 : "Conecte seu WhatsApp ou solicite ao administrador que configure suas credenciais."}
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar grupo por nome ou ID..."
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="max-w-sm"
              />
              <div className="max-h-[350px] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Nome do Grupo</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Membros</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((g) => (
                        (() => {
                          const uazapiState = uazapiMemberCounts[g.id];
                          const memberCount = typeof uazapiState?.count === "number" ? uazapiState.count : g.size;
                          const loadingMemberCount = Boolean(uazapiState?.loading);

                          return (
                            <tr key={g.id} className="border-t border-border/50 hover:bg-muted/30">
                              <td className="px-3 py-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-medium truncate max-w-[250px]">{g.name}</p>
                                    {g.isCommunity && <Badge variant="outline" className="text-[10px]">Comunidade</Badge>}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[250px]">{g.id}</p>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {loadingMemberCount ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    carregando...
                                  </span>
                                ) : memberCount > 0 ? (
                                  memberCount
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant={selectedGroupId === g.id && metadata ? "secondary" : "default"}
                                  onClick={() => handleExtract(g.id)}
                                  disabled={extracting}
                                  className="text-xs h-7 px-3"
                                >
                                  {extracting && selectedGroupId === g.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <><Search className="w-3 h-3 mr-1" /> Extrair</>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })()
                      ))}
                    {filteredGroups.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-muted-foreground text-xs">
                          Nenhum grupo encontrado para o filtro
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {metadata && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Total Membros</span>
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xl font-bold">{metadata.totalMembers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Números Válidos</span>
                  <Users className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xl font-bold">{phones.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="text-sm">Membros — {metadata.groupName}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copyAll} disabled={phones.length === 0}>
                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "Copiado!" : "Copiar Todos"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadTxt} disabled={phones.length === 0}>
                    <Download className="w-3 h-3 mr-1" /> TXT
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadCsv} disabled={phones.length === 0}>
                    <Download className="w-3 h-3 mr-1" /> CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Filtrar por número ou nome..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-sm"
              />
              <div className="max-h-[400px] overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">#</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Telefone</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Nome</th>
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p, i) => (
                      <tr key={`${p.phone}-${i}`} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{p.phone}</td>
                        <td className="px-3 py-1.5 text-xs">{p.name || "—"}</td>
                        <td className="px-3 py-1.5">
                          {p.isSuperAdmin ? (
                            <Badge variant="default" className="text-[10px]">Super Admin</Badge>
                          ) : p.isAdmin ? (
                            <Badge variant="secondary" className="text-[10px]">Admin</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Membro</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredParticipants.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                          {filter ? "Nenhum resultado para o filtro" : "Nenhum membro extraído"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ExtrairComunidade;
