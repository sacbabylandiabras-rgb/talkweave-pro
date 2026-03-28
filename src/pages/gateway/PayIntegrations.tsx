import { Link2, CheckCircle, XCircle, Settings, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const integrations = [
  { name: "Shopify", description: "Sincronize produtos e pedidos", connected: true, icon: ShoppingBag },
  { name: "WooCommerce", description: "Plugin WordPress para e-commerce", connected: false, icon: ShoppingBag },
  { name: "Nuvemshop", description: "Plataforma e-commerce brasileira", connected: false, icon: ShoppingBag },
];

export default function PayIntegrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-sm text-muted-foreground">Conecte sua loja e automatize seus processos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(int => (
          <Card key={int.name} className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <int.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{int.name}</h3>
                    <p className="text-xs text-muted-foreground">{int.description}</p>
                  </div>
                </div>
                {int.connected ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]"><CheckCircle className="w-3 h-3 mr-1" /> Conectado</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px]"><XCircle className="w-3 h-3 mr-1" /> Desconectado</Badge>
                )}
              </div>
              <Button variant="outline" className="w-full rounded-full text-xs">
                {int.connected ? <><Settings className="w-3 h-3 mr-1.5" /> Configurar</> : <><Link2 className="w-3 h-3 mr-1.5" /> Conectar</>}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
