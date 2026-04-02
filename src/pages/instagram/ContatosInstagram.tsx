import { useState } from "react";
import { Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MockContact {
  id: string;
  username: string;
  campaign: string;
  step: string;
  totalSteps: number;
  currentStep: number;
  enteredAt: string;
  lastInteraction: string;
  status: "in_progress" | "completed";
}

const mockContacts: MockContact[] = [
  { id: "1", username: "@joao.silva", campaign: "Promoção Black Friday", step: "DM 1", totalSteps: 3, currentStep: 1, enteredAt: "2026-03-30 14:22", lastInteraction: "2026-03-30 14:22", status: "in_progress" },
  { id: "2", username: "@maria.santos", campaign: "Promoção Black Friday", step: "DM 2", totalSteps: 3, currentStep: 2, enteredAt: "2026-03-29 10:15", lastInteraction: "2026-03-30 10:15", status: "in_progress" },
  { id: "3", username: "@pedro.costa", campaign: "Lançamento Curso", step: "DM 3", totalSteps: 3, currentStep: 3, enteredAt: "2026-03-25 08:00", lastInteraction: "2026-03-28 08:00", status: "completed" },
  { id: "4", username: "@ana.oliveira", campaign: "Sorteio Mensal", step: "DM 1", totalSteps: 2, currentStep: 1, enteredAt: "2026-03-31 16:45", lastInteraction: "2026-03-31 16:45", status: "in_progress" },
  { id: "5", username: "@lucas.ferreira", campaign: "Promoção Black Friday", step: "DM 3", totalSteps: 3, currentStep: 3, enteredAt: "2026-03-28 09:30", lastInteraction: "2026-03-31 09:30", status: "completed" },
];

export default function ContatosInstagram() {
  const [search, setSearch] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const campaigns = [...new Set(mockContacts.map(c => c.campaign))];

  const filtered = mockContacts.filter(c => {
    if (search && !c.username.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCampaign !== "all" && c.campaign !== filterCampaign) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });

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
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Campanha" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            {campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
          </SelectContent>
        </Select>
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
              {filtered.map(contact => (
                <TableRow key={contact.id} className="border-border">
                  <TableCell className="font-medium">{contact.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{contact.campaign}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{contact.currentStep}/{contact.totalSteps}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{contact.enteredAt}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{contact.lastInteraction}</TableCell>
                  <TableCell>
                    <Badge variant={contact.status === "completed" ? "default" : "secondary"}
                      className={contact.status === "completed" ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30"}>
                      {contact.status === "completed" ? "Concluído" : "Em andamento"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
