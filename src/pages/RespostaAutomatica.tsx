import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Plus, Trash2, Edit, Save, History, ExternalLink } from "lucide-react";
import { useAutoResponse } from "@/hooks/useAutoResponse";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const RespostaAutomatica = () => {
  const {
    responses,
    config,
    loading,
    addResponse,
    updateResponse,
    deleteResponse,
    updateConfig,
    getLogs
  } = useAutoResponse();

  const [novaResposta, setNovaResposta] = useState({ keyword: '', response: '' });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoResposta, setEditandoResposta] = useState({ keyword: '', response: '' });
  const [logs, setLogs] = useState<any[]>([]);

  const handleAddResponse = async () => {
    if (!novaResposta.keyword.trim() || !novaResposta.response.trim()) return;
    
    const success = await addResponse(novaResposta.keyword, novaResposta.response);
    if (success) {
      setNovaResposta({ keyword: '', response: '' });
    }
  };

  const handleEditResponse = async (id: string) => {
    if (!editandoResposta.keyword.trim() || !editandoResposta.response.trim()) return;
    
    const success = await updateResponse(id, {
      keyword: editandoResposta.keyword,
      response: editandoResposta.response
    });
    
    if (success) {
      setEditandoId(null);
      setEditandoResposta({ keyword: '', response: '' });
    }
  };

  const startEdit = (response: any) => {
    setEditandoId(response.id);
    setEditandoResposta({ keyword: response.keyword, response: response.response });
  };

  const cancelEdit = () => {
    setEditandoId(null);
    setEditandoResposta({ keyword: '', response: '' });
  };

  const loadLogs = async () => {
    const logsData = await getLogs();
    setLogs(logsData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resposta Automática</h1>
        <p className="text-muted-foreground">Configure respostas automáticas baseadas em palavras-chave</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="w-5 h-5" />
                Sistema de Respostas
              </CardTitle>
              <CardDescription>
                Ative ou desative o sistema de respostas automáticas
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="sistema-ativo">Sistema Ativo</Label>
              <Switch 
                id="sistema-ativo"
                checked={config?.active || false}
                onCheckedChange={(checked) => updateConfig(checked)}
                disabled={loading}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Respostas Configuradas</h2>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={loadLogs}>
                <History className="w-4 h-4 mr-2" />
                Ver Logs
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Histórico de Mensagens</DialogTitle>
                <DialogDescription>
                  Últimas mensagens processadas pelo sistema de resposta automática
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {logs.map((log, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Telefone</Label>
                          <p className="font-mono">{log.phone}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Mensagem Recebida</Label>
                          <p>{log.message_received}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Palavra-chave</Label>
                          <p className="font-medium text-primary">{log.keyword_matched}</p>
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground">Resposta Enviada</Label>
                          <p>{log.response_sent}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Data/Hora</Label>
                          <p>{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {logs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {responses.map((resposta) => (
          <Card key={resposta.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={resposta.active ? "default" : "secondary"}>
                    {resposta.active ? "Ativa" : "Inativa"}
                  </Badge>
                  <div>
                    {editandoId === resposta.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editandoResposta.keyword}
                          onChange={(e) => setEditandoResposta(prev => ({ ...prev, keyword: e.target.value }))}
                          placeholder="Palavra-chave"
                          className="text-sm"
                        />
                      </div>
                    ) : (
                      <CardTitle className="text-base">
                        Palavra-chave: <span className="text-primary">{resposta.keyword}</span>
                      </CardTitle>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={resposta.active}
                    onCheckedChange={(checked) => updateResponse(resposta.id, { active: checked })}
                    disabled={loading}
                  />
                  {editandoId === resposta.id ? (
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditResponse(resposta.id)}
                        disabled={loading}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={cancelEdit}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => startEdit(resposta)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteResponse(resposta.id)}
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm text-muted-foreground">Resposta</Label>
                {editandoId === resposta.id ? (
                  <Textarea
                    value={editandoResposta.response}
                    onChange={(e) => setEditandoResposta(prev => ({ ...prev, response: e.target.value }))}
                    className="mt-1 min-h-[60px]"
                  />
                ) : (
                  <p className="mt-1 text-sm">{resposta.response}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {responses.length === 0 && !loading && (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                Nenhuma resposta automática configurada
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar Nova Resposta</CardTitle>
          <CardDescription>Crie uma nova resposta automática</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nova-palavra-chave">Palavra-chave</Label>
            <Input 
              id="nova-palavra-chave"
              placeholder="Ex: horário, preço, localização"
              value={novaResposta.keyword}
              onChange={(e) => setNovaResposta(prev => ({ ...prev, keyword: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="nova-resposta">Resposta</Label>
            <Textarea 
              id="nova-resposta"
              placeholder="Digite a resposta automática..."
              value={novaResposta.response}
              onChange={(e) => setNovaResposta(prev => ({ ...prev, response: e.target.value }))}
              className="mt-1 min-h-[80px]"
            />
          </div>
          <Button 
            onClick={handleAddResponse}
            disabled={loading || !novaResposta.keyword.trim() || !novaResposta.response.trim()}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar Resposta
          </Button>
        </CardContent>
      </Card>

      {/* Seção de Configuração do Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Configuração do Webhook
          </CardTitle>
          <CardDescription>
            Configure o webhook para receber mensagens automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>URL do Webhook</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input 
                value={config?.webhook_url || ''}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(config?.webhook_url || '')}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Configure esta URL no painel da sua instância em "Configurações → Webhooks → Message"
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RespostaAutomatica;