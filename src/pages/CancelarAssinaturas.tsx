import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserX, Search, Shield, AlertTriangle } from "lucide-react";

const CancelarAssinaturas = () => {
  const assinaturasOpt = [
    {
      id: 1,
      numero: "+55 11 99999-9999",
      nome: "João Silva",
      dataCancelamento: "2024-01-15",
      motivo: "Não deseja mais receber mensagens",
      status: "ativo"
    },
    {
      id: 2,
      numero: "+55 11 88888-8888",
      nome: "Maria Santos",
      dataCancelamento: "2024-01-14",
      motivo: "Mudança de número",
      status: "ativo"
    },
    {
      id: 3,
      numero: "+55 11 77777-7777",
      nome: "Pedro Costa",
      dataCancelamento: "2024-01-13",
      motivo: "Spam",
      status: "removido"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cancelar Assinaturas</h1>
        <p className="text-muted-foreground">Gerencie opt-outs e cancelamentos de assinatura</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Opt-outs</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">
              +2 desde ontem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              -12% em relação ao mês anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Opt-out</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2%</div>
            <p className="text-xs text-muted-foreground">
              Dentro do limite aceitável
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Lista de Opt-outs</CardTitle>
              <CardDescription>Contatos que cancelaram suas assinaturas</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input placeholder="Buscar por número ou nome..." className="pl-10" />
              </div>
              <Button variant="outline">Exportar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assinaturasOpt.map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserX className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="font-medium">{item.nome}</p>
                      <p className="text-sm text-muted-foreground">{item.numero}</p>
                    </div>
                  </div>
                  <Badge variant={item.status === 'ativo' ? 'destructive' : 'secondary'}>
                    {item.status === 'ativo' ? 'Opt-out Ativo' : 'Removido'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Data do Cancelamento</p>
                    <p className="font-medium">{item.dataCancelamento}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Motivo</p>
                    <p className="font-medium">{item.motivo}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm">
                    Reativar
                  </Button>
                  <Button variant="outline" size="sm">
                    Remover Permanentemente
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurações de Opt-out</CardTitle>
          <CardDescription>Configure como gerenciar cancelamentos de assinatura</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Palavras-chave para Opt-out Automático</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Quando um contato enviar uma mensagem com essas palavras, será automaticamente removido da lista.
            </p>
            <div className="flex flex-wrap gap-2">
              {["PARAR", "STOP", "SAIR", "CANCELAR", "REMOVER"].map((palavra) => (
                <Badge key={palavra} variant="outline">{palavra}</Badge>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Importante - Conformidade Legal
            </h3>
            <p className="text-sm text-muted-foreground">
              Sempre respeite os pedidos de opt-out dos usuários para manter a conformidade com as leis de proteção de dados e evitar que suas mensagens sejam marcadas como spam.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CancelarAssinaturas;