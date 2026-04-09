import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { getCheckoutStyles } from "./checkout-style-helpers";

interface StepItem {
  num: number;
  label: string;
  icon: ReactNode;
}

interface Props {
  config: Record<string, any>;
  steps: StepItem[];
  step: 1 | 2 | 3 | 4;
  onStepChange: (step: 1 | 2 | 3 | 4) => void;
  previewMode?: "desktop" | "mobile";
  hideLabelsOnMobilePreview?: boolean;
}

export default function CheckoutStepIndicators({
  config,
  steps,
  step,
  onStepChange,
  previewMode,
  hideLabelsOnMobilePreview = false,
}: Props) {
  const s = getCheckoutStyles(config);
  const indicatorStyle = config.stepIndicatorStyle || "circles";
  const hideLabels = hideLabelsOnMobilePreview && previewMode === "mobile";

  if (indicatorStyle === "progress") {
    return (
      <div className="px-2 py-4 space-y-2">
        <div className="flex items-center gap-1">
          {steps.map((item) => (
            <div
              key={item.num}
              className="flex-1 h-2 rounded-full transition-all"
              style={{ background: step >= item.num ? s.primary : s.cardBorder }}
            />
          ))}
        </div>
        <p className="text-center text-[11px] font-medium" style={{ color: s.primary }}>
          Etapa {step} de {steps.length} — {steps.find((item) => item.num === step)?.label}
        </p>
      </div>
    );
  }

  if (indicatorStyle === "pills") {
    return (
      <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
        {steps.map((item, index) => {
          const active = step === item.num;
          const done = step > item.num;

          return (
            <div key={item.num} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStepChange(item.num as 1 | 2 | 3)}
                className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
                style={{
                  borderRadius: "999px",
                  background: active ? `${s.primary}12` : "transparent",
                  border: active ? `1.5px solid ${s.primary}50` : `1.5px solid ${s.cardBorder}`,
                  color: active || done ? s.primary : s.cardDesc,
                }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px]"
                  style={{
                    background: active || done ? s.primary : s.cardBorder,
                    color: s.stepText,
                    borderRadius: "4px",
                  }}
                >
                  {done ? <Check className="w-3 h-3" /> : item.icon}
                </div>
                {!hideLabels && <span className="text-[11px] font-medium">{item.label}</span>}
              </button>
              {index < steps.length - 1 && (
                <div className="h-px w-6" style={{ background: done ? s.primary : s.cardBorder }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-4 flex-wrap">
      {steps.map((item, index) => {
        const active = step === item.num;
        const done = step > item.num;

        return (
          <div key={item.num} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepChange(item.num as 1 | 2 | 3)}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="flex h-10 w-10 items-center justify-center border-2 transition-all"
                style={{
                  borderColor: active || done ? s.primary : s.cardBorder,
                  background: done ? `${s.primary}15` : "transparent",
                  color: active || done ? s.primary : s.cardDesc,
                  borderRadius: s.stepRadius,
                }}
              >
                {done ? <Check className="w-5 h-5" /> : item.icon}
              </div>
              {!hideLabels && (
                <span className="text-[11px] font-medium" style={{ color: active ? s.primary : s.cardDesc }}>
                  {item.label}
                </span>
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                className="h-px w-14"
                style={{
                  background: done ? s.primary : s.cardBorder,
                  marginBottom: hideLabels ? 0 : "20px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}