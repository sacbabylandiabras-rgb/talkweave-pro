import { useState } from "react";
import { Search, Instagram } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ContatosInstagram() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Contatos Instagram</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Acompanhe os usuários que entraram nos seus funis</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar @usuario..." className="pl-9" />
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>@Usuário</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Última Interação</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Instagram className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum contato ainda</p>
                    <p className="text-xs mt-1">Os contatos aparecerão quando os fluxos estiverem ativos</p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
