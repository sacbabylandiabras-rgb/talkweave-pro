import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Upload, QrCode, KeyRound, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, RefreshCw, Download } from "lucide-react";

type MediaType = "" | "image" | "video" | "audio" | "document";

type TemplateType = "text" | "media" | "text-buttons" | "image-buttons";

interface BtnDef { label: string; type: "reply" | "url" | "phone"; value?: string }

interface HiddenInst {
  id: string;
  name: string;
  api_provider: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DisparoOculto() {
  const { toast } = useToast();
  const [instances, setInstances] = useState<HiddenInst[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [hiddenInstanceId, setHiddenInstanceId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("");
  const [uploading, setUploading] = useState(false);
  const [templateType, setTemplateType] = useState<TemplateType>("text");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<BtnDef[]>([{ label: "", type: "reply" }]);

  // single
  const [singlePhone, setSinglePhone] = useState("");
  const [sendingSingle, setSendingSingle] = useState(false);

  // bulk
  const [bulkPhones, setBulkPhones] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [bulkLog, setBulkLog] = useState<{ phone: string; ok: boolean; err?: string }[]>([]);

  // history report
  interface HistoryRow {
    id: string;
    phone: string;
    status: string;
    error_message: string | null;
    instance_name: string | null;
    template_type: string | null;
    message_preview: string | null;
    batch_id: string | null;
    created_at: string;
  }
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "success" | "failed">("all");

  // connect dialog
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMode, setConnectMode] = useState<"qr" | "pairing">("qr");
  const [connectLoading, setConnectLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingInstances(true);
      const { data, error } = await (supabase as any)
        .from("zapi_instances")
        .select("id, instance_name, api_provider")
        .eq("api_provider", "zapi")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setInstances(data as HiddenInst[]);
        if (data.length > 0) setHiddenInstanceId(data[0].id);
      }
      setLoadingInstances(false);
    })();
  }, []);

  const parsePhones = (raw: string): string[] => {
    return raw
      .split(/[\s,;]+/)
      .map((p) => p.replace(/\D/g, ""))
      .filter((p) => p.length >= 10);
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("template-media").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("template-media").getPublicUrl(path);
      setMediaUrl(pub.publicUrl);
      const mime = file.type;
      if (mime.startsWith("image/")) setMediaType("image");
      else if (mime.startsWith("video/")) setMediaType("video");
      else if (mime.startsWith("audio/")) setMediaType("audio");
      else setMediaType("document");
      toast({ title: "Mídia carregada" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const sendOne = async (phone: string) => {
    const body: any = {
      hiddenInstanceId,
      phone,
      message: message || undefined,
    };
    const wantsImageBtn = templateType === "image-buttons";
    const wantsTextBtn = templateType === "text-buttons";
    const wantsMedia = templateType === "media";

    if ((wantsMedia || wantsImageBtn) && mediaUrl) {
      body.mediaUrl = mediaUrl;
      body.mediaType = wantsImageBtn ? "image" : (mediaType || "image");
    }
    if (wantsTextBtn || wantsImageBtn) {
      const valid = buttons
        .filter((b) => b.label.trim())
        .map((b) => ({
          label: b.label.trim(),
          ...(b.type === "url" ? { url: b.value?.trim() } : {}),
          ...(b.type === "phone" ? { phone: b.value?.trim() } : {}),
        }));
      if (valid.length === 0) throw new Error("Adicione ao menos um botão com texto");
      body.buttons = valid;
      if (footer.trim()) body.footer = footer.trim();
    }
    const { data, error } = await supabase.functions.invoke("send-hidden-dispatch", { body });
    if (error) throw new Error(error.message || "Falha no envio");
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSendSingle = async () => {
    const phone = singlePhone.replace(/\D/g, "");
    if (!phone) { toast({ title: "Informe o número", variant: "destructive" }); return; }
    if (!hiddenInstanceId) { toast({ title: "Selecione uma instância", variant: "destructive" }); return; }
    if (!validateContent()) return;
    setSendingSingle(true);
    try {
      await sendOne(phone);
      toast({ title: "✅ Enviado" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSendingSingle(false);
    }
  };

  const handleSendBulk = async () => {
    const phones = parsePhones(bulkPhones);
    if (phones.length === 0) { toast({ title: "Nenhum número válido", variant: "destructive" }); return; }
    if (!hiddenInstanceId) { toast({ title: "Selecione uma instância", variant: "destructive" }); return; }
    if (!validateContent()) return;
    setBulkRunning(true);
    setBulkLog([]);
    setBulkProgress({ done: 0, total: phones.length, ok: 0, fail: 0 });
    const batchId = crypto.randomUUID();
    const { data: { user } } = await supabase.auth.getUser();
    const instName = instances.find((i) => i.id === hiddenInstanceId)?.name || null;
    const preview = (message || mediaUrl || "").slice(0, 200);
    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i];
      let ok = false;
      let errMsg: string | null = null;
      try {
        await sendOne(phone);
        ok = true;
        setBulkLog((l) => [...l, { phone, ok: true }]);
        setBulkProgress((p) => ({ ...p, done: p.done + 1, ok: p.ok + 1 }));
      } catch (e: any) {
        errMsg = e.message;
        setBulkLog((l) => [...l, { phone, ok: false, err: e.message }]);
        setBulkProgress((p) => ({ ...p, done: p.done + 1, fail: p.fail + 1 }));
      }
      if (user) {
        await (supabase as any).from("hidden_dispatch_logs").insert({
          user_id: user.id,
          hidden_instance_id: hiddenInstanceId,
          instance_name: instName,
          phone,
          message_preview: preview,
          template_type: templateType,
          status: ok ? "success" : "failed",
          error_message: errMsg,
          batch_id: batchId,
        });
      }
      if (i < phones.length - 1 && delaySeconds > 0) {
        await sleep(delaySeconds * 1000);
      }
    }
    setBulkRunning(false);
    toast({ title: "Disparo concluído" });
    fetchHistory();
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await (supabase as any)
      .from("hidden_dispatch_logs")
      .select("id, phone, status, error_message, instance_name, template_type, message_preview, batch_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) setHistory(data as HistoryRow[]);
    setHistoryLoading(false);
  };

  const clearHistory = async () => {
    if (!confirm("Apagar todo o histórico?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("hidden_dispatch_logs").delete().eq("user_id", user.id);
    fetchHistory();
  };

  const exportCsv = () => {
    const rows = filteredHistory();
    const header = "data,instancia,telefone,status,tipo,erro,mensagem\n";
    const csv = header + rows.map((r) => [
      new Date(r.created_at).toISOString(),
      JSON.stringify(r.instance_name || ""),
      r.phone,
      r.status,
      r.template_type || "",
      JSON.stringify(r.error_message || ""),
      JSON.stringify(r.message_preview || ""),
    ].join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `disparo-oculto-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHistory = () => history.filter((r) => historyFilter === "all" ? true : (historyFilter === "success" ? r.status === "success" : r.status !== "success"));

  useEffect(() => { fetchHistory(); }, []);

  const validateContent = (): boolean => {
    if (templateType === "text" && !message.trim()) {
      toast({ title: "Informe a mensagem", variant: "destructive" }); return false;
    }
    if (templateType === "media" && !mediaUrl) {
      toast({ title: "Informe a URL da mídia", variant: "destructive" }); return false;
    }
    if (templateType === "text-buttons") {
      if (!message.trim()) { toast({ title: "Informe a mensagem", variant: "destructive" }); return false; }
      if (!buttons.some((b) => b.label.trim())) { toast({ title: "Adicione ao menos um botão", variant: "destructive" }); return false; }
    }
    if (templateType === "image-buttons") {
      if (!mediaUrl) { toast({ title: "Informe a URL da imagem", variant: "destructive" }); return false; }
      if (!buttons.some((b) => b.label.trim())) { toast({ title: "Adicione ao menos um botão", variant: "destructive" }); return false; }
    }
    return true;
  };

  const updateBtn = (idx: number, patch: Partial<BtnDef>) => {
    setButtons((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };
  const addBtn = () => setButtons((p) => (p.length >= 3 ? p : [...p, { label: "", type: "reply" }]));
  const removeBtn = (idx: number) => setButtons((p) => p.filter((_, i) => i !== idx));

  const openConnect = () => {
    if (!hiddenInstanceId) { toast({ title: "Selecione uma instância", variant: "destructive" }); return; }
    setConnectMode("qr");
    setQrImage(null);
    setPairingCode(null);
    setPairingPhone("");
    setConnectOpen(true);
  };

  const fetchQr = async () => {
    setConnectLoading(true);
    setQrImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("hidden-dispatch-connect", {
        body: { hiddenInstanceId, mode: "qr" },
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

  const fetchPairing = async () => {
    if (!pairingPhone.trim()) { toast({ title: "Informe o número", variant: "destructive" }); return; }
    setConnectLoading(true);
    setPairingCode(null);
    try {
      const { data, error } = await supabase.functions.invoke("hidden-dispatch-connect", {
        body: { hiddenInstanceId, mode: "pairing", phoneNumber: pairingPhone.replace(/\D/g, "") },
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Disparo Oculto</h1>
          <p className="text-sm text-muted-foreground">Página interna não listada.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Instância</Label>
              <div className="flex gap-2">
                <Select value={hiddenInstanceId} onValueChange={setHiddenInstanceId} disabled={loadingInstances}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={loadingInstances ? "Carregando..." : (instances.length === 0 ? "Nenhuma cadastrada" : "Selecione")} />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={openConnect} disabled={!hiddenInstanceId}>
                  <QrCode className="w-4 h-4 mr-2" /> Conectar
                </Button>
              </div>
              {!loadingInstances && instances.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhuma instância. Peça ao admin para cadastrar em <code>/admin/disparo-oculto</code>.
                </p>
              )}
            </div>

            <div>
              <Label>Tipo de mensagem</Label>
              <Select value={templateType} onValueChange={(v) => setTemplateType(v as TemplateType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="media">Mídia (imagem/vídeo/áudio/doc)</SelectItem>
                  <SelectItem value="text-buttons">Texto com botões</SelectItem>
                  <SelectItem value="image-buttons">Imagem + texto com botões</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mensagem {templateType === "image-buttons" && <span className="text-xs text-muted-foreground">(legenda)</span>}</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Texto da mensagem" />
            </div>

            {(templateType === "media" || templateType === "image-buttons") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>{templateType === "image-buttons" ? "URL da imagem" : "URL da mídia"}</Label>
                <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
              </div>
              {templateType === "media" && (
              <div>
                <Label>Tipo</Label>
                <Select value={mediaType} onValueChange={(v) => setMediaType(v as MediaType)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}
            </div>
            )}

            {(templateType === "media" || templateType === "image-buttons") && (
            <div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("file-upload")?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload de arquivo
              </Button>
            </div>
            )}

            {(templateType === "text-buttons" || templateType === "image-buttons") && (
              <div className="space-y-3 border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label>Botões (até 3)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addBtn} disabled={buttons.length >= 3}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {buttons.map((b, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-4"
                      placeholder="Texto do botão"
                      value={b.label}
                      onChange={(e) => updateBtn(idx, { label: e.target.value })}
                    />
                    <Select value={b.type} onValueChange={(v) => updateBtn(idx, { type: v as BtnDef["type"], value: "" })}>
                      <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reply">Resposta</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="phone">Ligar</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="col-span-4"
                      placeholder={b.type === "url" ? "https://..." : b.type === "phone" ? "5511999999999" : "(sem destino)"}
                      disabled={b.type === "reply"}
                      value={b.value || ""}
                      onChange={(e) => updateBtn(idx, { value: e.target.value })}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeBtn(idx)} className="col-span-1">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div>
                  <Label className="text-xs">Rodapé (opcional)</Label>
                  <Input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Texto pequeno abaixo dos botões" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="single">
          <TabsList>
            <TabsTrigger value="single">Envio único</TabsTrigger>
            <TabsTrigger value="bulk">Em massa</TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label>Número (com DDI)</Label>
                  <Input value={singlePhone} onChange={(e) => setSinglePhone(e.target.value)} placeholder="5511999999999" />
                </div>
                <Button onClick={handleSendSingle} disabled={sendingSingle || !hiddenInstanceId}>
                  {sendingSingle ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Enviar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label>Números (um por linha, vírgula ou espaço)</Label>
                  <Textarea rows={6} value={bulkPhones} onChange={(e) => setBulkPhones(e.target.value)} placeholder={"5511999999999\n5511888888888"} />
                </div>
                <div className="w-40">
                  <Label>Delay (segundos)</Label>
                  <Input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value) || 0)} />
                </div>
                <Button onClick={handleSendBulk} disabled={bulkRunning || !hiddenInstanceId}>
                  {bulkRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Disparar
                </Button>

                {bulkProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm">
                      Progresso: {bulkProgress.done}/{bulkProgress.total} • ✅ {bulkProgress.ok} • ❌ {bulkProgress.fail}
                    </div>
                    <div className="max-h-64 overflow-auto border rounded-md p-2 text-xs space-y-1 bg-muted/30">
                      {bulkLog.map((l, idx) => (
                        <div key={idx} className={l.ok ? "text-green-600" : "text-red-600"}>
                          {l.ok ? "✅" : "❌"} {l.phone} {l.err ? `— ${l.err}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Relatório de envios</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as any)}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={fetchHistory} disabled={historyLoading}>
                <RefreshCw className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={history.length === 0}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={clearHistory} disabled={history.length === 0}>
                <Trash2 className="w-4 h-4 mr-1 text-destructive" /> Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const total = history.length;
              const ok = history.filter((r) => r.status === "success").length;
              const fail = total - ok;
              return (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-2xl font-bold">{total}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">Sucesso</div>
                    <div className="text-2xl font-bold text-green-600">{ok}</div>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">Falhas</div>
                    <div className="text-2xl font-bold text-red-600">{fail}</div>
                  </div>
                </div>
              );
            })()}

            {historyLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : filteredHistory().length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left">
                        <th className="p-2">Data</th>
                        <th className="p-2">Instância</th>
                        <th className="p-2">Telefone</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Detalhe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory().map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                          <td className="p-2">{r.instance_name || "—"}</td>
                          <td className="p-2 font-mono">{r.phone}</td>
                          <td className="p-2">{r.template_type || "—"}</td>
                          <td className="p-2">
                            {r.status === "success" ? (
                              <span className="text-green-600">✅ Enviado</span>
                            ) : (
                              <span className="text-red-600">❌ Falhou</span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground max-w-xs truncate" title={r.error_message || r.message_preview || ""}>
                            {r.error_message || r.message_preview || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar instância</DialogTitle>
          </DialogHeader>
          <Tabs value={connectMode} onValueChange={(v) => setConnectMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="qr"><QrCode className="w-4 h-4 mr-1" /> QR Code</TabsTrigger>
              <TabsTrigger value="pairing"><KeyRound className="w-4 h-4 mr-1" /> Código</TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="space-y-3 pt-3">
              <Button onClick={fetchQr} disabled={connectLoading} className="w-full">
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
              <Button onClick={fetchPairing} disabled={connectLoading} className="w-full">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}