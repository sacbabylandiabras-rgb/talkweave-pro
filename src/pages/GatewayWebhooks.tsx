import { Webhook } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function GatewayWebhooks() {
  return (
    <div className="p-6 space-y-6">
      <div>
         <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
        <p className="text-sm text-muted-foreground">Monitore os webhooks recebidos</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Webhook className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nenhum webhook recebido ainda.</p>
        </CardContent>
      </Card>
    </div>
  );
}
