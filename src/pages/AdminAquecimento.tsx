import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Flame, Loader2, Phone, Server, QrCode, RefreshCw, CheckCircle2, UserCog, ImageIcon, Users2, Link as LinkIcon, ArrowRightLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

// Tabela criada via migration; o tipo gerado ainda não a conhece, então usamos cast.
const donorTable = () => (supabase as any).from("warmup_donor_numbers");
const messageTable = () => (supabase as any).from("warmup_messages");
import { toast } from "sonner";
import { warmupMessagePack } from "@/lib/warmup-messages";
import { warmupConversationPack } from "@/lib/warmup-conversations";

interface DonorNumber {
  id: string;
  phone: string;
  label: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

const normalize = (raw: string) => raw.replace(/\D/g, "");

const parseBulk = (raw: string) =>
  raw
    .split(/[\n,;\s]+/)
    .map(normalize)
    .filter((p) => p.length >= 8);

interface UazInstance {
  id: string;
  instance_name: string;
  zapi_instance_id?: string | null;
  zapi_token?: string | null;
  evolution_api_key?: string | null;
  evolution_api_url?: string | null;
  created_at: string;
}

export default function AdminAquecimento() {
  const [donors, setDonors] = useState<DonorNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [bulk, setBulk] = useState("");

  // Mensagens compartilhadas
  const [messages, setMessages] = useState<Array<{ id: string; content: string; active: boolean }>>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");
  const [importing, setImporting] = useState(false);

  const [instOpen, setInstOpen] = useState(false);
  const [instName, setInstName] = useState("");
  const [creatingInst, setCreatingInst] = useState(false);

  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [loadingInst, setLoadingInst] = useState(true);
  const [instancePhones, setInstancePhones] = useState<Record<string, { phone: string | null; connected: boolean; name?: string | null }>>({});
  const [healthByRef, setHealthByRef] = useState<Record<string, { blocked_until: string | null; last_detected_at: string }>>({});
  const [healthByPhone, setHealthByPhone] = useState<Record<string, { blocked_until: string | null; last_detected_at: string }>>({});

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectInst, setConnectInst] = useState<UazInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<string>("disconnected");
  const [qrLoading, setQrLoading] = useState(false);
  const [connectMode, setConnectMode] = useState<"qr" | "pairing">("qr");
  const [pairingPhone, setPairingPhone] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);

  // Atualização em massa de perfil
  const [bulkProfileName, setBulkProfileName] = useState("");
  const [bulkProfilePicUrl, setBulkProfilePicUrl] = useState("");
  const [bulkProfileFile, setBulkProfileFile] = useState<File | null>(null);
  const [bulkProfileRunning, setBulkProfileRunning] = useState(false);
  const [bulkProfileProgress, setBulkProfileProgress] = useState<{ done: number; total: number; current?: string }>({ done: 0, total: 0 });

  // Entrada automática em grupos durante o aquecimento
  const groupLinksTable = () => (supabase as any).from("warmup_group_links");
  const [groupLinks, setGroupLinks] = useState<Array<{ id: string; invite_url: string; label: string | null; threshold: number; active: boolean }>>([]);
  const [loadingGroupLinks, setLoadingGroupLinks] = useState(true);
  const [newGroupLink, setNewGroupLink] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupThreshold, setNewGroupThreshold] = useState(100);
  const [savingGroupLink, setSavingGroupLink] = useState(false);

  // Logs do warmup-group-chat
  const groupChatLogsTable = () => (supabase as any).from("warmup_group_chat_logs");
  type GroupChatLog = {
    id: string;
    created_at: string;
    cycle_id: string;
    link_id: string | null;
    group_jid: string | null;
    sender_name: string | null;
    sender_provider: string | null;
    status: string;
    http_status: number | null;
    error_message: string | null;
    message_preview: string | null;
  };
  const [chatLogs, setChatLogs] = useState<GroupChatLog[]>([]);
  const [loadingChatLogs, setLoadingChatLogs] = useState(false);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [logDate, setLogDate] = useState<string>(todayISO);
  const [logLinkFilter, setLogLinkFilter] = useState<string>("all");
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");

  const fetchChatLogs = async () => {
    setLoadingChatLogs(true);
    try {
      const start = new Date(`${logDate}T00:00:00`).toISOString();
      const end = new Date(`${logDate}T23:59:59.999`).toISOString();
      let q = groupChatLogsTable()
        .select("id, created_at, cycle_id, link_id, group_jid, sender_name, sender_provider, status, http_status, error_message, message_preview")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);
      if (logLinkFilter !== "all") q = q.eq("link_id", logLinkFilter);
      if (logStatusFilter !== "all") q = q.eq("status", logStatusFilter);
      const { data, error } = await q;
      if (error) throw error;
      setChatLogs((data || []) as GroupChatLog[]);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar logs");
    } finally {
      setLoadingChatLogs(false);
    }
  };

  useEffect(() => { fetchChatLogs(); }, [logDate, logLinkFilter, logStatusFilter]);

  const fetchGroupLinks = async () => {
    setLoadingGroupLinks(true);
    const { data, error } = await groupLinksTable()
      .select("id, invite_url, label, threshold, active")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar grupos");
    } else {
      setGroupLinks((data || []) as any);
    }
    setLoadingGroupLinks(false);
  };

  useEffect(() => { fetchGroupLinks(); }, []);

  const addGroupLink = async () => {
    const url = newGroupLink.trim();
    if (!/chat\.whatsapp\.com\//i.test(url)) {
      toast.error("Informe um link de convite válido (chat.whatsapp.com/...)");
      return;
    }
    const threshold = Math.max(1, Number(newGroupThreshold) || 100);
    setSavingGroupLink(true);
    const { error } = await groupLinksTable().insert({
      invite_url: url,
      label: newGroupLabel.trim() || null,
      threshold,
      active: true,
    });
    setSavingGroupLink(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Grupo adicionado");
    setNewGroupLink("");
    setNewGroupLabel("");
    setNewGroupThreshold(100);
    fetchGroupLinks();
  };

  const toggleGroupLink = async (id: string, active: boolean) => {
    const { error } = await groupLinksTable().update({ active }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchGroupLinks();
  };

  const deleteGroupLink = async (id: string) => {
    if (!confirm("Remover este grupo?")) return;
    const { error } = await groupLinksTable().delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); fetchGroupLinks(); }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const bulkUpdateProfile = async () => {
    const name = bulkProfileName.trim();
    const picUrl = bulkProfilePicUrl.trim();
    const hasFile = !!bulkProfileFile;
    if (!name && !picUrl && !hasFile) {
      toast.error("Informe um nome e/ou uma foto para atualizar");
      return;
    }
    if (instances.length === 0) {
      toast.error("Nenhuma instância disponível");
      return;
    }
    if (!confirm(`Aplicar alterações em ${instances.length} instância(s)?`)) return;

    setBulkProfileRunning(true);
    setBulkProfileProgress({ done: 0, total: instances.length });

    let pictureValue: string | null = null;
    if (hasFile) {
      try {
        pictureValue = await fileToBase64(bulkProfileFile!);
      } catch {
        toast.error("Falha ao ler arquivo de imagem");
        setBulkProfileRunning(false);
        return;
      }
    } else if (picUrl) {
      pictureValue = picUrl;
    }

    let okCount = 0;
    let failCount = 0;

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      setBulkProfileProgress({ done: i, total: instances.length, current: inst.instance_name });

      // Nome
      if (name) {
        try {
          const { data, error } = await supabase.functions.invoke("update-profile", {
            body: {
              type: "name",
              value: name,
              provider: "uazapi",
              apiUrl: inst.evolution_api_url,
              apiKey: inst.zapi_token,
            },
          });
          if (error || (data as any)?.error) {
            failCount++;
            console.error(`Nome falhou em ${inst.instance_name}:`, error || (data as any)?.error);
          } else {
            okCount++;
          }
        } catch (e) {
          failCount++;
          console.error(e);
        }
      }

      // Foto
      if (pictureValue) {
        try {
          const { data, error } = await supabase.functions.invoke("update-profile", {
            body: {
              type: "picture",
              value: pictureValue,
              provider: "uazapi",
              apiUrl: inst.evolution_api_url,
              apiKey: inst.zapi_token,
            },
          });
          if (error || (data as any)?.error) {
            failCount++;
            console.error(`Foto falhou em ${inst.instance_name}:`, error || (data as any)?.error);
          } else {
            okCount++;
          }
        } catch (e) {
          failCount++;
          console.error(e);
        }
      }

      // Pequeno delay entre instâncias
      await new Promise((r) => setTimeout(r, 400));
    }

    setBulkProfileProgress({ done: instances.length, total: instances.length });
    setBulkProfileRunning(false);
    if (failCount === 0) {
      toast.success(`Perfil atualizado em ${instances.length} instância(s)`);
    } else {
      toast.warning(`Concluído com ${okCount} sucesso(s) e ${failCount} falha(s). Veja o console.`);
    }
    refreshInstancePhones(instances);
  };

  const loadInstances = async () => {
    setLoadingInst(true);
    const { data, error } = await supabase
      .from("zapi_instances")
        .select("id,instance_name,zapi_instance_id,zapi_token,evolution_api_url,evolution_api_key,created_at,api_provider")
      .in("api_provider", ["uazapi", "uazapi_warmup"])
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setInstances((data as any) || []);
    }
    setLoadingInst(false);
  };

  const refreshInstancePhones = async (list: UazInstance[]) => {
    const results = await Promise.all(
      list.map(async (inst) => {
        try {
          const { data } = await supabase.functions.invoke("uazapi-status", {
            body: { 
              apiUrl: inst.evolution_api_url, 
              apiToken: inst.evolution_api_key || inst.zapi_token,
              instanceName: inst.instance_name
            },
          });
          return [
            inst.id,
            {
              phone: (data as any)?.phoneConnected || null,
              connected: !!(data as any)?.connected,
              name: (data as any)?.profileName || null,
            },
          ] as const;
        } catch {
          return [inst.id, { phone: null, connected: false, name: null }] as const;
        }
      })
    );
    setInstancePhones((prev) => {
      const next = { ...prev };
      for (const [id, info] of results) next[id] = info;
      return next;
    });
  };

  const loadHealth = async () => {
    const { data } = await (supabase as any)
      .from("warmup_instance_health")
      .select("instance_ref, phone, blocked_until, last_detected_at, block_type")
      .eq("block_type", "new_chat_capping");
    const byRef: Record<string, any> = {};
    const byPhone: Record<string, any> = {};
    for (const row of (data as any[]) || []) {
      byRef[row.instance_ref] = { blocked_until: row.blocked_until, last_detected_at: row.last_detected_at };
      if (row.phone) byPhone[row.phone] = { blocked_until: row.blocked_until, last_detected_at: row.last_detected_at };
    }
    setHealthByRef(byRef);
    setHealthByPhone(byPhone);
  };

  useEffect(() => {
    loadHealth();
    const t = setInterval(loadHealth, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (instances.length === 0) return;
    refreshInstancePhones(instances);
    const interval = setInterval(() => refreshInstancePhones(instances), 30000);
    return () => clearInterval(interval);
  }, [instances]);

  useEffect(() => {
    loadInstances();
  }, []);

  const fetchQr = async (inst: UazInstance, phone?: string) => {
    setQrLoading(true);
    setQrCode(null);
    setPairingCode(null);
    setConnectError(null);
    try {
      const { data: statusData } = await supabase.functions.invoke("uazapi-status", {
        body: { 
          apiUrl: inst.evolution_api_url, 
          apiToken: inst.evolution_api_key || inst.zapi_token,
          instanceName: inst.instance_name
        },
      });
      if ((statusData as any)?.connected) {
        setConnStatus("connected");
        return;
      }
      console.log("Chamando uazapi-connect para:", inst.instance_name);
      const { data, error } = await supabase.functions.invoke("uazapi-connect", {
        body: { 
          apiUrl: inst.evolution_api_url, 
          apiToken: inst.evolution_api_key || inst.zapi_token, 
          phone: phone || undefined, 
          instanceId: inst.id,
          instanceName: inst.instance_name 
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setConnStatus((data as any)?.connectionStatus || "connecting");
      setQrCode((data as any)?.qrCode || null);
      setPairingCode((data as any)?.pairingCode || null);
      if ((data as any)?.connected) setConnStatus("connected");
    } catch (err: any) {
      setConnectError(err.message || "Erro ao conectar instância");
      toast.error(err.message || "Erro ao conectar instância");
    } finally {
      setQrLoading(false);
    }
  };

  const openConnect = async (inst: UazInstance) => {
    setConnectInst(inst);
    setConnectOpen(true);
    setConnStatus("disconnected");
    setConnectMode("qr");
    setPairingPhone("");
    setConnectError(null);
    await fetchQr(inst);
  };

  // Polling do status enquanto o dialog está aberto
  useEffect(() => {
    if (!connectOpen || !connectInst) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke("uazapi-status", {
        body: { 
          apiUrl: connectInst.evolution_api_url, 
          apiToken: connectInst.evolution_api_key || connectInst.zapi_token,
          instanceName: connectInst.instance_name
        },
      });
      if ((data as any)?.connected) {
        setConnStatus("connected");
        setQrCode(null);
        setPairingCode(null);
        toast.success("Instância conectada!");
      } else if ((data as any)?.pairingCode && (data as any).pairingCode !== pairingCode) {
        setPairingCode((data as any).pairingCode);
      } else if ((data as any)?.qrCode && (data as any).qrCode !== qrCode) {
        setQrCode((data as any).qrCode);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connectOpen, connectInst, qrCode, pairingCode]);

  const removeInstance = async (inst: UazInstance) => {
    if (!confirm(`Remover instância "${inst.instance_name}"?`)) return;
    try {
      // Para instâncias de aquecimento (uazapi_warmup), tentamos desconectar primeiro
      if (inst.evolution_api_url && (inst.evolution_api_key || inst.zapi_token)) {
        try {
          await supabase.functions.invoke("uazapi-disconnect", {
            body: { 
              apiUrl: inst.evolution_api_url, 
              apiToken: inst.evolution_api_key || inst.zapi_token 
            },
          });
        } catch (e) {
          console.warn("Falha ao desconectar no servidor UAZAPI antes de excluir (provavelmente já desconectada):", e);
        }
      }

      // Remove diretamente do banco de dados (o RLS deve permitir para administradores)
      const { error: dbErr } = await supabase.from("zapi_instances").delete().eq("id", inst.id);
      
      if (dbErr) {
        console.error("Erro ao remover do banco:", dbErr);
        toast.error("Erro ao remover do banco: " + dbErr.message);
        return;
      }

      toast.success("Instância removida com sucesso");
      loadInstances();
    } catch (err: any) {
      console.error("Erro ao remover:", err);
      toast.error(err.message || "Erro inesperado ao remover");
    }
  };

  const createInstance = async () => {
    const name = instName.trim();
    if (!name) {
      toast.error("Informe um nome para a instância");
      return;
    }
    setCreatingInst(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Para instâncias de aquecimento, criamos o registro diretamente com o provedor correto
      const { error } = await supabase
        .from("zapi_instances")
        .insert({
          user_id: user.id,
          instance_name: name,
          api_provider: "uazapi_warmup",
          // Valores padrão para UAZAPI (zaplynx-uazapi-01)
          evolution_api_url: "https://zaplynx-uazapi-01.evolution-api.com",
          evolution_api_key: "3B8E3D7C6F2A4B1D9E0A7C5F3B8E3D7C",
          zapi_token: "3B8E3D7C6F2A4B1D9E0A7C5F3B8E3D7C", // Espelhado para compatibilidade
          zapi_instance_id: name,
          zapi_client_token: "zaplynx",
          is_active: true,
          is_default: false
        });

      if (error) throw error;

      toast.success("Instância de aquecimento criada com sucesso");
      setInstName("");
      setInstOpen(false);
      loadInstances();
    } catch (err: any) {
      console.error("Erro ao criar instância:", err);
      toast.error(err.message || "Erro ao criar instância");
    } finally {
      setCreatingInst(false);
    }
  };

  const migrateLegacyInstances = async () => {
    const legacy = instances.filter(i => (i as any).api_provider === 'uazapi');
    if (legacy.length === 0) return;
    setLoadingInst(true);
    try {
      const { error } = await supabase
        .from('zapi_instances')
        .update({ api_provider: 'uazapi_warmup' })
        .in('id', legacy.map(i => i.id));
      if (error) throw error;
      toast.success(`${legacy.length} instâncias migradas para o pool de aquecimento`);
      loadInstances();
    } catch (e: any) {
      toast.error('Erro ao migrar instâncias: ' + e.message);
    } finally {
      setLoadingInst(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await donorTable()
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setDonors((data as DonorNumber[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addOne = async () => {
    const p = normalize(phone);
    if (p.length < 8) {
      toast.error("Telefone inválido");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await donorTable().insert({
      phone: p,
      label: label.trim() || null,
      notes: notes.trim() || null,
      created_by: userData.user?.id || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Número adicionado");
    setPhone("");
    setLabel("");
    setNotes("");
    load();
  };

  const addBulk = async () => {
    const phones = parseBulk(bulk);
    if (!phones.length) {
      toast.error("Cole pelo menos um número válido");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const rows = phones.map((p) => ({
      phone: p,
      created_by: userData.user?.id || null,
    }));
    const { error } = await donorTable()
      .upsert(rows, { onConflict: "phone", ignoreDuplicates: true });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${phones.length} número(s) processado(s)`);
    setBulk("");
    load();
  };

  const toggleActive = async (id: string, next: boolean) => {
    const { error } = await donorTable()
      .update({ active: next })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDonors((prev) => prev.map((d) => (d.id === id ? { ...d, active: next } : d)));
  };

  const remove = async (id: string) => {
    const { error } = await donorTable().delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDonors((prev) => prev.filter((d) => d.id !== id));
    toast.success("Removido");
  };

  const activeCount = donors.filter((d) => d.active).length;

  const loadMessages = async () => {
    setLoadingMsgs(true);
    const { data, error } = await messageTable()
      .select("id,content,active")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setMessages((data as any) || []);
    setLoadingMsgs(false);
  };

  useEffect(() => { loadMessages(); }, []);

  const addMsg = async () => {
    const c = newMsg.trim();
    if (!c) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await messageTable().insert({ content: c, created_by: u.user?.id || null });
    if (error) { toast.error(error.message); return; }
    setNewMsg("");
    toast.success("Mensagem adicionada");
    loadMessages();
  };

  const importBulkMsgs = async () => {
    const lines = bulkMsg.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (!lines.length) { toast.error("Cole pelo menos uma mensagem"); return; }
    setImporting(true);
    const { data: u } = await supabase.auth.getUser();
    const rows = lines.slice(0, 800).map((content) => ({ content, created_by: u.user?.id || null }));
    const { error } = await messageTable().upsert(rows, { onConflict: "content", ignoreDuplicates: true });
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    setBulkMsg("");
    toast.success(`${rows.length} mensagem(ns) processada(s)`);
    loadMessages();
  };

  const loadDefaultPack = async () => {
    setImporting(true);
    const { data: u } = await supabase.auth.getUser();
    const rows = warmupMessagePack.map((content) => ({ content, created_by: u.user?.id || null }));
    // Insere em chunks para evitar payload grande demais
    const chunkSize = 200;
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await messageTable().upsert(chunk, { onConflict: "content", ignoreDuplicates: true });
      if (error) { toast.error(error.message); setImporting(false); return; }
      total += chunk.length;
    }
    setImporting(false);
    toast.success(`Pacote padrão importado (${total} mensagens)`);
    loadMessages();
  };

  const loadConversationPack = async () => {
    setImporting(true);
    const { data: u } = await supabase.auth.getUser();
    // Codifica cada par como "PERGUNTA||RESPOSTA" — o motor reconhece o separador e
    // faz a instância alvo responder reciprocamente à doadora.
    const rows = warmupConversationPack.map((p) => ({
      content: `${p.q}||${p.a}`,
      created_by: u.user?.id || null,
    }));
    const chunkSize = 200;
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await messageTable().upsert(chunk, { onConflict: "content", ignoreDuplicates: true });
      if (error) { toast.error(error.message); setImporting(false); return; }
      total += chunk.length;
    }
    setImporting(false);
    toast.success(`Pacote conversacional importado (${total} pares = ${total * 2} mensagens recíprocas)`);
    loadMessages();
  };

  const toggleMsg = async (id: string, next: boolean) => {
    const { error } = await messageTable().update({ active: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, active: next } : m)));
  };

  const removeMsg = async (id: string) => {
    const { error } = await messageTable().delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllMsgs = async () => {
    if (!confirm("Remover TODAS as mensagens do pool?")) return;
    const { error } = await messageTable().delete().not("id", "is", null);
    if (error) { toast.error(error.message); return; }
    toast.success("Pool zerado");
    loadMessages();
  };

  const activeMsgCount = messages.filter((m) => m.active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Flame className="w-6 h-6 text-primary" />
          Admin · Pool de Aquecimento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Números doadores que enviam mensagens para os números ativos no aquecimento. Apenas administradores enxergam esta página.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        {instances.some(i => (i as any).api_provider === 'uazapi') && (
          <Button size="sm" variant="outline" onClick={migrateLegacyInstances} className="border-orange-500 text-orange-500 hover:bg-orange-500/10">
            <ArrowRightLeft className="w-4 h-4 mr-1" />
            Migrar para Aquecimento
          </Button>
        )}
        <Dialog open={instOpen} onOpenChange={setInstOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Server className="w-4 h-4 mr-1" />
              Criar instância UAZAPI
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova instância UAZAPI</DialogTitle>
              <DialogDescription>
                Provisiona uma nova instância no servidor UAZAPI vinculada à sua conta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">Nome da instância</Label>
              <Input
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                placeholder="aquecimento-01"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setInstOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={createInstance} disabled={creatingInst}>
                {creatingInst ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instâncias UAZAPI criadas</CardTitle>
          <CardDescription>Conecte cada instância escaneando o QR Code</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingInst ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma instância UAZAPI criada
            </p>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => {
                const info = instancePhones[inst.id];
                const formatPhone = (p: string) => {
                  if (!p) return "";
                  if (p.length >= 12) {
                    return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ${p.slice(4, p.length - 4)}-${p.slice(-4)}`;
                  }
                  return `+${p}`;
                };
                return (
                <div
                  key={inst.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{inst.instance_name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        {inst.zapi_instance_id}
                      </p>
                      {info?.connected && info?.phone ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-500">
                            {formatPhone(info.phone)}
                          </span>
                          {info.name && (
                            <span className="text-[11px] text-muted-foreground truncate">
                              · {info.name}
                            </span>
                          )}
                        </div>
                      ) : info ? (
                        <p className="text-[11px] text-destructive mt-1">Desconectado</p>
                      ) : null}
                      {(() => {
                        const h = healthByRef[inst.id] || (info?.phone ? healthByPhone[info.phone] : undefined);
                        if (!h) return null;
                        const until = h.blocked_until ? new Date(h.blocked_until) : null;
                        const label = until
                          ? `Limite atingido · libera ${until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
                          : "Limite atingido";
                        return (
                          <Badge variant="destructive" className="mt-1 text-[10px]">
                            {label}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openConnect(inst)}>
                      <QrCode className="w-4 h-4 mr-1" />
                      Conectar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeInstance(inst)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Atualizar perfil de todas as instâncias
          </CardTitle>
          <CardDescription>
            Aplica o mesmo nome e/ou foto de perfil em todas as conexões listadas acima. Apenas instâncias conectadas serão atualizadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Novo nome de perfil</Label>
              <Input
                value={bulkProfileName}
                onChange={(e) => setBulkProfileName(e.target.value)}
                placeholder="Ex.: Atendimento"
                disabled={bulkProfileRunning}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">URL da nova foto (https://...)</Label>
              <Input
                value={bulkProfilePicUrl}
                onChange={(e) => setBulkProfilePicUrl(e.target.value)}
                placeholder="https://exemplo.com/foto.jpg"
                disabled={bulkProfileRunning || !!bulkProfileFile}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> ou envie um arquivo de imagem
            </Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setBulkProfileFile(e.target.files?.[0] || null)}
              disabled={bulkProfileRunning || !!bulkProfilePicUrl}
            />
            {bulkProfileFile && (
              <p className="text-[11px] text-muted-foreground">
                Selecionado: {bulkProfileFile.name}
              </p>
            )}
          </div>

          {bulkProfileRunning && (
            <div className="text-xs text-muted-foreground">
              Processando {bulkProfileProgress.done}/{bulkProfileProgress.total}
              {bulkProfileProgress.current ? ` — ${bulkProfileProgress.current}` : ""}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={bulkUpdateProfile} disabled={bulkProfileRunning || instances.length === 0}>
              {bulkProfileRunning ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <UserCog className="w-4 h-4 mr-1" />
              )}
              Aplicar em {instances.length} instância(s)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users2 className="w-5 h-5 text-primary" />
            Entrada automática em grupos
          </CardTitle>
          <CardDescription>
            Cada número aquecido entrará nestes grupos automaticamente conforme o
            progresso atingir o limite definido (ex.: a cada 100 mensagens recebidas).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-6">
              <Label className="text-xs">Link de convite</Label>
              <Input
                placeholder="https://chat.whatsapp.com/XXXXXXXXXXXX"
                value={newGroupLink}
                onChange={(e) => setNewGroupLink(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Apelido (opcional)</Label>
              <Input
                placeholder="Grupo VIP"
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">A cada N msgs</Label>
              <Input
                type="number"
                min={1}
                value={newGroupThreshold}
                onChange={(e) => setNewGroupThreshold(Number(e.target.value) || 100)}
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button
                onClick={addGroupLink}
                disabled={savingGroupLink}
                className="w-full"
              >
                {savingGroupLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {loadingGroupLinks ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : groupLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum grupo cadastrado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {groupLinks.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50"
                >
                  <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {g.label || "Grupo"}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        a cada {g.threshold} msgs
                      </Badge>
                      {!g.active && <Badge variant="outline" className="text-xs">Pausado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{g.invite_url}</p>
                  </div>
                  <Switch
                    checked={g.active}
                    onCheckedChange={(v) => toggleGroupLink(g.id, v)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGroupLink(g.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            ℹ️ Cada instância entra apenas uma vez em cada grupo. Quando o progresso
            do dia ultrapassar o limite, a próxima instância elegível será adicionada
            automaticamente em um dos grupos disponíveis.
          </p>
        </CardContent>
      </Card>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar {connectInst?.instance_name}</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp → Aparelhos conectados → Conectar aparelho
            </DialogDescription>
          </DialogHeader>
          {connStatus !== "connected" && (
            <div className="flex gap-2 justify-center">
              <Button
                size="sm"
                variant={connectMode === "qr" ? "default" : "outline"}
                onClick={() => {
                  setConnectMode("qr");
                  setPairingCode(null);
                  if (connectInst) fetchQr(connectInst);
                }}
              >
                QR Code
              </Button>
              <Button
                size="sm"
                variant={connectMode === "pairing" ? "default" : "outline"}
                onClick={() => {
                  setConnectMode("pairing");
                  setQrCode(null);
                }}
              >
                Código de pareamento
              </Button>
            </div>
          )}
          {connectMode === "pairing" && connStatus !== "connected" && (
            <div className="flex flex-col gap-2 px-1">
              <Label className="text-xs">Telefone (DDI+DDD+Número)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="5511999999999"
                  value={pairingPhone}
                  onChange={(e) => setPairingPhone(e.target.value.replace(/\D/g, ""))}
                />
                <Button
                  size="sm"
                  onClick={() => connectInst && fetchQr(connectInst, pairingPhone)}
                  disabled={qrLoading || pairingPhone.length < 10}
                >
                  Gerar código
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Digite o número e abra WhatsApp → Aparelhos conectados → Conectar com número de telefone
              </p>
            </div>
          )}
          <div className="flex flex-col items-center justify-center py-4 min-h-[280px]">
            {connStatus === "connected" ? (
              <div className="flex flex-col items-center gap-2 text-primary">
                <CheckCircle2 className="w-12 h-12" />
                <p className="font-medium">Conectado!</p>
              </div>
            ) : qrLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : connectMode === "qr" && qrCode ? (
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code"
                className="w-64 h-64"
              />
            ) : connectMode === "pairing" && pairingCode ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">Seu código:</p>
                <p className="text-3xl font-mono font-bold tracking-widest">{pairingCode}</p>
              </div>
            ) : connectError ? (
              <div className="flex flex-col items-center gap-2 text-center max-w-sm">
                <p className="text-sm text-destructive">{connectError}</p>
                <p className="text-xs text-muted-foreground">
                  Tente novamente em instância desconectada ou recrie a instância se ela ficou presa no QR Code.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {connectMode === "qr" ? "Aguardando QR Code..." : "Informe o telefone para gerar o código"}
              </p>
            )}
            {connectMode === "qr" && pairingCode && (
              <p className="mt-3 text-sm">
                Código de pareamento: <span className="font-mono font-bold">{pairingCode}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => connectInst && fetchQr(connectInst, connectMode === "pairing" ? pairingPhone : undefined)}
              disabled={qrLoading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setConnectOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{donors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inativos</p>
            <p className="text-2xl font-bold">{donors.length - activeCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar número</CardTitle>
          <CardDescription>Inclua um doador individual com rótulo e observação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Telefone (DDI+DDD)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511999990001"
              />
            </div>
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Chip 01" />
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <Button onClick={addOne} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Importar em lote</CardTitle>
          <CardDescription>Cole múltiplos números (um por linha)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={5}
            placeholder="5511999990001&#10;5511999990002&#10;5511999990003"
          />
          <Button onClick={addBulk} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Importar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pool de doadores</CardTitle>
          <CardDescription>Ative/desative ou remova números</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : donors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum número cadastrado</p>
          ) : (
            <div className="space-y-2">
              {donors.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{d.phone}</span>
                        {d.label && <Badge variant="outline" className="text-[10px]">{d.label}</Badge>}
                        <Badge variant={d.active ? "default" : "secondary"} className="text-[10px]">
                          {d.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {d.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{d.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.active} onCheckedChange={(v) => toggleActive(d.id, v)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => remove(d.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg">Mensagens do aquecimento</CardTitle>
              <CardDescription>
                Pool global usado pelas instâncias doadoras (até 800)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{activeMsgCount} ativas / {messages.length} total</Badge>
              <Button variant="outline" size="sm" onClick={loadDefaultPack} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Carregar pacote (800)
              </Button>
              <Button variant="default" size="sm" onClick={loadConversationPack} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Pacote conversa recíproca (1000)
              </Button>
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllMsgs} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" /> Limpar tudo
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Nova mensagem..."
              onKeyDown={(e) => e.key === "Enter" && addMsg()}
            />
            <Button onClick={addMsg} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Importar várias (uma por linha)</Label>
            <Textarea
              value={bulkMsg}
              onChange={(e) => setBulkMsg(e.target.value)}
              rows={4}
              placeholder="Oi! Tudo bem?&#10;Bom dia!&#10;Como vai?"
            />
            <Button onClick={importBulkMsgs} size="sm" variant="outline" disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Importar
            </Button>
          </div>

          {loadingMsgs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem cadastrada</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/20"
                >
                  {m.content.includes("||") ? (
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="text-muted-foreground">📤 </span>
                      <span className="truncate">{m.content.split("||")[0]}</span>
                      <span className="text-primary"> ↩ </span>
                      <span className="truncate text-muted-foreground">{m.content.split("||")[1]}</span>
                    </div>
                  ) : (
                    <span className="text-sm truncate flex-1">{m.content}</span>
                  )}
                  <Switch checked={m.active} onCheckedChange={(v) => toggleMsg(m.id, v)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeMsg(m.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users2 className="w-5 h-5" /> Logs · Conversas em grupos
              </CardTitle>
              <CardDescription>
                Mensagens enviadas pelo motor de aquecimento dentro dos grupos. Filtre por data, grupo e status.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  try {
                    toast.loading("Disparando ciclo manual...", { id: "warmup-chat-run" });
                    const { data, error } = await supabase.functions.invoke("warmup-group-chat", { body: {} });
                    if (error) throw error;
                    toast.success(`Ciclo executado: ${data?.sent ?? 0} enviadas / ${data?.errors ?? 0} erros`, { id: "warmup-chat-run" });
                    setTimeout(fetchChatLogs, 1500);
                  } catch (e: any) {
                    toast.error(e?.message || "Falha ao executar ciclo", { id: "warmup-chat-run" });
                  }
                }}
              >
                Executar agora
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    toast.loading("Disparando com TODAS as instâncias...", { id: "warmup-chat-all" });
                    const { data, error } = await supabase.functions.invoke("warmup-group-chat", { body: { sendAll: true } });
                    if (error) throw error;
                    toast.success(`Ciclo completo: ${data?.sent ?? 0} enviadas / ${data?.failed ?? 0} erros`, { id: "warmup-chat-all" });
                    setTimeout(fetchChatLogs, 1500);
                  } catch (e: any) {
                    toast.error(e?.message || "Falha ao executar ciclo", { id: "warmup-chat-all" });
                  }
                }}
              >
                Enviar com todas
              </Button>
              <Button variant="outline" size="sm" onClick={fetchChatLogs} disabled={loadingChatLogs}>
                {loadingChatLogs ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Grupo</Label>
              <Select value={logLinkFilter} onValueChange={setLogLinkFilter}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {groupLinks.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.label || g.invite_url.replace(/^https?:\/\//, "").slice(0, 40)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Enviadas</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(() => {
            const total = chatLogs.length;
            const ok = chatLogs.filter((l) => l.status === "success").length;
            const err = total - ok;
            const cycles = new Set(chatLogs.map((l) => l.cycle_id)).size;
            return (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Total: {total}</Badge>
                <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Enviadas: {ok}</Badge>
                <Badge variant="destructive">Erros: {err}</Badge>
                <Badge variant="outline">Ciclos: {cycles}</Badge>
              </div>
            );
          })()}

          {loadingChatLogs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : chatLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum envio registrado para os filtros selecionados.
            </p>
          ) : (
            <div className="border rounded-md divide-y max-h-[480px] overflow-auto">
              {chatLogs.map((l) => {
                const link = groupLinks.find((g) => g.id === l.link_id);
                const groupLabel = link?.label || (l.group_jid ? l.group_jid.replace(/@g\.us$/, "") : "—");
                const time = new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                return (
                  <div key={l.id} className="px-3 py-2 text-xs flex items-start gap-3">
                    <span className="text-muted-foreground tabular-nums w-20 shrink-0">{time}</span>
                    {l.status === "success" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 shrink-0">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="shrink-0">{l.http_status || "ERR"}</Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="font-medium truncate">{l.sender_name || "—"}</span>
                        <span className="text-muted-foreground">→ {groupLabel}</span>
                        {l.sender_provider && (
                          <span className="text-muted-foreground/70 uppercase text-[10px]">{l.sender_provider}</span>
                        )}
                      </div>
                      {l.message_preview && (
                        <div className="text-muted-foreground truncate">"{l.message_preview}"</div>
                      )}
                      {l.error_message && (
                        <div className="text-destructive truncate">{l.error_message}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}