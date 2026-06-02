import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquareHeart, Save, Eye, Send, MessageSquare, FileText, Workflow } from "lucide-react";
import { useWelcomeMessage } from "@/hooks/useWelcomeMessage";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { supabase } from "@/integrations/supabase/client";
import InstanceSelector from "@/components/envio/InstanceSelector";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const MensagemBoasVindas = () => {
  const { config, stats, loading, saveConfig, sendWelcomeMessage } = useWelcomeMessage();
  const { templates } = useMessageTemplates();
  const [ativo, setAtivo] = useState(false);
  const [mensagem, setMensagem] = useState("Olá! 👋 Bem-vindo à nossa empresa! Como podemos ajudá-lo hoje?");
  const [responseType, setResponseType] = useState<'text' | 'template' | 'flow'>('text');
  const [templateId, setTemplateId] = useState<string>("");
  const [flowId, setFlowId] = useState<string>("");
  const [flows, setFlows] = useState<Array<{ id: string; name: string }>>([]);
  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("");

  useEffect(() => {
    if (config) {
      setAtivo(config.active);
      setMensagem(config.message);
      setResponseType(config.response_type || 'text');
      setTemplateId(config.template_id || "");
      setFlowId(config.flow_id || "");
    }
  }, [config]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('flow_automations')
        .select('id, name')
        .eq('active', true)
        .order('name');
      setFlows((data as Array<{ id: string; name: string }>) || []);
    })();
  }, []);

  const handleSave = async () => {
    await saveConfig(ativo, mensagem, {
      response_type: responseType,
      template_id: responseType === 'template' ? (templateId || null) : null,
      flow_id: responseType === 'flow' ? (flowId || null) : null,
    });
  };

  const handleTest = async () => {
    if (testPhone) {
      await sendWelcomeMessage(testPhone, testName || undefined);
      setTestPhone("");
      setTestName("");
    }
  };

  const renderPreview = () => {
    let preview = mensagem;
    preview = preview.replace(/{nome}/g, testName || "João");
    preview = preview.replace(/{empresa}/g, "Nossa Empresa");
    preview = preview.replace(/{data}/g, new Date().toLocaleDateString('pt-BR'));
    preview = preview.replace(/{hora}/g, new Date().toLocaleTimeString('pt-BR'));
    return preview;
  };

  const selectedTemplate = templates.find(t => t.id === templateId);
  const selectedFlow = flows.find(f => f.id === flowId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mensagem de Boas-vindas</h1>
        <p className="text-muted-foreground">Configure mensagens automáticas para novos contatos</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareHeart className="w-5 h-5" />
                Configuração da Mensagem
              </CardTitle>
              <CardDescription>
                Defina uma mensagem que será enviada automaticamente para novos contatos
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch 
                id="ativo"
                checked={ativo}
                onCheckedChange={setAtivo}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <InstanceSelector />

          <div>
            <Label className="mb-2 block">Tipo de Boas-vindas</Label>
            <Tabs value={responseType} onValueChange={(v) => setResponseType(v as 'text' | 'template' | 'flow')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Texto
                </TabsTrigger>
                <TabsTrigger value="template" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Modelo
                </TabsTrigger>
                <TabsTrigger value="flow" className="flex items-center gap-2">
                  <Workflow className="w-4 h-4" />
                  Fluxo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="mensagem-boas-vindas">Mensagem de Boas-vindas</Label>
                  <Textarea
                    id="mensagem-boas-vindas"
                    placeholder="Digite sua mensagem de boas-vindas..."
                    className="mt-1 min-h-[120px]"
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Você pode usar variáveis como {"{nome}"} para personalizar a mensagem
                  </p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Variáveis Disponíveis:</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><code className="bg-background px-2 py-1 rounded">{"{nome}"}</code> - Nome do contato</div>
                    <div><code className="bg-background px-2 py-1 rounded">{"{empresa}"}</code> - Nome da empresa</div>
                    <div><code className="bg-background px-2 py-1 rounded">{"{data}"}</code> - Data atual</div>
                    <div><code className="bg-background px-2 py-1 rounded">{"{hora}"}</code> - Hora atual</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="template" className="space-y-3 pt-4">
                <Label>Selecione um modelo</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum modelo disponível</div>
                    )}
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap">
                    {selectedTemplate.content}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  O modelo selecionado será enviado como mensagem de boas-vindas para novos contatos.
                </p>
              </TabsContent>

              <TabsContent value="flow" className="space-y-3 pt-4">
                <Label>Selecione um fluxo</Label>
                <Select value={flowId} onValueChange={setFlowId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um fluxo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {flows.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum fluxo ativo</div>
                    )}
                    {flows.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedFlow && (
                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                    Fluxo selecionado: <strong>{selectedFlow.name}</strong>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  O fluxo será disparado automaticamente para o contato assim que ele iniciar a conversa.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Visualizar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pré-visualização da Mensagem</DialogTitle>
                  <DialogDescription>
                    Veja como a mensagem aparecerá para o cliente
                  </DialogDescription>
                </DialogHeader>
                <div className="bg-muted p-4 rounded-lg">
                  {responseType === 'text' && <p className="whitespace-pre-wrap">{renderPreview()}</p>}
                  {responseType === 'template' && (
                    <p className="whitespace-pre-wrap">
                      {selectedTemplate?.content || 'Nenhum modelo selecionado'}
                    </p>
                  )}
                  {responseType === 'flow' && (
                    <p>Disparará o fluxo: <strong>{selectedFlow?.name || 'Nenhum fluxo selecionado'}</strong></p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Testar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Testar Mensagem de Boas-vindas</DialogTitle>
                  <DialogDescription>
                    Envie uma mensagem de teste para um número específico
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="test-phone">Número de telefone</Label>
                    <Input
                      id="test-phone"
                      placeholder="5511999999999"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="test-name">Nome (opcional)</Label>
                    <Input
                      id="test-name"
                      placeholder="Nome do contato"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleTest} className="w-full">
                    Enviar Teste
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={handleSave} disabled={loading} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estatísticas</CardTitle>
          <CardDescription>Desempenho das mensagens de boas-vindas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{stats.sent}</p>
              <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{stats.viewed}</p>
              <p className="text-sm text-muted-foreground">Visualizadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{stats.replied}</p>
              <p className="text-sm text-muted-foreground">Respondidas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagemBoasVindas;