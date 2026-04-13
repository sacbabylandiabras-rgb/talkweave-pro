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
    icon: "text-muted-foreground",
    bg: "bg-muted/50",
  },
  success: {
    icon: "text-success",
    bg: "bg-success/8",
  },
  warning: {
    icon: "text-warning",
    bg: "bg-warning/8",
  },
  error: {
    icon: "text-destructive",
    bg: "bg-destructive/8",
  },
  info: {
    icon: "text-accent",
    bg: "bg-accent/8",
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
      "group relative flex items-center gap-4 p-5 rounded-2xl border border-primary/15 bg-card",
      "hover:shadow-lg hover:shadow-primary/5 hover:border-primary/35 hover:-translate-y-0.5",
      "transition-all duration-300 ease-out",
      className
    )}>
      <div className={cn("p-3 rounded-xl", styles.bg)}>
        <Icon className={cn("w-5 h-5", styles.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-foreground leading-tight tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
