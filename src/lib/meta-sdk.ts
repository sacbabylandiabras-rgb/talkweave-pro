 const META_APP_ID = "26985190684454065";
const META_GRAPH_VERSION = "v21.0";
const META_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "business_management",
].join(",");
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://yodgjxdekuraxquxkxhx.supabase.co";

 export const META_REDIRECT_URI = `${window.location.origin}/meta-oauth-callback`;

export const META_EMBEDDED_SIGNUP_CONFIG_ID = (
  import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID ||
  import.meta.env.VITE_META_CONFIG_ID ||
  ""
).trim();

interface FacebookAuthResponse {
  accessToken?: string;
  code?: string;
  expiresIn?: number;
  grantedScopes?: string;
  signedRequest?: string;
  userID?: string;
}

interface FacebookLoginStatusResponse {
  authResponse?: FacebookAuthResponse;
  status: "connected" | "not_authorized" | "unknown";
}

interface FacebookLoginOptions {
  config_id: string;
  override_default_response_type: boolean;
  response_type: "code";
  scope?: string;
}

interface FacebookSdk {
  init: (options: {
    appId: string;
    cookie?: boolean;
    version: string;
    xfbml?: boolean;
  }) => void;
  login: (
    callback: (response: FacebookLoginStatusResponse) => void,
    options: FacebookLoginOptions,
  ) => void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<FacebookSdk> | null = null;
let sdkInitialized = false;

function initializeSdk(FB: FacebookSdk) {
  if (!sdkInitialized) {
    FB.init({
      appId: META_APP_ID,
      cookie: true,
      version: META_GRAPH_VERSION,
      xfbml: false,
    });
    sdkInitialized = true;
  }

  return FB;
}

export async function loadMetaSdk() {
  if (typeof window === "undefined") {
    throw new Error("O SDK da Meta só pode ser carregado no navegador.");
  }

  if (window.FB) {
    return initializeSdk(window.FB);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    const existingScript = document.getElementById("facebook-jssdk") as HTMLScriptElement | null;

    window.fbAsyncInit = () => {
      if (!window.FB) {
        reject(new Error("O SDK da Meta não foi inicializado corretamente."));
        return;
      }

      resolve(initializeSdk(window.FB));
    };

    if (existingScript) {
      existingScript.addEventListener("load", () => window.fbAsyncInit?.(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Não foi possível carregar o SDK da Meta.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("Não foi possível carregar o SDK da Meta."));
    document.body.appendChild(script);
  });

  return sdkPromise;
}

export function createMetaOAuthState(payload: { origin: string; userId?: string }) {
  return encodeURIComponent(btoa(JSON.stringify(payload)));
}

export function buildLegacyFacebookOAuthUrl(state: string) {
  const query = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: META_REDIRECT_URI,
    response_type: "code",
    scope: META_SCOPES,
    state,
  });

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${query.toString()}`;
}

export async function requestWhatsAppEmbeddedSignupCode(
  configId: string = META_EMBEDDED_SIGNUP_CONFIG_ID,
) {
  if (!configId) {
    throw new Error("Config ID do WhatsApp Embedded Signup não configurado.");
  }

  const FB = await loadMetaSdk();

  return new Promise<string>((resolve, reject) => {
    FB.login(
      (response) => {
        const code = response.authResponse?.code;

        if (response.status === "connected" && code) {
          resolve(code);
          return;
        }

        reject(new Error("A autorização foi cancelada ou a Meta não retornou o código OAuth."));
      },
      {
        config_id: configId,
        override_default_response_type: true,
        response_type: "code",
        scope: META_SCOPES,
      },
    );
  });
}