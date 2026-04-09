import type { ReactNode } from "react";
import { User, MapPin, Check, CreditCard } from "lucide-react";

export type StepNumber = 1 | 2 | 3 | 4;

export interface CheckoutStepItem {
  num: number;
  label: string;
  icon: ReactNode;
}

export function getCheckoutSteps(config: Record<string, any>): CheckoutStepItem[] {
  const use4Steps = config.checkoutSteps === "4" || config.checkoutSteps === 4;
  
  if (use4Steps) {
    return [
      { num: 1, label: "Identificação", icon: <User className="w-3 h-3" /> },
      { num: 2, label: "Endereço", icon: <MapPin className="w-3 h-3" /> },
      { num: 3, label: "Conferência", icon: <Check className="w-3 h-3" /> },
      { num: 4, label: "Pagamento", icon: <CreditCard className="w-3 h-3" /> },
    ];
  }

  return [
    { num: 1, label: "Identificação", icon: <User className="w-3 h-3" /> },
    { num: 2, label: "Conferência", icon: <Check className="w-3 h-3" /> },
    { num: 3, label: "Pagamento", icon: <CreditCard className="w-3 h-3" /> },
  ];
}

/** Map logical step names to actual step numbers based on config */
export function getStepNumbers(config: Record<string, any>) {
  const use4Steps = config.checkoutSteps === "4" || config.checkoutSteps === 4;
  return {
    identification: 1 as StepNumber,
    address: use4Steps ? (2 as StepNumber) : null,
    review: (use4Steps ? 3 : 2) as StepNumber,
    payment: (use4Steps ? 4 : 3) as StepNumber,
  };
}

export function getMaxStep(config: Record<string, any>): StepNumber {
  const use4Steps = config.checkoutSteps === "4" || config.checkoutSteps === 4;
  return use4Steps ? 4 : 3;
}
