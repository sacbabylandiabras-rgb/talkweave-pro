import { createContext, useContext, ReactNode } from "react";

export type TenantConfig = {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  subdomain: string;
  custom_domain?: string;
};

const TenantContext = createContext<TenantConfig | null>(null);

export function useTenantConfig() {
  return useContext(TenantContext);
}

interface TenantProviderProps {
  tenant: TenantConfig | null;
  children: ReactNode;
}

export function TenantProvider({ tenant, children }: TenantProviderProps) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}
