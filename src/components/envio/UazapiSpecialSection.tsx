import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, MapPinned, CreditCard, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useZapiInstances } from "@/hooks/useZapiInstances";

/**
 * UI for the 3 UAZAPI-only special endpoints:
 * - /send/status            (Stories)
 * - /send/location-button   (Interactive location button)
 * - /send/request-payment   (PIX/payment request)
 *
 * Calls the `send-uazapi-special` edge function.
 */
const UazapiSpecialSection = () => {
  const { toast } = useToast();
  const { instances, activeInstance } = useZapiInstances();

  const uazapiInstances = (instances || []).filter(
    (i: any) => String(i.api_provider || "").toLowerCase() === "uazapi",
  );
  const hasUazapi = uazapiInstances.length > 0;
  const activeIsUazapi =
    activeInstance && String((activeInstance as any).api_provider || "").toLowerCase() === "uazapi";

  const [instanceId, setInstanceId] = useState<string>(
    activeIsUazapi ? (activeInstance as any).id : (uazapiInstances[0]?.id || ""),
  );
  const [loading, setLoading] = useState(false);

  // Status
  const [statusKind, setStatusKind] = useState<"text" | "image" | "video" | "audio">("text");
  const [statusText, setStatusText] = useState("");
  const [statusFile, setStatusFile] = useState("");
  const [statusBg, setStatusBg] = useState("");

  // Location button
  const [locPhone, setLocPhone] = useState("");
  const [locText, setLocText] = useState("Por favor, compartilhe sua localização.");

  // Request payment
  const [payPhone, setPayPhone] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDescription, setPayDescription] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const callEdge = async (kind: string, payload: Record<string, any>, phone?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-uazapi-special", {
        body: {
          kind,
          instanceId: instanceId || undefined,
          phone: phone || undefined,
          payload,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha no envio");
      toast({ title: "Enviado!", description: `${kind} enviado com sucesso.` });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar",
        description: err?.message || "Falha desconhecida",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendStatus = () => {
    if (statusKind === "text" && !statusText.trim()) {
      return toast({ title: "Texto obrigatório", variant: "destructive" });
    }
    if (statusKind !== "text" && !statusFile.trim()) {
      return toast({ title: "URL da mídia obrigatória", variant: "destructive" });
    }
    callEdge("status", {
      type: statusKind,
      text: statusText || undefined,
      file: statusKind !== "text" ? statusFile : undefined,
      backgroundColor: statusBg || undefined,
    });
  };

  const handleSendLocation = () => {
    const phone = locPhone.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      return toast({ title: "Número inválido", variant: "destructive" });
    }
    callEdge(
      "location-button",
      { text: locText || "Por favor, compartilhe sua localização." },
      phone,
    );
  };

  const handleSendPayment = () => {
    const phone = payPhone.replace(/\D/g, "");
    const amount = parseFloat((payAmount || "").replace(",", "."));
    if (!phone || phone.length < 10) {
      return toast({ title: "Número inválido", variant: "destructive" });
    }
    if (!amount || amount <= 0) {
      return toast({ title: "Valor inválido", variant: "destructive" });
    }
    callEdge(
      "request-payment",
      {
        amount,
        currency: "BRL",
        noteForReceiver: payDescription || "Solicitação de pagamento",
        requestNote: payNotes || undefined,
      },
      phone,
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Recursos Especiais UAZAPI
          </CardTitle>
          <CardDescription>
            Status (Stories), Botão de Localização e Solicitação de Pagamento. Disponível apenas
            para instâncias UAZAPI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasUazapi && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Você não tem nenhuma instância UAZAPI conectada. Adicione uma em{" "}
                <strong>Dispositivos</strong> para usar estes recursos.
              </span>
            </div>
          )}

          {hasUazapi && (
            <div className="space-y-2">
              <Label>Instância UAZAPI</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {uazapiInstances.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.instance_name || i.zapi_instance_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="status" className="flex items-center gap-2">
                <Camera className="w-4 h-4" /> Status
              </TabsTrigger>
              <TabsTrigger value="location" className="flex items-center gap-2">
                <MapPinned className="w-4 h-4" /> Localização
              </TabsTrigger>
              <TabsTrigger value="payment" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Pagamento
              </TabsTrigger>
            </TabsList>

            {/* STATUS */}
            <TabsContent value="status" className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label>Tipo de Status</Label>
                <Select value={statusKind} onValueChange={(v: any) => setStatusKind(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {statusKind !== "text" && (
                <div className="space-y-2">
                  <Label>URL da mídia</Label>
                  <Input
                    placeholder="https://..."
                    value={statusFile}
                    onChange={(e) => setStatusFile(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Texto / Legenda {statusKind === "text" ? "" : "(opcional)"}</Label>
                <Textarea
                  rows={3}
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="Conteúdo do status..."
                />
              </div>
              {statusKind === "text" && (
                <div className="space-y-2">
                  <Label>Cor de fundo (opcional, hex)</Label>
                  <Input
                    placeholder="#075E54"
                    value={statusBg}
                    onChange={(e) => setStatusBg(e.target.value)}
                  />
                </div>
              )}
              <Button onClick={handleSendStatus} disabled={loading || !hasUazapi} className="w-full">
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Enviando..." : "Publicar Status"}
              </Button>
            </TabsContent>

            {/* LOCATION BUTTON */}
            <TabsContent value="location" className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label>Número do contato</Label>
                <Input
                  placeholder="5511999999999"
                  value={locPhone}
                  onChange={(e) => setLocPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  rows={3}
                  value={locText}
                  onChange={(e) => setLocText(e.target.value)}
                  placeholder="Por favor, compartilhe sua localização."
                />
              </div>
              <Button onClick={handleSendLocation} disabled={loading || !hasUazapi} className="w-full">
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Enviando..." : "Solicitar Localização"}
              </Button>
            </TabsContent>

            {/* REQUEST PAYMENT */}
            <TabsContent value="payment" className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label>Número do contato</Label>
                <Input
                  placeholder="5511999999999"
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    placeholder="49.90"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Produto X"
                    value={payDescription}
                    onChange={(e) => setPayDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Mensagem adicional para o cliente"
                />
              </div>
              <Button onClick={handleSendPayment} disabled={loading || !hasUazapi} className="w-full">
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Enviando..." : "Solicitar Pagamento"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default UazapiSpecialSection;