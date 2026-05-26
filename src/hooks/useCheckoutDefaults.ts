import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CheckoutDefaults {
  logoUrl: string;
  showLogo: boolean;
  faviconUrl: string;
  pageTitle: string;
  primaryColor: string;
  bgColor: string;
  textColor: string;
  buttonColor: string;
  font: string;
  creditCard: boolean;
  debitCard: boolean;
  pix: boolean;
  boleto: boolean;
  maxInstallments: number;
  pixDiscount: number;
  showCpf: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showBirthdate: boolean;
  showGuarantee: boolean;
  guaranteeDays: number;
  showSecurityBadges: boolean;
  templateId: string;
  footerCompanyName: string;
  footerCnpj: string;
  stepIndicatorStyle: "circles" | "pills" | "progress";
  format: "one_step" | "multi_step" | "modal" | "inline";
  checkoutSteps: "3" | "4";
  elements?: any[];
  sendEmail: boolean;
}

export const emptyDefaults: CheckoutDefaults = {
  logoUrl: "",
  showLogo: true,
  faviconUrl: "",
  pageTitle: "",
  primaryColor: "#EF4444",
  bgColor: "#EFF1F5",
  textColor: "#1F2937",
  buttonColor: "#EF4444",
  font: "inter",
  creditCard: true,
  debitCard: false,
  pix: true,
  boleto: false,
  maxInstallments: 12,
  pixDiscount: 0,
  showCpf: true,
  showPhone: true,
  showAddress: false,
  showBirthdate: false,
  showGuarantee: true,
  guaranteeDays: 7,
  showSecurityBadges: true,
  templateId: "",
  footerCompanyName: "",
  footerCnpj: "",
  stepIndicatorStyle: "circles",
  format: "multi_step",
  checkoutSteps: "3",
  elements: [],
  sendEmail: true,
};

/**
 * FIX: removed the hardcoded JWT anon token that was used as a fallback.
 * The session token from supabase.auth.getSession() is always used instead.
 * The API key env var is kept for the REST apikey header (public, non-secret).
 */
async function callEdgeFunction(action: string, defaults?: CheckoutDefaults) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  if (!supabaseUrl || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY env vars");
    return null;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/save-checkout-defaults`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // User JWT — never fall back to a hardcoded token
      Authorization: `Bearer ${session.access_token}`,
      // Public anon key is safe to embed and only used as the REST API key header
      apikey: anonKey,
    },
    body: JSON.stringify({ action, defaults }),
  });

  if (!res.ok) {
    console.error(`save-checkout-defaults returned ${res.status}`);
    return null;
  }

  return res.json();
}

export function useCheckoutDefaults() {
  const [defaults, setDefaults] = useState<CheckoutDefaults>(emptyDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await callEdgeFunction("load");
        if (result?.value) {
          try {
            const parsed = JSON.parse(result.value);
            setDefaults((prev) => ({ ...prev, ...parsed }));
          } catch {
            // ignore malformed stored value
          }
        }
      } catch (err) {
        console.error("Error loading checkout defaults:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveDefaults = async (newDefaults: CheckoutDefaults): Promise<boolean> => {
    setSaving(true);
    try {
      const result = await callEdgeFunction("save", newDefaults);
      if (result?.success) {
        setDefaults(newDefaults);
        return true;
      }
      console.error("Save error:", result?.error);
      return false;
    } catch (err) {
      console.error("Save error:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const applyToAllCheckouts = async (newDefaults: CheckoutDefaults): Promise<number> => {
    try {
      const result = await callEdgeFunction("apply_all", newDefaults);
      return result?.updated ?? 0;
    } catch {
      return 0;
    }
  };

  return { defaults, loading, saving, saveDefaults, applyToAllCheckouts };
}
