import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, Plus, Trash2, Edit, Save } from "lucide-react";

const RespostaAutomatica = () => {
  const [ativo, setAtivo] = useState(true);
  const [respostas, setRespostas] = useState([
    {
      id: 1,
      palavra_chave: "horário",
      resposta: "Nosso horário de funcionamento é de segunda a sexta, das 8h às 18h.",
      ativa: true
    },
    {
      id: 2,
      palavra_chave: "preço",
      resposta: "Para informações sobre preços, entre em contato com nossa equipe comercial.",
      ativa: true
    },
    {
      id: 3,
      palavra_chave: "localização",
      resposta: "Estamos localizados na Rua das Flores, 123 - Centro, São Paulo - SP",
      ativa: false
    }
  ]);

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
                checked={ativo}
                onCheckedChange={setAtivo}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Respostas Configuradas</h2>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Resposta
        </Button>
      </div>

      <div className="space-y-4">
        {respostas.map((resposta) => (
          <Card key={resposta.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={resposta.ativa ? "default" : "secondary"}>
                    {resposta.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                  <div>
                    <CardTitle className="text-base">
                      Palavra-chave: <span className="text-primary">{resposta.palavra_chave}</span>
                    </CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={resposta.ativa}
                    onCheckedChange={(checked) => {
                      setRespostas(respostas.map(r => 
                        r.id === resposta.id ? {...r, ativa: checked} : r
                      ));
                    }}
                  />
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm text-muted-foreground">Resposta</Label>
                <p className="mt-1 text-sm">{resposta.resposta}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="nova-resposta">Resposta</Label>
            <Textarea 
              id="nova-resposta"
              placeholder="Digite a resposta automática..."
              className="mt-1 min-h-[80px]"
            />
          </div>
          <Button className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Salvar Resposta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RespostaAutomatica;