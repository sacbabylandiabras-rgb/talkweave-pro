import { ReactNode, useEffect, useState } from "react";
import { useGatewayKyc } from "@/hooks/useGatewayKyc";
import GatewayKycSubmission from "@/pages/gateway/GatewayKycSubmission";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GatewayKycGateProps {
  children: ReactNode;
}

export default function GatewayKycGate({ children }: GatewayKycGateProps) {
  const { kyc, loading } = useGatewayKyc();
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRoleLoading(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
      setRoleLoading(false);
    };
    check();
  }, []);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4D2E]" />
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

  // Otherwise show the KYC submission/status page
  return <GatewayKycSubmission />;
}
