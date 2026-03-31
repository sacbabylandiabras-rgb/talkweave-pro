export type CheckoutShellFormat = "full_page" | "modal" | "inline";
export type CheckoutFlowFormat = "one_step" | "multi_step";

export interface ResolvedCheckoutFormat {
  value: string;
  shell: CheckoutShellFormat;
  flow: CheckoutFlowFormat;
}

export function resolveCheckoutFormat(format?: string): ResolvedCheckoutFormat {
  switch (format) {
    case "one_step":
      return { value: "one_step", shell: "full_page", flow: "one_step" };
    case "modal":
      return { value: "modal", shell: "modal", flow: "multi_step" };
    case "inline":
      return { value: "inline", shell: "inline", flow: "multi_step" };
    case "full_page":
      return { value: "full_page", shell: "full_page", flow: "multi_step" };
    case "multi_step":
    default:
      return { value: "multi_step", shell: "full_page", flow: "multi_step" };
  }
}