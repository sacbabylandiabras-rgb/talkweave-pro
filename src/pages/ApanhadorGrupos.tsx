import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Search, Download, RefreshCw, Users, Eye, Loader2, Copy, Check, MessageCircle, ChevronDown, ChevronUp, FileText, Workflow, Smartphone, CheckSquare, Plug } from "lucide-react";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { useGroupWelcome } from "@/hooks/useGroupWelcome";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TemplateOption {
  id: string;
  name: string;
  category: string;
}

interface FlowOption {
  id: string;
  name: string;
  keyword: string;
}

const ApanhadorGrupos = () => {
  const [busca, setBusca] = useState("");
  const { groups, loading, refetch } = useWhatsAppGroups({ provider: 'uazapi' });
  const { configs: welcomeConfigs, saveConfig, refetch: refetchWelcome } = useGroupWelcome();
  const { instances } = useZapiInstances();
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractedNumbers, setExtractedNumbers] = useState<Map<string, string[]>>(new Map());
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedWelcome, setExpandedWelcome] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Map<string, string>>(new Map());
  const [editingType, setEditingType] = useState<Map<string, string>>(new Map());
  const [editingTemplateId, setEditingTemplateId] = useState<Map<string, string>>(new Map());
  const [editingFlowId, setEditingFlowId] = useState<Map<string, string>>(new Map());
  const [editingInstanceId, setEditingInstanceId] = useState<Map<string, string>>(new Map());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [bulkActivating, setBulkActivating] = useState(false);

  // Conectar instância uazapi via QR Code
  const [connectOpen, setConnectOpen] = useState(false);
  const [uazapiAccounts, setUazapiAccounts] = useState<{ label: string; url: string; token: string }[]>([]);
  const [activeAccountIdx, setActiveAccountIdx] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<string>('disconnected');
  const [connectMode, setConnectMode] = useState<'qr' | 'pairing'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');

  const loadUazapiAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('profiles')
      .select('uazapi_url, uazapi_token')
      .eq('id', user.id)
      .maybeSingle();
    const urls = (data?.uazapi_url || '').split('|').filter(Boolean);
    const tokens = (data?.uazapi_token || '').split('|').filter(Boolean);
    const accounts = urls.map((url, i) => ({
      label: `Instância #${i + 1}`,
      url: url.trim(),
      token: (tokens[i] || '').trim(),
    })).filter(a => a.url && a.token);
    setUazapiAccounts(accounts);
    return accounts;
  };

  const fetchQrFor = async (account: { url: string; token: string }, phone?: string) => {
    setQrLoading(true);
    setQrCode(null);
    setPairingCode(null);
    try {
      // Verifica status primeiro
      const { data: statusData } = await supabase.functions.invoke('uazapi-status', {
        body: { apiUrl: account.url, apiToken: account.token },
      });
      if (statusData?.connected) {
        setConnStatus('connected');
        setQrLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('uazapi-connect', {
        body: { apiUrl: account.url, apiToken: account.token, phone: phone || undefined },
      });
      if (error) throw error;
      setConnStatus(data?.connectionStatus || 'connecting');
      setQrCode(data?.qrCode || null);
      setPairingCode(data?.pairingCode || null);
      if (data?.connected) setConnStatus('connected');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar instância');
    } finally {
      setQrLoading(false);
    }
  };

  const requestPairingCode = async () => {
    const account = uazapiAccounts[activeAccountIdx];
    if (!account) return;
    const phone = pairingPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Informe o número completo com DDI e DDD (ex: 5511999999999)');
      return;
    }
    await fetchQrFor(account, phone);
  };

  const openConnectDialog = async () => {
    setConnectOpen(true);
    setActiveAccountIdx(0);
    setQrCode(null);
    setPairingCode(null);
    setConnStatus('disconnected');
    setConnectMode('qr');
    setPairingPhone('');
    const accounts = await loadUazapiAccounts();
    if (accounts.length > 0) {
      await fetchQrFor(accounts[0]);
    }
  };

  // Polling: refresh status while dialog is open and not connected
  useEffect(() => {
    if (!connectOpen) return;
    if (uazapiAccounts.length === 0) return;
    const account = uazapiAccounts[activeAccountIdx];
    if (!account) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke('uazapi-status', {
        body: { apiUrl: account.url, apiToken: account.token },
      });
      if (data?.connected) {
        setConnStatus('connected');
        setQrCode(null);
        setPairingCode(null);
        toast.success(`${account ? `Instância #${activeAccountIdx + 1}` : 'Instância'} conectada!`);
        refetch();
      } else if (data?.qrCode && data.qrCode !== qrCode) {
        setQrCode(data.qrCode);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connectOpen, uazapiAccounts, activeAccountIdx, qrCode, refetch]);

  const switchAccount = async (idx: number) => {
    setActiveAccountIdx(idx);
    setConnStatus('disconnected');
    if (uazapiAccounts[idx]) {
      await fetchQrFor(uazapiAccounts[idx]);
    }
  };

  // Load templates and flows
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [flows, setFlows] = useState<FlowOption[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      const [tplRes, flowRes] = await Promise.all([
        supabase.from('message_templates').select('id, name, category').eq('active', true).order('name'),
        supabase.from('flow_automations').select('id, name, keyword').eq('active', true).order('name'),
      ]);
      if (tplRes.data) setTemplates(tplRes.data);
      if (flowRes.data) setFlows(flowRes.data);
    };
    loadOptions();
  }, []);

  const filteredGroups = groups.filter((grupo) => {
    const query = busca.toLowerCase();
    return (
      grupo.nome.toLowerCase().includes(query) ||
      grupo.descricao.toLowerCase().includes(query)
    );
  });

  const getGroupWelcomeId = (groupId: string) => {
    if (groupId.includes('@g.us')) return groupId.replace('@g.us', '-group');
    if (groupId.includes('-group')) return groupId;
    return groupId + '-group';
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const allIds = filteredGroups.map(g => g.id);
    const allSelected = allIds.every(id => selectedGroups.has(id));
    if (allSelected) {
      setSelectedGroups(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedGroups(prev => {
        const next = new Set(prev);
        allIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const bulkActivateWelcome = async (active: boolean) => {
    if (selectedGroups.size === 0) {
      toast.error('Selecione ao menos um grupo');
      return;
    }
    setBulkActivating(true);
    let success = 0;
    let failed = 0;
    try {
      for (const groupId of selectedGroups) {
        const grupo = groups.find(g => g.id === groupId);
        if (!grupo) continue;
        const welcomeGroupId = getGroupWelcomeId(grupo.id);
        const existing = welcomeConfigs.find(c => c.group_id === welcomeGroupId);
        try {
          await saveConfig(
            welcomeGroupId,
            grupo.nome,
            active,
            {
              message: existing?.message ?? 'Olá {{nome}}! 👋 Bem-vindo ao grupo!',
              response_type: (existing?.response_type as any) ?? 'text',
              template_id: existing?.template_id ?? null,
              flow_id: existing?.flow_id ?? null,
              instance_id: existing?.instance_id ?? null,
            },
            { silent: true, refetch: false }
          );
          success++;
        } catch {
          failed++;
        }
      }
      if (success > 0) {
        toast.success(
          active
            ? `Boas-vindas ativadas em ${success} grupo(s)${failed ? ` (${failed} falharam)` : ''}`
            : `Boas-vindas desativadas em ${success} grupo(s)${failed ? ` (${failed} falharam)` : ''}`
        );
      } else if (failed > 0) {
        toast.error(`Falha ao atualizar ${failed} grupo(s)`);
      }
      setSelectedGroups(new Set());
      await refetchWelcome();
    } finally {
      setBulkActivating(false);
    }
  };

  const extractParticipants = async (
    groupId: string,
    fallbackParticipants: any[] = [],
    sourceInstanceId?: string | null,
  ) => {
    setExtracting(groupId);
    try {
      const { data, error } = await supabase.functions.invoke('get-group-participants', {
        body: { groupId, fallbackParticipants, sourceInstanceId },
      });
      if (error) throw error;
      const phones = (data.participants || [])
        .map((p: any) => p.phone)
        .filter((p: string) => p && p.length > 5);
      setExtractedNumbers(prev => new Map(prev).set(groupId, phones));
      if (data.unresolvedLids > 0) {
        toast.success(`${phones.length} contatos extraídos (${data.unresolvedLids} com @lid).`);
      } else if (data.partialAdminsOnlyFallback) {
        toast.warning('Esta comunidade retornou apenas admins na listagem.');
      } else {
        toast.success(`${phones.length} números extraídos!`);
      }
    } catch (err: any) {
      console.error('Erro ao extrair participantes:', err);
      toast.error('Erro ao extrair participantes do grupo');
    } finally {
      setExtracting(null);
    }
  };

  const copyNumbers = (groupId: string) => {
    const numbers = extractedNumbers.get(groupId);
    if (!numbers) return;
    navigator.clipboard.writeText(numbers.join('\n'));
    setCopied(groupId);
    toast.success('Números copiados!');
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadNumbers = (groupId: string, groupName: string) => {
    const numbers = extractedNumbers.get(groupId);
    if (!numbers) return;
    const blob = new Blob([numbers.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_numeros.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = (groupId: string, groupName: string) => {
    const numbers = extractedNumbers.get(groupId);
    if (!numbers || numbers.length === 0) return;
    const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const header = ['Grupo', 'Telefone'].map(escape).join(',');
    const rows = numbers.map((phone) => [groupName, phone].map(escape).join(','));
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV baixado!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Apanhador de Grupos</h1>
          <p className="text-muted-foreground">Visualize seus grupos do WhatsApp e extraia números dos participantes</p>
        </div>
        <Button
          onClick={openConnectDialog}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Plug className="w-4 h-4" />
          Conectar Instância
        </Button>
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="w-5 h-5" /> Conectar Instância
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code ou use o código de pareamento para conectar.
            </DialogDescription>
          </DialogHeader>

          {uazapiAccounts.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhuma instância uazapi cadastrada na sua conta.
              </p>
              <p className="text-xs text-muted-foreground">
                Solicite ao administrador para configurar suas credenciais uazapi.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {uazapiAccounts.length > 1 && (
                <div className="flex gap-2">
                  {uazapiAccounts.map((acc, idx) => (
                    <Button
                      key={idx}
                      size="sm"
                      variant={idx === activeAccountIdx ? 'default' : 'outline'}
                      onClick={() => switchAccount(idx)}
                      className="flex-1"
                    >
                      {acc.label}
                    </Button>
                  ))}
                </div>
              )}

              {connStatus !== 'connected' && (
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  <Button
                    size="sm"
                    variant={connectMode === 'qr' ? 'default' : 'ghost'}
                    onClick={() => {
                      setConnectMode('qr');
                      fetchQrFor(uazapiAccounts[activeAccountIdx]);
                    }}
                    className="flex-1"
                  >
                    QR Code
                  </Button>
                  <Button
                    size="sm"
                    variant={connectMode === 'pairing' ? 'default' : 'ghost'}
                    onClick={() => {
                      setConnectMode('pairing');
                      setQrCode(null);
                      setPairingCode(null);
                    }}
                    className="flex-1"
                  >
                    Código de Pareamento
                  </Button>
                </div>
              )}

              <div className="border border-border rounded-lg p-6 flex flex-col items-center justify-center min-h-[320px] bg-muted/20">
                {qrLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {connectMode === 'pairing' ? 'Gerando código...' : 'Gerando QR Code...'}
                    </p>
                  </div>
                ) : connStatus === 'connected' ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="font-medium text-foreground">Instância conectada!</p>
                    <p className="text-xs text-muted-foreground">Pronta para usar no Apanhador de Grupos.</p>
                  </div>
                ) : connectMode === 'pairing' ? (
                  pairingCode ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <p className="text-xs text-muted-foreground">Seu código de pareamento:</p>
                      <div className="px-6 py-4 bg-background border-2 border-primary/40 rounded-lg">
                        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">
                          {pairingCode}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground max-w-xs space-y-1">
                        <p>1. Abra o WhatsApp no celular</p>
                        <p>2. Vá em <strong>Aparelhos conectados</strong></p>
                        <p>3. Toque em <strong>Conectar com número</strong></p>
                        <p>4. Digite o código acima</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Número de WhatsApp (com DDI e DDD)
                        </label>
                        <Input
                          type="tel"
                          placeholder="5511999999999"
                          value={pairingPhone}
                          onChange={(e) => setPairingPhone(e.target.value.replace(/\D/g, ''))}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Apenas números. Ex: 55 (Brasil) + 11 (DDR) + número
                        </p>
                      </div>
                      <Button
                        onClick={requestPairingCode}
                        disabled={qrLoading || pairingPhone.length < 10}
                        className="w-full gap-2"
                      >
                        <Smartphone className="w-4 h-4" />
                        Gerar Código
                      </Button>
                    </div>
                  )
                ) : qrCode ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="QR Code"
                      className="w-64 h-64 bg-white p-2 rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-sm text-muted-foreground">QR Code indisponível.</p>
                    <Button size="sm" variant="outline" onClick={() => fetchQrFor(uazapiAccounts[activeAccountIdx])}>
                      <RefreshCw className="w-4 h-4 mr-1" /> Tentar novamente
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {uazapiAccounts.length > 0 && connStatus !== 'connected' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (connectMode === 'pairing') {
                    if (pairingCode) {
                      setPairingCode(null);
                    } else {
                      requestPairingCode();
                    }
                  } else {
                    fetchQrFor(uazapiAccounts[activeAccountIdx]);
                  }
                }}
                disabled={qrLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${qrLoading ? 'animate-spin' : ''}`} />
                {connectMode === 'pairing' ? (pairingCode ? 'Novo código' : 'Gerar código') : 'Atualizar QR'}
              </Button>
            )}
            <Button onClick={() => setConnectOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Grupos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
            <p className="text-xs text-muted-foreground">Grupos encontrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups.reduce((sum, g) => sum + g.membros, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Contatos nos grupos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grupos Admin</CardTitle>
            <Eye className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.filter(g => g.isAdmin).length}</div>
            <p className="text-xs text-muted-foreground">Você é administrador</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Boas-vindas Ativas</CardTitle>
            <MessageCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{welcomeConfigs.filter(c => c.active).length}</div>
            <p className="text-xs text-muted-foreground">Grupos com boas-vindas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Grupos do WhatsApp</CardTitle>
              <CardDescription>Clique em "Extrair Números" para obter os telefones dos participantes</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => { setExtractedNumbers(new Map()); refetch(); }}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar grupos por nome ou descrição..."
                className="pl-10"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredGroups.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAllVisible}
              className="gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              {filteredGroups.every(g => selectedGroups.has(g.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedGroups.size} grupo(s) selecionado(s)
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                onClick={() => bulkActivateWelcome(true)}
                disabled={bulkActivating || selectedGroups.size === 0}
                className="gap-2"
              >
                {bulkActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                Ativar boas-vindas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkActivateWelcome(false)}
                disabled={bulkActivating || selectedGroups.size === 0}
              >
                Desativar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Buscando grupos...</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">
              {busca ? "Nenhum grupo encontrado" : "Nenhum grupo disponível"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {busca ? "Tente buscar com outro termo" : "Verifique se sua instância está conectada"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((grupo) => {
            const numbers = extractedNumbers.get(grupo.id);
            const welcomeGroupId = getGroupWelcomeId(grupo.id);
            const welcomeConfig = welcomeConfigs.find(c => c.group_id === welcomeGroupId);
            const isWelcomeActive = welcomeConfig?.active || false;
            const isExpanded = expandedWelcome === grupo.id;

            const currentType = editingType.get(grupo.id) ?? welcomeConfig?.response_type ?? 'text';
            const currentMessage = editingMessage.get(grupo.id) ?? welcomeConfig?.message ?? 'Olá {{nome}}! 👋 Bem-vindo ao grupo!';
            const currentTemplateId = editingTemplateId.get(grupo.id) ?? welcomeConfig?.template_id ?? '';
            const currentFlowId = editingFlowId.get(grupo.id) ?? welcomeConfig?.flow_id ?? '';
            const currentInstanceId = editingInstanceId.get(grupo.id) ?? welcomeConfig?.instance_id ?? '';

            return (
              <Card key={grupo.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedGroups.has(grupo.id)}
                      onCheckedChange={() => toggleGroupSelection(grupo.id)}
                      aria-label={`Selecionar ${grupo.nome}`}
                    />
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={grupo.foto || undefined} alt={grupo.nome} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {grupo.nome.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-base truncate">{grupo.nome}</h3>
                        {grupo.isAdmin && <Badge variant="default" className="text-xs">Admin</Badge>}
                        {grupo.isCommunity && <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">Comunidade</Badge>}
                        {isWelcomeActive && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            {currentType === 'template' ? <FileText className="h-3 w-3" /> :
                             currentType === 'flow' ? <Workflow className="h-3 w-3" /> :
                             <MessageCircle className="h-3 w-3" />}
                            Boas-vindas
                          </Badge>
                        )}
                      </div>
                      {grupo.descricao && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{grupo.descricao}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {grupo.membros > 0 ? `${grupo.membros} membros` : "Clique em 'Extrair Números' para ver"}
                        </span>
                        {numbers && (
                          <Badge variant="secondary" className="text-xs">{numbers.length} números extraídos</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedWelcome(isExpanded ? null : grupo.id)}
                        className="text-muted-foreground"
                        title="Mensagem de boas-vindas"
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>

                      {numbers ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => copyNumbers(grupo.id)}>
                            {copied === grupo.id ? <Check className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
                            Copiar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => downloadNumbers(grupo.id, grupo.nome)}>
                            <Download className="w-4 h-4 mr-1" />
                            Baixar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => downloadCsv(grupo.id, grupo.nome)}>
                            <Download className="w-4 h-4 mr-1" />
                            CSV
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => extractParticipants(grupo.id, grupo.participantes || [], grupo.sourceInstanceId)}
                          disabled={extracting === grupo.id}
                        >
                          {extracting === grupo.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
                          Extrair Números
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Welcome message config panel */}
                  {isExpanded && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">Mensagem de Boas-vindas</span>
                        </div>
                         <Switch
                          checked={isWelcomeActive}
                          onCheckedChange={(checked) => {
                            saveConfig(welcomeGroupId, grupo.nome, checked, {
                              message: currentMessage,
                              response_type: currentType as any,
                              template_id: currentTemplateId || null,
                              flow_id: currentFlowId || null,
                              instance_id: currentInstanceId || null,
                            });
                          }}
                        />
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo de Resposta</label>
                          <Select
                            value={currentType}
                            onValueChange={(val) => setEditingType(prev => new Map(prev).set(grupo.id, val))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">
                                <span className="flex items-center gap-2">
                                  <MessageCircle className="h-3.5 w-3.5" /> Mensagem de Texto
                                </span>
                              </SelectItem>
                              <SelectItem value="template">
                                <span className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5" /> Modelo
                                </span>
                              </SelectItem>
                              <SelectItem value="flow">
                                <span className="flex items-center gap-2">
                                  <Workflow className="h-3.5 w-3.5" /> Fluxo Visual
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {currentType === 'text' && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">
                              Use {'{{nome}}'} para o nome do participante.
                            </p>
                            <Textarea
                              value={currentMessage}
                              onChange={(e) => setEditingMessage(prev => new Map(prev).set(grupo.id, e.target.value))}
                              placeholder="Digite a mensagem de boas-vindas..."
                              className="min-h-[80px] text-sm"
                            />
                          </div>
                        )}

                        {currentType === 'template' && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Selecione o Modelo</label>
                            {templates.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhum modelo ativo encontrado. Crie um em Modelos.</p>
                            ) : (
                              <Select
                                value={currentTemplateId}
                                onValueChange={(val) => setEditingTemplateId(prev => new Map(prev).set(grupo.id, val))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Escolha um modelo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {templates.map(tpl => (
                                    <SelectItem key={tpl.id} value={tpl.id}>
                                      {tpl.name} <span className="text-muted-foreground ml-1">({tpl.category})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}

                        {currentType === 'flow' && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Selecione o Fluxo</label>
                            {flows.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhum fluxo ativo encontrado. Crie um em Fluxo Visual.</p>
                            ) : (
                              <Select
                                value={currentFlowId}
                                onValueChange={(val) => setEditingFlowId(prev => new Map(prev).set(grupo.id, val))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Escolha um fluxo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {flows.map(flow => (
                                    <SelectItem key={flow.id} value={flow.id}>
                                      {flow.name} {flow.keyword && <span className="text-muted-foreground ml-1">(#{flow.keyword})</span>}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}

                        {instances.length >= 1 && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                              <Smartphone className="h-3.5 w-3.5" />
                              Instância de Disparo
                            </label>
                            <Select
                              value={currentInstanceId || "auto"}
                              onValueChange={(val) => setEditingInstanceId(prev => new Map(prev).set(grupo.id, val === "auto" ? "" : val))}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Automática (mesma do grupo)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">🔄 Automática (mesma do grupo)</SelectItem>
                                {instances.map(inst => (
                                  <SelectItem key={inst.id} value={inst.id}>
                                    {inst.instance_name} {inst.is_default ? "(Padrão)" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Escolha qual número vai enviar a mensagem de boas-vindas
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => {
                            saveConfig(welcomeGroupId, grupo.nome, true, {
                              message: currentMessage,
                              response_type: currentType as any,
                              template_id: currentTemplateId || null,
                              flow_id: currentFlowId || null,
                              instance_id: currentInstanceId || null,
                            });
                          }}
                        >
                          Salvar Configuração
                        </Button>
                      </div>
                    </div>
                  )}

                  {numbers && numbers.length > 0 && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">Números extraídos ({numbers.length}):</p>
                      <div className="max-h-32 overflow-y-auto text-xs font-mono text-foreground space-y-0.5">
                        {numbers.map((num, i) => <div key={i}>{num}</div>)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApanhadorGrupos;
