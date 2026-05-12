import { useState, useEffect, useRef } from "react";
import {
  Send, Users, FileText, Plus, Loader2, Phone, MessageSquare,
  AlertCircle, RefreshCw, Smartphone, Trash2, Image, Video,
  FileAudio, Paperclip, Clock, MousePointer, Upload, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
   Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";

/* ---------- types ---------- */
interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
}

interface PhoneNumber {
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  name_status: string;
  id: string;
  waba_id?: string;
}

/* ---------- helpers ---------- */
async function getInvokeErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (payload?.error) return payload.error;
      } catch {
        try {
          const text = await context.clone().text();
          if (text) return text;
        } catch {}
      }
    }
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/* ========== COMPONENT ========== */
export default function EnvioCloudAPI() {
  const { data: creds, isLoading: loadingCreds } = useMetaCredentials();

  // shared
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [sending, setSending] = useState(false);

  // phone numbers
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);

  // templates
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [variables, setVariables] = useState<string[]>([]);

  // interactive buttons (max 3 reply buttons for Meta API)
  const [buttons, setButtons] = useState([{ id: "1", title: "" }]);

  // media
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "audio" | "document">("image");
  const [caption, setCaption] = useState("");

  // bulk
  const [contacts, setContacts] = useState("");
  const [delay, setDelay] = useState(3);
  const [sendingBulk, setSendingBulk] = useState(false);
  const cancelRef = useRef(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const isConnected = creds?.connected === true;

  useEffect(() => {
    if (isConnected) {
      fetchPhoneNumbers();
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;

    setTemplateName("");
    setVariables([]);
    void fetchTemplates(selectedPhoneNumberId || undefined);
  }, [isConnected, selectedPhoneNumberId]);

  /* ---------- fetchers ---------- */
  const fetchPhoneNumbers = async () => {
    setLoadingPhones(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "get_phone_numbers" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPhoneNumbers(data.phone_numbers || []);
    } catch (err) {
      console.error("Error fetching phone numbers:", err);
    } finally {
      setLoadingPhones(false);
    }
  };

  const fetchTemplates = async (phoneNumberId?: string) => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: {
          action: "list_templates",
          ...(phoneNumberId ? { override_phone_number_id: phoneNumberId } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTemplates((data.templates || []).filter((t: MetaTemplate) => t.status === "APPROVED"));
    } catch (err) {
      console.error("Error fetching templates:", err);
      const msg = await getInvokeErrorMessage(err, "Erro desconhecido");
      toast.error("Erro ao buscar templates: " + msg);
    } finally {
      setLoadingTemplates(false);
    }
  };

  /* ---------- send helpers ---------- */
  const overrideObj = () =>
    selectedPhoneNumberId ? { override_phone_number_id: selectedPhoneNumberId } : {};

  const metaInvoke = async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("send-meta-message", {
      body: { ...body, ...overrideObj() },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  /* ---------- individual sends ---------- */
  const handleSendText = async () => {
    if (!phone || !message.trim()) {
      toast.error("Informe o número e a mensagem");
      return;
    }
    setSending(true);
    try {
      await metaInvoke({ action: "send_text", phone, message });
      toast.success("Mensagem de texto enviada!");
      setPhone("");
      setMessage("");
    } catch (err) {
      toast.error(await getInvokeErrorMessage(err, "Erro ao enviar"));
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!phone || !templateName) {
      toast.error("Informe o número e selecione um template");
      return;
    }
    const selectedTpl = selectedTemplate;
    if (!selectedTpl) {
      toast.error("Selecione um template válido para o número remetente escolhido");
      return;
    }
    setSending(true);
    try {
      await metaInvoke({
        action: "send_template",
        phone,
        template_name: selectedTpl.name,
        language: selectedTpl.language || "pt_BR",
        variables: variables.filter(Boolean),
      });
      toast.success("Template enviado com sucesso!");
      setPhone("");
      setTemplateName("");
      setVariables([]);
    } catch (err) {
      toast.error(await getInvokeErrorMessage(err, "Erro ao enviar template"));
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async () => {
    if (!phone || !mediaUrl) {
      toast.error("Informe o número e a URL da mídia");
      return;
    }
    setSending(true);
    try {
      await metaInvoke({
        action: "send_media",
        phone,
        media_url: mediaUrl,
        media_type: mediaType,
        ...(mediaType === "audio" ? { voice: true } : {}),
        caption: caption || undefined,
      });
      toast.success("Mídia enviada com sucesso!");
      setPhone("");
      setMediaUrl("");
      setCaption("");
    } catch (err) {
      toast.error(await getInvokeErrorMessage(err, "Erro ao enviar mídia"));
    } finally {
      setSending(false);
    }
  };

  const handleSendInteractive = async () => {
    const validButtons = buttons.filter((b) => b.title.trim());
    if (!phone || !message.trim() || validButtons.length === 0) {
      toast.error("Informe número, mensagem e pelo menos um botão");
      return;
    }
    setSending(true);
    try {
      await metaInvoke({
        action: "send_interactive",
        phone,
        message,
        buttons: validButtons.slice(0, 3).map((b) => ({
          id: b.id,
          title: b.title.slice(0, 20),
        })),
      });
      toast.success("Mensagem com botões enviada!");
      setPhone("");
      setMessage("");
      setButtons([{ id: "1", title: "" }]);
    } catch (err) {
      toast.error(await getInvokeErrorMessage(err, "Erro ao enviar"));
    } finally {
      setSending(false);
    }
  };

  /* ---------- bulk send ---------- */
   const handleSendBulk = async () => {
     if (!contacts.trim() || (!message.trim() && !templateName)) {
       toast.error("Adicione contatos e uma mensagem ou template");
       return;
     }
 
     const lines = contacts.split("\n").filter((l) => l.trim());
     const parsed: { name: string; phone: string }[] = [];
 
     for (const line of lines) {
       const parts = line.split(/[,;\t]/).map((p) => p.trim());
       for (const part of parts) {
         const clean = part.replace(/\D/g, "");
         if (clean.length >= 10 && clean.length <= 15) {
           const name = parts.find((p) => p !== part)?.trim() || `Contato`;
           parsed.push({ name, phone: clean });
           break;
         }
       }
     }
 
     if (parsed.length === 0) {
       toast.error("Nenhum contato válido encontrado");
       return;
     }
 
     cancelRef.current = false;
     setSendingBulk(true);
     setBulkProgress({ sent: 0, failed: 0, total: parsed.length });
 
     let sent = 0;
     let failed = 0;
 
     for (let i = 0; i < parsed.length; i++) {
       if (cancelRef.current) {
         toast.info(`Envio cancelado. ${sent} enviados, ${failed} erros.`);
         break;
       }
 
       const contact = parsed[i];
       const personalizedMsg = message
         .replace(/\{nome\}/g, contact.name)
         .replace(/\{numero\}/g, contact.phone);
       
       const processedVariables = variables.map(v => 
         v.replace(/\{nome\}/g, contact.name)
          .replace(/\{numero\}/g, contact.phone)
       );
 
       try {
         if (templateName) {
           const selectedTpl = selectedTemplate;
           if (!selectedTpl) {
             throw new Error("Template selecionado não é válido para o número remetente escolhido");
           }
           await metaInvoke({
             action: "send_template",
             phone: contact.phone,
             template_name: selectedTpl.name,
             language: selectedTpl.language || "pt_BR",
             variables: processedVariables.filter(Boolean),
           });
         } else {
           await metaInvoke({
             action: "send_text",
             phone: contact.phone,
             message: personalizedMsg,
           });
         }
         sent++;
       } catch (err) {
         failed++;
         console.error(`Erro para ${contact.phone}:`, err);
       }
 
       setBulkProgress({ sent, failed, total: parsed.length });
 
       if (i < parsed.length - 1) {
         await new Promise((r) => setTimeout(r, delay * 1000));
       }
     }
 
     if (!cancelRef.current) {
       toast.success(`Envio concluído! ✅ ${sent} enviados • ❌ ${failed} erros`);
     }
 
     setSendingBulk(false);
     cancelRef.current = false;
   };

  /* ---------- template helpers ---------- */
  const getBodyVarCount = (tpl: MetaTemplate): number => {
    const bodyComp = tpl.components?.find((c: any) => c.type === "BODY");
    if (!bodyComp?.text) return 0;
    const matches = bodyComp.text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const getTemplateOptionValue = (tpl: MetaTemplate) => `${tpl.id}::${tpl.language}`;

  const selectedTemplate = templates.find((t) => getTemplateOptionValue(t) === templateName);

  /* ---------- button helpers ---------- */
  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { id: String(buttons.length + 1), title: "" }]);
  };

  const removeButton = (idx: number) => {
    if (buttons.length <= 1) return;
    setButtons(buttons.filter((_, i) => i !== idx));
  };

  const updateButton = (idx: number, title: string) => {
    const next = [...buttons];
    next[idx] = { ...next[idx], title };
    setButtons(next);
  };

  /* ========== RENDER ========== */

  if (loadingCreds) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enviar via Meta API</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie mensagens utilizando a API oficial do WhatsApp Business
          </p>
        </div>
        <Card className="p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-medium text-foreground">Conta não conectada</p>
          <p className="text-xs text-muted-foreground">
            Conecte sua conta Facebook Business na página de Configuração para enviar mensagens.
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.location.href = "/meta/configuracao"}>
            Ir para Configuração
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Enviar via Meta API</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Envie mensagens utilizando a API oficial do WhatsApp Business (Graph API v21.0)
        </p>
      </div>

      {/* Phone Numbers Card */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5" />
            Número remetente
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 px-2"
            onClick={fetchPhoneNumbers}
            disabled={loadingPhones}
          >
            <RefreshCw className={`w-3 h-3 ${loadingPhones ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        {loadingPhones ? (
          <div className="flex items-center gap-2 py-3 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Buscando números...</span>
          </div>
        ) : phoneNumbers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum número encontrado.</p>
        ) : (
          <div className="space-y-2">
            {phoneNumbers.map((pn) => (
              <button
                key={pn.id}
                type="button"
                onClick={() => setSelectedPhoneNumberId(pn.id === selectedPhoneNumberId ? "" : pn.id)}
                className={`w-full flex items-center justify-between rounded-lg border p-3 transition-colors text-left ${
                  selectedPhoneNumberId === pn.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{pn.display_phone_number}</p>
                    <p className="text-[10px] text-muted-foreground">{pn.verified_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={pn.quality_rating === "GREEN" ? "default" : "secondary"} className="text-[9px]">
                    {pn.quality_rating || "N/A"}
                  </Badge>
                  {selectedPhoneNumberId === pn.id && (
                    <Badge className="text-[9px] bg-primary text-primary-foreground">Ativo</Badge>
                  )}
                </div>
              </button>
            ))}
            <p className="text-[10px] text-muted-foreground">
              Clique em um número para usá-lo como remetente. Sem seleção, usa o padrão.
            </p>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="texto" className="w-full">
         <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="texto" className="flex items-center gap-1 text-xs">
            <MessageSquare className="w-3.5 h-3.5" />
            Texto
          </TabsTrigger>
          <TabsTrigger value="midia" className="flex items-center gap-1 text-xs">
            <Image className="w-3.5 h-3.5" />
            Mídia
          </TabsTrigger>
          <TabsTrigger value="botoes" className="flex items-center gap-1 text-xs">
            <MousePointer className="w-3.5 h-3.5" />
            Botões
          </TabsTrigger>
          <TabsTrigger value="massa" className="flex items-center gap-1 text-xs">
            <Users className="w-3.5 h-3.5" />
            Em Massa
          </TabsTrigger>
        </TabsList>

        {/* --- TEXT --- */}
        <TabsContent value="texto" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mensagem de Texto</CardTitle>
              <CardDescription className="text-xs">
                Texto livre dentro da janela de 24h de conversa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Número do destinatário</Label>
                <Input
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Mensagem</Label>
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  ⚠️ Texto livre só funciona dentro da janela de 24h aberta pelo destinatário.
                </p>
              </div>
              <Button className="w-full gap-2" onClick={handleSendText} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar Texto"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TEMPLATE --- */}
        <TabsContent value="template" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enviar Template Aprovado</CardTitle>
              <CardDescription className="text-xs">
                Templates aprovados podem iniciar conversas a qualquer momento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Número do destinatário</Label>
                <Input
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Template aprovado
                    <Badge variant="secondary" className="text-[9px]">Obrigatório</Badge>
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2"
                    onClick={() => fetchTemplates(selectedPhoneNumberId || undefined)}
                    disabled={loadingTemplates}
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingTemplates ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>

                {loadingTemplates ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Buscando templates...</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground">Nenhum template aprovado encontrado.</p>
                  </div>
                ) : (
                  <Select
                    value={templateName}
                      onValueChange={(v) => {
                        setTemplateName(v);
                        const t = templates.find((tpl) => getTemplateOptionValue(tpl) === v);
                      if (t) setVariables(Array(getBodyVarCount(t)).fill(""));
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                        {templates.map((t) => (
                        <SelectItem key={`${t.id}-${t.language}`} value={getTemplateOptionValue(t)} className="text-sm">
                          <div className="flex items-center gap-2">
                            <span>{t.name}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">{t.language}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedTemplate && getBodyVarCount(selectedTemplate) > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs font-medium">Variáveis do template</Label>
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{`{{${i + 1}}}`}</Badge>
                      <Input
                        placeholder={`Valor para variável ${i + 1}`}
                        value={v}
                        onChange={(e) => {
                          const next = [...variables];
                          next[i] = e.target.value;
                          setVariables(next);
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button className="w-full gap-2" onClick={handleSendTemplate} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar Template"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- MEDIA --- */}
        <TabsContent value="midia" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enviar Mídia</CardTitle>
              <CardDescription className="text-xs">
                Envie imagem, vídeo, áudio ou documento via URL pública
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Número do destinatário</Label>
                <Input
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Tipo de mídia</Label>
                <Select value={mediaType} onValueChange={(v: any) => setMediaType(v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">🖼️ Imagem</SelectItem>
                    <SelectItem value="video">🎬 Vídeo</SelectItem>
                    <SelectItem value="audio">🎵 Áudio</SelectItem>
                    <SelectItem value="document">📄 Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5" />
                  URL da mídia
                </Label>
                <Input
                  placeholder="https://exemplo.com/arquivo.jpg"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="h-9 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  A URL deve ser pública e acessível pela Meta. Para sair como gravado, use áudio .ogg/OPUS.
                </p>
              </div>

              {mediaType !== "audio" && (
                <div className="space-y-2">
                  <Label className="text-xs">Legenda (opcional)</Label>
                  <Textarea
                    placeholder="Legenda para a mídia..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              )}

              <Button className="w-full gap-2" onClick={handleSendMedia} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar Mídia"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- INTERACTIVE BUTTONS --- */}
        <TabsContent value="botoes" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mensagem com Botões Interativos</CardTitle>
              <CardDescription className="text-xs">
                Envie até 3 botões de resposta rápida (limite da Meta API)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Número do destinatário</Label>
                <Input
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Mensagem do corpo</Label>
                <Textarea
                  placeholder="Digite a mensagem que acompanha os botões..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs">Botões de Resposta Rápida (máx. 3)</Label>
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">{idx + 1}</Badge>
                    <Input
                      placeholder="Texto do botão (máx 20 caracteres)"
                      value={btn.title}
                      maxLength={20}
                      onChange={(e) => updateButton(idx, e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                    {buttons.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeButton(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                {buttons.length < 3 && (
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addButton}>
                    <Plus className="w-3 h-3" />
                    Adicionar Botão
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  💡 Botões de resposta rápida enviam o texto do botão como resposta quando clicados.
                </p>
              </div>

              <Button className="w-full gap-2" onClick={handleSendInteractive} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MousePointer className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar com Botões"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- BULK SEND --- */}
        <TabsContent value="massa" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Envio em Massa</CardTitle>
              <CardDescription className="text-xs">
                Envie para múltiplos contatos com delay entre envios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
                <p className="text-[11px] font-medium">💡 Como usar:</p>
                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                  <li>• Cole a lista (Nome,Telefone) — um por linha</li>
                  <li>• Use Template para iniciar conversas ou Texto livre (janela 24h)</li>
                  <li>• Variáveis: {"{nome}"} e {"{numero}"} são substituídas automaticamente</li>
                </ul>
              </div>

              {/* Contact list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Upload CSV/TXT</Label>
                  <Input
                    type="file"
                    accept=".csv,.txt"
                    className="text-xs"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const text = ev.target?.result as string;
                          setContacts(text);
                          toast.success(`${text.split("\n").filter((l) => l.trim()).length} linhas carregadas`);
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Modelo CSV</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1"
                    onClick={() => {
                      const csv = `João Silva,5511999999999\nMaria Santos,5511888888888`;
                      const blob = new Blob([csv], { type: "text/csv" });
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      link.download = "modelo_contatos.csv";
                      link.click();
                      toast.success("Modelo baixado!");
                    }}
                  >
                    <Upload className="w-3 h-3" />
                    Baixar Modelo
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Lista de contatos</Label>
                <Textarea
                  placeholder={`João Silva,5511999999999\nMaria Santos,5511888888888`}
                  className="font-mono text-xs min-h-[100px]"
                  value={contacts}
                  onChange={(e) => setContacts(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  📊 {contacts.split("\n").filter((l) => l.trim()).length} linhas detectadas
                </p>
              </div>

              {/* Send mode: template or text */}
              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Modo de envio</Label>
                <div className="flex gap-2">
                  <Button
                    variant={templateName ? "default" : "outline"}
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => { setMessage(""); }}
                  >
                    <FileText className="w-3 h-3" />
                    Template
                  </Button>
                  <Button
                    variant={!templateName ? "default" : "outline"}
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => setTemplateName("")}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Texto livre
                  </Button>
                </div>
              </div>

              {templateName || templates.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-xs">Template aprovado</Label>
                   <Select value={templateName} onValueChange={(v) => {
                     setTemplateName(v);
                     const t = templates.find((tpl) => getTemplateOptionValue(tpl) === v);
                    if (t) setVariables(Array(getBodyVarCount(t)).fill(""));
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione (ou deixe vazio para texto livre)" />
                    </SelectTrigger>
                    <SelectContent>
                       {templates.map((t) => (
                         <SelectItem key={`${t.id}-${t.language}`} value={getTemplateOptionValue(t)} className="text-sm">
                          {t.name} <Badge variant="outline" className="ml-1 text-[9px]">{t.language}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {!templateName && (
                <div className="space-y-2">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    placeholder="Digite a mensagem... Use {nome} e {numero} para personalizar"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
              )}

              {selectedTemplate && getBodyVarCount(selectedTemplate) > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Variáveis do template</Label>
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{`{{${i + 1}}}`}</Badge>
                      <Input
                        placeholder={`Valor para {{${i + 1}}}`}
                        value={v}
                        onChange={(e) => {
                          const next = [...variables];
                          next[i] = e.target.value;
                          setVariables(next);
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Delay entre envios (segundos)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value) || 3)}
                  className="h-9 text-sm w-32"
                />
                <p className="text-[10px] text-muted-foreground">Recomendado: 3-5 segundos</p>
              </div>

              <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-[11px] text-amber-800 dark:text-amber-200">
                  ⚠️ <strong>Importante:</strong> Para iniciar conversas use Templates aprovados. Texto livre só funciona com janela de 24h aberta.
                </p>
              </div>

              {sendingBulk && (
                <div className="rounded-lg bg-muted/50 border p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Progresso: {bulkProgress.sent + bulkProgress.failed}/{bulkProgress.total}</span>
                    <span>✅ {bulkProgress.sent} • ❌ {bulkProgress.failed}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${((bulkProgress.sent + bulkProgress.failed) / Math.max(bulkProgress.total, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  className="w-full gap-2"
                  onClick={handleSendBulk}
                  disabled={sendingBulk || !contacts.trim()}
                  size="lg"
                >
                  {sendingBulk ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Iniciar Envio em Massa
                    </>
                  )}
                </Button>
                {sendingBulk && (
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => (cancelRef.current = true)}
                  >
                    ❌ Cancelar Envio
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
