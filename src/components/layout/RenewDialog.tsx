import { CreditCard, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface RenewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans = [
  {
    name: "Start",
    price: "R$ 100",
    period: "/mês",
    link: "https://pay.zaplynxpro.online/pay/plano-start-704549",
    features: [
      "Mensagens ilimitadas",
      "1 instância conectada",
      "Suporte básico",
      "Modelos de mensagem",
    ],
  },
  {
    name: "Pro",
    price: "R$ 349",
    period: "/mês",
    link: "https://pay.zaplynxpro.online/pay/plano-pro-716484",
    features: [
      "Mensagens ilimitadas",
      "5 instâncias conectadas",
      "Suporte prioritário",
      "Campanhas avançadas",
      "Relatórios avançados",
    ],
    popular: true,
  },
  {
    name: "Scale",
    price: "R$ 897",
    period: "/mês",
    link: "https://pay.zaplynxpro.online/pay/plano-scale-731140",
    features: [
      "Mensagens ilimitadas",
      "10 instâncias conectadas",
      "Suporte VIP",
      "API completa",
      "Gerente de conta dedicado",
    ],
  },
];

export function RenewDialog({ open, onOpenChange }: RenewDialogProps) {
  const { t } = useTranslation();
  const handleRenew = (planLink: string) => {
    window.open(planLink, "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <CreditCard className="w-6 h-6" />
            {t("Renovar Assinatura")}
          </DialogTitle>
          <DialogDescription>
            {t("Escolha o plano ideal para suas necessidades e continue aproveitando todos os recursos do ZapLynx")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 relative ${
                plan.popular ? "border-primary border-2 shadow-lg" : ""
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {t("Mais Popular")}
                </Badge>
              )}
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-xl">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{t(plan.period)}</span>
                  </div>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{t(feature)}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleRenew(plan.link)}
                >
                  {t("Renovar Agora")}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground text-center">
            {t("Todas as renovações são processadas de forma segura. Você pode cancelar a qualquer momento.")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
