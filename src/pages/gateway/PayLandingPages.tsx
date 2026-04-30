import { Card, CardContent } from "@/components/ui/card";
import { LayoutTemplate } from "lucide-react";

export default function PayLandingPages() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutTemplate className="w-6 h-6 text-primary" />
          Landing Pages
        </h1>
        <p className="text-sm text-muted-foreground">
          Crie e gerencie suas landing pages para campanhas e vendas.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutTemplate className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-foreground font-medium">Nenhuma landing page criada</p>
          <p className="text-muted-foreground text-sm mt-1">
            Em breve você poderá montar suas landing pages diretamente por aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}