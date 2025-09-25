import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquareReply, Search, Filter, Reply, Star, Archive, Trash2 } from "lucide-react";

const MensagensRecebidas = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todas");
  
  const mensagens = [
    {
      id: 1,
      remetente: "João Silva",
      numero: "+55 11 99999-9999",
      mensagem: "Olá! Gostaria de saber mais informações sobre os seus produtos. Vocês fazem entrega para São Paulo?",
      data: "2024-01-16 14:30",
      status: "nova",
      importante: true,
      dispositivo: "WhatsApp Principal"
    },
    {
      id: 2,
      remetente: "Maria Santos",
      numero: "+55 11 88888-8888",
      mensagem: "Obrigada pelo atendimento de ontem! Já recebi o produto e está perfeito.",
      data: "2024-01-16 11:15",
      status: "lida",
      importante: false,
      dispositivo: "WhatsApp Suporte"
    },
    {
      id: 3,
      remetente: "Pedro Costa",
      numero: "+55 11 77777-7777",
      mensagem: "Qual o horário de funcionamento da loja? Preciso ir hoje.",
      data: "2024-01-16 09:45",
      status: "respondida",
      importante: false,
      dispositivo: "WhatsApp Principal"
    },
    {
      id: 4,
      remetente: "Ana Oliveira",
      numero: "+55 11 66666-6666",
      mensagem: "Estou com problema no produto que comprei. Podem me ajudar?",
      data: "2024-01-15 16:20",
      status: "nova",
      importante: true,
      dispositivo: "WhatsApp Suporte"
    },
    {
      id: 5,
      remetente: "Carlos Lima",
      numero: "+55 11 55555-5555",
      mensagem: "Vocês têm desconto para compra em quantidade?",
      data: "2024-01-15 13:10",
      status: "arquivada",
      importante: false,
      dispositivo: "WhatsApp Principal"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'nova': return 'destructive';
      case 'lida': return 'default';
      case 'respondida': return 'default';
      case 'arquivada': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'nova': return 'Nova';
      case 'lida': return 'Lida';
      case 'respondida': return 'Respondida';
      case 'arquivada': return 'Arquivada';
      default: return status;
    }
  };

  const mensagensFiltradas = mensagens.filter(msg => {
    const matchSearch = msg.remetente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       msg.numero.includes(searchTerm) ||
                       msg.mensagem.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filtroStatus === 'todas') return matchSearch;
    return matchSearch && msg.status === filtroStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mensagens Recebidas</h1>
        <p className="text-muted-foreground">Gerencie todas as mensagens recebidas em seus dispositivos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novas Mensagens</CardTitle>
            <MessageSquareReply className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">8</div>
            <p className="text-xs text-muted-foreground">
              Aguardando resposta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
            <MessageSquareReply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">
              +12 desde ontem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <Reply className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">89%</div>
            <p className="text-xs text-muted-foreground">
              Últimos 7 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <MessageSquareReply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4m</div>
            <p className="text-xs text-muted-foreground">
              Tempo de resposta
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Filtros e Busca</CardTitle>
              <CardDescription>Encontre mensagens específicas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Buscar por remetente, número ou conteúdo..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="px-3 py-2 border border-input bg-background rounded-md"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="nova">Novas</option>
              <option value="lida">Lidas</option>
              <option value="respondida">Respondidas</option>
              <option value="arquivada">Arquivadas</option>
            </select>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Mais Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {mensagensFiltradas.map((mensagem) => (
          <Card key={mensagem.id} className={`hover:shadow-md transition-shadow ${mensagem.status === 'nova' ? 'border-red-200 dark:border-red-800' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mensagem.remetente}`} />
                    <AvatarFallback>{mensagem.remetente.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{mensagem.remetente}</h3>
                      {mensagem.importante && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{mensagem.numero}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {mensagem.dispositivo}
                  </Badge>
                  <Badge variant={getStatusColor(mensagem.status)}>
                    {getStatusText(mensagem.status)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm">{mensagem.mensagem}</p>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{mensagem.data}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex items-center gap-1">
                    <Reply className="w-4 h-4" />
                    Responder
                  </Button>
                  <Button variant="outline" size="sm">
                    <Star className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {mensagensFiltradas.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquareReply className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">Nenhuma mensagem encontrada</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros ou buscar por outros termos</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MensagensRecebidas;