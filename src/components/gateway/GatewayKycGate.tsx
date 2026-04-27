import { ReactNode, useEffect, useState } from "react";
import { useGatewayKyc } from "@/hooks/useGatewayKyc";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import GatewayKycSubmission from "@/pages/gateway/GatewayKycSubmission";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GatewayKycGateProps {
  children: ReactNode;
}

export default function GatewayKycGate({ children }: GatewayKycGateProps) {
  const { kyc, loading } = useGatewayKyc();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { isAdmin, loading: roleLoading } = useUserRole(userId);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#a78bfa]" />
      </div>
    );
  }

  // Admins bypass KYC
  if (isAdmin) {
    return <>{children}</>;
  }

  // If KYC is approved, show the actual content
  if (kyc?.status === "approved") {
    return <>{children}</>;
  }

  // Show children behind + KYC modal on top
  return (
    <>
      {children}
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Cadastro e Verificação</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Complete todas as etapas para ativar o gateway de pagamentos
            </p>
          </DialogHeader>
          <GatewayKycSubmission inDialog />
        </DialogContent>
      </Dialog>
    </>
  );
}
