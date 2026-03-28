import { Settings, TestTube, Power } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockAcquirers, getStatusBadge, formatCurrencyReais } from "./mock-data";

export default function AdminAcquirers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Adquirentes</h1>
        <p className="text-sm text-muted-foreground">Gerencie as adquirentes de pagamento da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockAcquirers.map(acq => {
          const badge = getStatusBadge(acq.status);
          return (
            <Card key={acq.id} className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">{acq.logo}</div>
                    <div>
                      <h3 className="font-semibold">{acq.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${badge.color} ${badge.bg}`}>{badge.label}</span>
                    </div>
                  </div>
                </div>
                {acq.status === "production" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Volume Mês</p>
                      <p className="font-bold text-sm">{formatCurrencyReais(acq.volumeMonth)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Aprovação</p>
                      <p className="font-bold text-sm text-emerald-400">{acq.approvalRate}%</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full"><Settings className="w-3 h-3 mr-1" /> Configurar</Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full"><TestTube className="w-3 h-3 mr-1" /> Testar</Button>
                  {acq.status === "inactive" && <Button size="sm" className="flex-1 text-xs rounded-full bg-[#FF4D2E] hover:bg-[#E63D20] text-white"><Power className="w-3 h-3 mr-1" /> Ativar</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
