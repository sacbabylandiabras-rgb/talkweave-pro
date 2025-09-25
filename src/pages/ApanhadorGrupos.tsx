import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UserPlus, Search, Download, Play, Pause, Users, Eye } from "lucide-react";

const ApanhadorGrupos = () => {
  const [busca, setBusca] = useState("");
  const [coletando, setColetando] = useState(false);
  
  const grupos = [
    {
      id: 1,
      nome: "Empreendedores Brasil",
      membros: 1250,
      descrição: "Grupo para networking de empreendedores brasileiros",
      categoria: "Negócios",
      coletado: 890,
      progresso: 71,
      status: "coletando"
    },
    {
      id: 2,
      nome: "Marketing Digital SP",
      membros: 850,
      descrição: "Discussões sobre marketing digital em São Paulo",
      categoria: "Marketing",
      coletado: 850,
      progresso: 100,
      status: "concluído"
    },
    {
      id: 3,
      nome: "Vendas e Negócios",
      membros: 650,
      descrição: "Técnicas e estratégias de vendas",
      categoria: "Vendas",
      coletado: 0,
      progresso: 0,
      status: "pendente"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'coletando': return 'default';
      case 'concluído': return 'default';
      case 'pendente': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Apanhador de Grupos</h1>
        <p className="text-muted-foreground">Colete contatos de grupos do WhatsApp para suas campanhas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grupos Monitorados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              +3 esta semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatos Coletados</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,847</div>
            <p className="text-xs text-muted-foreground">
              +234 hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Grupos sendo processados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Eye className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">
              Perfis públicos acessados
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Buscar Grupos</CardTitle>
              <CardDescription>Encontre grupos públicos para coletar contatos</CardDescription>
            </div>
            <Button className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Adicionar Grupo Manualmente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Buscar grupos por nome ou categoria..."
                className="pl-10"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button>Buscar</Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Negócios</Badge>
            <Badge variant="outline">Marketing</Badge>
            <Badge variant="outline">Vendas</Badge>
            <Badge variant="outline">Tecnologia</Badge>
            <Badge variant="outline">Empreendedorismo</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Grupos Monitorados</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar Contatos
          </Button>
          <Button 
            variant={coletando ? "destructive" : "default"}
            onClick={() => setColetando(!coletando)}
            className="flex items-center gap-2"
          >
            {coletando ? (
              <>
                <Pause className="w-4 h-4" />
                Pausar Coleta
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Iniciar Coleta
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {grupos.map((grupo) => (
          <Card key={grupo.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{grupo.nome}</CardTitle>
                    <CardDescription>{grupo.descrição}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{grupo.categoria}</Badge>
                  <Badge variant={getStatusColor(grupo.status)}>
                    {grupo.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total de Membros</p>
                  <p className="font-semibold">{grupo.membros.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contatos Coletados</p>
                  <p className="font-semibold">{grupo.coletado.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Progresso</p>
                  <p className="font-semibold">{grupo.progresso}%</p>
                </div>
              </div>
              
              {grupo.status === 'coletando' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso da Coleta</span>
                    <span>{grupo.progresso}%</span>
                  </div>
                  <Progress value={grupo.progresso} className="w-full" />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Ver Detalhes
                </Button>
                <Button variant="outline" size="sm">
                  Configurar
                </Button>
                {grupo.status === 'concluído' && (
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações de Coleta</CardTitle>
          <CardDescription>Configure como os contatos serão coletados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Diretrizes de Uso Responsável</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Respeite a privacidade dos usuários</li>
              <li>• Use apenas para grupos públicos onde você é membro</li>
              <li>• Não envie spam ou mensagens não solicitadas</li>
              <li>• Siga as diretrizes do WhatsApp</li>
            </ul>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Intervalo entre coletas</label>
              <select className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md">
                <option>5 segundos</option>
                <option>10 segundos</option>
                <option>30 segundos</option>
                <option>1 minuto</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Máximo por sessão</label>
              <select className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md">
                <option>100 contatos</option>
                <option>500 contatos</option>
                <option>1000 contatos</option>
                <option>Ilimitado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApanhadorGrupos;