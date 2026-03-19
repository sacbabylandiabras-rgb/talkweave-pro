import { useState, useRef, useEffect } from "react";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const AgenteIA = () => {
  const { config, knowledge, loading, saving, saveConfig, addFaq, addDocument, removeKnowledge } = useAgentConfig();

  // Config form state
  const [agentName, setAgentName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isActive, setIsActive] = useState(false);

  // FAQ form
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  // Document form
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) {
      setAgentName(config.agent_name);
      setSystemPrompt(config.system_prompt);
      setIsActive(config.active);
    }
  }, [loading, config]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSaveConfig = () => {
    saveConfig({ agent_name: agentName, system_prompt: systemPrompt, active: isActive });
  };

  const handleAddFaq = () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    addFaq(faqQuestion, faqAnswer);
    setFaqQuestion("");
    setFaqAnswer("");
  };

  const handleAddDoc = () => {
    if (!docTitle.trim() || !docContent.trim()) return;
    addDocument(docTitle, docContent);
    setDocTitle("");
    setDocContent("");
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
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config" className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Configuração
              </TabsTrigger>
              <TabsTrigger value="faq" className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                FAQ
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Documentos
              </TabsTrigger>
            </TabsList>

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

                  <div className="space-y-2">
                    <Label>Prompt do Sistema (Instruções)</Label>
                    <Textarea
                      value={systemPrompt}
                      onChange={e => setSystemPrompt(e.target.value)}
                      placeholder="Descreva como o agente deve se comportar, o tom de voz, regras, etc."
                      rows={8}
                      className="resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Este texto será usado como instrução principal do agente. Inclua informações sobre sua empresa, tom de voz e regras.
                    </p>
                  </div>

                  <Button onClick={handleSaveConfig} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Configuração
                  </Button>
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
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
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
                      <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => removeKnowledge(item.id)}>
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
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card border-l-[3px] border-l-primary">
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
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card border-l-[3px] border-l-accent">
              <div className="p-2 rounded-lg bg-accent/10">
                <HelpCircle className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">FAQs</p>
                <p className="text-lg font-bold">{knowledge.filter(k => k.type === "faq").length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card border-l-[3px] border-l-success">
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
                        {msg.content}
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
    </div>
  );
};

export default AgenteIA;
