import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Copy, Edit, Trash2, Save } from "lucide-react";

const Modelos = () => {
  const [modelos, setModelos] = useState([
    {
      id: 1,
      nome: "Saudação Comercial",
      categoria: "Saudação",
      conteudo: "Olá! Obrigado por entrar em contato conosco. Como podemos ajudá-lo hoje?",
      usado: 45
    },
    {
      id: 2,
      nome: "Informações de Produto",
      categoria: "Vendas",
      conteudo: "Nosso produto oferece as seguintes funcionalidades: {lista_funcionalidades}. Gostaria de saber mais detalhes?",
      usado: 23
    },
    {
      id: 3,
      nome: "Agendamento",
      categoria: "Atendimento",
      conteudo: "Para agendar uma reunião, por favor nos informe sua disponibilidade. Nossos horários são de segunda a sexta, das 9h às 17h.",
      usado: 67
    },
    {
      id: 4,
      nome: "Suporte Técnico",
      categoria: "Suporte",
      conteudo: "Recebemos sua solicitação de suporte. Nossa equipe técnica entrará em contato em até 24 horas.",
      usado: 12
    }
  ]);

  const categorias = ["Saudação", "Vendas", "Atendimento", "Suporte"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Modelos de Mensagem</h1>
        <p className="text-muted-foreground">Gerencie e organize seus modelos de mensagem</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Todos</Button>
          {categorias.map((categoria) => (
            <Button key={categoria} variant="outline" size="sm">{categoria}</Button>
          ))}
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Modelo
        </Button>
      </div>

      <div className="grid gap-4">
        {modelos.map((modelo) => (
          <Card key={modelo.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{modelo.nome}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{modelo.categoria}</Badge>
                      <span>•</span>
                      <span>Usado {modelo.usado} vezes</span>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Copy className="w-4 h-4" />
                    Copiar
                  </Button>
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
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm">{modelo.conteudo}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Modelo</CardTitle>
          <CardDescription>Adicione um novo modelo de mensagem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome-modelo">Nome do Modelo</Label>
              <Input 
                id="nome-modelo"
                placeholder="Ex: Saudação Personalizada"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="categoria-modelo">Categoria</Label>
              <Input 
                id="categoria-modelo"
                placeholder="Ex: Vendas, Suporte"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="conteudo-modelo">Conteudo do Modelo</Label>
            <Textarea 
              id="conteudo-modelo"
              placeholder="Digite o conteúdo do modelo..."
              className="mt-1 min-h-[120px]"
            />
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Variáveis Disponíveis:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><code className="bg-background px-2 py-1 rounded">{"{nome}"}</code> - Nome do contato</div>
              <div><code className="bg-background px-2 py-1 rounded">{"{empresa}"}</code> - Nome da empresa</div>
              <div><code className="bg-background px-2 py-1 rounded">{"{produto}"}</code> - Nome do produto</div>
              <div><code className="bg-background px-2 py-1 rounded">{"{data}"}</code> - Data atual</div>
            </div>
          </div>
          <Button className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Salvar Modelo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Modelos;