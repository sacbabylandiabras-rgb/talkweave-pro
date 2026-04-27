import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export function PaidRouteGuard({ children }: { children: ReactNode }) {
  const { isPaid, loading } = useSubscriptionStatus();

  useEffect(() => {
    if (!loading && !isPaid) {
      toast.error("Recurso disponível apenas para assinantes com plano ativo.");
    }
  }, [loading, isPaid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPaid) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}