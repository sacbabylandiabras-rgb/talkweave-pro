import GatewayKycGate from "@/components/gateway/GatewayKycGate";
import { ReactNode } from "react";

export default function GatewayProtected({ children }: { children: ReactNode }) {
  return <GatewayKycGate>{children}</GatewayKycGate>;
}
