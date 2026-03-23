import { BarChart3, MessageCircle, Send, Clock, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const recentSends = [
  { phone: "+55 11 9****-1234", template: "boas_vindas_cliente", status: "delivered", time: "2 min atrás" },
  { phone: "+55 21 9****-5678", template: "confirmacao_pedido", status: "sent", time: "5 min atrás" },
  { phone: "+55 31 9****-9012", template: "lembrete_pagamento", status: "failed", time: "8 min atrás" },
  { phone: "+55 41 9****-3456", template: "boas_vindas_cliente", status: "delivered", time: "12 min atrás" },
];

const statusMap = {
  delivered: { label: "Entregue", icon: CheckCircle2, color: "text-emerald-500" },
  sent: { label: "Enviado", icon: Send, color: "text-primary" },
  failed: { label: "Falhou", icon: XCircle, color: "text-destructive" },
};

export default function DashboardMeta() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel — Meta API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral dos envios via WhatsApp Cloud API
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Mensagens Hoje", value: "0", icon: MessageCircle, trend: "+0%" },
          { label: "Templates Ativos", value: "3", icon: Send, trend: "" },
          { label: "Taxa de Entrega", value: "0%", icon: TrendingUp, trend: "" },
          { label: "Tempo Médio", value: "—", icon: Clock, trend: "" },
        ].map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <metric.icon className="w-4.5 h-4.5 text-primary" />
              </div>
              {metric.trend && (
                <Badge variant="secondary" className="text-[10px]">{metric.trend}</Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{metric.label}</p>
          </Card>
        ))}
      </div>

      {/* Conversation costs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Custos por Categoria
          </h3>
          <div className="space-y-3">
            {[
              { category: "Marketing", count: 0, cost: "R$ 0,00", color: "bg-primary" },
              { category: "Utilidade", count: 0, cost: "R$ 0,00", color: "bg-emerald-500" },
              { category: "Autenticação", count: 0, cost: "R$ 0,00", color: "bg-amber-500" },
              { category: "Serviço", count: 0, cost: "Gratuito (24h)", color: "bg-muted-foreground" },
            ].map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs text-foreground">{item.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{item.count} msgs</span>
                  <span className="text-xs font-medium text-foreground">{item.cost}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Últimos Envios
          </h3>
          <div className="space-y-3">
            {recentSends.map((send, i) => {
              const s = statusMap[send.status as keyof typeof statusMap];
              const Icon = s.icon;
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                    <div>
                      <p className="text-xs text-foreground">{send.phone}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{send.template}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{send.time}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
