import { useState } from "react";
import { Globe } from "lucide-react";
import CheckoutDefaultsTab from "@/components/gateway/CheckoutDefaultsTab";
import CheckoutDomainSection from "@/components/gateway/CheckoutDomainSection";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PayCheckouts() {
  const [domainOpen, setDomainOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuração do Checkout</h1>
          <p className="text-sm text-muted-foreground">Defina as configurações padrão aplicadas a todos os checkouts</p>
        </div>
        <Button
          variant="outline"
          className="gap-2 border-[#2A2A2A]"
          onClick={() => setDomainOpen(true)}
        >
          <Globe className="w-4 h-4 text-[#a78bfa]" />
          Domínio
        </Button>
      </div>

      <Dialog open={domainOpen} onOpenChange={setDomainOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#a78bfa]" />
              Domínio Personalizado
            </DialogTitle>
          </DialogHeader>
          <CheckoutDomainSection />
        </DialogContent>
      </Dialog>

      <CheckoutDefaultsTab />
    </div>
  );
}
