import { Users, UserPlus, Search, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function PayAffiliates() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Meus Afiliados
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus parceiros e acompanhe o desempenho.
          </p>
        </div>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Convidar Afiliado
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Afiliados</CardTitle>
            <Users className="h-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Nenhum afiliado ativo ainda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas por Afiliados</CardTitle>
            <TrendingUp className="h-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">Volume total de vendas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Pagas</CardTitle>
            <DollarSign className="h-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">Total repassado aos parceiros</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar afiliado por nome ou e-mail..." className="pl-10" />
          </div>
        </div>

        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="max-w-[420px] mx-auto space-y-2">
              <h3 className="text-lg font-semibold">Nenhum afiliado encontrado</h3>
              <p className="text-muted-foreground">
                Você ainda não possui afiliados vinculados aos seus produtos. 
                Comece convidando parceiros para escalar suas vendas!
              </p>
            </div>
            <Button variant="outline" className="mt-2">Ver link de convite</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
