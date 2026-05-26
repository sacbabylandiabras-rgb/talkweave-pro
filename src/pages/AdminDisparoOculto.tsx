import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, QrCode, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HiddenInstance {
  id: string;
  name: string;
  api_provider: string;
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  is_active: boolean;
  created_at: string;
}

const empty = {
  name: "",
  api_provider: "zapi" as "zapi",
  zapi_instance_id: "",
  zapi_token: "",
  zapi_client_token: "",
  evolution_api_url: "",
  evolution_api_key: "",
};

export default function AdminDisparoOculto() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | undefined>();
  const { isAdmin, loading: roleLoading } = useUserRole(userId);
  const [items, setItems] = useState<HiddenInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectInstance, setConnectInstance] = useState<HiddenInstance | null>(null);
  const [connectMode, setConnectMode] = useState<"qr" | "pairing">("qr");
  const [connectLoading, setConnectLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("hidden_dispatch_instances")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setItems((data || []) as HiddenInstance[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchItems(); }, [isAdmin]);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      api_provider: form.api_provider,
      zapi_instance_id: form.zapi_instance_id.trim(),
      zapi_token: form.zapi_token.trim(),
      zapi_client_token: form.zapi_client_token.trim(),
      evolution_api_url: form.evolution_api_url.trim() || null,
      evolution_api_key: form.evolution_api_key.trim() || null,
      created_by: userId,
    };
    const { error } = await (supabase as any).from("hidden_dispatch_instances").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Instância adicionada" });
    setForm(empty);
    fetchItems();
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await (supabase as any)
      .from("hidden_dispatch_instances")
      .update({ is_active: active })
      .eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchItems();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover essa instância?")) return;
    const { error } = await (supabase as any).from("hidden_dispatch_instances").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchItems();
  };

  const openConnect = (it: HiddenInstance) => {
    setConnectInstance(it);
    setConnectMode("qr");
    setQrImage(null);
    setPairingCode(null);
    setPairingPhone("");
    setConnectOpen(true);
  };

  const fetchQr = async (instance: HiddenInstance) => {
    setConnectLoading(true);
    setQrImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("hidden-dispatch-connect", {
        body: { hiddenInstanceId: instance.id, mode: "qr" },
      });
      if (error) throw error;
      const qr = (data as any)?.data?.qrCode;
      if (!qr) {
        toast({ title: "Sem QR", description: (data as any)?.data?.connected ? "Já conectada" : "Resposta vazia" });
      } else {
        setQrImage(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setConnectLoading(false);
    }
  };

  const fetchPairing = async (instance: HiddenInstance) => {
    if (!pairingPhone.trim()) { toast({ title: "Informe o número", variant: "destructive" }); return; }
    setConnectLoading(true);
    setPairingCode(null);
    try {
      const { data, error } = await supabase.functions.invoke("hidden-dispatch-connect", {
        body: { hiddenInstanceId: instance.id, mode: "pairing", phoneNumber: pairingPhone.replace(/\D/g, "") },
      });
      if (error) throw error;
      const code = (data as any)?.data?.pairingCode;
      if (!code) toast({ title: "Sem código", description: "Resposta vazia", variant: "destructive" });
      else setPairingCode(code);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setConnectLoading(false);
    }
  };

  if (roleLoading) return <div className="p-6">Carregando...</div>;
  if (!isAdmin) return <div className="p-6">Acesso restrito.</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Disparo Oculto — Instâncias (Admin)</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre as instâncias Z-API usadas em <code>/disparo-oculto</code>. Visíveis para todos os usuários logados.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Adicionar instância</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Instância principal" />
              </div>
              <div>
                <Label>Provedor</Label>
                <Select value={form.api_provider} onValueChange={(v) => setForm({ ...form, api_provider: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zapi">Z-API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.api_provider === "zapi" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Instance ID</Label>
                  <Input value={form.zapi_instance_id} onChange={(e) => setForm({ ...form, zapi_instance_id: e.target.value })} />
                </div>
                <div>
                  <Label>Token</Label>
                  <Input value={form.zapi_token} onChange={(e) => setForm({ ...form, zapi_token: e.target.value })} />
                </div>
                <div>
                  <Label>Client Token</Label>
                  <Input value={form.zapi_client_token} onChange={(e) => setForm({ ...form, zapi_client_token: e.target.value })} />
                </div>
              </div>

            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Instâncias cadastradas</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma instância.</p>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex-1">
                      <div className="font-medium">{it.name} <span className="text-xs text-muted-foreground">({it.api_provider})</span></div>
                      <div className="text-xs text-muted-foreground">
                        {it.api_provider === "zapi"
                          ? `Instance: ${it.zapi_instance_id || "—"}`
                          : `URL: ${it.evolution_api_url || "—"}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={it.is_active} onCheckedChange={(v) => toggleActive(it.id, v)} />
                        <span className="text-xs">{it.is_active ? "Ativa" : "Inativa"}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openConnect(it)}>
                        <QrCode className="w-4 h-4 mr-1" /> Conectar
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar — {connectInstance?.name}</DialogTitle>
          </DialogHeader>
          {connectInstance && (
            <Tabs value={connectMode} onValueChange={(v) => setConnectMode(v as any)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="qr"><QrCode className="w-4 h-4 mr-1" /> QR Code</TabsTrigger>
                <TabsTrigger value="pairing"><KeyRound className="w-4 h-4 mr-1" /> Código</TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="space-y-3 pt-3">
                <Button onClick={() => fetchQr(connectInstance)} disabled={connectLoading} className="w-full">
                  {connectLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                  Gerar QR Code
                </Button>
                {qrImage && (
                  <div className="flex justify-center bg-white p-4 rounded-lg">
                    <img src={qrImage} alt="QR" className="w-64 h-64" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Abra WhatsApp → Aparelhos conectados → Conectar aparelho
                </p>
              </TabsContent>

              <TabsContent value="pairing" className="space-y-3 pt-3">
                <div>
                  <Label>Número (com DDI)</Label>
                  <Input
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="5511999999999"
                  />
                </div>
                <Button onClick={() => fetchPairing(connectInstance)} disabled={connectLoading} className="w-full">
                  {connectLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Gerar código
                </Button>
                {pairingCode && (
                  <div className="text-center space-y-2">
                    <div className="text-3xl font-mono font-bold tracking-widest bg-muted py-4 rounded-lg">
                      {pairingCode}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp → Aparelhos conectados → Conectar com número de telefone
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}