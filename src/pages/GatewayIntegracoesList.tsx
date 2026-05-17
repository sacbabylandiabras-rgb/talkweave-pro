import { PlugZap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function GatewayIntegracoesList() {
  return (
    <div className="p-6 space-y-6">
      <div>
         <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas integrações de gateway</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <PlugZap className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhuma integração configurada ainda.</p>
        </CardContent>
      </Card>
    </div>
  );
}
