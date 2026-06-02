import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertCircle, RefreshCw, HelpCircle, Save, CheckCircle2,
  MessageSquare, FileText, Workflow, Settings, Send,
} from "lucide-react";
import { toast } from "sonner";
import TelegramCanalFreeEnvio from "./TelegramCanalFreeEnvio";

type Bot = { id: string; first_name: string | null; username: string | null };
type Template = { id: string; name: string; content: string | null };
type Flow = { id: string; name: string };

export default function TelegramCanalFree() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [botId, setBotId] = useState<string>("");
  const [channelTitle, setChannelTitle] = useState("");
  const [chatId, setChatId] = useState<number | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [responseType, setResponseType] = useState<"text" | "template" | "flow">("text");
  const [templateId, setTemplateId] = useState<string>("");
  const [flowId, setFlowId] = useState<string>("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  const isConfigured = !!channelTitle;

  // Carrega bots do usuário
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("telegram_bots")
        .select("id, first_name, username")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const list = (data ?? []) as Bot[];
      setBots(list);
      if (list.length > 0) setBotId(list[0].id);
      setLoading(false);
    })();
  }, []);

  // Carrega config do bot selecionado
  useEffect(() => {
    if (!botId) return;
    (async () => {
      const { data } = await supabase
        .from("telegram_free_channels" as any)
        .select("chat_id, title, welcome_message, approval_delay_seconds, response_type, template_id, flow_id")
        .eq("bot_id", botId)
        .maybeSingle();
      const row = data as any;
      setChannelTitle(row?.title || "");
      setChatId(row?.chat_id ?? null);
      setWelcomeMessage(row?.welcome_message || "");
      setDelaySeconds(row?.approval_delay_seconds ? String(row.approval_delay_seconds) : "");
      setResponseType((row?.response_type as any) || "text");
      setTemplateId(row?.template_id || "");
      setFlowId(row?.flow_id || "");
    })();
  }, [botId]);

  // Carrega templates e fluxos disponíveis (fluxos filtrados pelo bot)
  useEffect(() => {
    (async () => {
      const { data: tpl } = await supabase
        .from("telegram_message_templates" as any)
        .select("id, name, content")
        .eq("active", true)
        .order("name");
      setTemplates((tpl as unknown as Template[]) || []);
    })();
  }, []);

  useEffect(() => {
    if (!botId) { setFlows([]); return; }
    (async () => {
      const { data } = await supabase
        .from("flow_automations")
        .select("id, name, bot_id, active")
        .eq("active", true)
        .eq("bot_id", botId)
        .order("name");
      setFlows(((data as any[]) || []).map((f) => ({ id: f.id, name: f.name })));
    })();
  }, [botId]);

  async function refresh() {
    if (!botId) {
      toast.error("Selecione um bot primeiro.");
      return;
    }
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "telegram-canal-free-refresh",
        { body: { bot_id: botId } },
      );
      if (error) throw error;
      const ch = (data as any)?.channel;
      if (ch?.chat_id) {
        setChannelTitle(ch.title || `Canal ${ch.chat_id}`);
        setChatId(ch.chat_id);
        toast.success(`Canal encontrado: ${ch.title || ch.chat_id}`);
      } else {
        toast.error(
          "Não foi possível encontrar o canal. Confirme que o bot foi adicionado como administrador e tente novamente em alguns segundos.",
        );
      }
    } catch (e: any) {
      toast.error(`Erro ao atualizar: ${e?.message || "tente novamente"}`);
    } finally {
      setRefreshing(false);
    }
  }

  async function save() {
    if (!botId) {
      toast.error("Selecione um bot primeiro.");
      return;
    }
    if (!isConfigured) {
      toast.error("Adicione o bot como admin do canal antes de salvar.");
      return;
    }
    if (responseType === "text" && !welcomeMessage.trim()) {
      toast.error("Informe a mensagem de boas-vindas.");
      return;
    }
    if (responseType === "template" && !templateId) {
      toast.error("Selecione um modelo de boas-vindas.");
      return;
    }
    if (responseType === "flow" && !flowId) {
      toast.error("Selecione um fluxo de boas-vindas.");
      return;
    }
    const secs = Number(delaySeconds);
    if (!Number.isFinite(secs) || secs < 1) {
      toast.error("Informe um tempo válido em segundos.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); toast.error("Sessão expirada."); return; }
    const { error } = await supabase
      .from("telegram_free_channels" as any)
      .upsert({
        bot_id: botId,
        user_id: user.id,
        welcome_message: welcomeMessage,
        approval_delay_seconds: secs,
        response_type: responseType,
        template_id: responseType === "template" ? templateId : null,
        flow_id: responseType === "flow" ? flowId : null,
      }, { onConflict: "bot_id" });
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success("Configurações salvas!");
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const selectedFlow = flows.find((f) => f.id === flowId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Canal Free</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprovação automática de entradas e mensagem de boas-vindas no privado.
        </p>
      </div>

      {/* Bot selector */}
      <Card className="p-4">
        <Label>Bot</Label>
        {loading ? (
          <p className="text-sm text-muted-foreground mt-2">Carregando bots...</p>
        ) : bots.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">
            Nenhum bot cadastrado. Crie um bot primeiro.
          </p>
        ) : (
          <Select value={botId} onValueChange={setBotId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Selecione um bot" />
            </SelectTrigger>
            <SelectContent>
              {bots.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.first_name || b.username || b.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Card>

      {/* Status Banner */}
      <Card
        className={`p-5 border-l-4 ${
          isConfigured
            ? "border-l-emerald-500 bg-emerald-500/5"
            : "border-l-destructive bg-destructive/5"
        }`}
      >
        <div className="flex items-start gap-3">
          {isConfigured ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          )}
          <div>
            <h3 className="font-semibold text-foreground">Status da configuração</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isConfigured
                ? `Canal "${channelTitle}" conectado com sucesso.`
                : "O bot ainda não foi detectado como admin de nenhum canal. Adicione o bot como administrador do canal e clique no ícone de atualizar."}
            </p>
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-6 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Canal</Label>
            <button
              type="button"
              onClick={refresh}
              className="text-primary hover:text-primary/80 disabled:opacity-50"
              title="Atualizar canal"
              disabled={refreshing || !botId}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div
            className={`rounded-md border bg-muted/40 px-4 py-3 text-sm ${
              isConfigured ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {channelTitle ||
              "Não encontrado. Adicione o bot como administrador do canal e clique no ícone acima."}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mensagem de boas-vindas</Label>
          <Tabs value={responseType} onValueChange={(v) => setResponseType(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Texto
              </TabsTrigger>
              <TabsTrigger value="template" className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Modelo
              </TabsTrigger>
              <TabsTrigger value="flow" className="flex items-center gap-2">
                <Workflow className="w-4 h-4" /> Fluxo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-1 pt-3">
              <Textarea
                id="welcome"
                placeholder="Ex: Olá {nome}, seja bem-vindo! Daqui a pouco você será aceito no canal."
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {welcomeMessage.length}/500 — use {"{nome}"} para o primeiro nome
              </p>
            </TabsContent>

            <TabsContent value="template" className="space-y-2 pt-3">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um modelo..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum modelo disponível</div>
                  )}
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate?.content && (
                <div className="bg-muted/40 p-3 rounded-md text-sm whitespace-pre-wrap text-foreground">
                  {selectedTemplate.content}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O modelo será enviado no privado do usuário ao ser aprovado no canal.
              </p>
            </TabsContent>

            <TabsContent value="flow" className="space-y-2 pt-3">
              <Select value={flowId} onValueChange={setFlowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um fluxo..." />
                </SelectTrigger>
                <SelectContent>
                  {flows.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nenhum fluxo ativo para este bot
                    </div>
                  )}
                  {flows.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFlow && (
                <div className="bg-muted/40 p-3 rounded-md text-sm text-foreground">
                  Fluxo selecionado: <strong>{selectedFlow.name}</strong>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O fluxo é disparado no privado do usuário ao ser aprovado no canal.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delay">Tempo para aceitar a solicitação (em segundos)</Label>
          <Input
            id="delay"
            type="number"
            min={1}
            placeholder="Ex: 10"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">3600 segundos = 1 hora.</p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
          <Button variant="outline" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="w-4 h-4 mr-1.5" />
            Como funciona?
          </Button>
        </div>
      </Card>

      {/* Help Modal */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como funciona?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm text-foreground">
            <p className="flex items-start gap-2">
              <span>⚠️</span>
              <span>Esse recurso só funciona em canais privados com links de aprovação.</span>
              <span>⚠️</span>
            </p>

            <div className="space-y-3">
              <h4 className="font-semibold">Passo a passo:</h4>
              <ol className="list-decimal pl-5 space-y-3 text-muted-foreground">
                <li>Adicione seu bot como administrador do seu canal FREE.</li>
                <li>
                  Volte aqui, selecione o bot e clique no ícone de "atualizar". O nome do canal deve aparecer
                  automaticamente.
                </li>
                <li>
                  Defina uma mensagem de boas-vindas atraente e estratégica:
                  <div className="mt-2 rounded-md bg-muted/50 p-3 text-foreground">
                    <strong>Exemplo:</strong> "Oi {"{nome}"}... Percebi que você solicitou entrar no meu Canal FREE!
                    Aproveita agora a promoção do meu canal VIP antes que ela acabe..."
                  </div>
                </li>
                <li>
                  Defina o tempo em segundos para que o bot aceite as solicitações:
                  <div className="mt-2 rounded-md bg-muted/50 p-3 text-foreground">
                    <strong>Exemplo:</strong> 3600 (1 hora).
                  </div>
                </li>
                <li>Crie um link de "aprovação" no seu canal FREE.</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">🤔 Como criar um link de aprovação?</h4>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>No canal gratuito, vá em "link de convite".</li>
                <li>Clique em "criar novo link".</li>
                <li>Ative a opção "pedir aprovação dos administradores".</li>
                <li>Pronto!</li>
              </ol>
            </div>

            <div className="rounded-md bg-primary/5 border border-primary/20 p-4 space-y-3 text-muted-foreground">
              <p>
                <strong className="text-foreground">Funcionamento:</strong> o bot aprova automaticamente as
                solicitações de entrada no canal gratuito após o tempo configurado e envia a mensagem de
                boas-vindas no chat privado do usuário.
              </p>
              <p className="text-foreground font-medium">
                Em caso de dúvidas, entre em contato com o suporte!
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
