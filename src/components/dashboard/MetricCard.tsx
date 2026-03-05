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

const variantIcon = {
  default: "text-muted-foreground bg-muted",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10", 
  error: "text-destructive bg-destructive/10",
  info: "text-accent bg-accent/10",
};

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = "default",
  className 
}: MetricCardProps) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow",
      className
    )}>
      <div className={cn("p-2.5 rounded-lg", variantIcon[variant])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{title}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
