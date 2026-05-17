import { LayoutDashboard, PlugZap, CreditCard, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GatewayDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
         <h1 className="text-2xl font-bold text-foreground">ZaplynxPay</h1>
        <p className="text-sm text-muted-foreground">Painel de integrações e pagamentos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Integrações Ativas", value: "0", icon: PlugZap, color: "text-primary" },
          { label: "Checkouts Criados", value: "0", icon: CreditCard, color: "text-primary" },
          { label: "Webhooks Recebidos", value: "0", icon: Activity, color: "text-primary" },
          { label: "Conversões", value: "0%", icon: LayoutDashboard, color: "text-primary" },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Configure suas integrações e checkouts para começar.</p>
        </CardContent>
      </Card>
    </div>
  );
}
