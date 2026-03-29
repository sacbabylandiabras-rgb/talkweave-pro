/**
 * Shared style helpers for checkout templates.
 * Converts config properties into CSS-ready values.
 */

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  plus_jakarta: "'Plus Jakarta Sans', sans-serif",
  roboto: "'Roboto', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  poppins: "'Poppins', sans-serif",
  dm_sans: "'DM Sans', sans-serif",
  nunito: "'Nunito', sans-serif",
};

const RADIUS_MAP: Record<string, string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  full: "9999px",
  rounded: "8px",
};

export function getCheckoutStyles(config: Record<string, any>) {
  const isDark = config.theme === "dark";

  // Colors — use config values with sensible fallbacks based on theme
  const primary = config.primaryColor || "#EF4444";
  const buttonColor = config.buttonColor || primary;
  const bgColor = config.bgColor || (isDark ? "#0D0D0D" : "#EFF1F5");
  const textColor = config.textColor || (isDark ? "#F3F4F6" : "#1F2937");
  const cardBg = config.cardBgColor || (isDark ? "#1A1A1A" : "#FFFFFF");
  const cardBorder = config.cardBorderColor || (isDark ? "#333" : "#E5E7EB");
  const cardLabel = config.cardLabelColor || (isDark ? "#D1D5DB" : "#6B7280");
  const cardText = config.cardTextColor || (isDark ? "#F3F4F6" : "#1F2937");
  const cardTitle = config.cardTitleColor || (isDark ? "#F9FAFB" : "#111827");
  const cardDesc = config.cardDescColor || (isDark ? "#9CA3AF" : "#6B7280");
  const inputBg = config.inputBgColor || (isDark ? "#0D0D0D" : "#FFFFFF");
  const inputBorder = config.inputBorderColor || (isDark ? "#444" : "#D1D5DB");
  const stepBg = config.stepBgColor || primary;
  const stepText = config.stepTextColor || "#FFFFFF";

  // Border radius
  const cardRadius = RADIUS_MAP[config.cardBorderRadius] || RADIUS_MAP.xl;
  const buttonRadius = RADIUS_MAP[config.buttonBorderRadius] || RADIUS_MAP.md;
  const fieldRadius = RADIUS_MAP[config.fieldBorderRadius] || RADIUS_MAP.md;
  const stepRadius = RADIUS_MAP[config.stepBorderRadius] || RADIUS_MAP.full;

  // Font
  const fontFamily = FONT_MAP[config.font] || FONT_MAP.inter;

  return {
    primary,
    buttonColor,
    bgColor,
    textColor,
    cardBg,
    cardBorder,
    cardLabel,
    cardText,
    cardTitle,
    cardDesc,
    inputBg,
    inputBorder,
    stepBg,
    stepText,
    cardRadius,
    buttonRadius,
    fieldRadius,
    stepRadius,
    fontFamily,
    isDark,
  };
}

/** CSS properties for an input element */
export function inputStyle(s: ReturnType<typeof getCheckoutStyles>) {
  return {
    borderRadius: s.fieldRadius,
    borderColor: s.inputBorder,
    background: s.inputBg,
    color: s.cardText,
  } as React.CSSProperties;
}

/** CSS properties for a card container */
export function cardStyle(s: ReturnType<typeof getCheckoutStyles>) {
  return {
    background: s.cardBg,
    borderColor: s.cardBorder,
    borderRadius: s.cardRadius,
  } as React.CSSProperties;
}

/** CSS properties for a primary button */
export function buttonStyle(s: ReturnType<typeof getCheckoutStyles>) {
  return {
    background: s.buttonColor,
    color: "#FFFFFF",
    borderRadius: s.buttonRadius,
  } as React.CSSProperties;
}

/** CSS properties for a step indicator circle */
export function stepStyle(s: ReturnType<typeof getCheckoutStyles>, active = true) {
  return {
    background: active ? s.stepBg : (s.isDark ? "#333" : "#E5E7EB"),
    color: active ? s.stepText : (s.isDark ? "#9CA3AF" : "#9CA3AF"),
    borderRadius: s.stepRadius,
  } as React.CSSProperties;
}
