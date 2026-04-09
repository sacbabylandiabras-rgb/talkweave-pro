import CheckoutDefaultsTab from "@/components/gateway/CheckoutDefaultsTab";
import CheckoutDomainSection from "@/components/gateway/CheckoutDomainSection";

export default function PayCheckouts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração do Checkout</h1>
        <p className="text-sm text-muted-foreground">Defina as configurações padrão aplicadas a todos os checkouts</p>
      </div>
      <CheckoutDomainSection />
      <CheckoutDefaultsTab />
    </div>
  );
}
