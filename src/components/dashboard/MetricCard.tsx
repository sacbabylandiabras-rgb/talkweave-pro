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
    accent: "border-l-muted-foreground",
  },
  success: {
    icon: "text-success",
    bg: "bg-success/8",
    accent: "border-l-success",
  },
  warning: {
    icon: "text-warning",
    bg: "bg-warning/8",
    accent: "border-l-warning",
  },
  error: {
    icon: "text-destructive",
    bg: "bg-destructive/8",
    accent: "border-l-destructive",
  },
  info: {
    icon: "text-accent",
    bg: "bg-accent/8",
    accent: "border-l-accent",
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
      "group relative flex items-center gap-4 p-4 rounded border border-border/60 bg-card",
      "hover:shadow-md hover:border-border hover:-translate-y-0.5",
      "transition-all duration-300 ease-out",
      "border-l-[3px]",
      styles.accent,
      className
    )}>
      <div className={cn("p-2.5 rounded", styles.bg)}>
        <Icon className={cn("w-5 h-5", styles.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-foreground leading-tight tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
