import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Flame, Loader2, Phone, Server, QrCode, RefreshCw, CheckCircle2 } from "lucide-react";
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
import { toast } from "sonner";

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
  zapi_instance_id: string;
  zapi_token: string;
  evolution_api_url: string;
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
  const [instOpen, setInstOpen] = useState(false);
  const [instName, setInstName] = useState("");
  const [creatingInst, setCreatingInst] = useState(false);

  const [instances, setInstances] = useState<UazInstance[]>([]);
  const [loadingInst, setLoadingInst] = useState(true);

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectInst, setConnectInst] = useState<UazInstance | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<string>("disconnected");
  const [qrLoading, setQrLoading] = useState(false);

  const loadInstances = async () => {
    setLoadingInst(true);
    const { data, error } = await supabase
      .from("zapi_instances")
      .select("id,instance_name,zapi_instance_id,zapi_token,evolution_api_url,created_at,api_provider")
      .eq("api_provider", "uazapi")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setInstances((data as any) || []);
    }
    setLoadingInst(false);
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const fetchQr = async (inst: UazInstance) => {
    setQrLoading(true);
    setQrCode(null);
    setPairingCode(null);
    try {
      const { data: statusData } = await supabase.functions.invoke("uazapi-status", {
        body: { apiUrl: inst.evolution_api_url, apiToken: inst.zapi_token },
      });
      if ((statusData as any)?.connected) {
        setConnStatus("connected");
        return;
      }
      const { data, error } = await supabase.functions.invoke("uazapi-connect", {
        body: { apiUrl: inst.evolution_api_url, apiToken: inst.zapi_token },
      });
      if (error) throw error;
      setConnStatus((data as any)?.connectionStatus || "connecting");
      setQrCode((data as any)?.qrCode || null);
      setPairingCode((data as any)?.pairingCode || null);
      if ((data as any)?.connected) setConnStatus("connected");
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar instância");
    } finally {
      setQrLoading(false);
    }
  };

  const openConnect = async (inst: UazInstance) => {
    setConnectInst(inst);
    setConnectOpen(true);
    setConnStatus("disconnected");
    await fetchQr(inst);
  };

  // Polling do status enquanto o dialog está aberto
  useEffect(() => {
    if (!connectOpen || !connectInst) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke("uazapi-status", {
        body: { apiUrl: connectInst.evolution_api_url, apiToken: connectInst.zapi_token },
      });
      if ((data as any)?.connected) {
        setConnStatus("connected");
        setQrCode(null);
        setPairingCode(null);
        toast.success("Instância conectada!");
      } else if ((data as any)?.qrCode && (data as any).qrCode !== qrCode) {
        setQrCode((data as any).qrCode);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connectOpen, connectInst, qrCode]);

  const removeInstance = async (inst: UazInstance) => {
    if (!confirm(`Remover instância "${inst.instance_name}"?`)) return;
    try {
      await supabase.functions.invoke("uazapi-create-instance", {
        body: { action: "delete", instanceToken: inst.zapi_token },
      });
      await supabase.from("zapi_instances").delete().eq("id", inst.id);
      toast.success("Instância removida");
      loadInstances();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  const createInstance = async () => {
    const name = instName.trim();
    if (!name) {
      toast.error("Informe um nome para a instância");
      return;
    }
    setCreatingInst(true);
    const { data, error } = await supabase.functions.invoke("uazapi-create-instance", {
      body: { instanceName: name, systemName: "zaplynx" },
    });
    setCreatingInst(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return;
    }
    toast.success("Instância UAZAPI criada");
    setInstName("");
    setInstOpen(false);
    loadInstances();
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

      <div className="flex justify-end">
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
              {instances.map((inst) => (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar {connectInst?.instance_name}</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie o QR Code
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 min-h-[280px]">
            {connStatus === "connected" ? (
              <div className="flex flex-col items-center gap-2 text-primary">
                <CheckCircle2 className="w-12 h-12" />
                <p className="font-medium">Conectado!</p>
              </div>
            ) : qrLoading ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : qrCode ? (
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code"
                className="w-64 h-64"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando QR Code...</p>
            )}
            {pairingCode && (
              <p className="mt-3 text-sm">
                Código de pareamento: <span className="font-mono font-bold">{pairingCode}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => connectInst && fetchQr(connectInst)}
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
    </div>
  );
}