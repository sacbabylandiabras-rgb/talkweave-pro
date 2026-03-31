import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface TenantConfig {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  subdomain: string;
  custom_domain?: string;
}

/**
 * Detects the tenant from:
 * 1. ?tenant= query param (injected by Vercel middleware)
 * 2. hostname subdomain detection (fallback)
 * 
 * Then fetches tenant config from Supabase.
 */
export function useTenant() {
  const [searchParams] = useSearchParams();
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectAndFetchTenant = async () => {
      try {
        // 1. Check ?tenant= query param (from Vercel middleware)
        let tenantIdentifier = searchParams.get("tenant");

        // 2. Fallback: detect from hostname
        if (!tenantIdentifier) {
          const hostname = window.location.hostname;
          
          // Skip detection for localhost, lovable.app, and bare domains
          if (
            hostname === "localhost" ||
            hostname.endsWith(".lovable.app") ||
            hostname.split(".").length <= 2
          ) {
            setLoading(false);
            return;
          }

          // Extract subdomain (first part of hostname)
          // e.g., "checkout.loja.com" → "checkout"
          // e.g., "pay.payshein.site" → "pay"
          tenantIdentifier = hostname.split(".")[0];
        }

        if (!tenantIdentifier) {
          setLoading(false);
          return;
        }

        // 3. Fetch tenant config from edge function
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-tenant?subdomain=${encodeURIComponent(tenantIdentifier)}`,
          {
            headers: {
              apikey: anonKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          if (res.status === 404) {
            setError("Tenant não encontrado");
          } else {
            setError("Erro ao carregar configurações");
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        setTenant(data.tenant);
      } catch (err) {
        console.error("Erro ao detectar tenant:", err);
        setError("Erro ao carregar configurações do tenant");
      } finally {
        setLoading(false);
      }
    };

    detectAndFetchTenant();
  }, [searchParams]);

  return { tenant, loading, error };
}
