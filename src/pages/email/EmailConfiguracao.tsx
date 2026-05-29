import CheckoutEmailSection from "@/components/gateway/CheckoutEmailSection";

export default function EmailConfiguracao() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configuração de Email</h1>
        <p className="text-sm text-muted-foreground">Configure seu domínio remetente e nome do remetente.</p>
      </div>
      <CheckoutEmailSection />
    </div>
  );
}