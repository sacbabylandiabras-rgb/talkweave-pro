import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Download, Loader2, Copy, Check, Search, RefreshCw, AlertCircle, QrCode, Phone, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { useGroupMemberCount } from "@/hooks/useGroupMemberCount";
import QRCodeLib from 'qrcode';

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

  // Connection via QR/Pairing
  const { instances } = useZapiInstances();
  const [connectionTab, setConnectionTab] = useState("qr-code");
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [connectionPolling, setConnectionPolling] = useState(false);
  const [connectedViaInstance, setConnectedViaInstance] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [hasLegacyZapiProfileCredentials, setHasLegacyZapiProfileCredentials] = useState(false);
  const { fetchMemberCount, getMemberCount, isLoading: isMemberCountLoading } = useGroupMemberCount();

  const hasCredentials = apiUrl.trim() && apiToken.trim();
  const canOperate = hasCredentials || connectedViaInstance;
  const canConnectNumber = instances.length > 0 || hasLegacyZapiProfileCredentials;

  useEffect(() => {
    if (!canOperate || groups.length === 0 || (hasCredentials && !connectedViaInstance)) return;

    let cancelled = false;

    const groupsNeedingCount = groups.filter((group) => group.size <= 0 || group.isCommunity);

    if (groupsNeedingCount.length === 0) return;

    const loadMemberCounts = async () => {
      for (const group of groupsNeedingCount) {
        if (cancelled) return;

        await fetchMemberCount(
          group.id,
          group.sourceInstanceId || null,
          extractParticipantsFromPayload(group.raw),
        );
      }
    };

    void loadMemberCounts();

    return () => {
      cancelled = true;
    };
  }, [canOperate, connectedViaInstance, fetchMemberCount, groups, hasCredentials]);

  useEffect(() => {
    if (!hasCredentials || connectedViaInstance || groups.length === 0) return;

    let cancelled = false;

    const groupsNeedingCount = groups.filter((group) => group.size <= 0 || group.isCommunity);

    if (groupsNeedingCount.length === 0) return;

    const loadUazapiCounts = async () => {
      for (const group of groupsNeedingCount) {
        if (cancelled) return;

        // Skip if already fetched or in progress
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
  }, [apiToken, apiUrl, connectedViaInstance, groups, hasCredentials]);

  const fetchGroupsViaZapi = async () => {
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-whatsapp-groups");
      if (error) throw error;
      const rawGroups = Array.isArray(data) ? data : Array.isArray(data?.groups) ? data.groups : [];
      const list = buildGroupList(rawGroups);
      setGroups(list);
      if (list.length === 0) {
        toast.warning("Nenhum grupo encontrado.");
      } else {
        toast.success(`${list.length} grupos carregados!`);
      }
    } catch (err: any) {
      console.error("Erro ao listar grupos via Z-API:", err);
      toast.error(err?.message || "Erro ao listar grupos");
    } finally {
      setLoadingGroups(false);
    }
  };

  const checkInstanceConnection = async (instanceId?: string | null, options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setCheckingConnection(true);
      const { data } = await supabase.functions.invoke(
        "get-device-status",
        instanceId ? { body: { instanceId } } : {},
      );
      const connected =
        data?.data?.connected === true ||
        data?.connected === true ||
        data?.data?.status === "CONNECTED" ||
        data?.status === "CONNECTED";

      setConnectedViaInstance(connected);

      if (connected) {
        if (!options?.silent) toast.success("WhatsApp conectado com sucesso!");
        setConnectDialogOpen(false);
        setQrCodeImage(null);
        setPairingCode(null);
        fetchGroupsViaZapi();
      }

      return connected;
    } catch {
      setConnectedViaInstance(false);
      return false;
    } finally {
      if (!options?.silent) setCheckingConnection(false);
    }
  };

  // Poll connection status after QR is shown
  useEffect(() => {
    if (!connectDialogOpen || (!qrCodeImage && !pairingCode) || (!selectedInstanceId && !hasLegacyZapiProfileCredentials)) {
      setConnectionPolling(false);
      return;
    }

    setConnectionPolling(true);
    const interval = setInterval(() => {
      checkInstanceConnection(selectedInstanceId, { silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [connectDialogOpen, hasLegacyZapiProfileCredentials, qrCodeImage, pairingCode, selectedInstanceId]);

  // Load credentials from database (set by admin)
  useEffect(() => {
    const loadCredentials = async () => {
      setLoadingCredentials(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from("profiles")
          .select("uazapi_url, uazapi_token, zapi_instance_id, zapi_token, zapi_client_token")
          .eq("id", session.user.id)
          .single();
        const profile = data as any;
        if (profile?.uazapi_url) setApiUrl(profile.uazapi_url);
        if (profile?.uazapi_token) setApiToken(profile.uazapi_token);
        setHasLegacyZapiProfileCredentials(
          Boolean(profile?.zapi_instance_id && profile?.zapi_token && profile?.zapi_client_token),
        );
      } catch (err) {
        console.error("Erro ao carregar credenciais:", err);
      } finally {
        setLoadingCredentials(false);
      }
    };
    loadCredentials();
  }, []);

  // Auto-select first instance
  useEffect(() => {
    if (!selectedInstanceId && instances.length > 0) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    if (selectedInstanceId) {
      checkInstanceConnection(selectedInstanceId, { silent: true });
    } else if (!loadingCredentials && hasLegacyZapiProfileCredentials) {
      checkInstanceConnection(null, { silent: true });
    }
  }, [hasLegacyZapiProfileCredentials, loadingCredentials, selectedInstanceId]);

  const fetchQrCode = async () => {
    const instId = selectedInstanceId;
    if (!instId && !hasLegacyZapiProfileCredentials) { toast.error("Nenhuma instância disponível"); return; }
    setQrLoading(true);
    setQrCodeImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("get-qr-code", {
        body: { instanceId: instId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data?.message || data?.error);
      const rawQr = data?.data?.value ?? data?.data?.qrCode ?? data?.data?.qrcode ?? null;
      const normalized = normalizeQrImageValue(rawQr);
      if (typeof normalized === "string" && normalized.startsWith("data:image")) {
        setQrCodeImage(normalized);
        toast.success("QR Code gerado!");
      } else if (typeof normalized === "string" && normalized.length > 50) {
        const img = await QRCodeLib.toDataURL(normalized, { width: 256, margin: 2, color: { dark: "#000000", light: "#FFFFFF" } });
        setQrCodeImage(img);
        toast.success("QR Code gerado!");
      } else if (data?.data?.connected === true) {
        toast.success("Dispositivo já conectado!");
        setConnectDialogOpen(false);
      } else {
        toast.error("QR Code indisponível. Tente reiniciar a instância.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar QR Code");
    } finally {
      setQrLoading(false);
    }
  };

  const fetchPairingCode = async () => {
    const instId = selectedInstanceId;
    if (!instId && !hasLegacyZapiProfileCredentials) { toast.error("Nenhuma instância disponível"); return; }
    if (!pairingPhone) { toast.error("Digite seu número de telefone"); return; }
    setPairingLoading(true);
    setPairingCode(null);
    try {
      let cleanPhone = pairingPhone.replace(/\D/g, "");
      if (cleanPhone && !cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;
      const { data, error } = await supabase.functions.invoke("get-pairing-code", {
        body: { phoneNumber: cleanPhone, instanceId: instId },
      });
      if (error) throw error;
      if (!data?.success || !data?.data) throw new Error(data?.message || data?.error || "Falha ao gerar código");
      const code = data.data.pairingCode || data.data.code || null;
      if (code) {
        setPairingCode(code);
        toast.success("Código gerado!");
      } else {
        toast.error("Código de pareamento indisponível");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao solicitar código");
    } finally {
      setPairingLoading(false);
    }
  };

  // Auto-fetch groups when credentials are loaded
  useEffect(() => {
    if (!loadingCredentials && apiUrl && apiToken) {
      fetchGroups();
    }
  }, [loadingCredentials, apiUrl, apiToken]);

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

      const useZapiDirect = connectedViaInstance && !hasCredentials;
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

      if (useZapiDirect) {
        pushParticipants(listParticipants);

        const { data, error } = await supabase.functions.invoke("get-group-participants", {
          body: {
            groupId: groupId.trim(),
            fallbackParticipants: Array.from(normalizedMap.values()),
            sourceInstanceId,
          },
        });

        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          return;
        }

        pushParticipants(Array.isArray(data?.participants) ? data.participants : []);
        resolvedGroupName = data?.groupName || selectedGroup?.name || "Comunidade";
        resolvedTotalMembers = Math.max(
          Number(data?.participants?.length) || 0,
          listParticipants.length,
          Number(selectedGroup?.size) || 0,
        );
      } else {
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
      }

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
      {!loadingCredentials && !connectedViaInstance && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium">Status da instância</p>
                <p className="text-xs text-muted-foreground">
                  Conecte seu WhatsApp para continuar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {checkingConnection || connectionPolling ? "Verificando..." : "Desconectado"}
              </Badge>
              {canConnectNumber ? (
                <Button size="sm" onClick={() => setConnectDialogOpen(true)} className="gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  Conectar WhatsApp
                </Button>
              ) : (
                <p className="text-[10px] text-muted-foreground max-w-[200px]">
                  Nenhuma instância ou credencial configurada. Solicite ao administrador.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connection dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Smartphone className="w-5 h-5 text-primary" />
              Conectar WhatsApp
            </DialogTitle>
          </DialogHeader>
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
              {connectedViaInstance && <Badge variant="secondary" className="text-[10px]">Conectado</Badge>}
              {groups.length > 0 && <Badge variant="secondary" className="text-[10px]">{groups.length}</Badge>}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={connectedViaInstance && !hasCredentials ? fetchGroupsViaZapi : fetchGroups}
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
                          const memberCount = hasCredentials && !connectedViaInstance
                            ? (typeof uazapiState?.count === "number" ? uazapiState.count : g.size)
                            : getMemberCount(g.id, g.size);
                          const loadingMemberCount = hasCredentials && !connectedViaInstance
                            ? Boolean(uazapiState?.loading)
                            : isMemberCountLoading(g.id);

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
