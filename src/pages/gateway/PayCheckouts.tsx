import { useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import CheckoutDefaultsTab from "@/components/gateway/CheckoutDefaultsTab";
import CheckoutDomainSection from "@/components/gateway/CheckoutDomainSection";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

export default function PayCheckouts() {
  const [domainOpen, setDomainOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração do Checkout</h1>
        <p className="text-sm text-muted-foreground">Defina as configurações padrão aplicadas a todos os checkouts</p>
      </div>

      <Collapsible open={domainOpen} onOpenChange={setDomainOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full flex items-center justify-between gap-2 h-11 border-[#2A2A2A] bg-muted/30 hover:bg-muted/50"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Globe className="w-4 h-4 text-[#FF4D2E]" />
              Domínio Personalizado
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${domainOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <CheckoutDomainSection />
        </CollapsibleContent>
      </Collapsible>

      <CheckoutDefaultsTab />
    </div>
  );
}
