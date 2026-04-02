import { useState } from "react";
import { Plus, Play, Pause, BarChart3, Send, Users, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface MockFlow {
  id: string;
  name: string;
  active: boolean;
  totalContacts: number;
  dmsSent: number;
  keywords: string[];
  createdAt: string;
}

const mockFlows: MockFlow[] = [
  { id: "1", name: "Promoção Black Friday", active: true, totalContacts: 234, dmsSent: 189, keywords: ["quero", "preço", "link"], createdAt: "2026-03-28" },
  { id: "2", name: "Lançamento Curso", active: false, totalContacts: 87, dmsSent: 62, keywords: ["curso", "info"], createdAt: "2026-03-20" },
  { id: "3", name: "Sorteio Mensal", active: true, totalContacts: 512, dmsSent: 498, keywords: ["participar", "sorteio"], createdAt: "2026-03-15" },
];

export default function CampanhasInstagram() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Campanhas Instagram</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus fluxos de automação de comentários</p>
        </div>
        <Button onClick={() => navigate("/instagram/automacao")} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Fluxo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockFlows.map(flow => (
          <Card key={flow.id} className="border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate("/instagram/automacao")}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{flow.name}</CardTitle>
                <Badge variant={flow.active ? "default" : "secondary"} className={flow.active ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30" : ""}>
                  {flow.active ? "Ativo" : "Pausado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {flow.keywords.map(kw => (
                  <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <Users className="w-3 h-3" />
                    <span className="text-[10px]">No Funil</span>
                  </div>
                  <p className="text-sm font-bold">{flow.totalContacts}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <Send className="w-3 h-3" />
                    <span className="text-[10px]">DMs Enviadas</span>
                  </div>
                  <p className="text-sm font-bold">{flow.dmsSent}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Criado em {flow.createdAt}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
