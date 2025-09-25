import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Search, Plus, MessageSquare, Phone, Mail, Filter } from "lucide-react";

const Contatos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const contatos = [
    {
      id: 1,
      nome: "João Silva",
      numero: "+55 11 99999-9999",
      email: "joao@email.com",
      ultimaMensagem: "Olá, gostaria de mais informações",
      status: "ativo",
      dataUltimaMensagem: "2024-01-15",
      tags: ["Cliente", "VIP"]
    },
    {
      id: 2,
      nome: "Maria Santos",
      numero: "+55 11 88888-8888",
      email: "maria@email.com",
      ultimaMensagem: "Obrigada pelo atendimento!",
      status: "inativo",
      dataUltimaMensagem: "2024-01-14",
      tags: ["Lead", "Interessado"]
    },
    {
      id: 3,
      nome: "Pedro Costa",
      numero: "+55 11 77777-7777",
      email: "pedro@email.com",
      ultimaMensagem: "Quando vocês abrem?",
      status: "ativo",
      dataUltimaMensagem: "2024-01-16",
      tags: ["Novo"]
    },
    {
      id: 4,
      nome: "Ana Oliveira",
      numero: "+55 11 66666-6666",
      email: "ana@email.com",
      ultimaMensagem: "Preciso de suporte técnico",
      status: "bloqueado",
      dataUltimaMensagem: "2024-01-13",
      tags: ["Suporte"]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'default';
      case 'inativo': return 'secondary';
      case 'bloqueado': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contatos</h1>
        <p className="text-muted-foreground">Gerencie todos os seus contatos do WhatsApp</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input 
            placeholder="Buscar contatos por nome, número ou email..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Contato
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contatos.map((contato) => (
          <Card key={contato.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${contato.nome}`} />
                  <AvatarFallback>{contato.nome.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">{contato.nome}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant={getStatusColor(contato.status)}>
                      {contato.status}
                    </Badge>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{contato.numero}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{contato.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Última mensagem:</p>
                <p className="text-sm text-muted-foreground italic">"{contato.ultimaMensagem}"</p>
                <p className="text-xs text-muted-foreground">{contato.dataUltimaMensagem}</p>
              </div>

              <div className="flex flex-wrap gap-1">
                {contato.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1 flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  Mensagem
                </Button>
                <Button variant="outline" size="sm">
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Estatísticas de Contatos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">156</p>
              <p className="text-sm text-muted-foreground">Total de Contatos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">98</p>
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">45</p>
              <p className="text-sm text-muted-foreground">Inativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">13</p>
              <p className="text-sm text-muted-foreground">Bloqueados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Contatos;