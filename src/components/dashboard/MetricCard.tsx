import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const variantStyles = {
  default: {
    icon: "text-white/60",
    bg: "bg-white/8",
  },
  success: {
    icon: "text-[#34d399]",
    bg: "bg-[rgba(52,211,153,0.14)]",
  },
  warning: {
    icon: "text-[#fb923c]",
    bg: "bg-[rgba(251,146,60,0.14)]",
  },
  error: {
    icon: "text-[#f87171]",
    bg: "bg-[rgba(248,113,113,0.14)]",
  },
  info: {
    icon: "text-[#a78bfa]",
    bg: "bg-[rgba(167,139,250,0.16)]",
  },
};

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = "default",
  className 
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn(
      "group glass-card relative flex items-center gap-4 p-5",
      "hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-0.5",
      "transition-all duration-300 ease-out",
      className
    )}>
      <div className={cn("w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0", styles.bg)}>
        <Icon className={cn("w-[18px] h-[18px]", styles.icon)} />
      </div>
      <div className="min-w-0 flex-1">
         <p className="font-nunito text-[12px] uppercase tracking-wider text-white/40 font-normal [[data-theme='blue']_&]:text-[#6B7280]">{title}</p>
         <p className="font-bebas text-[36px] text-white leading-none mt-0.5 tracking-wide [[data-theme='blue']_&]:text-[#111827]">{value}</p>
        {subtitle && (
           <p className="font-nunito text-[11px] text-white/30 mt-1 [[data-theme='blue']_&]:text-[#6B7280]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
