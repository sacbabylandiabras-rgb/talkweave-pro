import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquareHeart, Save, Eye } from "lucide-react";

const MensagemBoasVindas = () => {
  const [ativo, setAtivo] = useState(true);
  const [mensagem, setMensagem] = useState("Olá! 👋 Bem-vindo à nossa empresa! Como podemos ajudá-lo hoje?");

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

          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Visualizar
            </Button>
            <Button className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Salvar Configurações
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
              <p className="text-2xl font-bold text-primary">127</p>
              <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">98</p>
              <p className="text-sm text-muted-foreground">Visualizadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">45</p>
              <p className="text-sm text-muted-foreground">Respondidas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MensagemBoasVindas;