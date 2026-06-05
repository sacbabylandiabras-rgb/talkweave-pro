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
  Bot, Sparkles, Brain, Save, Loader2, Wrench, HelpCircle, FileText, Plus, Trash2, Mic, CheckCircle2, Upload, Globe, Search, Link as LinkIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AgentConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentConfigDialog({ open, onOpenChange }: AgentConfigDialogProps) {
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

  useEffect(() => {
    if (!loading) {
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
  }, [loading, config]);

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Configuração do Agente IA
          </DialogTitle>
          <DialogDescription>
            Tudo o que você configurar aqui será sincronizado com o Agente de IA principal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
