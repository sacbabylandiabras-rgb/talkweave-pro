import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CheckoutDefaults {
  logoUrl: string;
  faviconUrl: string;
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
}

export const emptyDefaults: CheckoutDefaults = {
  logoUrl: "",
  faviconUrl: "",
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
};

const CONFIG_KEY_PREFIX = "checkout_defaults:";

export function useCheckoutDefaults() {
  const [defaults, setDefaults] = useState<CheckoutDefaults>(emptyDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getConfigKey = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user ? `${CONFIG_KEY_PREFIX}${user.id}` : null;
  };

  useEffect(() => {
    const load = async () => {
      const key = await getConfigKey();
      if (!key) { setLoading(false); return; }

      const { data } = await supabase
        .from("gateway_platform_config")
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setDefaults(prev => ({ ...prev, ...parsed }));
        } catch {}
      }
      setLoading(false);
    };
    load();
  }, []);

  const saveDefaults = async (newDefaults: CheckoutDefaults) => {
    setSaving(true);
    const key = await getConfigKey();
    if (!key) { setSaving(false); return false; }

    const { error } = await supabase
      .from("gateway_platform_config")
      .upsert({ key, value: JSON.stringify(newDefaults) }, { onConflict: "key" });

    setSaving(false);
    if (!error) {
      setDefaults(newDefaults);
      return true;
    }
    return false;
  };

  const applyToAllCheckouts = async (newDefaults: CheckoutDefaults) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data: checkouts } = await supabase
      .from("gateway_checkouts")
      .select("id, config")
      .eq("user_id", user.id);

    if (!checkouts || checkouts.length === 0) return 0;

    let updated = 0;
    for (const checkout of checkouts) {
      const existingConfig = (checkout.config || {}) as Record<string, any>;
      const mergedConfig = {
        ...existingConfig,
        logoUrl: newDefaults.logoUrl,
        faviconUrl: newDefaults.faviconUrl,
        primaryColor: newDefaults.primaryColor,
        bgColor: newDefaults.bgColor,
        textColor: newDefaults.textColor,
        buttonColor: newDefaults.buttonColor,
        font: newDefaults.font,
        creditCard: newDefaults.creditCard,
        debitCard: newDefaults.debitCard,
        pix: newDefaults.pix,
        boleto: newDefaults.boleto,
        maxInstallments: newDefaults.maxInstallments,
        pixDiscount: newDefaults.pixDiscount,
        showCpf: newDefaults.showCpf,
        showPhone: newDefaults.showPhone,
        showAddress: newDefaults.showAddress,
        showBirthdate: newDefaults.showBirthdate,
        showGuarantee: newDefaults.showGuarantee,
        guaranteeDays: newDefaults.guaranteeDays,
        showSecurityBadges: newDefaults.showSecurityBadges,
        templateId: newDefaults.templateId || existingConfig.templateId,
        footerCompanyName: newDefaults.footerCompanyName,
        footerCnpj: newDefaults.footerCnpj,
        stepIndicatorStyle: newDefaults.stepIndicatorStyle,
        format: newDefaults.format,
        checkoutSteps: newDefaults.checkoutSteps,
      };

      const { error } = await supabase
        .from("gateway_checkouts")
        .update({ config: mergedConfig as any })
        .eq("id", checkout.id);

      if (!error) updated++;
    }
    return updated;
  };

  return { defaults, loading, saving, saveDefaults, applyToAllCheckouts };
}
