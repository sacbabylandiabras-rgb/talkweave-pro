import { useState, useRef, useEffect } from "react";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { useAgentTools } from "@/hooks/useAgentTools";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { AgentFunnel } from "@/components/agent/AgentFunnel";
import {
  Bot,
  Brain,
  MessageCircle,
  Plus,
  Trash2,
  FileText,
  HelpCircle,
  Send,
  Loader2,
  Sparkles,
  Save,
  Globe,
  Link,
  Search,
  Upload,
  Wrench,
  BarChart3,
} from "lucide-react";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  cta?: {
    label: string;
    url: string;
  } | null;
}

interface KnowledgeItem {
  id: string;
  type: "faq" | "document";
  question?: string;
  answer?: string;
  title?: string;
  content?: string;
  active: boolean;
  created_at: string;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const getEdgeFunctionErrorMessage = async (err: unknown) => {
  if (err instanceof FunctionsHttpError) {
    try {
      const payload = await err.context.json();
      if (payload?.error) return payload.error;
    } catch {
      try {
        const text = await err.context.text();
        if (text) return text;
      } catch {
        return "A função retornou um erro inesperado.";
      }
    }
    return "A função retornou um erro inesperado.";
  }

  if (err instanceof FunctionsRelayError) {
    return "Falha de comunicação com a Edge Function.";
  }

  if (err instanceof FunctionsFetchError) {
    return "Não foi possível conectar à Edge Function.";
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Erro desconhecido";
};

const AgenteIA = () => {
  const { config, knowledge, loading, saving, saveConfig, addFaq, addDocument, removeKnowledge } = useAgentConfig();
  const { tools, unavailable: toolsUnavailable, toggle: toggleTool } = useAgentTools();

  // Config form state
  const [agentName, setAgentName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptTriage, setPromptTriage] = useState("");
  const [promptService, setPromptService] = useState("");
  const [promptClosing, setPromptClosing] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [provider] = useState<"anthropic">("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [voice, setVoice] = useState("nova");

  // FAQ form
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  // Document form
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);

  // URL import
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Analysis state
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisContent, setAnalysisContent] = useState("");
  const [analysisTitle, setAnalysisTitle] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeItem | null>(null);

  const analyzeContent = async (type: "faq" | "document" | "url", data: { question?: string; answer?: string; title?: string; content?: string }) => {
    setAnalysisLoading(true);
    setAnalysisOpen(true);
    setAnalysisContent("");
    setAnalysisTitle(
      type === "faq" ? `Análise do FAQ: ${data.question}` :
      type === "url" ? `Análise da URL: ${data.title}` :
      `Análise do Documento: ${data.title}`
    );

    try {
      let promptContent = "";
      if (type === "faq") {
        promptContent = `Analise detalhadamente este FAQ que foi adicionado à base de conhecimento do meu agente de IA.\n\nPergunta: ${data.question}\nResposta: ${data.answer}\n\nFaça uma análise extensa e detalhada cobrindo:\n1. **Clareza da pergunta**: A pergunta está clara e bem formulada? Sugira melhorias se necessário.\n2. **Qualidade da resposta**: A resposta é completa, precisa e objetiva? Há informações faltando?\n3. **Tom e linguagem**: O tom está adequado para atendimento ao cliente?\n4. **Possíveis variações**: Quais outras formas o cliente poderia fazer essa mesma pergunta? O agente conseguiria reconhecer?\n5. **Sugestões de melhoria**: O que poderia ser adicionado ou alterado para tornar essa FAQ mais eficiente?\n6. **Pontuação geral**: De 1 a 10, qual a qualidade desta FAQ?\n\nSeja detalhado e construtivo na análise.`;
      } else {
        promptContent = `Analise detalhadamente este documento/conteúdo que foi adicionado à base de conhecimento do meu agente de IA.\n\nTítulo: ${data.title}\nConteúdo:\n${data.content?.substring(0, 5000)}\n\nFaça uma análise extensa e detalhada cobrindo:\n1. **Resumo do conteúdo**: Faça um resumo claro do que este documento contém.\n2. **Qualidade da informação**: As informações estão completas, atualizadas e precisas?\n3. **Organização**: O conteúdo está bem estruturado e organizado?\n4. **Cobertura de tópicos**: Quais tópicos principais são abordados? Há lacunas importantes?\n5. **Utilidade para o agente**: Como o agente poderá usar essas informações para responder clientes?\n6. **Possíveis perguntas**: Liste 5-10 perguntas que os clientes poderiam fazer e que este documento ajudaria a responder.\n7. **Sugestões de melhoria**: O que poderia ser adicionado para tornar a base de conhecimento mais completa?\n8. **Pontuação geral**: De 1 a 10, qual a qualidade e utilidade deste conteúdo?\n\nSeja detalhado e construtivo na análise.`;
      }

      const { data: result, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: [{ role: "user", content: promptContent }],
          skip_config: true,
        },
      });

      if (error) throw error;
      setAnalysisContent(result?.reply || "Não foi possível gerar a análise.");
    } catch (err) {
      const errorMessage = await getEdgeFunctionErrorMessage(err);
      setAnalysisContent("❌ Erro ao gerar análise: " + errorMessage);
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      setAgentName(config.agent_name);
      setSystemPrompt(config.system_prompt);
      setPromptTriage(config.prompt_triage || "");
      setPromptService(config.prompt_service || "");
      setPromptClosing(config.prompt_closing || "");
      setIsActive(config.active);
      setModel(config.model);
      setVoice(config.voice || "nova");
    }
  }, [loading, config]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSaveConfig = () => {
    saveConfig({ 
      agent_name: agentName, 
      system_prompt: systemPrompt, 
      prompt_triage: promptTriage,
      prompt_service: promptService,
      prompt_closing: promptClosing,
      active: isActive, 
      provider, 
      model,
      voice,
    });
  };

  const handleAddFaq = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    await addFaq(faqQuestion, faqAnswer);
    analyzeContent("faq", { question: faqQuestion, answer: faqAnswer });
    setFaqQuestion("");
    setFaqAnswer("");
  };

  const handleAddDoc = async () => {
    if (!docTitle.trim() || !docContent.trim()) return;
    await addDocument(docTitle, docContent);
    analyzeContent("document", { title: docTitle, content: docContent });
    setDocTitle("");
    setDocContent("");
  };

  const extractTextFromFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    if (["txt", "md", "csv", "json", "xml", "html", "htm", "yaml", "yml", "log"].includes(ext)) {
      return await file.text();
    }

    if (ext === "pdf") {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const pages: string[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (text) pages.push(text);
      }

      return pages.join("\n\n");
    }

    if (ext === "docx") {
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value;
    }

    throw new Error("Formato não suportado. Use TXT, MD, CSV, JSON, HTML, XML, PDF ou DOCX.");
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadingDocument) return;

    setUploadingDocument(true);
    try {
      const extractedText = (await extractTextFromFile(file)).trim();

      if (!extractedText) {
        throw new Error("Não consegui extrair texto deste arquivo.");
      }

      const nextTitle = file.name.replace(/\.[^.]+$/, "");
      setDocTitle(nextTitle);
      setDocContent(extractedText);

      await addDocument(nextTitle, extractedText);
      analyzeContent("document", { title: nextTitle, content: extractedText });
      setDocTitle("");
      setDocContent("");
      toast({ title: "Documento importado!", description: `${file.name} foi convertido em texto e salvo na base.` });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message || "Não foi possível importar o arquivo.", variant: "destructive" });
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleImportUrl = async () => {
    if (!urlInput.trim() || urlLoading) return;
    setUrlLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-url", {
        body: { url: urlInput },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const title = data.title || urlInput;
      const content = data.content;
      if (!content || content.length < 10) {
        toast({ title: "Conteúdo insuficiente", description: "Não foi possível extrair conteúdo relevante desta URL.", variant: "destructive" });
        return;
      }
      await addDocument(`🌐 ${title}`, content);
      analyzeContent("url", { title, content });
      setUrlInput("");
      toast({ title: "URL importada!", description: `${content.length} caracteres extraídos com sucesso.` });
    } catch (err: any) {
      toast({ title: "Erro ao importar URL", description: err.message, variant: "destructive" });
    } finally {
      setUrlLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const allMessages = [...chatMessages, userMsg];

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { messages: allMessages.map(m => ({ role: m.role, content: m.content })) },
      });

      if (error) throw error;

      const reply = data?.reply || "Sem resposta";
      setChatMessages(prev => [...prev, { role: "assistant", content: reply, cta: data?.cta ?? null }]);
    } catch (err: any) {
      toast({ title: "Erro no chat", description: err.message, variant: "destructive" });
      setChatMessages(prev => [...prev, { role: "assistant", content: "Erro ao processar a mensagem." }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div>
         <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
           <Bot className="w-6 h-6 text-primary" />
           Agente IA
         </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure e treine seu assistente virtual inteligente
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Config + Knowledge */}
        <div className="xl:col-span-2 space-y-6">
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="config" className="flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" />
                Configuração
              </TabsTrigger>
              <TabsTrigger value="flow" className="flex items-center gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" />
                Fluxo/Leads
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

            <TabsContent value="flow" className="mt-4">
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Fluxo de Conversão (Funil)
                  </CardTitle>
                  <CardDescription>Visualize o progresso dos seus leads através das etapas do agente</CardDescription>
                </CardHeader>
                <CardContent>
                  <AgentFunnel />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="mt-4">
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    Personalidade do Agente
                  </CardTitle>
                  <CardDescription>Defina como seu agente deve se comportar e responder</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                    <div>
                      <Label className="text-sm font-medium">Agente Ativo</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Quando ativo, responde automaticamente no WhatsApp
                      </p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>

                  <div className="space-y-2">
                    <Label>Nome do Agente</Label>
                    <Input
                      value={agentName}
                      onChange={e => setAgentName(e.target.value)}
                      placeholder="Ex: Atendente Virtual"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Provedor de IA</Label>
                      <Input value="Claude Code" readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <>
                            <SelectItem value="claude-opus-4-5-20251101">Claude Opus 4.5 (mais inteligente)</SelectItem>
                            <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (recomendado)</SelectItem>
                            <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (rápido e barato)</SelectItem>
                            <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                            <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                          </>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-2">
                    Usando sua chave da Anthropic (ANTHROPIC_API_KEY). Cobrança ocorre direto na sua conta Anthropic.
                  </p>

                  <div className="space-y-2">
                    <Label>Voz das respostas em áudio</Label>
                    <Select value={voice} onValueChange={setVoice}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nova">Feminina jovem (padrão)</SelectItem>
                        <SelectItem value="shimmer">Feminina suave</SelectItem>
                        <SelectItem value="alloy">Neutra equilibrada</SelectItem>
                        <SelectItem value="echo">Masculina calma</SelectItem>
                        <SelectItem value="onyx">Masculina grave</SelectItem>
                        <SelectItem value="fable">Narrador (sotaque)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Voz usada quando o agente responde em áudio (mensagens de voz).
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-primary" />
                        Etapa 1: Triagem e Classificação
                      </Label>
                      <Textarea
                        value={promptTriage}
                        onChange={e => setPromptTriage(e.target.value)}
                        placeholder="Ex: Identifique se o cliente quer comprar, tirar dúvida ou suporte..."
                        rows={3}
                        className="resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Instruções para o agente identificar o que o cliente deseja.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-primary" />
                        Etapa 2: Atendimento (Base de Conhecimento)
                      </Label>
                      <Textarea
                        value={promptService}
                        onChange={e => setPromptService(e.target.value)}
                        placeholder="Ex: Use a base de conhecimento para responder de forma técnica e prestativa..."
                        rows={6}
                        className="resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Instruções sobre como o agente deve responder usando os documentos e FAQ.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Etapa 3: Conclusão e CTA
                      </Label>
                      <Textarea
                        value={promptClosing}
                        onChange={e => setPromptClosing(e.target.value)}
                        placeholder="Ex: Tente sempre converter em venda enviando o link do checkout ou peça para falar com humano..."
                        rows={3}
                        className="resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Instruções para o fechamento da conversa e chamada para ação.
                      </p>
                    </div>
                  </div>

                  <Button onClick={handleSaveConfig} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Configuração
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tools" className="mt-4">
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary" />
                    Ferramentas do Agente
                  </CardTitle>
                  <CardDescription>
                    Ative as ações que o Claude pode executar automaticamente durante a conversa. Disponível apenas com provedor <strong>Claude (Anthropic)</strong>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {provider !== "anthropic" && (
                    <div className="p-3 rounded-lg border border-warning/40 bg-warning/10 text-xs text-warning-foreground">
                      As ferramentas só funcionam com o provedor <strong>Claude (Anthropic)</strong>. Troque o provedor na aba "Configuração" para ativá-las.
                    </div>
                  )}
                  {toolsUnavailable && (
                    <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive">
                      As ferramentas estão temporariamente indisponíveis porque a tabela <code>agent_tools_config</code> ainda não está acessível neste ambiente. Depois de aplicar/sincronizar a migration, recarregue a página.
                    </div>
                  )}
                  {Array.from(new Set(tools.map((t) => t.category))).map((cat) => (
                    <div key={cat} className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary/80 mt-2">{cat}</p>
                      {tools.filter((t) => t.category === cat).map((t) => (
                        <div key={t.name} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{t.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                            <code className="text-[10px] text-muted-foreground/70 mt-1 block">{t.name}</code>
                          </div>
                          <Switch
                            checked={t.enabled}
                            onCheckedChange={(v) => toggleTool(t.name, v)}
                            disabled={provider !== "anthropic" || toolsUnavailable}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faq" className="mt-4">
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-accent" />
                    Base de Perguntas e Respostas
                  </CardTitle>
                  <CardDescription>
                    Cadastre perguntas frequentes para o agente usar como referência
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <Input
                      value={faqQuestion}
                      onChange={e => setFaqQuestion(e.target.value)}
                      placeholder="Pergunta (ex: Qual o horário de funcionamento?)"
                    />
                    <Textarea
                      value={faqAnswer}
                      onChange={e => setFaqAnswer(e.target.value)}
                      placeholder="Resposta (ex: Funcionamos de segunda a sexta, das 9h às 18h)"
                      rows={3}
                      className="resize-none"
                    />
                    <Button onClick={handleAddFaq} disabled={!faqQuestion.trim() || !faqAnswer.trim()} size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Adicionar FAQ
                    </Button>
                  </div>

                  <div className="space-y-2 mt-4">
                    {knowledge.filter(k => k.type === "faq").map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{item.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.answer}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => removeKnowledge(item.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {knowledge.filter(k => k.type === "faq").length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum FAQ cadastrado ainda
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docs" className="mt-4">
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-success" />
                    Documentos e Textos
                  </CardTitle>
                  <CardDescription>
                    Cole textos, instruções ou informações para o agente absorver como contexto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* URL Import */}
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-medium">Importar de URL</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cole uma URL e o agente extrairá automaticamente o conteúdo para usar como base de conhecimento
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder="https://seusite.com/pagina"
                        disabled={urlLoading}
                        className="flex-1"
                      />
                      <Button onClick={handleImportUrl} disabled={!urlInput.trim() || urlLoading} size="sm">
                        {urlLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Link className="w-4 h-4 mr-1" />}
                        Importar
                      </Button>
                    </div>
                  </div>

                  {/* Manual Document */}
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" className="relative overflow-hidden" disabled={uploadingDocument}>
                        <input
                          type="file"
                          accept=".txt,.md,.csv,.json,.xml,.html,.htm,.yaml,.yml,.log,.pdf,.docx"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          onChange={handleDocumentUpload}
                          disabled={uploadingDocument}
                        />
                        {uploadingDocument ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                        Upload de Arquivo
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Suporta TXT, MD, CSV, JSON, HTML, XML, PDF e DOCX.
                      </p>
                    </div>
                    <Input
                      value={docTitle}
                      onChange={e => setDocTitle(e.target.value)}
                      placeholder="Título do documento (ex: Política de Devoluções)"
                    />
                    <Textarea
                      value={docContent}
                      onChange={e => setDocContent(e.target.value)}
                      placeholder="Cole aqui o conteúdo completo do documento..."
                      rows={6}
                      className="resize-none"
                    />
                    <Button onClick={handleAddDoc} disabled={!docTitle.trim() || !docContent.trim()} size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Adicionar Documento
                    </Button>
                  </div>

                  <div className="space-y-2 mt-4">
                      {knowledge.filter(k => k.type === "document").map(item => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/20 cursor-pointer hover:border-primary/40 transition-colors"
                          onClick={() => setSelectedDocument(item)}
                        >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                        </div>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="shrink-0 h-7 w-7"
                           onClick={(e) => {
                             e.stopPropagation();
                             removeKnowledge(item.id);
                           }}
                         >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {knowledge.filter(k => k.type === "document").length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum documento cadastrado ainda
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/15 bg-card hover:border-primary/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Status</p>
                <Badge variant={config.active ? "default" : "secondary"} className="text-xs mt-0.5">
                  {config.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/15 bg-card hover:border-primary/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-accent/10">
                <HelpCircle className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">FAQs</p>
                <p className="text-lg font-bold">{knowledge.filter(k => k.type === "faq").length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-primary/15 bg-card hover:border-primary/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-success/10">
                <FileText className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Documentos</p>
                <p className="text-lg font-bold">{knowledge.filter(k => k.type === "document").length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chat Test */}
        <div className="xl:col-span-1">
          <Card className="border-border/60 h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                Testar Agente
              </CardTitle>
              <CardDescription className="text-xs">
                Converse com seu agente para testar as respostas
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <ScrollArea className="flex-1 px-4 py-3" style={{ minHeight: 350, maxHeight: 500 }}>
                <div className="space-y-3">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-10">
                      <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Envie uma mensagem para testar</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="space-y-3">
                            <div className="prose prose-sm dark:prose-invert max-w-none text-inherit">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            {msg.cta?.url && (
                              <Button asChild size="sm" className="w-full">
                                <a href={msg.cta.url} target="_blank" rel="noreferrer">
                                  {msg.cta.label || "Abrir checkout"}
                                </a>
                              </Button>
                            )}
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-xl px-3.5 py-2.5 rounded-bl-md">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-3 border-t border-border/40">
                <form onSubmit={e => { e.preventDefault(); handleSendChat(); }} className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    disabled={chatLoading}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analysis Dialog */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              {analysisTitle}
            </DialogTitle>
            <DialogDescription>
              Análise automática gerada pela IA sobre o conteúdo adicionado
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4" style={{ maxHeight: "65vh" }}>
            {analysisLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando análise detalhada...</p>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                <ReactMarkdown>{analysisContent}</ReactMarkdown>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.title || "Documento"}</DialogTitle>
            <DialogDescription>
              Leitura completa do conteúdo importado para a base de conhecimento.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4" style={{ maxHeight: "65vh" }}>
            <div className="whitespace-pre-wrap text-sm text-foreground leading-6">
              {selectedDocument?.content}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgenteIA;
