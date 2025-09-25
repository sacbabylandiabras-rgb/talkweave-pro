import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Save, Bot, Brain, Zap, Settings } from "lucide-react";

const Contexto = () => {
  const [contextoAtivo, setContextoAtivo] = useState(true);
  const [contextoEmpresa, setContextoEmpresa] = useState(`Somos a ZapLynx, uma empresa especializada em automação de WhatsApp para empresas. 

Nossos principais serviços incluem:
- Automação de mensagens
- Gestão de contatos
- Relatórios detalhados
- Integração com CRM

Horário de funcionamento: Segunda a Sexta, das 8h às 18h
Localização: São Paulo, SP
Website: www.zaplynx.com.br`);

  const [personalidade, setPersonalidade] = useState("Profissional, cordial e prestativo. Sempre disposto a ajudar e resolver dúvidas dos clientes.");

  const contextosPersonalizados = [
    {
      id: 1,
      nome: "Suporte Técnico",
      contexto: "Você é um especialista em suporte técnico da ZapLynx. Resolva problemas com paciência e conhecimento técnico.",
      ativo: true,
      categoria: "Suporte"
    },
    {
      id: 2,
      nome: "Vendas",
      contexto: "Você é um consultor de vendas experiente. Identifique necessidades do cliente e apresente soluções adequadas.",
      ativo: true,
      categoria: "Comercial"
    },
    {
      id: 3,
      nome: "Pós-Venda",
      contexto: "Você cuida do relacionamento pós-venda, garantindo satisfação e fidelização do cliente.",
      ativo: false,
      categoria: "Relacionamento"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contexto de IA</h1>
        <p className="text-muted-foreground">Configure como a IA responde automaticamente às mensagens</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Sistema de IA Contextual
              </CardTitle>
              <CardDescription>
                Ative respostas inteligentes baseadas no contexto da sua empresa
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="contexto-ativo">IA Ativa</Label>
              <Switch 
                id="contexto-ativo"
                checked={contextoAtivo}
                onCheckedChange={setContextoAtivo}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respostas IA Hoje</CardTitle>
            <Bot className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">
              +23% vs ontem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precisão</CardTitle>
            <Brain className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-muted-foreground">
              Taxa de satisfação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Economia de Tempo</CardTitle>
            <Zap className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.5h</div>
            <p className="text-xs text-muted-foreground">
              Poupadas hoje
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contexto Geral da Empresa</CardTitle>
          <CardDescription>Informações base que a IA usará para responder sobre sua empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="contexto-empresa">Informações da Empresa</Label>
            <Textarea 
              id="contexto-empresa"
              placeholder="Descreva sua empresa, produtos, serviços, horários, etc..."
              className="mt-1 min-h-[150px]"
              value={contextoEmpresa}
              onChange={(e) => setContextoEmpresa(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="personalidade">Personalidade da IA</Label>
            <Textarea 
              id="personalidade"
              placeholder="Como a IA deve se comportar nas conversas..."
              className="mt-1 min-h-[80px]"
              value={personalidade}
              onChange={(e) => setPersonalidade(e.target.value)}
            />
          </div>

          <Button className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Salvar Contexto Geral
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Contextos Especializados</CardTitle>
              <CardDescription>Configure contextos específicos para diferentes situações</CardDescription>
            </div>
            <Button className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Novo Contexto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contextosPersonalizados.map((contexto) => (
              <div key={contexto.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-medium">{contexto.nome}</h3>
                      <Badge variant="outline" className="mt-1">{contexto.categoria}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={contexto.ativo} />
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm">{contexto.contexto}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Contexto</CardTitle>
          <CardDescription>Adicione um contexto especializado para situações específicas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome-contexto">Nome do Contexto</Label>
              <Input 
                id="nome-contexto"
                placeholder="Ex: Atendimento VIP"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="categoria-contexto">Categoria</Label>
              <Input 
                id="categoria-contexto"
                placeholder="Ex: Atendimento, Vendas"
                className="mt-1"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="contexto-especializado">Instruções para a IA</Label>
            <Textarea 
              id="contexto-especializado"
              placeholder="Descreva como a IA deve se comportar neste contexto específico..."
              className="mt-1 min-h-[120px]"
            />
          </div>

          <div>
            <Label htmlFor="palavras-chave">Palavras-chave de Ativação</Label>
            <Input 
              id="palavras-chave"
              placeholder="Ex: problema, erro, bug, suporte (separar por vírgula)"
              className="mt-1"
            />
          </div>

          <Button className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Criar Contexto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurações Avançadas</CardTitle>
          <CardDescription>Ajustes finos do comportamento da IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="criatividade">Nível de Criatividade</Label>
              <select className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md">
                <option>Conservador</option>
                <option>Equilibrado</option>
                <option>Criativo</option>
              </select>
            </div>
            <div>
              <Label htmlFor="tamanho-resposta">Tamanho das Respostas</Label>
              <select className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md">
                <option>Conciso</option>
                <option>Médio</option>
                <option>Detalhado</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Dicas para um Contexto Eficaz</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Seja específico sobre seus produtos e serviços</li>
              <li>• Inclua informações de contato e horário de funcionamento</li>
              <li>• Defina o tom de voz adequado para sua marca</li>
              <li>• Adicione FAQ comum dos seus clientes</li>
              <li>• Atualize regularmente com novas informações</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Contexto;