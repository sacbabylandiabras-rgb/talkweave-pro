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
import { Loader2, Send, Upload } from "lucide-react";

type MediaType = "" | "image" | "video" | "audio" | "document";

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

  // single
  const [singlePhone, setSinglePhone] = useState("");
  const [sendingSingle, setSendingSingle] = useState(false);

  // bulk
  const [bulkPhones, setBulkPhones] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [bulkLog, setBulkLog] = useState<{ phone: string; ok: boolean; err?: string }[]>([]);

  useEffect(() => {
    (async () => {
      setLoadingInstances(true);
      const { data, error } = await (supabase as any)
        .from("hidden_dispatch_instances")
        .select("id, name, api_provider")
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
    if (mediaUrl && mediaType) {
      body.mediaUrl = mediaUrl;
      body.mediaType = mediaType;
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
    if (!message && !mediaUrl) { toast({ title: "Informe mensagem ou mídia", variant: "destructive" }); return; }
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
    if (!message && !mediaUrl) { toast({ title: "Informe mensagem ou mídia", variant: "destructive" }); return; }
    setBulkRunning(true);
    setBulkLog([]);
    setBulkProgress({ done: 0, total: phones.length, ok: 0, fail: 0 });
    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i];
      try {
        await sendOne(phone);
        setBulkLog((l) => [...l, { phone, ok: true }]);
        setBulkProgress((p) => ({ ...p, done: p.done + 1, ok: p.ok + 1 }));
      } catch (e: any) {
        setBulkLog((l) => [...l, { phone, ok: false, err: e.message }]);
        setBulkProgress((p) => ({ ...p, done: p.done + 1, fail: p.fail + 1 }));
      }
      if (i < phones.length - 1 && delaySeconds > 0) {
        await sleep(delaySeconds * 1000);
      }
    }
    setBulkRunning(false);
    toast({ title: "Disparo concluído" });
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
              <Select value={hiddenInstanceId} onValueChange={setHiddenInstanceId} disabled={loadingInstances}>
                <SelectTrigger>
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
              {!loadingInstances && instances.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhuma instância. Peça ao admin para cadastrar em <code>/admin/disparo-oculto</code>.
                </p>
              )}
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Texto da mensagem (opcional se enviar mídia)" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>URL da mídia</Label>
                <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
              </div>
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
            </div>

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
      </div>
    </div>
  );
}