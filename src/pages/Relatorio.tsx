import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Download, TrendingUp, TrendingDown, Calendar, Users, MessageSquare, Send } from "lucide-react";

const Relatorio = () => {
  const metricas = [
    {
      titulo: "Mensagens Enviadas",
      valor: "12,847",
      variacao: "+12%",
      tipo: "alta",
      icon: Send,
      periodo: "Este mês"
    },
    {
      titulo: "Taxa de Entrega",
      valor: "94.2%",
      variacao: "+2.1%",
      tipo: "alta",
      icon: TrendingUp,
      periodo: "Últimos 30 dias"
    },
    {
      titulo: "Contatos Ativos",
      valor: "3,456",
      variacao: "-1.2%",
      tipo: "baixa",
      icon: Users,
      periodo: "Este mês"
    },
    {
      titulo: "Taxa de Resposta",
      valor: "23.8%",
      variacao: "+4.3%",
      tipo: "alta",
      icon: MessageSquare,
      periodo: "Últimos 30 dias"
    }
  ];

  const campanhas = [
    {
      id: 1,
      nome: "Campanha Black Friday",
      data: "2024-01-15",
      enviadas: 2500,
      entregues: 2350,
      visualizadas: 1890,
      respondidas: 567,
      taxa_conversao: "22.7%",
      status: "concluída"
    },
    {
      id: 2,
      nome: "Lançamento Produto X",
      data: "2024-01-10",
      enviadas: 1800,
      entregues: 1720,
      visualizadas: 1340,
      respondidas: 298,
      taxa_conversao: "16.6%",
      status: "concluída"
    },
    {
      id: 3,
      nome: "Promoção Fim de Ano",
      data: "2024-01-08",
      enviadas: 3200,
      entregues: 3050,
      visualizadas: 2456,
      respondidas: 734,
      taxa_conversao: "22.9%",
      status: "concluída"
    }
  ];

  const dispositivosPerformance = [
    { dispositivo: "WhatsApp Principal", mensagens: 8500, taxa_entrega: "96.2%" },
    { dispositivo: "WhatsApp Suporte", mensagens: 4347, taxa_entrega: "92.1%" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">Análise detalhada do desempenho das suas campanhas</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Últimos 30 dias
          </Button>
          <Button variant="outline">Personalizar Período</Button>
        </div>
        <Button className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricas.map((metrica, index) => {
          const Icon = metrica.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metrica.titulo}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrica.valor}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={metrica.tipo === 'alta' ? 'default' : 'destructive'}>
                    {metrica.tipo === 'alta' ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {metrica.variacao}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{metrica.periodo}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Desempenho por Dispositivo
          </CardTitle>
          <CardDescription>Comparativo de performance entre dispositivos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dispositivosPerformance.map((dispositivo, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">{dispositivo.dispositivo}</h3>
                  <p className="text-sm text-muted-foreground">
                    {dispositivo.mensagens.toLocaleString()} mensagens enviadas
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{dispositivo.taxa_entrega}</p>
                  <p className="text-sm text-muted-foreground">Taxa de Entrega</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Campanhas Recentes</CardTitle>
              <CardDescription>Resultados das últimas campanhas enviadas</CardDescription>
            </div>
            <Button variant="outline">Ver Todas</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campanhas.map((campanha) => (
              <div key={campanha.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{campanha.nome}</h3>
                    <p className="text-sm text-muted-foreground">{campanha.data}</p>
                  </div>
                  <Badge variant="outline">{campanha.status}</Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Enviadas</p>
                    <p className="font-semibold">{campanha.enviadas.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Entregues</p>
                    <p className="font-semibold">{campanha.entregues.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Visualizadas</p>
                    <p className="font-semibold">{campanha.visualizadas.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Respondidas</p>
                    <p className="font-semibold">{campanha.respondidas.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taxa de Conversão</p>
                    <p className="font-semibold text-primary">{campanha.taxa_conversao}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Horários de Maior Engajamento</CardTitle>
            <CardDescription>Melhores horários para envio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>09:00 - 11:00</span>
                <Badge>Alto engajamento</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>14:00 - 16:00</span>
                <Badge>Alto engajamento</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>19:00 - 21:00</span>
                <Badge variant="secondary">Médio engajamento</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>22:00 - 08:00</span>
                <Badge variant="destructive">Baixo engajamento</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Modelos de Mensagem</CardTitle>
            <CardDescription>Modelos com melhor performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Saudação Comercial</span>
                <div className="text-right">
                  <p className="font-semibold">28.5%</p>
                  <p className="text-xs text-muted-foreground">Taxa de resposta</p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Promoção Especial</span>
                <div className="text-right">
                  <p className="font-semibold">24.2%</p>
                  <p className="text-xs text-muted-foreground">Taxa de resposta</p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span>Agendamento</span>
                <div className="text-right">
                  <p className="font-semibold">19.8%</p>
                  <p className="text-xs text-muted-foreground">Taxa de resposta</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Relatorio;