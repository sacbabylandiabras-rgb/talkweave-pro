import { QrCode, CreditCard, Landmark, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const fees = [
  {
    method: "PIX",
    icon: QrCode,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    percent: "6,99",
    fixed: "R$ 1,99 por transação",
    reserve: "0,00",
    available: true,
    note: null,
  },
  {
    method: "Cartão de Crédito",
    icon: CreditCard,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    percent: "4,99",
    fixed: null,
    reserve: "25,00",
    available: true,
    note: "Taxas por parcela",
  },
  {
    method: "Cartão de Débito",
    icon: CreditCard,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    percent: "3,49",
    fixed: null,
    reserve: "25,00",
    available: true,
    note: null,
  },
  {
    method: "Boleto",
    icon: Landmark,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    percent: "3,99",
    fixed: "R$ 2,00 por transação",
    reserve: "10,00",
    available: true,
    note: "Sem custos para emissão de boletos, pague apenas o que vender!",
  },
];

export default function AdminFees() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Taxas</h1>
        <p className="text-sm text-muted-foreground">Veja detalhadamente as taxas da plataforma</p>
      </div>

      <div className="space-y-4">
        {fees.map((fee) => {
          const Icon = fee.icon;
          return (
            <Card key={fee.method} className="border-[#2A2A2A]">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${fee.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${fee.iconColor}`} />
                    </div>
                    <span className="font-semibold text-foreground">{fee.method}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={fee.available ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}
                  >
                    {fee.available ? "Disponível" : "Indisponível"}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-foreground">{fee.percent} %</span>
                  {fee.fixed && (
                    <span className="text-sm text-muted-foreground">+ {fee.fixed}</span>
                  )}
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-md px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">Reserva de Financeira: </span>
                  <span className="text-xs font-medium text-emerald-400">{fee.reserve}%</span>
                </div>

                {fee.note && (
                  <p className="text-xs text-muted-foreground">• {fee.note}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
