import { useState, useEffect } from "react";
import { Send, Users, FileText, Plus, Loader2, Phone, MessageSquare, AlertCircle, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";

interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
}

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
        } catch {
          // ignore parse failures
        }
      }
    }
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

interface PhoneNumber {
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  name_status: string;
  id: string;
}

export default function EnvioCloudAPI() {
  const { data: creds, isLoading: loadingCreds } = useMetaCredentials();
  const [sendType, setSendType] = useState<"template" | "text">("template");
  const [phone, setPhone] = useState("");
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [message, setMessage] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);

  const isConnected = creds?.connected === true;

  useEffect(() => {
    if (isConnected) {
      fetchTemplates();
      fetchPhoneNumbers();
    }
  }, [isConnected]);

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

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "list_templates" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const approved = (data.templates || []).filter(
        (t: MetaTemplate) => t.status === "APPROVED"
      );
      setTemplates(approved);
    } catch (err) {
      console.error("Error fetching templates:", err);
      const message = await getInvokeErrorMessage(err, "Erro desconhecido");
      toast.error("Erro ao buscar templates: " + message);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const getBodyVarCount = (tpl: MetaTemplate): number => {
    const bodyComp = tpl.components?.find((c: any) => c.type === "BODY");
    if (!bodyComp?.text) return 0;
    const matches = bodyComp.text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const selectedTemplate = templates.find((t) => t.name === templateName);

  const handleSend = async () => {
    if (!phone) {
      toast.error("Informe o número do destinatário");
      return;
    }

    setSending(true);
    try {
      let body: any;

      if (sendType === "template") {
        if (!templateName) {
          toast.error("Selecione um template");
          setSending(false);
          return;
        }
        body = {
          action: "send_template",
          phone,
          template_name: templateName,
          language: selectedTemplate?.language || "pt_BR",
          variables: variables.filter(Boolean),
          ...(selectedPhoneNumberId && { override_phone_number_id: selectedPhoneNumberId }),
        };
      } else {
        if (!message.trim()) {
          toast.error("Digite a mensagem");
          setSending(false);
          return;
        }
        body = {
          action: "send_text",
          phone,
          message,
          ...(selectedPhoneNumberId && { override_phone_number_id: selectedPhoneNumberId }),
        };
      }

      const { data, error } = await supabase.functions.invoke("send-meta-message", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Mensagem enviada com sucesso via Meta API!");
      setPhone("");
      setMessage("");
    } catch (err) {
      console.error("Send error:", err);
      const message = await getInvokeErrorMessage(err, "Erro ao enviar mensagem");
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enviar via Meta API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie mensagens utilizando a API oficial do WhatsApp Business (Graph API v21.0)
        </p>
      </div>

      {/* Connected Phone Numbers */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5" />
            Números conectados na BM
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
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum número encontrado na BM.</p>
        ) : (
          <div className="space-y-2">
            {phoneNumbers.map((pn) => (
              <div key={pn.id} className="flex items-center justify-between rounded-lg border border-border p-3">
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
                  <Badge variant="outline" className="text-[9px]">
                    {pn.name_status || "N/A"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Send type tabs */}
      <div className="flex gap-2">
        <Button
          variant={sendType === "template" ? "default" : "outline"}
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setSendType("template")}
        >
          <FileText className="w-3.5 h-3.5" />
          Template Aprovado
        </Button>
        <Button
          variant={sendType === "text" ? "default" : "outline"}
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setSendType("text")}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Texto Livre
        </Button>
      </div>

      <Card className="p-5 space-y-5">
        {/* Destination */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Número do destinatário</Label>
          <Input
            placeholder="5511999999999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-9 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Formato: código do país + DDD + número (ex: 5511999999999)
          </p>
        </div>

        <Separator />

        {sendType === "template" ? (
          <>
            {/* Template selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Template aprovado
                  <Badge variant="secondary" className="text-[9px]">Obrigatório</Badge>
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1 px-2"
                  onClick={fetchTemplates}
                  disabled={loadingTemplates}
                >
                  <RefreshCw className={`w-3 h-3 ${loadingTemplates ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>

              {loadingTemplates ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Buscando templates da Meta...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    Nenhum template aprovado encontrado na sua conta WABA.
                  </p>
                </div>
              ) : (
                <Select
                  value={templateName}
                  onValueChange={(v) => {
                    setTemplateName(v);
                    const t = templates.find((tpl) => tpl.name === v);
                    if (t) {
                      const count = getBodyVarCount(t);
                      setVariables(Array(count).fill(""));
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione um template aprovado" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.name} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span>{t.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">
                            {t.language}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Variables */}
            {selectedTemplate && getBodyVarCount(selectedTemplate) > 0 && (
              <div className="space-y-3">
                <Label className="text-xs font-medium">Variáveis do template</Label>
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                      {`{{${i + 1}}}`}
                    </Badge>
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
          </>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Mensagem
            </Label>
            <Textarea
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              ⚠️ Mensagens de texto livre só funcionam dentro da janela de 24h de conversação.
            </p>
          </div>
        )}

        <Separator />

        {/* Info box */}
        <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1">
          <p className="text-[11px] font-medium text-foreground">Informações</p>
          <ul className="text-[10px] text-muted-foreground space-y-0.5">
            <li>• Mensagens enviadas via Graph API v21.0</li>
            <li>• Phone Number ID: {creds?.phone_number_id || "não detectado"}</li>
            {sendType === "template" ? (
              <li>• Templates aprovados podem iniciar conversas a qualquer momento</li>
            ) : (
              <li>• Texto livre requer janela de 24h aberta pelo destinatário</li>
            )}
          </ul>
        </div>

        <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? "Enviando..." : "Enviar via Meta API"}
        </Button>
      </Card>
    </div>
  );
}
