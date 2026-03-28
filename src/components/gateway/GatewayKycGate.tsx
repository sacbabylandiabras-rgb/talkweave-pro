import { ReactNode } from "react";
import { useGatewayKyc } from "@/hooks/useGatewayKyc";
import GatewayKycSubmission from "@/pages/gateway/GatewayKycSubmission";
import { Loader2 } from "lucide-react";

interface GatewayKycGateProps {
  children: ReactNode;
}

export default function GatewayKycGate({ children }: GatewayKycGateProps) {
  const { kyc, loading } = useGatewayKyc();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4D2E]" />
      </div>
    );
  }

  // If KYC is approved, show the actual content
  if (kyc?.status === "approved") {
    return <>{children}</>;
  }

  // Otherwise show the KYC submission/status page
  return <GatewayKycSubmission />;
}
