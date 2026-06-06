import { useState, useEffect } from "react";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { useAgentTools } from "@/hooks/useAgentTools";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Bot, Sparkles, Brain, Save, Loader2, Wrench, HelpCircle, FileText, Plus, Trash2, Mic, CheckCircle2, Upload, Globe, Search, Link as LinkIcon, RefreshCw, Wand2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AgentConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoImportUrl?: string;
  onImportComplete?: () => void;
}

export function AgentConfigDialog({ open, onOpenChange, autoImportUrl, onImportComplete }: AgentConfigDialogProps) {
  const { config, knowledge, loading, saving, saveConfig, addFaq, addDocument, removeKnowledge } = useAgentConfig();
  const { tools, unavailable: toolsUnavailable, toggle: toggleTool } = useAgentTools();

  // Config form state
  const [agentName, setAgentName] = useState("");
  const [promptTriage, setPromptTriage] = useState("");
  const [promptService, setPromptService] = useState("");
  const [promptClosing, setPromptClosing] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [disableInGroups, setDisableInGroups] = useState(false);
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [voice, setVoice] = useState("nova");
  const [voiceProvider, setVoiceProvider] = useState<"openai" | "elevenlabs">("openai");
  const [elevenApiKey, setElevenApiKey] = useState("");
  const [elevenVoiceId, setElevenVoiceId] = useState("");
  const [elevenVoiceName, setElevenVoiceName] = useState("");

  // FAQ form
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  // Document form
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");

  // URL Import state
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  useEffect(() => {
    if (open && autoImportUrl) {
      setUrlInput(autoImportUrl);
    }
  }, [open, autoImportUrl]);

  useEffect(() => {
    const triggerAutoImport = async () => {
      if (open && autoImportUrl && !loading && !urlLoading) {
        console.log("[AutoImport] Checking...", { autoImportUrl, knowledgeCount: knowledge.length });
        
        const alreadyHasUrl = knowledge.find(k => 
          k.title?.toLowerCase().includes(autoImportUrl.toLowerCase()) || 
          k.content?.toLowerCase().includes(autoImportUrl.toLowerCase())
        );
        
        if (!alreadyHasUrl) {
          console.log("[AutoImport] Starting import for:", autoImportUrl);
          setTimeout(() => handleImportUrl(autoImportUrl), 300);
        } else {
          console.log("[AutoImport] URL já existe. Forçando preenchimento dos prompts.");
          const existing = alreadyHasUrl;
          if (existing && existing.content) {
             const siteTitle = existing.title || autoImportUrl;
             const siteName = siteTitle.replace("🌐 ", "").split(/[|\-]/)[0]?.trim() || autoImportUrl;
             
             // Update local states immediately
             setAgentName(`Assistente ${siteName}`);
             setPromptTriage(`Você é o assistente virtual da empresa ${siteName}. Identifique se o cliente tem dúvidas sobre produtos ou checkout.`);
             setPromptService(`Atue como especialista da ${siteName}. Use a base de conhecimento:\n\n${existing.content.substring(0, 1500)}`);
             setPromptClosing(`Leve o cliente de volta ao checkout em ${autoImportUrl}.`);
             setIsActive(true);
             
             // Save immediately to ensure it's not lost on re-renders
             saveConfig({
               agent_name: `Assistente ${siteName}`,
               prompt_triage: `Você é o assistente virtual da empresa ${siteName}. Identifique se o cliente tem dúvidas sobre produtos ou checkout.`,
               prompt_service: `Atue como especialista da ${siteName}. Use a base de conhecimento:\n\n${existing.content.substring(0, 1500)}`,
               prompt_closing: `Leve o cliente de volta ao checkout em ${autoImportUrl}.`,
               active: true,
               model: "claude-sonnet-4-5-20250929"
             });
          }
        }
      }
    };
    triggerAutoImport();
  }, [open, loading, autoImportUrl]);

  const handleImportUrl = async (urlToImport?: string) => {
    const url = urlToImport || urlInput;
    if (!url.trim() || urlLoading) return;
    
    setUrlLoading(true);
    const loadingToast = toast.loading("Lendo site e configurando agente...");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-url", {
        body: { url: url },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const siteTitle = (data.title || "").toLowerCase().includes("paypal") ? "" : (data.title || "");
      
      // Extrair o nome da loja a partir da URL para ser mais confiável
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
      const domainParts = urlObj.hostname.replace("www.", "").split(".");
      const fallbackName = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
      
      const cleanSiteName = siteTitle 
        ? siteTitle.replace("🌐 ", "").split(/[|\-]/)[0]?.trim() 
        : fallbackName;

      const content = data.content;
      
      if (!content || content.length < 10) {
        toast.error("Conteúdo insuficiente na URL");
        return;
      }
      
      await addDocument(`🌐 ${siteTitle}`, content);
      
      if (autoImportUrl) {
        // Advanced pre-fill of all information
        const siteName = cleanSiteName;
        const autoName = `Assistente ${cleanSiteName}`;
        setAgentName(autoName);
        
        // Use full content for better context in prompts
        const triagePrompt = `Você é o assistente virtual da empresa ${siteName}. Sua missão é identificar se o lead tem dúvidas sobre os produtos ou se está enfrentando problemas no checkout da loja ${url}.`;
        setPromptTriage(triagePrompt);

        const servicePrompt = `Atue como um especialista da ${siteName}. Responda as dúvidas do cliente usando estas informações reais da loja:\n\n${content.substring(0, 3000)}`;
        setPromptService(servicePrompt);

        const closingPrompt = `Seu objetivo é converter a dúvida em venda. Se o cliente estiver pronto, envie-o de volta para finalizar a compra em ${url}.`;
        setPromptClosing(closingPrompt);

        setIsActive(true);

        // Save everything automatically
        await saveConfig({
          agent_name: autoName,
          prompt_triage: triagePrompt,
          prompt_service: servicePrompt,
          prompt_closing: closingPrompt,
          active: true,
          model: "claude-sonnet-4-5-20250929"
        });
        
        onImportComplete?.();
      }

      setUrlInput("");
      toast.dismiss(loadingToast);
      toast.success("Toda a configuração foi preenchida automaticamente!");
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error("Erro ao importar: " + err.message);
    } finally {
      toast.dismiss(loadingToast);
      setUrlLoading(false);
    }
  };

  const handleFetchWebhookProducts = async () => {
    setUrlLoading(true);
    const loadingToast = toast.loading("Buscando produtos do último webhook...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Buscar os logs de webhook mais recentes para este usuário
      const { data: logs, error } = await supabase
        .from("gateway_webhook_logs")
        .select("payload")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!logs || logs.length === 0) {
        throw new Error("Nenhum webhook recebido ainda. Envie um teste da sua plataforma.");
      }

      // Extrair produtos únicos de TODOS os payloads recebidos
      const products: string[] = [];
      logs.forEach(log => {
        const payload = log.payload as any;
        
        // Função auxiliar para procurar produtos recursivamente no payload
        const findProducts = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          
          // Nomes de campos comuns para produtos
          const keys = ['product_name', 'produto', 'name', 'title', 'product'];
          for (const key of keys) {
            if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 2) {
              // Evitar nomes de clientes ou emails
              if (!obj[key].includes('@') && !products.includes(obj[key])) {
                products.push(obj[key]);
              }
            }
          }
          
          // Se for array (como itens de carrinho), percorre cada item
          if (Array.isArray(obj)) {
            obj.forEach(findProducts);
          } else {
            // Se for objeto, percorre os valores (para achar em objetos aninhados como 'data', 'transaction', etc)
            Object.values(obj).forEach(val => {
              if (val && typeof val === 'object') findProducts(val);
            });
          }
        };

        findProducts(payload);
      });

      if (products.length === 0) {
        throw new Error("Nenhum produto encontrado nos webhooks recebidos.");
      }

      const productsList = products.join(", ");
      const docTitle = "📦 Produtos via Webhook";
      const docContent = `Produtos identificados automaticamente via integração de checkout:\n\n${products.map(p => `- ${p}`).join("\n")}`;

      await addDocument(docTitle, docContent);
      
      // Atualizar o prompt de atendimento para incluir os novos produtos
      const newServicePrompt = `${promptService}\n\nProdutos integrados via Webhook: ${productsList}`;
      setPromptService(newServicePrompt);
      
      toast.dismiss(loadingToast);
      toast.success(`${products.length} produtos importados com sucesso!`);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error(err.message);
    } finally {
      setUrlLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !urlLoading) {
      setAgentName(config.agent_name || "Assistente");
      setPromptTriage(config.prompt_triage || "");
      setPromptService(config.prompt_service || "");
      setPromptClosing(config.prompt_closing || "");
      setIsActive(config.active);
      setDisableInGroups(config.disable_in_groups === true);
      setModel(config.model || "claude-sonnet-4-5-20250929");
      setVoice(config.voice || "nova");
      setVoiceProvider((config.voice_provider as any) || "openai");
      setElevenApiKey(config.elevenlabs_api_key || "");
      setElevenVoiceId(config.elevenlabs_voice_id || "");
      setElevenVoiceName(config.elevenlabs_voice_name || "");
    }
  }, [loading, config, urlLoading]);

  const handleSaveConfig = async () => {
    await saveConfig({ 
      agent_name: agentName, 
      prompt_triage: promptTriage,
      prompt_service: promptService,
      prompt_closing: promptClosing,
      active: isActive, 
      disable_in_groups: disableInGroups,
      model,
      voice,
      voice_provider: voiceProvider,
      elevenlabs_api_key: elevenApiKey,
      elevenlabs_voice_id: elevenVoiceId,
      elevenlabs_voice_name: elevenVoiceName,
    });
  };

  const handleAddFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    await addFaq(faqQuestion, faqAnswer);
    setFaqQuestion("");
    setFaqAnswer("");
  };

  const handleAddDoc = async () => {
    if (!docTitle.trim() || !docContent.trim()) return;
    await addDocument(docTitle, docContent);
    setDocTitle("");
    setDocContent("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Configuração do Agente IA
          </DialogTitle>
          <DialogDescription>
            Tudo o que você configurar aqui será sincronizado com o Agente de IA principal.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 pb-10">
            <Tabs defaultValue="config" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="config" className="flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  Personalidade
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex items-center gap-1.5 text-xs">
                  <Wrench className="w-3.5 h-3.5" />
                  Ferramentas
                </TabsTrigger>
                <TabsTrigger value="faq" className="flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-3.5 h-3.5" />
                  FAQ
                </TabsTrigger>
                <TabsTrigger value="docs" className="flex items-center gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5" />
                  Documentos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-6">
                <Card className="border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      Personalidade e Voz
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                      <div>
                        <Label className="text-sm font-medium">Agente Ativo</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Responde automaticamente</p>
                      </div>
                      <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>

                    <div className="space-y-2">
                      <Label>Nome do Agente</Label>
                      <Input value={agentName} onChange={e => setAgentName(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Modelo</Label>
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</SelectItem>
                            <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Voz</Label>
                        <Select value={voice} onValueChange={setVoice}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nova">Nova (Feminina)</SelectItem>
                            <SelectItem value="alloy">Alloy (Neutra)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Configuração Inteligente</Label>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleFetchWebhookProducts} 
                          disabled={urlLoading}
                          className="h-8 gap-2 text-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${urlLoading ? 'animate-spin' : ''}`} />
                          Sincronizar Produtos via Webhook
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Etapa 1: Triagem</Label>
                        <Textarea value={promptTriage} onChange={e => setPromptTriage(e.target.value)} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Etapa 2: Atendimento</Label>
                        <Textarea value={promptService} onChange={e => setPromptService(e.target.value)} rows={4} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Etapa 3: Fechamento</Label>
                        <Textarea value={promptClosing} onChange={e => setPromptClosing(e.target.value)} rows={2} />
                      </div>
                    </div>

                    <Button onClick={handleSaveConfig} disabled={saving} className="w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Salvar Configurações
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tools" className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">Ferramentas Ativas</CardTitle>
                    <CardDescription>Ações que o agente pode executar</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {tools.map((t) => (
                      <div key={t.name} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        </div>
                        <Switch checked={t.enabled} onCheckedChange={(v) => toggleTool(t.name, v)} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="faq" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Base de FAQ</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <Input value={faqQuestion} onChange={e => setFaqQuestion(e.target.value)} placeholder="Pergunta" />
                      <Textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} placeholder="Resposta" rows={2} />
                      <Button onClick={handleAddFaq} size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
                    </div>
                    <div className="space-y-2">
                      {knowledge.filter(k => k.type === "faq").map(item => (
                        <div key={item.id} className="flex items-start justify-between p-3 rounded bg-muted/20 border">
                          <div className="text-xs">
                            <p className="font-bold">{item.question}</p>
                            <p className="mt-1">{item.answer}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeKnowledge(item.id)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="docs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Documentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      <Input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Título do documento" />
                      <Textarea value={docContent} onChange={e => setDocContent(e.target.value)} placeholder="Conteúdo..." rows={3} />
                      <Button onClick={handleAddDoc} size="sm"><Plus className="w-4 h-4 mr-1" /> Importar</Button>
                    </div>
                    <div className="space-y-2">
                      {knowledge.filter(k => k.type === "document").map(item => (
                        <div key={item.id} className="flex items-start justify-between p-3 rounded bg-muted/20 border">
                          <div className="text-xs truncate max-w-[90%]">
                            <p className="font-bold">{item.title}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeKnowledge(item.id)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
