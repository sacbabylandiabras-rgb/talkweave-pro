import { useState } from "react";
import { Search, Instagram } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useInstagramContacts } from "@/hooks/useInstagramContacts";
import { format } from "date-fns";

export default function ContatosInstagram() {
  const [search, setSearch] = useState("");
  const { contacts, isLoading } = useInstagramContacts();

  const filtered = contacts.filter(c =>
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    c.full_name.toLowerCase().includes(search.toLowerCase())
  );

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
        <Badge variant="secondary" className="h-9 px-3 flex items-center">
          {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-16">
                      <div className="flex flex-col items-center text-muted-foreground">
                        <Instagram className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm font-medium">Nenhum contato ainda</p>
                        <p className="text-xs mt-1">Os contatos aparecerão quando os fluxos estiverem ativos</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(contact => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={contact.profile_pic_url} />
                            <AvatarFallback className="text-[10px]">
                              {contact.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">@{contact.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{contact.full_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{contact.source}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(contact.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
