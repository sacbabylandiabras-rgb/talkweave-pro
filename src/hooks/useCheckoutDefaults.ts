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

async function callEdgeFunction(action: string, defaults?: CheckoutDefaults) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL || "https://yodgjxdekuraxquxkxhx.supabase.co"}/functions/v1/save-checkout-defaults`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8",
      },
      body: JSON.stringify({ action, defaults }),
    }
  );

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
            setDefaults(prev => ({ ...prev, ...parsed }));
          } catch {}
        }
      } catch (err) {
        console.error("Error loading checkout defaults:", err);
      }
      setLoading(false);
    };
    load();
  }, []);

  const saveDefaults = async (newDefaults: CheckoutDefaults) => {
    setSaving(true);
    try {
      const result = await callEdgeFunction("save", newDefaults);
      if (result?.success) {
        setDefaults(newDefaults);
        setSaving(false);
        return true;
      }
      console.error("Save error:", result?.error);
      setSaving(false);
      return false;
    } catch (err) {
      console.error("Save error:", err);
      setSaving(false);
      return false;
    }
  };

  const applyToAllCheckouts = async (newDefaults: CheckoutDefaults) => {
    try {
      const result = await callEdgeFunction("apply_all", newDefaults);
      return result?.updated || 0;
    } catch {
      return 0;
    }
  };

  return { defaults, loading, saving, saveDefaults, applyToAllCheckouts };
}
