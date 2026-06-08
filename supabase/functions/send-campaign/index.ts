import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

interface SendCampaignRequest {
  campaignId: string;
  contacts: Array<{
    phone: string;
    name?: string;
    variables?: Record<string, string>;
    sourceInstanceId?: string | null;
    sourceInstanceName?: string | null;
    userId?: string;
  }>;

  instanceId?: string;
  rotationOffset?: number;
  _isContinuation?: boolean;
  _userId?: string;
  forceSend?: boolean;
}

interface CampaignSendRecord {
  campaign_id: string;
  phone: string;
  contact_name?: string;
  message_content: string;
  status: "pending" | "sent" | "delivered" | "failed";
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  user_id?: string;
  instance_name?: string;
  message_id?: string;
}

interface ResolvedInstance {
  dbId?: string;
  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken: string;
  instanceName: string;
  apiProvider?: string;
  evolutionApiUrl?: string | null;
}

type CampaignCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
  userId: string;
  instanceName: string;
  dbId?: string;
  apiProvider?: string;
  evolutionApiUrl?: string | null;
};

const PUBLIC_TRACKING_URL = "https://go.zaplynxpro.online/r";

const normalizePublicInviteUrl = (url: string) => {
  if (!url || typeof url !== "string") return url || "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "pay.zaplynxpro.online") {
      const pathname = parsed.pathname || "";
      const slug = pathname
        .replace(/^\/invite\//, "/")
        .replace(/^\/+|\/+$/g, "")
        .split("/")[0];
      if (slug) return `https://go.zaplynxpro.online/invite/${encodeURIComponent(slug)}${parsed.hash}`;
    }
  } catch {
    // keep original
  }
  return url;
};

const normalizePublicRedirectUrlsInText = (text: string) => {
  if (!text) return text;
  return text
    .replace(
      /https?:\/\/pay\.zaplynxpro\.online\/invite\/([^\s)\]}>"']+)/gi,
      (_match, slug) => `https://go.zaplynxpro.online/invite/${slug}`,
    )
    .replace(/https?:\/\/pay\.zaplynxpro\.online\/r\?/gi, "https://go.zaplynxpro.online/r?");
};

const mapResolvedInstance = (
  instance: {
    id?: string;
    zapi_instance_id: string;
    zapi_token: string | null;
    zapi_client_token: string | null;
    instance_name: string | null;
    api_provider?: string | null;
    instance_type?: string | null;
    evolution_api_url?: string | null;
    evolution_api_key?: string | null;
  } | null,
): ResolvedInstance | null => {
  if (!instance?.zapi_instance_id) return null;

  const provider = String(instance.api_provider || "zapi").toLowerCase();
  const instanceName = String(instance.instance_name || "").toLowerCase();
  const instanceType = String(instance.instance_type || "").toLowerCase();

  // Support all providers including UAZAPI
  if (instanceType === "mobile" || instanceName.includes("mobile")) {
    return null;
  }

  const hasZapiCreds = Boolean(instance.zapi_instance_id && instance.zapi_token && instance.zapi_client_token);
  if (!hasZapiCreds) return null;

  return {
    dbId: instance.id,
    zapiInstanceId: instance.zapi_instance_id,
    zapiToken: instance.zapi_token || "",
    zapiClientToken: instance.zapi_client_token || "",
    instanceName: instance.instance_name || "Instância",
    apiProvider: provider,
    evolutionApiUrl: instance.evolution_api_url,
  };
};

const resolvePreferredUserInstance = async (supabase: any, userId: string): Promise<ResolvedInstance | null> => {
  const selectFields =
    "id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, instance_type, evolution_api_url, evolution_api_key";

  const { data: defaultInstance } = await supabase
    .from("zapi_instances")
    .select(selectFields)
    .eq("user_id", userId)
    .eq("is_default", true)
    .eq("is_active", true)
    .in("api_provider", ["zapi", "uazapi", "uazapi_warmup", "evolution"])
    .not("instance_name", "ilike", "%Mobile%")
    .maybeSingle();

  const mappedDefault = mapResolvedInstance(defaultInstance);
  if (mappedDefault) return mappedDefault;

  const { data: activeInstances } = await supabase
    .from("zapi_instances")
    .select(selectFields)
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("api_provider", ["zapi", "uazapi", "uazapi_warmup", "evolution"])
    .order("created_at", { ascending: true })
    .limit(25);

  return ((activeInstances || []).map((instance: any) => mapResolvedInstance(instance)).find(Boolean) as ResolvedInstance | null) || null;
};

const buildCampaignCredentials = (userId: string, instance: ResolvedInstance): CampaignCredentials => ({
  instanceId: instance.zapiInstanceId,
  token: instance.zapiToken,
  clientToken: instance.zapiClientToken,
  userId,
  instanceName: instance.instanceName,
  dbId: instance.dbId,
  apiProvider: instance.apiProvider || "zapi",
  evolutionApiUrl: instance.evolutionApiUrl,
});

const getAuthenticatedUserId = async (req: Request, supabaseUrl: string, supabaseServiceKey: string) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("No authorization header");

  const userClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("Unauthorized: " + (error?.message || "User not found"));
  return user.id;
};

const resolveContactInstance = async (
  supabase: any,
  userId: string,
  sourceInstanceId?: string | null,
  allowInactive = false,
): Promise<ResolvedInstance | null> => {
  if (!sourceInstanceId) return null;

  let instance: {
    id: string;
    zapi_instance_id: string;
    zapi_token: string;
    zapi_client_token: string;
    instance_name: string | null;
    api_provider?: string | null;
    instance_type?: string | null;
    evolution_api_url?: string | null;
    evolution_api_key?: string | null;
  } | null = null;

  let byZapiQuery = supabase
    .from("zapi_instances")
    .select(
      "id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, instance_type, evolution_api_url, evolution_api_key",
    )
    .eq("user_id", userId)
    .in("api_provider", ["zapi", "uazapi", "uazapi_warmup", "evolution"])
    .not("instance_name", "ilike", "%Mobile%");

  if (isUuid(sourceInstanceId)) {
    byZapiQuery = byZapiQuery.or(`zapi_instance_id.eq.${sourceInstanceId},id.eq.${sourceInstanceId}`);
  } else {
    byZapiQuery = byZapiQuery.eq("zapi_instance_id", sourceInstanceId);
  }

  if (!allowInactive) byZapiQuery = byZapiQuery.eq("is_active", true);
  const { data: foundInstance } = await byZapiQuery.maybeSingle();

  return mapResolvedInstance(foundInstance);
};

const resolveGroupInstanceFromInboundLogs = async (
  supabase: any,
  userId: string,
  phone: string,
): Promise<ResolvedInstance | null> => {
  if (!isGroupDestination(phone)) return null;

  const numericGroupId = phone.replace(/[@\-].*$/, "").replace(/\D/g, "");
  if (!numericGroupId) return null;

  const groupVariants = [`${numericGroupId}-group`, `${numericGroupId}@g.us`, numericGroupId];

  const { data: groupLogs } = await supabase
    .from("message_logs")
    .select("instance_id")
    .in("phone", groupVariants)
    .not("instance_id", "is", null)
    .is("keyword_matched", null)
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(1);

  let resolvedGroupInstanceId = (groupLogs as Array<{ instance_id: string | null }> | null)?.[0]?.instance_id || null;

  if (!resolvedGroupInstanceId) {
    const { data: groupLogsFallback } = await supabase
      .from("message_logs")
      .select("instance_id, keyword_matched")
      .in("phone", groupVariants)
      .not("instance_id", "is", null)
      .not("message_received", "is", null)
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(5);

    const inboundLog = (
      groupLogsFallback as Array<{ instance_id: string | null; keyword_matched: string | null }> | null
    )?.find((log) => log.keyword_matched !== "__manual_send__");
    resolvedGroupInstanceId = inboundLog?.instance_id || null;
  }

  if (!resolvedGroupInstanceId) return null;

  let query = supabase
    .from("zapi_instances")
    .select(
      "id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, instance_type, evolution_api_url, evolution_api_key",
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (isUuid(resolvedGroupInstanceId)) {
    query = query.or(`zapi_instance_id.eq.${resolvedGroupInstanceId},id.eq.${resolvedGroupInstanceId}`);
  } else {
    query = query.eq("zapi_instance_id", resolvedGroupInstanceId);
  }

  const { data: correctInstance } = await query.maybeSingle();

  const correctInstanceRow = correctInstance as {
    zapi_instance_id?: string | null;
    zapi_token?: string | null;
    zapi_client_token?: string | null;
    instance_name?: string | null;
    api_provider?: string | null;
    instance_type?: string | null;
    evolution_api_url?: string | null;
    evolution_api_key?: string | null;
  } | null;
  return mapResolvedInstance(correctInstanceRow as any);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getZapiAckId = (payload: any) =>
  payload?.messageId ||
  payload?.zapiMessageId ||
  payload?.zaapId ||
  payload?.id ||
  payload?.key?.id ||
  payload?.message?.id ||
  payload?.messageId ||
  (payload?.ids && payload.ids[0]) ||
  (payload?.value && payload.value[0]?.id) ||
  null;
const getZapiExplicitError = (payload: any) =>
  payload?.error || payload?.erro || (payload?.success === false ? payload?.message : null) || null;

const isWhatsAppRateLimitError = (payload: any, httpStatus?: number): boolean => {
  const haystack = JSON.stringify(payload || {}).toLowerCase();
  if (!haystack) return false;
  return (
    haystack.includes("error 463") ||
    haystack.includes('"code":463') ||
    haystack.includes("temporary restriction") ||
    haystack.includes("temporarily restricted") ||
    haystack.includes("currently connected account is under") ||
    haystack.includes("sending volume or quality") ||
    haystack.includes("rate limit") ||
    haystack.includes("rate-limit") ||
    haystack.includes("rate_limit") ||
    httpStatus === 429
  );
};

const recordShadowBan = async (supabase: any, instanceDbId: string, errorText: string) => {
  try {
    const isCapping = /cycle_end|new_chat_message_capping|capping/i.test(errorText);
    const extractCycleEnd = (text: string): string | null => {
      try {
        const m = text.match(/"cycle_end"\s*:\s*"([^"]+)"/i);
        if (m && m[1]) return new Date(m[1]).toISOString();
      } catch (_) {
        /* ignore */
      }
      return null;
    };

    const blockedUntil = extractCycleEnd(errorText);
    const blockType = isCapping ? "new_chat_capping" : "shadowban";

    await supabase.from("warmup_instance_health").upsert(
      {
        instance_ref: instanceDbId,
        block_type: blockType,
        blocked_until: blockedUntil,
        last_detected_at: new Date().toISOString(),
        detail: errorText.slice(0, 240),
      },
      { onConflict: "instance_ref,block_type" },
    );
    console.log(`🛡️ Recorded ${blockType} for instance ${instanceDbId}`);
  } catch (e: any) {
    console.warn(`  ⚠ Failed to record shadowban health: ${e?.message}`);
  }
};

const deactivateInstance = async (supabase: any, dbId: string, reason: string) => {
  try {
    console.warn(`🛑 Deactivating instance ${dbId} due to fatal error: ${reason}`);
    await supabase
      .from("zapi_instances")
      .update({ 
        is_active: false, 
        last_error: reason,
        updated_at: new Date().toISOString() 
      })
      .eq("id", dbId);
  } catch (err) {
    console.error(`Failed to deactivate instance ${dbId}:`, err);
  }
};

const isZapiConfirmed = (payload: any) => {
  const ackId = getZapiAckId(payload);
  const status = String(payload?.status || payload?.message?.status || "").toUpperCase();
  const result = String(payload?.result || "").toUpperCase();

  const error = String(payload?.error || payload?.message || "").toLowerCase();
  if (error.includes("likely shadow ban")) return false;

  // Se tem erro explícito de negação, não confirma
  if (payload?.error === true || payload?.success === false) return false;

  // Se tem ackId, o Z-API aceitou a mensagem — confirmado
  if (Boolean(ackId)) return true;

  // Sem ackId mas com status de sucesso explícito também confirma
  const successStatuses = ["SENT", "SUCCESS", "OK", "PENDING", "QUEUED", "ENQUEUED", "ACCEPTED", "PROCESSING"];
  const deliveryStatuses = ["DELIVERED", "RECEIVED", "READ", "READ_BY_ME"];
  return successStatuses.includes(status) || successStatuses.includes(result) || deliveryStatuses.includes(status);
};

const isGroupDestination = (phone: string) =>
  (phone.includes("@g.us") || phone.includes("-group")) &&
  !phone.includes("@newsletter") &&
  !phone.includes("-community");
const isCommunityDestination = (phone: string) => phone.includes("-community");
const isChannelDestination = (phone: string) => phone.includes("@newsletter");
const isLidIdentifier = (phone?: string | null) =>
  Boolean(phone && phone.toLowerCase().includes("@lid") && !isGroupDestination(phone));

const SPECIAL_TEMPLATE_PREFIX = "__SPECIAL_TEMPLATE__:";

const getZapiTargetPhone = (phone: string) => {
  if (!phone) return phone;

  if (isGroupDestination(phone)) {
    const numericId = phone
      .replace(/@g\.us$/i, "")
      .replace(/-group$/i, "")
      .replace(/\D/g, "");
    return numericId ? `${numericId}-group` : phone;
  }

  if (isCommunityDestination(phone) || isChannelDestination(phone)) return phone;

  if (phone.toLowerCase().includes("@lid")) return phone;

  let cleaned = phone.replace(/^\+/, "").replace(/\D/g, "");

  if (cleaned.length === 11 && !cleaned.startsWith("55")) {
    console.log(`[Normalization] Prepended 55 to Brazilian mobile: ${cleaned} -> 55${cleaned}`);
    cleaned = `55${cleaned}`;
  } else if (cleaned.length === 10 && !cleaned.startsWith("55")) {
    console.log(`[Normalization] Prepended 55 to Brazilian number: ${cleaned} -> 55${cleaned}`);
    cleaned = `55${cleaned}`;
  }

  return cleaned || phone;
};

const buildTrackedCampaignUrl = (
  url: string,
  opts: {
    campaignId: string;
    userId: string;
    phone: string;
    label: string;
    campaignName?: string | null;
    sendId?: string | null;
  },
) => {
  const cleanUrl = normalizePublicInviteUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  if (!opts.campaignId || !opts.userId) return cleanUrl;

  const params = new URLSearchParams({
    url: cleanUrl,
    cid: opts.campaignId,
    uid: opts.userId,
    ph: opts.phone.toLowerCase().includes("@lid") ? opts.phone : opts.phone.replace(/\D/g, ""),
    btn: opts.label,
    flow: opts.campaignName || "Campanha",
    src: "campaign",
  });

  if (opts.sendId) params.set("cs", opts.sendId);

  return cleanUrl.includes("go.zaplynxpro.online/invite/") ? cleanUrl : `${PUBLIC_TRACKING_URL}?${params.toString()}`;
};

const isConfirmedRateLimitHit = (payload: any, errorMessage?: string | null, httpStatus?: number) => {
  const hasRateLimitPayload = isWhatsAppRateLimitError(payload, httpStatus);
  if (!hasRateLimitPayload) return false;

  const message = String(errorMessage || "").toLowerCase();
  if (!message) return false;

  return (
    message.includes("temporary restriction") ||
    message.includes("temporarily restricted") ||
    message.includes("currently connected account is under a temporary restriction") ||
    message.includes("sending volume or quality") ||
    message.includes("rate limit") ||
    message.includes("rate-limit")
  );
};

const parseSpecialTemplate = (content?: string | null) => {
  if (!content || !content.startsWith(SPECIAL_TEMPLATE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SPECIAL_TEMPLATE_PREFIX.length));
  } catch {
    return null;
  }
};

const isUuid = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

const parseCoordinate = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/-?\d+(?:[\.,]\d+)?/);
  if (!match) return null;
  const normalized = match[0].replace(",", ".");
  const coordinate = Number(normalized);
  return Number.isFinite(coordinate) ? String(coordinate) : null;
};

const dispatchZapiSpecial = async (
  baseUrl: string,
  clientToken: string,
  phone: string,
  special: any,
  supabase?: any,
  userId?: string,
) => {
  let url = "";
  let body: Record<string, unknown> = {};

  const type = special.type === "gateway_billing" ? "gateway-billing" : special.type;

  if (type === "pix" || type === "gateway-billing" || type === "request-payment" || type === "pagamento") {
    const amountReais = Number(String(special.amount || special.pixAmount || "0.00").replace(",", "."));
    const amountCents = Math.round(amountReais * 100);
    const description = String(
      special.description || special.text || special.pixDescription || special.paymentDescription || "Pagamento",
    ).trim();
    const isGateway =
      special.pixSource === "gateway" || special.paymentSource === "gateway" || type === "gateway-billing";

    let brCode = "";
    let qrCodeImage = "";

    if (isGateway && supabase && userId && amountCents > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const chargeRes = await fetch(`${supabaseUrl}/functions/v1/gateway-flow-charge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            userId,
            amount: amountCents,
            description,
            customerPhone: phone,
          }),
        });
        if (chargeRes.ok) {
          const chargeData = await chargeRes.json();
          brCode = chargeData?.brCode || "";
          qrCodeImage = chargeData?.qrCodeImage || "";
          console.log(
            `✅ [Gateway] Charge generated for ${phone}: ${brCode ? "Copied code received" : "No code received"}`,
          );
        } else {
          const errorData = await chargeRes.text();
          console.error(`❌ [Gateway] Charge generation failed: ${chargeRes.status} - ${errorData}`);
        }
      } catch (e) {
        console.error("❌ [Gateway] Failed to generate charge:", e);
      }
    }

    if (isGateway && !brCode) {
      throw new Error("Falha ao gerar cobrança real via Gateway. Verifique suas configurações de Checkout.");
    }

    if (brCode) {
      url = `${baseUrl}/send-button-otp`;
      body = {
        phone,
        message: description || "Realize o pagamento via PIX:",
        code: brCode,
        footer: "Clique abaixo para copiar o código PIX",
      };
    } else {
      url = `${baseUrl}/send-button-pix`;
      const pixKey = String(special.pixKey || special.paymentReceiver || "").trim();
      const merchantName = String(special.merchantName || special.paymentReceiver || "Pagamento").trim();
      const rawType = String(special.pixKeyType || "cpf").toUpperCase();

      const typeMap: Record<string, string> = {
        TELEFONE: "PHONE",
        CELULAR: "PHONE",
        "E-MAIL": "EMAIL",
        ALEATORIA: "EVP",
        ALEATÓRIA: "EVP",
        RANDOM: "EVP",
      };

      body = {
        phone,
        pixKey,
        type: typeMap[rawType] || rawType,
        merchantName,
        amount: amountReais || 0,
      };
    }
  } else if (
    type === "localizacao" ||
    type === "uaz_location_button" ||
    type === "location" ||
    type === "location_button" ||
    type === "request-location"
  ) {
    url = `${baseUrl}/send-location`;
    const latitude = parseCoordinate(special.latitude || special.locLatitude);
    const longitude = parseCoordinate(special.longitude || special.locLongitude);
    if (!latitude || !longitude) {
      throw new Error("Template de localização com latitude/longitude inválidos");
    }
    const title = String(special.title || special.name || special.address || special.locTitle || "Localização").trim();
    const address = String(special.address || special.description || special.locAddress || title).trim();
    body = {
      phone,
      title,
      address,
      latitude,
      longitude,
    };
  } else if (type === "contato") {
    url = `${baseUrl}/send-contact`;
    body = {
      phone,
      contactName: special.contactName || "",
      contactPhone: String(special.contactPhone || "").replace(/\D/g, ""),
      ...(special.description ? { contactBusinessDescription: special.description } : {}),
    };
  } else if (type === "uaz_status" || type === "status" || phone === "status@broadcast") {
    const statusType = String(special.statusType || "text").toLowerCase();
    if (statusType === "image") {
      url = `${baseUrl}/send-status-image`;
      body = {
        image: special.media || special.image || "",
        ...(special.text ? { caption: special.text } : {}),
      };
    } else if (statusType === "video") {
      url = `${baseUrl}/send-status-video`;
      body = {
        video: special.media || special.video || "",
        ...(special.text ? { caption: special.text } : {}),
      };
    } else {
      url = `${baseUrl}/send-status-text`;
      body = {
        message: special.text || special.message || "",
        ...(special.backgroundColor ? { backgroundColor: special.backgroundColor } : {}),
        ...(special.font !== undefined && special.font !== null ? { font: Number(special.font) || 1 } : {}),
      };
    }
  } else if (type === "copia_cola" || type === "copy_paste") {
    const code = String(special.copyText || special.code || "").trim();
    const message = String(special.description || special.text || "").trim() || " ";
    url = `${baseUrl}/send-button-otp`;
    body = {
      phone,
      message,
      code,
    };
  }
  return { url, body };
};

const sendZapiLocationButtonFollowUp = async (baseUrl: string, clientToken: string, phone: string, special: any) => {
  const latitude = parseCoordinate(special.latitude || special.locLatitude);
  const longitude = parseCoordinate(special.longitude || special.locLongitude);
  const buttonUrl = String(
    special.url ||
      (latitude && longitude ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : ""),
  ).trim();
  if (!buttonUrl) {
    return { ok: false, ack: null, error: "Template de localização com botão sem URL do mapa", raw: null };
  }

  const normalizedUrl = /^https?:\/\//i.test(buttonUrl) ? buttonUrl : `https://${buttonUrl}`;
  const message = String(
    special.text ||
      special.description ||
      [special.name || special.title || special.locTitle, special.address || special.locAddress]
        .filter(Boolean)
        .join("\n") ||
      "Abrir localização no mapa",
  ).trim();
  const buttonLabel = String(special.buttonLabel || special.locButtonLabel || "Ver no mapa").trim() || "Ver no mapa";
  const body = {
    phone,
    message,
    buttonActions: [{ type: "URL", label: buttonLabel, url: normalizedUrl }],
  };

  const res = await fetch(`${baseUrl}/send-button-actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try {
    const responseText = await res.text();
    if (responseText && responseText.trim()) data = JSON.parse(responseText);
  } catch {}

  const explicitError = getZapiExplicitError(data);
  const confirmed = isZapiConfirmed(data);
  console.log(
    `📍 Z-API location button follow-up for ${phone}: status=${res.status}, confirmed=${confirmed}, ack=${getZapiAckId(data) || "none"}, body=${JSON.stringify(data).substring(0, 300)}`,
  );
  if (!res.ok || explicitError || !confirmed) {
    return {
      ok: false,
      ack: null,
      error: explicitError || (!confirmed ? "Z-API não confirmou o botão da localização" : `HTTP ${res.status}`),
      raw: data,
    };
  }

  return { ok: true, ack: getZapiAckId(data), error: null, raw: data };
};

const MAX_BATCH_SIZE = 50;
const MIN_BATCH_SIZE = 3;
const MAX_BATCH_RUNTIME_MS = 40_000;
const MAX_INTERACTIVE_BODY_CHARS = 1000;

const getBatchSizeForDelay = (delayMs: number) => {
  const safeDelayMs = Number.isFinite(delayMs) ? Math.max(delayMs, 0) : 2000;
  const estimatedPerContactMs = Math.max(safeDelayMs + 2500, 3000);
  return Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, Math.floor(MAX_BATCH_RUNTIME_MS / estimatedPerContactMs)));
};

const normalizeCampaignPhoneKey = (phone?: string | null) => {
  if (!phone) return "";
  const trimmed = String(phone).trim().toLowerCase();
  if (trimmed.includes("@lid")) return trimmed;
  return trimmed.replace(/\D/g, "");
};

const getRemainingAudienceContacts = async (
  supabase: any,
  campaignId: string,
  targetContacts: SendCampaignRequest["contacts"],
) => {
  const acceptedPhones = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("campaign_sends")
      .select("phone, status")
      .eq("campaign_id", campaignId)
      .in("status", ["pending", "sent", "delivered"])
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;
    for (const send of data) {
      const phoneKey = normalizeCampaignPhoneKey(send.phone);
      if (phoneKey) acceptedPhones.add(phoneKey);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const remaining = new Map<string, SendCampaignRequest["contacts"][number]>();
  for (const contact of targetContacts) {
    const phoneKey = normalizeCampaignPhoneKey(contact.phone);
    if (!phoneKey || acceptedPhones.has(phoneKey) || remaining.has(phoneKey)) continue;
    remaining.set(phoneKey, contact);
  }
  return Array.from(remaining.values());
};

const readDeviceConnectivity = (deviceStatus: any) => {
  const status = String(deviceStatus?.status || deviceStatus?.device?.status || "").toLowerCase();
  const connectedFlag = deviceStatus?.connected;
  const isConnected =
    connectedFlag === true ||
    (typeof connectedFlag === "string" && connectedFlag.toLowerCase() === "true") ||
    deviceStatus?.session === true ||
    deviceStatus?.smartphoneConnected === true ||
    deviceStatus?.device?.connected === true ||
    ["connected", "open", "online"].includes(status);

  const isExplicitlyDisconnected =
    !isConnected && (connectedFlag === false || ["disconnected", "close", "closed"].includes(status));

  return { connected: isConnected, explicitlyDisconnected: isExplicitlyDisconnected };
};

const fetchDeviceStatusSnapshot = async (instance: ResolvedInstance) => {
  try {
    const deviceStatusUrl = `https://api.z-api.io/instances/${instance.zapiInstanceId}/token/${instance.zapiToken}/status`;
    const deviceResponse = await fetch(deviceStatusUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Client-Token": instance.zapiClientToken },
    });

    if (!deviceResponse.ok) {
      const errorText = await deviceResponse.text().catch(() => "Unknown error");
      const isAuthError = 
        deviceResponse.status === 401 || 
        deviceResponse.status === 403 || 
        errorText.toLowerCase().includes("not allowed") ||
        errorText.toLowerCase().includes("token") ||
        errorText.toLowerCase().includes("unauthorized");

      if (isAuthError && instance.dbId) {
        console.warn(`🛑 Instance ${instance.instanceName} (${instance.dbId}) returned auth error. Deactivating.`);
        // Note: In a real environment, we'd use the supabase client to update.
        // We'll handle deactivation in the main loop to keep this helper pure-ish or pass the client.
      }

      return {
        connected: false,
        explicitlyDisconnected: isAuthError,
        ok: false,
        isAuthError,
        raw: { error: `HTTP ${deviceResponse.status}: ${errorText}` },
      };
    }

    const raw = await deviceResponse.json();
    const connectivity = readDeviceConnectivity(raw);
    return { ...connectivity, ok: true, raw };
  } catch (error) {
    return {
      connected: false,
      explicitlyDisconnected: false,
      ok: false,
      raw: { error: error instanceof Error ? error.message : "Unknown status error" },
    };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase configuration");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const reqPayload: SendCampaignRequest & { _directSendTemplateId?: string } = await req.json();
    const body = reqPayload;
    console.log("send-campaign body:", JSON.stringify(body));
    let {
      campaignId,
      contacts,
      instanceId: requestedInstanceIdRaw,
      rotationOffset: initialRotationOffset,
      _isContinuation,
      _userId,
      _directSendTemplateId,
    } = body;
    const rotationOffset = initialRotationOffset || 0;
    const requestedContacts = Array.isArray(contacts) ? contacts : [];

    let campaign: any = null;
    let campaignTemplate: any = null;
    if (!_directSendTemplateId && campaignId) {
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("*, template:message_templates(*)")
        .eq("id", campaignId)
        .maybeSingle();

      if (campaignData) {
        campaign = campaignData;
        campaignTemplate = campaign.template;
        const sendConfig = campaign.target_audience?.__sendConfig;

        // Prioridade absoluta para o instanceId que vem na requisição (escolha do usuário no momento do clique)
        const requestHasInstanceId = Boolean(reqPayload.instanceId);
        
        if (requestHasInstanceId) {
          console.log(`📋 [Config] Using instanceId from request (direct user selection): ${reqPayload.instanceId}`);
          requestedInstanceIdRaw = reqPayload.instanceId;
        } else if (sendConfig && (sendConfig.instanceId || sendConfig.rotateAll)) {
          console.log(`📋 [Config] Using persisted send configuration from DB for campaign ${campaignId}`);
          requestedInstanceIdRaw = sendConfig.instanceId || (sendConfig.rotateAll ? "__rotate_all__" : null);
        }
      }
    }

    let isRotateMode =
      requestedInstanceIdRaw === "__rotate_all__" ||
      (typeof requestedInstanceIdRaw === "string" && requestedInstanceIdRaw.startsWith("rotate:"));
    let requestedInstanceId = isRotateMode ? undefined : requestedInstanceIdRaw;

    if (!_directSendTemplateId && (!campaignId || requestedContacts.length === 0)) {
      return new Response(JSON.stringify({ error: "Campaign ID and contacts are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(
      `🚀 Campaign ${campaignId}: ${requestedContacts.length} contacts to process (continuation: ${!!_isContinuation}, offset: ${rotationOffset}, mode: ${isRotateMode ? "rotate" : "single"}, target: ${requestedInstanceIdRaw || "default"})`,
    );

    let credentials: CampaignCredentials;
    let forcedRequestedInstance: ResolvedInstance | null = null;
    let rotatePool: ResolvedInstance[] = [];

    if (_isContinuation && _userId) {
      console.log(`🔑 Continuation mode: resolving credentials for user ${_userId} via service role`);

      let continuationInstance = null;
      if (requestedInstanceId && requestedInstanceId !== "__rotate_all__") {
        continuationInstance = await resolveContactInstance(supabase, _userId, requestedInstanceId, true);
      }

      if (!continuationInstance && (!requestedInstanceId || requestedInstanceId === "__rotate_all__")) {
        continuationInstance = await resolvePreferredUserInstance(supabase, _userId);
      }

      if (!continuationInstance) {
        const { data: fallbackInst } = await supabase
          .from("zapi_instances")
          .select("*")
          .eq("user_id", _userId)
          .eq("is_active", true)
          .eq("api_provider", "zapi")
          .limit(1)
          .maybeSingle();
        continuationInstance = fallbackInst ? mapResolvedInstance(fallbackInst) : null;
      }

      if (!continuationInstance) throw new Error("Instância ativa não encontrada para continuação");
      credentials = buildCampaignCredentials(_userId, continuationInstance);
    } else {
      const authenticatedUserId = await getAuthenticatedUserId(req, supabaseUrl, supabaseServiceKey);

      let preferredInstance = null;
      if (requestedInstanceId && requestedInstanceId !== "__rotate_all__") {
        preferredInstance = await resolveContactInstance(supabase, authenticatedUserId, requestedInstanceId, true);
        if (!preferredInstance) {
          console.error(`❌ CRITICAL: Requested instance ${requestedInstanceId} could not be resolved!`);
        }
      }

      if (!preferredInstance) {
        preferredInstance = await resolvePreferredUserInstance(supabase, authenticatedUserId);
        if (preferredInstance && requestedInstanceId) {
          console.log(
            `↩️ [Fallback] Requested instance ${requestedInstanceId} not resolvable; using preferred active instance ${preferredInstance.instanceName} (${preferredInstance.zapiInstanceId}).`,
          );
          // Disable forced-instance routing so downstream block uses our resolved credentials.
          requestedInstanceId = undefined;
        }
      }

      if (preferredInstance) {
        credentials = buildCampaignCredentials(authenticatedUserId, preferredInstance);
      } else {
        const baseCredentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
        credentials = {
          instanceId: baseCredentials.instanceId,
          token: baseCredentials.token,
          clientToken: baseCredentials.clientToken,
          userId: baseCredentials.userId,
          instanceName: baseCredentials.instanceName,
          apiProvider: baseCredentials.provider,
          evolutionApiUrl: baseCredentials.evolutionApiUrl,
        };
      }

      if (isRotateMode) {
        forcedRequestedInstance = null;
        console.log(
          `🔄 [Mode] Rotate Mode enabled for campaign ${campaignId}. Ignoring preferred instance for forced routing.`,
        );
      }
    }

    let zapiInstanceId = credentials.instanceId;
    let zapiToken = credentials.token;
    let zapiClientToken = credentials.clientToken;

    if (!isRotateMode && credentials.instanceId) {
      forcedRequestedInstance = {
        dbId: credentials.dbId,
        zapiInstanceId: credentials.instanceId,
        zapiToken: credentials.token,
        zapiClientToken: credentials.clientToken,
        instanceName: credentials.instanceName,
        apiProvider: credentials.apiProvider,
      };
      console.log(
        `📍 [Mode] Single Instance mode: forcing all sends through ${credentials.instanceName} (${credentials.instanceId})`,
      );
    }

    if (isRotateMode) {
      let query = supabase
        .from("zapi_instances")
        .select(
          "id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, instance_type, evolution_api_url, evolution_api_key",
        )
        .eq("user_id", credentials.userId)
        .eq("is_active", true)
        .in("api_provider", ["zapi", "uazapi", "uazapi_warmup", "evolution"]);

      if (typeof requestedInstanceIdRaw === "string" && requestedInstanceIdRaw.startsWith("rotate:")) {
        const specificIds = requestedInstanceIdRaw.replace("rotate:", "").split(",").filter(Boolean);
        if (specificIds.length > 0) {
          const uuids = specificIds.filter(isUuid);
          const nonUuuids = specificIds.filter(id => !isUuid(id));
          
          console.log(
            `🎯 [Mode] Rotation restricted to ${specificIds.length} specific instances`,
          );
          
          if (uuids.length > 0 && nonUuuids.length > 0) {
             query = query.or(`id.in.(${uuids.join(',')}),zapi_instance_id.in.(${nonUuuids.map(id => `"${id}"`).join(',')})`);
          } else if (uuids.length > 0) {
             query = query.in("id", uuids);
          } else if (nonUuuids.length > 0) {
             query = query.in("zapi_instance_id", nonUuuids);
          }
        } else {
          query = query.in("api_provider", ["zapi", "uazapi", "uazapi_warmup", "evolution"]);
        }
      } else {
        console.log(`🔄 [Mode] Rotating through all active instances for user ${credentials.userId}`);
      }

      const { data: allActiveInstances } = await query.order("created_at", { ascending: true });

      const rawRotatePool: ResolvedInstance[] = (allActiveInstances || [])
        .map((instance: any) => mapResolvedInstance(instance))
        .filter(Boolean) as ResolvedInstance[];

      const rotateStatuses = await Promise.all(
        rawRotatePool.map(async (instance) => {
          const status = await fetchDeviceStatusSnapshot(instance);
          if ((status as any).isAuthError && instance.dbId) {
            await deactivateInstance(supabase, instance.dbId, (status as any).raw?.error || "Auth error");
          }
          return { instance, status };
        }),
      );

      rotatePool = rotateStatuses.map(({ instance }) => instance);

      const unavailableInstances = rotateStatuses
        .filter(({ status }) => !status.connected)
        .map(
          ({ instance, status }) => `${instance.instanceName} (${status.ok ? "desconectada" : "status indisponível"})`,
        );

      console.log(`🔄 Rotate mode: ${rawRotatePool.length} instances loaded, ${rotatePool.length} connected`);

      if (unavailableInstances.length > 0) {
        console.log(`⚠️ Rotate mode ignoring unavailable instances: ${unavailableInstances.join(", ")}`);
      }

      if (rotatePool.length === 0) {
        if (rawRotatePool.length > 0) {
          console.log(
            `⚠️ No instances reported as connected, but proceeding anyway with ${rawRotatePool.length} instance(s). Messages may be enqueued by the provider.`,
          );
          rotatePool = rawRotatePool;
        } else {
          await supabase
            .from("campaigns")
            .update({ status: "paused", updated_at: new Date().toISOString() })
            .eq("id", campaignId);

          return new Response(
            JSON.stringify({
              error: "Nenhuma instância disponível no modo rotativo. A campanha foi pausada.",
              stopped: true,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }
      }
    } else if (requestedInstanceId) {
      const specificInstance = await resolveContactInstance(supabase, credentials.userId, requestedInstanceId, true);

      if (!specificInstance) {
        console.log(
          `⚠️ Requested instance ${requestedInstanceId} not found. Falling back to preferred active instance.`,
        );
        const fallbackInstance = await resolvePreferredUserInstance(supabase, credentials.userId);
        if (!fallbackInstance) {
          await supabase
            .from("campaigns")
            .update({ status: "paused", updated_at: new Date().toISOString() })
            .eq("id", campaignId)
            .eq("user_id", credentials.userId);
          return new Response(
            JSON.stringify({
              error:
                "Nenhuma conexão ativa encontrada. A campanha foi pausada. Conecte um número e retome.",
              stopped: true,
              paused: true,
              reason: "no_active_instance",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        }
        forcedRequestedInstance = fallbackInstance;
        zapiInstanceId = fallbackInstance.zapiInstanceId;
        zapiToken = fallbackInstance.zapiToken;
        zapiClientToken = fallbackInstance.zapiClientToken;
        credentials = buildCampaignCredentials(credentials.userId, fallbackInstance);
        console.log(
          `✅ [Fallback] Using ${fallbackInstance.instanceName} (${fallbackInstance.zapiInstanceId}) instead of stale selection.`,
        );
      } else {
        const status = await fetchDeviceStatusSnapshot(specificInstance);
        if ((status as any).isAuthError && specificInstance.dbId) {
          await deactivateInstance(supabase, specificInstance.dbId, (status as any).raw?.error || "Auth error");
        }

        if (!status.connected) {
          console.log(
            `⚠️ [Force] Selected instance ${specificInstance.instanceName} appears offline, but proceeding anyway.`,
          );
        } else if (specificInstance.dbId) {
          await supabase
            .from("zapi_instances")
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq("id", specificInstance.dbId)
            .eq("user_id", credentials.userId);
        }

        forcedRequestedInstance = specificInstance;
        zapiInstanceId = specificInstance.zapiInstanceId;
        zapiToken = specificInstance.zapiToken;
        zapiClientToken = specificInstance.zapiClientToken;
        credentials.apiProvider = specificInstance.apiProvider || "zapi";
        credentials.instanceName = specificInstance.instanceName;
      }
    }

    const getInstanceForIndex = (index: number): ResolvedInstance => {
      if (isRotateMode && rotatePool.length > 0) {
        return rotatePool[(index + rotationOffset) % rotatePool.length];
      }
      return {
        dbId: credentials.dbId,
        zapiInstanceId,
        zapiToken,
        zapiClientToken,
        instanceName: credentials.instanceName,
        apiProvider: credentials.apiProvider || "zapi",
      };
    };

    const queueContinuation = async (
      contactsToContinue: SendCampaignRequest["contacts"],
      processedInThisRun: number,
    ) => {
      if (!contactsToContinue.length) return true;

      const newRotationOffset = (rotationOffset + processedInThisRun) % (rotatePool.length || 1);

      try {
        // We define the promise but only start it within waitUntil if possible
        // to ensure the current execution can return its response quickly
        const continuationPromise = (async () => {
          // INTER-BATCH DELAY: Wait delayMs before starting the next batch
          // to maintain the cadence set by the user
          if (delayMs > 0) {
            console.log(`⏱️ Waiting ${delayMs}ms before re-invoking next batch...`);
            await sleep(delayMs);
          }

          const response = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              campaignId,
              contacts: contactsToContinue,
              instanceId: requestedInstanceIdRaw,
              rotationOffset: newRotationOffset,
              _isContinuation: true,
              _userId: credentials.userId,
            }),
          });

          if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            console.error(`❌ Re-invocation HTTP error: ${response.status} ${errorBody}`);
          } else {
            console.log(`🔄 Re-invocation successful for ${contactsToContinue.length} contacts.`);
          }
        })();

        const edgeRuntime = (globalThis as any).EdgeRuntime;
        if (edgeRuntime?.waitUntil) {
          edgeRuntime.waitUntil(continuationPromise);
        }

        return true;
      } catch (reError) {
        console.error(`❌ Re-invocation failed:`, reError);
        return false;
      }
    };

    if (_directSendTemplateId) {
      const { data: directTpl, error: tplErr } = await supabase
        .from("message_templates")
        .select("*")
        .eq("id", _directSendTemplateId)
        .maybeSingle();

      if (tplErr || !directTpl) {
        throw new Error("Template not found for direct send");
      }

      campaignTemplate = directTpl;
      campaign = {
        id: campaignId || `direct-${Date.now()}`,
        name: "Envio Direto",
        status: "active",
        user_id: credentials.userId,
        template_id: _directSendTemplateId,
        delay_seconds: 0,
      };
    } else {
      if (!campaign) {
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select(`*, template:message_templates(*)`)
          .eq("id", campaignId)
          .eq("user_id", credentials.userId)
          .single();

        if (campaignError || !campaignData) {
          console.error(`❌ Campaign not found: ${campaignError?.message}`);
          throw new Error("Campaign not found");
        }
        campaign = campaignData;
      }

      const isForceSend = (reqPayload as SendCampaignRequest).forceSend === true;

      if (
        !isForceSend &&
        (campaign.status === "paused" || campaign.status === "completed" || campaign.status === "cancelled")
      ) {
        console.log(`🛑 Campaign ${campaignId} is ${campaign.status}. Not processing.`);
        return new Response(
          JSON.stringify({ stopped: true, status: campaign.status, message: `Campaign is ${campaign.status}` }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      if (
        isForceSend &&
        (campaign.status === "completed" || campaign.status === "cancelled" || campaign.status === "paused")
      ) {
        console.log(
          `⚡ [ForceSend] Ignorando status "${campaign.status}" da campanha ${campaignId} — forçando reenvio.`,
        );
        await supabase
          .from("campaigns")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", campaign.id)
          .eq("user_id", credentials.userId);
      }

      if (campaign.status === "draft") {
        await supabase
          .from("campaigns")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", campaign.id)
          .eq("user_id", credentials.userId);
      }

      campaignTemplate = campaign.template;
    }

    if (!campaignTemplate && campaign.template_id) {
      console.log(
        `🔍 Campaign ${campaignId}: template relation missing, fetching template ${campaign.template_id} manually...`,
      );
      const { data: manualTpl } = await supabase
        .from("message_templates")
        .select("*")
        .eq("id", campaign.template_id)
        .maybeSingle();

      if (manualTpl) {
        campaignTemplate = manualTpl;
      }
    }

    const campaignTargetContacts = _directSendTemplateId
      ? requestedContacts
      : Array.isArray(campaign.target_audience?.contacts)
        ? campaign.target_audience.contacts.filter((contact: any) => Boolean(contact?.phone))
        : [];

    let existingSendsCount = 0;
    if (!_directSendTemplateId) {
      const { count } = await supabase
        .from("campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId);
      existingSendsCount = count ?? 0;
    }

    const shouldUseCampaignAudience =
      !_directSendTemplateId &&
      !_isContinuation &&
      existingSendsCount === 0 &&
      campaignTargetContacts.length > 0 &&
      requestedContacts.length !== campaignTargetContacts.length;

    const executionContacts = shouldUseCampaignAudience ? campaignTargetContacts : requestedContacts;

    if (shouldUseCampaignAudience) {
      console.log(
        `⚠️ Campaign ${campaignId}: request had ${requestedContacts.length} contacts, but campaign audience has ${campaignTargetContacts.length}. Using campaign audience as source of truth.`,
      );
    }

    const isFlowCampaign = campaign.target_audience?.campaign_type === "flow" && campaign.target_audience?.flow_id;
    const flowId = campaign.target_audience?.flow_id;

    if (!isFlowCampaign && !campaignTemplate) {
      console.error(`❌ Campaign ${campaignId}: template not found (ID: ${campaign.template_id})`);
      throw new Error("Campaign template not found");
    }

    const getBatchSizeForDelay = (delayMs: number) => {
      if (delayMs >= 20000) return 2;
      if (delayMs >= 10000) return 4;
      if (delayMs >= 5000) return 8;
      return 15;
    };

    const isGroupCampaign = campaign.target_audience?.type === "groups" || campaign.target_audience?.mode === "groups";
    // Fix: Always default to 2s if delay_seconds is not provided, even for groups, to respect user expectations
    const delayMs = (campaign.delay_seconds || 2) * 1000;
    const batchSize = getBatchSizeForDelay(delayMs);

    let currentBatch = executionContacts.slice(0, batchSize);
    const remainingContacts = executionContacts.slice(batchSize);

    // DEDUP: remove contacts that already have a non-failed send for this campaign,
    // and collapse phones repeated within the same batch. Prevents the same number
    // from being sent multiple times when re-invocations or concurrent batches overlap.
    if (!(reqPayload as SendCampaignRequest).forceSend && currentBatch.length > 0 && campaignId) {
      const batchPhones = Array.from(new Set(currentBatch.map((c: any) => c?.phone).filter(Boolean)));
      const { data: existingForBatch } = await supabase
        .from("campaign_sends")
        .select("phone, status")
        .eq("campaign_id", campaignId)
        .in("phone", batchPhones)
        .in("status", ["pending", "sent", "delivered", "read"]);
      const alreadyHandled = new Set<string>((existingForBatch || []).map((r: any) => r.phone));
      const seenInBatch = new Set<string>();
      const filtered: typeof currentBatch = [];
      for (const c of currentBatch) {
        const ph = (c as any)?.phone;
        if (!ph) continue;
        if (alreadyHandled.has(ph)) {
          console.log(`⏭️ [BatchDedup] Skipping ${ph} - already has non-failed send.`);
          continue;
        }
        if (seenInBatch.has(ph)) {
          console.log(`⏭️ [BatchDedup] Dropping duplicate ${ph} within same batch.`);
          continue;
        }
        seenInBatch.add(ph);
        filtered.push(c);
      }
      currentBatch = filtered;
    }

    console.log(
      `📦 Processing batch of ${currentBatch.length} contacts (batchSize=${batchSize}, delay=${delayMs}ms). Remaining: ${remainingContacts.length}`,
    );

    const firstInstance = getInstanceForIndex(0);
    try {
      const shouldPause = async () => {
        if (isRotateMode && rotatePool.length > 0) {
          const statuses = await Promise.all(
            rotatePool.map(async (inst) => ({
              ...(await fetchDeviceStatusSnapshot(inst)),
              instanceName: inst.instanceName,
            })),
          );
          const allDown =
            statuses.length > 0 && statuses.every((s) => s.ok && s.explicitlyDisconnected && !s.connected);
          if (!allDown) return false;
          await sleep(1500);
          const recheck = await Promise.all(
            rotatePool.map(async (inst) => ({ ...(await fetchDeviceStatusSnapshot(inst)) })),
          );
          return recheck.length > 0 && recheck.every((s) => s.ok && s.explicitlyDisconnected && !s.connected);
        }

        const first = await fetchDeviceStatusSnapshot(firstInstance);
        if (!first.ok || !first.explicitlyDisconnected || first.connected) return false;
        await sleep(1500);
        const second = await fetchDeviceStatusSnapshot(firstInstance);
        return second.ok && second.explicitlyDisconnected && !second.connected;
      };

      if (!(reqPayload as SendCampaignRequest).forceSend && (await shouldPause())) {
        console.log(`⚠️ DISPOSITIVO DESCONECTADO! Mas continuando conforme nova diretriz de não trocar instância.`);
      }
    } catch (e) {
      console.error("Device check error:", e);
    }

    const normalizeGroupPhone = (phone: string): string => {
      const isGroup = phone.includes("@g.us") || phone.includes("-group");
      if (!isGroup) return phone;
      const numericId = phone
        .replace(/@g\.us$/i, "")
        .replace(/-group$/i, "")
        .replace(/\D/g, "");
      return numericId ? `${numericId}-group` : phone;
    };

    const isMissingMessageIdColumn = (error: any) => {
      const message = String(error?.message || error?.details || "").toLowerCase();
      return (
        error?.code === "42703" ||
        error?.code === "PGRST204" ||
        (message.includes("message_id") && (message.includes("column") || message.includes("schema cache")))
      );
    };

    const withoutMessageId = (recordWithMessageId: CampaignSendRecord) => {
      const { message_id: _messageId, ...recordWithoutMessageId } = recordWithMessageId;
      return recordWithoutMessageId;
    };

    const persistCampaignSend = async (
      record: CampaignSendRecord,
      existingId?: string | null,
    ): Promise<string | null> => {
      if (existingId) {
        // Se estamos tentando atualizar para "sent" ou "pending" mas o registro atual já é uma falha confirmada,
        // não sobrescrevemos o status de falha para evitar que o número "volte" a parecer enviado.
        if (record.status === "sent" || record.status === "pending") {
          const { data: current } = await supabase
            .from("campaign_sends")
            .select("status")
            .eq("id", existingId)
            .maybeSingle();
          
          if (current?.status === "failed") {
            console.log(`🛡️ Preserving 'failed' status for ${record.phone} against '${record.status}' update.`);
            return existingId;
          }
        }

        const { error: updateError } = await supabase
          .from("campaign_sends")
          .update({
            phone: record.phone,
            contact_name: record.contact_name,
            message_content: record.message_content,
            status: record.status,
            sent_at: record.sent_at ?? null,
            delivered_at: record.delivered_at ?? null,
            error_message: record.error_message ?? null,
            user_id: record.user_id,
            instance_name: record.instance_name,
            message_id: record.message_id ?? null,
          })
          .eq("id", existingId);

        if (!updateError) return existingId;

        if (isMissingMessageIdColumn(updateError)) {
          const { error: retryUpdateError } = await supabase
            .from("campaign_sends")
            .update(
              withoutMessageId({
                phone: record.phone,
                contact_name: record.contact_name,
                message_content: record.message_content,
                status: record.status,
                sent_at: record.sent_at ?? null,
                delivered_at: record.delivered_at ?? null,
                error_message: record.error_message ?? null,
                user_id: record.user_id,
                instance_name: record.instance_name,
              } as CampaignSendRecord),
            )
            .eq("id", existingId);

          if (!retryUpdateError) return existingId;
          console.error(
            `❌ Failed to update campaign_send ${existingId} without message_id for ${record.phone}:`,
            retryUpdateError.message,
          );
        }

        console.error(`❌ Failed to update campaign_send ${existingId} for ${record.phone}:`, updateError.message);
      }

      const { data: inserted, error: insertError } = await supabase
        .from("campaign_sends")
        .insert([record])
        .select("id")
        .maybeSingle();
      if (insertError) {
        if (isMissingMessageIdColumn(insertError)) {
          const { data: retryInserted, error: retryInsertError } = await supabase
            .from("campaign_sends")
            .insert([withoutMessageId(record)])
            .select("id")
            .maybeSingle();
          if (!retryInsertError) return retryInserted?.id || null;
          console.error(
            `❌ Failed to insert campaign_send without message_id for ${record.phone}:`,
            retryInsertError.message,
          );
        }
        console.error(`❌ Failed to insert campaign_send for ${record.phone}:`, insertError.message);
      }
      return inserted?.id || null;
    };

    const results = [];
    let rateLimitHitsInBatch = 0;
    let shouldStop = false;
    let stopReason = "";

    if (isGroupCampaign) {
      console.log(`🚀 Group campaign detected: processing ${currentBatch.length} groups sequentially with ${delayMs}ms delay`);
      for (let i = 0; i < currentBatch.length; i++) {
        const item = currentBatch[i];
        const contact = { ...item, phone: normalizeGroupPhone(item.phone) };

        let currentInstance;
        if (forcedRequestedInstance && !isRotateMode) {
          currentInstance = forcedRequestedInstance;
        } else {
          const contactInst = await resolveContactInstance(supabase, credentials.userId, item.sourceInstanceId);

          if (contactInst && isRotateMode && rotatePool.length > 0) {
            const isInPool = rotatePool.some((p) => p.zapiInstanceId === contactInst.zapiInstanceId);
            if (isInPool) currentInstance = contactInst;
          }

          if (!currentInstance) {
            currentInstance =
              (isGroupDestination(contact.phone)
                ? await resolveGroupInstanceFromInboundLogs(supabase, credentials.userId, contact.phone)
                : null) || getInstanceForIndex(i);
          }
        }

        console.log(
          `🔍 [Decision] Contact ${contact.phone} (idx ${i}) will use instance: ${currentInstance.instanceName} (${currentInstance.zapiInstanceId})`,
        );

        const res = await processContact(contact, currentInstance, i, false);
        if (res?.stop) {
          shouldStop = true;
          stopReason = res.status || "paused";
          break;
        }
        
        if (i < currentBatch.length - 1) {
          await sleep(delayMs);
        }
      }
      if (shouldStop) {
        return new Response(
          JSON.stringify({ success: true, stopped: true, message: `Stopped: campaign ${stopReason}` }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    } else {
      for (let i = 0; i < currentBatch.length; i++) {
        const contact = { ...currentBatch[i], phone: normalizeGroupPhone(currentBatch[i].phone) };

        let currentInstance;
        if (forcedRequestedInstance && !isRotateMode) {
          currentInstance = forcedRequestedInstance;
        } else {
          const contactInst = await resolveContactInstance(
            supabase,
            credentials.userId,
            currentBatch[i].sourceInstanceId,
          );

          if (contactInst && isRotateMode && rotatePool.length > 0) {
            const isInPool = rotatePool.some((p) => p.zapiInstanceId === contactInst.zapiInstanceId);
            if (isInPool) currentInstance = contactInst;
          }

          if (!currentInstance) {
            currentInstance =
              (isGroupDestination(contact.phone)
                ? await resolveGroupInstanceFromInboundLogs(supabase, credentials.userId, contact.phone)
                : null) || getInstanceForIndex(i);
          }
        }

        console.log(
          `🔍 [Decision] Contact ${contact.phone} (idx ${i}) will use instance: ${currentInstance.instanceName} (${currentInstance.zapiInstanceId})`,
        );

        const res = await processContact(contact, currentInstance, i, false);
        if (res?.stop) {
          return new Response(
            JSON.stringify({
              success: true,
              stopped: true,
              processed: i,
              message: `Stopped: campaign ${res.status || "paused"}`,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
        if (i < currentBatch.length - 1) {
          await sleep(delayMs);
        }
      }
    }

    async function processContact(contact: any, currentInstance: ResolvedInstance, i: number, isParallel: boolean) {
      let campaignSend: CampaignSendRecord | undefined;
      let reusableSendId: string | null = null;

      try {
        const { data: statusCheck } = await supabase.from("campaigns").select("status").eq("id", campaignId).single();
        if (!(reqPayload as SendCampaignRequest).forceSend) {
          if (
            statusCheck?.status === "paused" ||
            statusCheck?.status === "cancelled" ||
            statusCheck?.status === "completed"
          ) {
            return { stop: true, status: statusCheck?.status };
          }
        }

        const { data: existingSends } = await supabase
          .from("campaign_sends")
          .select("id, status, created_at")
          .eq("campaign_id", campaignId)
          .eq("phone", contact.phone);
        const successfulForPhone =
          existingSends?.filter((s) => s.status === "delivered" || s.status === "sent" || s.status === "read").length || 0;
        const pendingForPhone = existingSends?.filter((s) => s.status === "pending").length || 0;
        const phoneOccurrencesBefore = currentBatch.slice(0, i).filter((c: any) => c.phone === contact.phone).length;

        if (!(reqPayload as SendCampaignRequest).forceSend) {
          if (successfulForPhone > phoneOccurrencesBefore) {
            console.log(`⏭️ Skipping ${contact.phone} - already successfully sent in this campaign.`);
            results.push({ phone: contact.phone, success: true, messageId: "already-sent" });
            return { stop: false };
          }
          if (pendingForPhone > phoneOccurrencesBefore) {
            console.log(`⏭️ Skipping ${contact.phone} - message is still pending callback.`);
            return { stop: false };
          }
        } else {
          console.log(`🔄 [Force] Re-sending to ${contact.phone} even if already sent (forceSend=true).`);
        }

        const failedOnly = [...(existingSends || [])]
          .filter((s) => s.status === "failed")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        reusableSendId = failedOnly?.id || null;

        console.log(
          `🚀 [Dispatch] Executing send to ${contact.phone} via Z-API: ${currentInstance.instanceName} (${currentInstance.zapiInstanceId})`,
        );

        if (isFlowCampaign && flowId) {
          campaignSend = {
            campaign_id: campaignId,
            phone: contact.phone,
            contact_name: contact.name,
            message_content: `[Fluxo: ${flowId}]`,
            status: "pending",
            user_id: credentials.userId,
            instance_name: currentInstance.instanceName,
          };
          try {
            const webhookUrl = `${supabaseUrl}/functions/v1/webhook-zapi`;
            const webhookPayload = {
              phone: contact.phone,
              instanceId: currentInstance.zapiInstanceId,
              __manual_flow_trigger__: true,
              flowId: flowId,
              body: { message: { text: { body: `__flow_trigger_${flowId}__` } } },
              fromMe: false,
              __tagId__: campaign.target_audience?.tag_id,
            };
            const flowResponse = await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify(webhookPayload),
            });

            if (flowResponse.ok) {
              campaignSend.status = "pending";
              results.push({ phone: contact.phone, success: true, messageId: "flow-triggered" });
            } else {
              campaignSend.status = "failed";
              campaignSend.error_message = `Flow trigger failed: ${await flowResponse.text()}`;
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            }
          } catch (flowError) {
            campaignSend.status = "failed";
            campaignSend.error_message = String(flowError);
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
          }
          await persistCampaignSend(campaignSend, reusableSendId);
          return { stop: false };
        }

        let messageContent = normalizePublicRedirectUrlsInText(campaignTemplate.content);
        messageContent = messageContent.replace(/{nome}/g, contact.name || "Cliente");
        messageContent = messageContent.replace(/{empresa}/g, "Nossa Empresa");
        messageContent = messageContent.replace(/{data}/g, new Date().toLocaleDateString("pt-BR"));
        messageContent = messageContent.replace(/{hora}/g, new Date().toLocaleTimeString("pt-BR"));

        if (contact.variables) {
          Object.entries(contact.variables).forEach(([key, value]) => {
            messageContent = messageContent.replace(new RegExp(`{${key}}`, "g"), value);
          });
        }

        let fullMessage = "";
        const isAudioWithMedia =
          campaignTemplate.type === "audio_imagem_botoes" || campaignTemplate.type === "audio_video_botoes";
        if (campaignTemplate.header && !isAudioWithMedia)
          fullMessage += normalizePublicRedirectUrlsInText(campaignTemplate.header) + "\n\n";
        fullMessage += messageContent;
        if (campaignTemplate.footer) fullMessage += "\n\n" + normalizePublicRedirectUrlsInText(campaignTemplate.footer);

        console.log(
          `📝 [Content] Message for ${contact.phone}: ${fullMessage.slice(0, 100)}${fullMessage.length > 100 ? "..." : ""}`,
        );

        let visualContent = fullMessage;
        if (campaignTemplate.media_url) {
          const type = campaignTemplate.type?.split("_")[0] || "image";
          visualContent = `[media:${type}:${campaignTemplate.media_url}]\n${visualContent}`;
        }
        if (
          campaignTemplate.buttons &&
          Array.isArray(campaignTemplate.buttons) &&
          campaignTemplate.buttons.length > 0
        ) {
          const buttonLabels = campaignTemplate.buttons
            .map((b: any) => String(b.text || b.label || "").trim())
            .filter(Boolean);
          if (buttonLabels.length > 0) {
            visualContent += `\n\n[Botões: ${buttonLabels.join(" | ")}]`;
          }
        }

        campaignSend = {
          campaign_id: campaignId,
          phone: contact.phone,
          contact_name: contact.name,
          message_content: visualContent,
          status: "pending",
          user_id: credentials.userId,
          instance_name: currentInstance.instanceName,
        };

        const templateType = campaignTemplate.type || "texto";
        const hasButtons =
          campaignTemplate.buttons && Array.isArray(campaignTemplate.buttons) && campaignTemplate.buttons.length > 0;
        const hasMedia = campaignTemplate.media_url && campaignTemplate.media_url.trim() !== "";
        const hasCarouselCards =
          campaignTemplate.carousel_cards &&
          Array.isArray(campaignTemplate.carousel_cards) &&
          campaignTemplate.carousel_cards.length > 0;
        const campaignViewOnce = campaign.target_audience?.viewOnce === true;
        const campaignIsPtv = campaign.target_audience?.isPtv === true;
        const specialTpl = parseSpecialTemplate(campaignTemplate.content);

        const sanitizeCallPhone = (raw: string) => String(raw || "").replace(/\D+/g, "");

        const formatZapiButtons = (buttons: any[], sendId?: string | null) =>
          buttons
            .map((btn: any, index: number) => {
              let btnType = String(btn?.type || "url").toUpperCase();
              const label = String(btn?.text || btn?.label || `Botão ${index + 1}`)
                .trim()
                .slice(0, 20);

              const buttonData: any = {
                id: String(index + 1),
                type: "URL",
                label,
              };

              if (btnType === "COPY") {
                const code = String(btn?.copyText || btn?.value || "").trim();
                if (code) {
                  btnType = "URL";
                  buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(code)}`;
                }
              }

              if (btnType === "CALL") {
                const phone = sanitizeCallPhone(btn?.phone || btn?.value);
                if (!phone) return null;
                buttonData.type = "CALL";
                buttonData.phone = phone;
              } else if (btnType === "REPLY" || btnType === "OPTION" || btnType === "QUICK_REPLY") {
                buttonData.type = "REPLY";
              } else {
                const rawUrl = btn?.url || btn?.value || "";
                const finalUrl = buildTrackedCampaignUrl(rawUrl || "https://z-api.io", {
                  campaignId,
                  userId: credentials.userId,
                  phone: contact.phone,
                  label,
                  campaignName: campaign?.name,
                  sendId,
                });
                if (!finalUrl) return null;
                buttonData.type = "URL";
                buttonData.url = finalUrl;
              }
              return buttonData;
            })
            .filter(Boolean);

        const buildZapiButtonActionPayload = (buttons: any[], message: string, sendId?: string | null) => {
          const formattedButtons = formatZapiButtons(buttons, sendId).slice(0, 3);
          return {
            message,
            buttonActions: formattedButtons.map((btn: any, idx: number) => ({ ...btn, id: String(idx + 1) })),
          };
        };

        const instId = currentInstance.zapiInstanceId;
        const instToken = currentInstance.zapiToken;
        const instClientToken = currentInstance.zapiClientToken;
        const instApiProvider = currentInstance.apiProvider || "zapi";
        const instEvolutionUrl = currentInstance.evolutionApiUrl;
        const instName = currentInstance.instanceName;

        const isUazapi = instApiProvider === "uazapi" || instApiProvider === "uazapi_warmup" || instApiProvider === "evolution";
        const uazapiBaseUrl = instEvolutionUrl?.replace(/\/+$/, "");

        const getUniversalUrl = (endpoint: string) => {
          if (isUazapi && uazapiBaseUrl) {
            const withToken = (p: string) => `${p}${p.includes("?") ? "&" : "?"}token=${encodeURIComponent(instToken)}`;
            const inst = instName || instId;
            
            if (endpoint === "/send-text") return uazapiBaseUrl + withToken(`/message/sendText/${inst}`);
            if (endpoint === "/send-image") return uazapiBaseUrl + withToken(`/message/sendMedia/${inst}`);
            if (endpoint === "/send-video") return uazapiBaseUrl + withToken(`/message/sendMedia/${inst}`);
            if (endpoint === "/send-audio") return uazapiBaseUrl + withToken(`/message/sendMedia/${inst}`);
            if (endpoint.startsWith("/send-document")) return uazapiBaseUrl + withToken(`/message/sendMedia/${inst}`);
            if (endpoint === "/send-button-actions") return uazapiBaseUrl + withToken(`/message/sendButtons/${inst}`);
            if (endpoint === "/send-button-list") return uazapiBaseUrl + withToken(`/message/sendButtons/${inst}`);
            if (endpoint === "/send-ptv") return uazapiBaseUrl + withToken(`/message/sendMedia/${inst}`);
            
            return uazapiBaseUrl + withToken(endpoint.replace(/^\/send-/, "/message/send/"));
          }
          return `https://api.z-api.io/instances/${instId}/token/${instToken}${endpoint}`;
        };

        const getUniversalHeaders = () => {
          if (isUazapi) {
            return { "Content-Type": "application/json", token: instToken, apikey: instToken };
          }
          return { "Content-Type": "application/json", "Client-Token": instClientToken };
        };

        const mapUniversalPayload = (endpoint: string, payload: any) => {
          if (!isUazapi) return payload;

          const number = (payload.phone || "").replace(/\D/g, "");
          if (endpoint === "/send-text") {
             return { number, text: payload.message || "", linkPreview: true };
          }
          if (endpoint === "/send-image") {
             return { number, media: payload.image, type: "image", caption: payload.caption || "" };
          }
          if (endpoint === "/send-video") {
             return { number, media: payload.video, type: "video", caption: payload.caption || "" };
          }
          if (endpoint === "/send-audio") {
             return { number, media: payload.audio, type: "audio" };
          }
          if (endpoint.startsWith("/send-document")) {
             return { number, media: payload.document, type: "document", caption: payload.caption || "", fileName: payload.fileName || "" };
          }
          if (endpoint === "/send-button-actions" || endpoint === "/send-button-list") {
             const buttons = (payload.buttonActions || payload.buttonList?.buttons || []).map((b: any, i: number) => ({
               buttonId: b.id || String(i + 1),
               buttonText: { displayText: b.label || b.text || "Botão" },
               type: 1
             }));
             return { number, title: payload.title || "", description: payload.message || "", footer: payload.footer || "", buttons };
          }
          if (endpoint === "/send-ptv") {
             return { number, media: payload.ptv, type: "ptv" };
          }
          
          return { ...payload, number };
        };

        const performUniversalSend = async (endpoint: string, payload: any, method: string = "POST") => {
          const url = getUniversalUrl(endpoint);
          const headers = getUniversalHeaders();
          const body = mapUniversalPayload(endpoint, payload);
          
          console.log(`📤 Sending campaign message via ${instApiProvider}: ${url}`);
          return fetch(url, {
            method,
            headers,
            body: JSON.stringify(body)
          });
        };

        let zapiUrl: string = "";
        let requestBody: any = {};
        const baseZapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}`;

        if (isLidIdentifier(contact.phone)) {
          console.log(`📞 [Z-API] Enviando @lid: ${contact.phone}`);
          const phoneStr = String(contact.phone || "");
          const cleanLid = phoneStr.split(/[\s\t]+/).pop() || phoneStr;
          if (cleanLid !== contact.phone) {
            console.log(`🧹 Limpando nome do @lid: ${contact.phone} -> ${cleanLid}`);
            contact.phone = cleanLid;
          }
        } else if (!isGroupDestination(contact.phone)) {
          const normalized = getZapiTargetPhone(contact.phone);
          if (normalized && normalized !== contact.phone) {
            console.log(`📞 [Z-API] Normalizando telefone: ${contact.phone} → ${normalized}`);
            contact.phone = normalized;
          }
        }

        if (specialTpl) {
          const { url, body: specialBody } = await dispatchZapiSpecial(
            baseZapiUrl,
            instClientToken,
            contact.phone,
            specialTpl,
            supabase,
            credentials.userId,
          );
          zapiUrl = url;
          requestBody = specialBody;

          if (zapiUrl) {
            const endpoint = "/" + zapiUrl.split("/").pop();
            const zapiResponse = await fetch(zapiUrl, {
              method: "POST",
              headers: getUniversalHeaders(),
              body: JSON.stringify(mapUniversalPayload(endpoint, requestBody)),
            });

            let zapiResult: any = {};
            try {
              const responseText = await zapiResponse.text();
              if (responseText && responseText.trim()) zapiResult = JSON.parse(responseText);
            } catch {}

            const confirmed = isZapiConfirmed(zapiResult);
            const explicitError = getZapiExplicitError(zapiResult);
            console.log(
              `📬 [Special] Campaign Z-API response for ${contact.phone}: status=${zapiResponse.status}, confirmed=${confirmed}`,
            );

            if (
              (zapiResponse.ok && !explicitError && confirmed) ||
              (isLidIdentifier(contact.phone) && zapiResponse.ok)
            ) {
              campaignSend.status = "sent";
              campaignSend.sent_at = new Date().toISOString();
              campaignSend.error_message = null;
              const ackId = getZapiAckId(zapiResult);
              if (ackId) campaignSend.message_id = String(ackId);
              results.push({ phone: contact.phone, success: true, messageId: ackId });
            } else {
              campaignSend.status = "failed";
              campaignSend.error_message =
                explicitError || (!confirmed ? "Z-API não confirmou o envio especial" : `HTTP ${zapiResponse.status}`);
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            }

            await persistCampaignSend(campaignSend, reusableSendId);
            return { stop: false };
          }
        } else if (templateType === "carrossel" && hasCarouselCards) {
          const carouselItems = campaignTemplate.carousel_cards.map((card: any, idx: number) => {
            const text =
              [card.title, card.description].filter((s: any) => s && String(s).trim() !== "").join("\n\n") ||
              card.text ||
              "";
            const item: any = { text };
            if (card.image && String(card.image).trim() !== "") item.image = card.image;
            if (card.buttons && Array.isArray(card.buttons) && card.buttons.length > 0) {
              item.buttons = card.buttons.map((btn: any, bIdx: number) => {
                const btnType = String(btn.type || "url").toUpperCase();
                const button: any = {
                  id: String(btn.id || `${idx}-${bIdx}`),
                  label: btn.text || btn.label || "Abrir",
                };
                if (btnType === "CALL") {
                  button.type = "CALL";
                  button.phone = btn.phone || btn.value || "";
                } else if (btnType === "REPLY" || btnType === "OPTION") {
                  button.type = "REPLY";
                } else {
                  button.type = "URL";
                  button.url = buildTrackedCampaignUrl(btn.url || btn.value || "https://z-api.io", {
                    campaignId,
                    userId: credentials.userId,
                    phone: contact.phone,
                    label: button.label || "Abrir",
                    campaignName: campaign?.name,
                  });
                }
                return button;
              });
            }
            return item;
          });

          zapiUrl = getUniversalUrl("/send-carousel");
          requestBody = {
            phone: contact.phone,
            message: fullMessage || " ",
            carousel: carouselItems,
          };

          console.log("[send-campaign] Enviando carrossel Z-API:", JSON.stringify(requestBody));
          const carouselResponse = await fetch(zapiUrl, {
            method: "POST",
            headers: getUniversalHeaders(),
            body: JSON.stringify(mapUniversalPayload("/send-carousel", requestBody)),
          });
          const carouselText = await carouselResponse.text();
          console.log("[send-campaign] Resposta carrossel Z-API:", carouselResponse.status, carouselText);
          if (!carouselResponse.ok) throw new Error(`Erro ao enviar carrossel: ${carouselText}`);

          campaignSend.status = "sent";
          campaignSend.sent_at = new Date().toISOString();
          campaignSend.error_message = null;
          results.push({ phone: contact.phone, success: true, messageId: "carousel-sent" });

          await persistCampaignSend(campaignSend, reusableSendId);
          return { stop: false };
        } else if (templateType === "video_botoes" && hasMedia && hasButtons && !campaignIsPtv) {
          const zapiButtons = formatZapiButtons(campaignTemplate.buttons, reusableSendId);
          const hasActionButtonsInFormatted = zapiButtons.some((b: any) => b.type === "URL" || b.type === "CALL");

          if (!hasActionButtonsInFormatted) {
            const listEndpoint = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
            const listPayload = {
              phone: contact.phone,
              message: fullMessage || " ",
              buttonList: {
                video: campaignTemplate.media_url,
                buttons: (campaignTemplate.buttons || []).slice(0, 3).map((b: any, idx: number) => ({
                  id: b.id || String(idx + 1),
                  label: String(b.text || b.label || `Botão ${idx + 1}`)
                    .trim()
                    .slice(0, 20),
                })),
              },
              ...(campaignViewOnce ? { viewOnce: true } : {}),
            };

            const listResponse = await fetch(listEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Client-Token": instClientToken },
              body: JSON.stringify(listPayload),
            });

            if (listResponse.ok) {
              const result = await listResponse.json();
              campaignSend.status = "sent";
              campaignSend.sent_at = new Date().toISOString();
              campaignSend.error_message = null;
              const ackId = getZapiAckId(result);
              if (ackId) campaignSend.message_id = String(ackId);
              results.push({ phone: contact.phone, success: true, messageId: ackId });
              await persistCampaignSend(campaignSend, reusableSendId);
              return { stop: false };
            }

            const errorBody = await listResponse.json().catch(() => ({}));
            if (listResponse.status !== 404 && errorBody.error !== "NOT_FOUND") {
              throw new Error(`Erro ao enviar botões de lista (video): ${JSON.stringify(errorBody)}`);
            }

            zapiUrl = getUniversalUrl("/send-button-actions");
            const buttonPayload = buildZapiButtonActionPayload(
              campaignTemplate.buttons,
              fullMessage || " ",
              reusableSendId,
            );
            requestBody = {
              phone: contact.phone,
              ...buttonPayload,
              video: campaignTemplate.media_url,
              ...(campaignViewOnce ? { viewOnce: true } : {}),
            };
          } else {
            zapiUrl = getUniversalUrl("/send-button-actions");
            const buttonPayload = buildZapiButtonActionPayload(
              campaignTemplate.buttons,
              fullMessage || " ",
              reusableSendId,
            );
            requestBody = {
              phone: contact.phone,
              ...buttonPayload,
              video: campaignTemplate.media_url,
              ...(campaignViewOnce ? { viewOnce: true } : {}),
            };
          }
        } else if (templateType === "video_botoes" && hasMedia && hasButtons && campaignIsPtv) {
          const ptvUrl = getUniversalUrl("/send-ptv");
          const ptvResponse = await fetch(ptvUrl, {
            method: "POST",
            headers: getUniversalHeaders(),
            body: JSON.stringify(mapUniversalPayload("/send-ptv", { phone: contact.phone, ptv: campaignTemplate.media_url })),
          });
          if (!ptvResponse.ok) throw new Error(`Erro ao enviar PTV: ${await ptvResponse.text()}`);

          await sleep(Math.max(delayMs / 2, 1000));
          zapiUrl = getUniversalUrl("/send-button-actions");
          const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage, reusableSendId);
          requestBody = { phone: contact.phone, ...buttonPayload };
        } else if (
          (templateType === "audio_botoes" ||
            templateType === "audio_imagem_botoes" ||
            templateType === "audio_video_botoes") &&
          hasMedia &&
          hasButtons
        ) {
          const audioUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-audio`;
          const audioResponse = await fetch(audioUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Client-Token": instClientToken },
            body: JSON.stringify({ phone: contact.phone, audio: campaignTemplate.media_url, waveform: true }),
          });
          if (!audioResponse.ok) throw new Error(`Erro ao enviar áudio: ${await audioResponse.text()}`);

          await sleep(Math.max(delayMs / 2, 2500));

          const secondaryFromCarousel =
            Array.isArray(campaignTemplate.carousel_cards) && campaignTemplate.carousel_cards[0]?.id === "secondary"
              ? campaignTemplate.carousel_cards[0].image
              : null;

          const secondaryUrl =
            secondaryFromCarousel || (campaignTemplate.header?.startsWith("http") ? campaignTemplate.header : null);
          const headerTitle = secondaryFromCarousel
            ? campaignTemplate.header
            : !campaignTemplate.header?.startsWith("http")
              ? campaignTemplate.header
              : undefined;
          const zapiButtons = formatZapiButtons(campaignTemplate.buttons, reusableSendId);
          const hasActionButtonsInFormatted = zapiButtons.some((b: any) => b.type === "URL" || b.type === "CALL");

          const sType = templateType === "audio_video_botoes" ? "video" : "image";

          if (secondaryUrl && !hasActionButtonsInFormatted && (sType === "image" || sType === "video")) {
            const listEndpoint = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
            const listPayload: any = {
              phone: contact.phone,
              message: fullMessage || " ",
              buttonList: {
                [sType]: secondaryUrl,
                buttons: (campaignTemplate.buttons || []).slice(0, 3).map((b: any, idx: number) => ({
                  id: b.id || String(idx + 1),
                  label: String(b.text || b.label || `Botão ${idx + 1}`)
                    .trim()
                    .slice(0, 20),
                })),
              },
            };

            const listResponse = await fetch(listEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Client-Token": instClientToken },
              body: JSON.stringify(listPayload),
            });

            if (listResponse.ok) {
              const result = await listResponse.json();
              if (isZapiConfirmed(result)) {
                campaignSend.status = "sent";
                campaignSend.sent_at = new Date().toISOString();
                campaignSend.error_message = null;
                const ackId = getZapiAckId(result);
                if (ackId) campaignSend.message_id = String(ackId);
                results.push({ phone: contact.phone, success: true, messageId: ackId });
                await persistCampaignSend(campaignSend, reusableSendId);
                return { stop: false };
              }
            }
          }

          zapiUrl = getUniversalUrl("/send-button-actions");
          const buttonPayload = buildZapiButtonActionPayload(
            campaignTemplate.buttons,
            fullMessage || " ",
            reusableSendId,
          );
          requestBody = {
            phone: contact.phone,
            ...buttonPayload,
            ...(headerTitle ? { title: headerTitle } : {}),
          };

          if (secondaryUrl) {
            requestBody[sType] = secondaryUrl;
          }
        } else if (templateType === "imagem_botoes" && hasMedia && hasButtons) {
          const zapiButtons = formatZapiButtons(campaignTemplate.buttons, reusableSendId);
          const hasActionButtonsInFormatted = zapiButtons.some((b: any) => b.type === "URL" || b.type === "CALL");

          if (!hasActionButtonsInFormatted) {
            const listEndpoint = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
            const listPayload = {
              phone: contact.phone,
              message: fullMessage || " ",
              buttonList: {
                image: campaignTemplate.media_url,
                buttons: (campaignTemplate.buttons || []).slice(0, 3).map((b: any, idx: number) => ({
                  id: b.id || String(idx + 1),
                  label: String(b.text || b.label || `Botão ${idx + 1}`)
                    .trim()
                    .slice(0, 20),
                })),
              },
            };

            const listResponse = await fetch(listEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Client-Token": instClientToken },
              body: JSON.stringify(listPayload),
            });

            if (listResponse.ok) {
              const result = await listResponse.json();
              campaignSend.status = "sent";
              campaignSend.sent_at = new Date().toISOString();
              campaignSend.error_message = null;
              const ackId = getZapiAckId(result);
              if (ackId) campaignSend.message_id = String(ackId);
              results.push({ phone: contact.phone, success: true, messageId: ackId });
              await persistCampaignSend(campaignSend, reusableSendId);
              return { stop: false };
            }

            const errorBody = await listResponse.json().catch(() => ({}));
            if (listResponse.status !== 404 && errorBody.error !== "NOT_FOUND") {
              throw new Error(`Erro ao enviar botões de lista (image): ${JSON.stringify(errorBody)}`);
            }

            zapiUrl = getUniversalUrl("/send-button-actions");
            const buttonPayload = buildZapiButtonActionPayload(
              campaignTemplate.buttons,
              fullMessage || " ",
              reusableSendId,
            );
            requestBody = {
              phone: contact.phone,
              ...buttonPayload,
              image: campaignTemplate.media_url,
            };
          } else {
            zapiUrl = getUniversalUrl("/send-button-actions");
            const buttonPayload = buildZapiButtonActionPayload(
              campaignTemplate.buttons,
              fullMessage || " ",
              reusableSendId,
            );
            requestBody = {
              phone: contact.phone,
              ...buttonPayload,
              image: campaignTemplate.media_url,
            };
          }
        } else if (templateType === "imagem") {
          if (!hasMedia) throw new Error('Template tipo "imagem" requer uma imagem');
          zapiUrl = getUniversalUrl("/send-image");
          requestBody = { phone: contact.phone, image: campaignTemplate.media_url, caption: fullMessage };
        } else if (templateType === "video") {
          if (!hasMedia) throw new Error('Template tipo "video" requer um vídeo');
          if (campaignIsPtv) {
            zapiUrl = getUniversalUrl("/send-ptv");
            requestBody = { phone: contact.phone, ptv: campaignTemplate.media_url };
          } else {
            zapiUrl = getUniversalUrl("/send-video");
            requestBody = {
              phone: contact.phone,
              video: campaignTemplate.media_url,
              caption: fullMessage,
              ...(campaignViewOnce ? { viewOnce: true } : {}),
            };
          }
        } else if (templateType === "audio") {
          if (!hasMedia) throw new Error('Template tipo "audio" requer um áudio');
          zapiUrl = getUniversalUrl("/send-audio");
          requestBody = { phone: contact.phone, audio: campaignTemplate.media_url, waveform: true };
        } else if (templateType === "status") {
          const statusType = String((campaignTemplate as any).status_type || "text").toLowerCase();
          if (statusType === "image") {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-status-image`;
            requestBody = { image: campaignTemplate.media_url, caption: fullMessage };
          } else if (statusType === "video") {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-status-video`;
            requestBody = { video: campaignTemplate.media_url, caption: fullMessage };
          } else {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-status-text`;
            requestBody = { message: fullMessage };
          }
          requestBody.phone = "status@broadcast";
        } else if (templateType === "documento" || templateType === "arquivo") {
          if (!hasMedia) throw new Error(`Template tipo "${templateType}" requer um arquivo`);
          const mimeExt = campaignTemplate.file_type?.split("/").pop()?.toLowerCase();
          const urlExt = String(campaignTemplate.media_url || "")
            .split("?")[0]
            .split("#")[0]
            .split(".")
            .pop()
            ?.toLowerCase();
          const extension = (mimeExt && mimeExt !== "octet-stream" ? mimeExt : urlExt) || "pdf";
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-document/${extension}`;
          requestBody = {
            phone: contact.phone,
            document: campaignTemplate.media_url,
            fileName: campaignTemplate.file_name || `documento.${extension}`,
            caption: fullMessage,
          };
        } else if (templateType === "imagem_lista_opcao" && hasMedia) {
          const rawItems = Array.isArray(campaignTemplate.list_items)
            ? campaignTemplate.list_items
            : Array.isArray((campaignTemplate as any).listItems)
              ? (campaignTemplate as any).listItems
              : [];
          const cleanItems = rawItems
            .filter((it: any) => it && String(it.title || "").trim() !== "")
            .slice(0, 10)
            .map((it: any, idx: number) => ({
              title: String(it.title).trim(),
              description: String(it.description || "").trim(),
              rowId: String(it.id || `opt_${idx + 1}`),
            }));

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
          requestBody = {
            phone: contact.phone,
            message: fullMessage || " ",
            image: campaignTemplate.media_url,
            buttonList: {
              title: campaignTemplate.header || "",
              buttonLabel: "Ver opções",
              options: cleanItems,
            },
          };
        } else if (templateType === "lista_opcao" || templateType === "lista" || templateType === "lista de opção") {
          const rawItems = Array.isArray(campaignTemplate.list_items)
            ? campaignTemplate.list_items
            : Array.isArray((campaignTemplate as any).listItems)
              ? (campaignTemplate as any).listItems
              : [];
          const cleanItems = rawItems
            .filter((it: any) => it && String(it.title || "").trim() !== "")
            .slice(0, 10)
            .map((it: any, idx: number) => ({
              title: String(it.title).trim(),
              description: String(it.description || "").trim(),
              rowId: String(it.id || `opt_${idx + 1}`),
            }));
          if (cleanItems.length === 0) throw new Error('Template tipo "lista" requer pelo menos um item');

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-option-list`;
          requestBody = {
            phone: contact.phone,
            message: fullMessage || " ",
            optionList: {
              title: campaignTemplate.header || "",
              buttonLabel: "Ver opções",
              options: cleanItems,
            },
          };
        } else if (hasButtons) {
          zapiUrl = getUniversalUrl("/send-button-actions");
          const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage, reusableSendId);
          requestBody = { phone: contact.phone, ...buttonPayload };
        } else {
          zapiUrl = getUniversalUrl("/send-text");
          requestBody = { phone: contact.phone, message: fullMessage };
        }

        if (zapiUrl) {
          const tagId = campaign.target_audience?.tag_id;
          if (tagId && tagId !== "none" && !isGroupDestination(contact.phone)) {
            try {
              console.log(`🏷️ Applying tag ${tagId} to ${contact.phone}`);
              const tagUrl = `${baseZapiUrl}/add-tag-chat`;
              await fetch(tagUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Client-Token": instClientToken },
                body: JSON.stringify({ phone: contact.phone, tagId }),
              });
            } catch (tagErr) {
              console.error(`⚠️ Failed to apply tag to ${contact.phone}:`, tagErr);
            }
          }

          console.log(`🚀 [Dispatch] Provider: ${instApiProvider}, URL: ${zapiUrl}`);
          console.log(`📦 [Dispatch] Payload: ${JSON.stringify({ ...requestBody, phone: contact.phone })}`);

          const endpoint = "/" + zapiUrl.split("/").pop();
          const zapiResponse = await fetch(zapiUrl, {
            method: "POST",
            headers: getUniversalHeaders(),
            body: JSON.stringify(mapUniversalPayload(endpoint, requestBody)),
          });

          let zapiResult: any = {};
          try {
            const responseText = await zapiResponse.text();
            if (responseText && responseText.trim()) zapiResult = JSON.parse(responseText);
          } catch {}

          const explicitError = getZapiExplicitError(zapiResult);
          const confirmed = isZapiConfirmed(zapiResult);
          const messageIdFromResponse = getZapiAckId(zapiResult);

          console.log(
            `📬 Campaign Z-API response for ${contact.phone} via ${currentInstance.instanceName}: status=${zapiResponse.status}, confirmed=${confirmed}, ack=${messageIdFromResponse || "none"}`,
          );

          if (zapiResponse.ok && (isLidIdentifier(contact.phone) || (!explicitError && confirmed))) {
            const isLocationButton =
              specialTpl?.type === "uaz_location_button" ||
              specialTpl?.type === "location_button" ||
              specialTpl?.type === "request-location";

            if (isLocationButton) {
              await sleep(Math.max(1000, Math.min(delayMs / 2, 3000)));
              const buttonResult = await sendZapiLocationButtonFollowUp(
                baseZapiUrl,
                instClientToken,
                contact.phone,
                specialTpl,
              );
              if (!buttonResult.ok) {
                campaignSend.status = "failed";
                campaignSend.error_message = buttonResult.error || "Falha ao enviar botão da localização";
                results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
                await persistCampaignSend(campaignSend, reusableSendId);
                return { stop: false };
              }
            }

            campaignSend.status = "sent";
            campaignSend.sent_at = new Date().toISOString();
            campaignSend.error_message = null; // Clear any previous error message on success
            const ackId = getZapiAckId(zapiResult);
            if (ackId) campaignSend.message_id = String(ackId);
            results.push({ phone: contact.phone, success: true, messageId: ackId });
            console.log(`📨 Sent for ${contact.phone} after accepted send`);
          } else if (
            !zapiResponse.ok ||
            (explicitError && !isLidIdentifier(contact.phone)) ||
            (!confirmed && !isLidIdentifier(contact.phone))
          ) {
            console.log(`🔍 [ShadowBan Check] phone=${contact.phone}, explicitError="${explicitError}", confirmed=${confirmed}, status=${zapiResponse.status}`);
            const isAuthError = 
              zapiResponse.status === 401 || 
              zapiResponse.status === 403 || 
              (explicitError && (
                explicitError.toLowerCase().includes("not allowed") ||
                explicitError.toLowerCase().includes("token") ||
                explicitError.toLowerCase().includes("unauthorized")
              ));

            if (isAuthError && currentInstance.dbId) {
              await deactivateInstance(supabase, currentInstance.dbId, explicitError || `HTTP ${zapiResponse.status}`);
            }

            const isShadowBan =
              explicitError &&
              (explicitError.toLowerCase().includes("shadow ban") ||
                explicitError.toLowerCase().includes("restrições de envio") ||
                explicitError.toLowerCase().includes("unauthorized") ||
                explicitError.toLowerCase().includes("capping"));

            if (isShadowBan && currentInstance.dbId) {
              await recordShadowBan(supabase, currentInstance.dbId, JSON.stringify(zapiResult));
            }

            // Shadow ban: sempre marca como falha e continua para o próximo contato
            // Nunca pausa a campanha por shadow ban — só por rate limit real (error 463)
            campaignSend.status = "failed";
            campaignSend.error_message = isShadowBan
              ? "Shadowban detectado: Seu número WhatsApp está com restrições de envio."
              : explicitError ||
                (!confirmed
                  ? "WhatsApp não confirmou o envio (possível Shadowban ou número inválido)"
                  : `HTTP ${zapiResponse.status}`);

            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            console.log(`❌ Failed ${contact.phone}: ${campaignSend.error_message}`);

            // Shadow ban nunca pausa — só rate limit real (error 463) pausa, e só se não for forceSend
            if (isConfirmedRateLimitHit(zapiResult, campaignSend.error_message, zapiResponse.status) && !isLidIdentifier(contact.phone)) {
              if (!(reqPayload as SendCampaignRequest).forceSend) {
                rateLimitHitsInBatch += 1;
                if (rateLimitHitsInBatch >= 2) {
                  console.log(`🚨 Rate-limit detectado e persistente em ${campaignId}. Pausando campanha para proteção.`);
                  await supabase
                    .from("campaigns")
                    .update({ status: "paused", updated_at: new Date().toISOString() })
                    .eq("id", campaignId);
                  return { stop: true, status: "paused" };
                }
              }
            } else {
              rateLimitHitsInBatch = 0;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${contact.phone}:`, error);
        if (!campaignSend) {
          campaignSend = {
            campaign_id: campaignId,
            phone: contact.phone,
            contact_name: contact.name,
            message_content: "Error processing message",
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
            user_id: credentials.userId,
            instance_name: currentInstance.instanceName,
          };
        } else {
          campaignSend.status = "failed";
          campaignSend.error_message = error instanceof Error ? error.message : "Unknown error";
        }
        results.push({
          phone: contact.phone,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      if (campaignSend) {
        if (campaignSend.status === "pending" && !isFlowCampaign) {
          console.log(`⚠️ Contact ${contact.phone} was left as pending. Marking as failed for safety.`);
          campaignSend.status = "failed";
          campaignSend.error_message =
            campaignSend.error_message || "Erro desconhecido durante o processamento (timeout ou resposta vazia)";
        }
        await persistCampaignSend(campaignSend, reusableSendId);
      }

      return { stop: false };
    }

    if (remainingContacts.length > 0) {
      const { data: continueCheck } = await supabase.from("campaigns").select("status").eq("id", campaignId).single();
      if (
        continueCheck?.status === "paused" ||
        continueCheck?.status === "cancelled" ||
        continueCheck?.status === "completed"
      ) {
        console.log(
          `🛑 Campaign ${campaignId} is ${continueCheck?.status}. Not continuing with remaining ${remainingContacts.length} contacts.`,
        );
        return new Response(
          JSON.stringify({
            success: true,
            stopped: true,
            processed: currentBatch.length,
            remaining: remainingContacts.length,
            message: `Stopped: campaign ${continueCheck?.status}`,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }

      console.log(`🔄 Re-invoking for remaining ${remainingContacts.length} contacts...`);

      const continuationSuccess = await queueContinuation(remainingContacts, currentBatch.length);
      if (!continuationSuccess) {
        console.log(`⚠️ Re-invocation failed. Retrying in 2s...`);
        await sleep(2000);
        const retrySuccess = await queueContinuation(remainingContacts, currentBatch.length);
        if (!retrySuccess) {
          console.error(
            `❌ Re-invocation failed after retry. Campaign ${campaignId} stuck with ${remainingContacts.length} remaining contacts.`,
          );
        }
      }
    } else {
      const totalTargetContacts = campaignTargetContacts.length;
      const [processedRes, awaitingCallbackRes, successRes] = await Promise.all([
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
        supabase
          .from("campaign_sends")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("status", "pending"),
        supabase
          .from("campaign_sends")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .in("status", ["delivered", "sent"]),
      ]);

      const totalProcessed = processedRes.count ?? 0;
      const awaitingCallbackCount = awaitingCallbackRes.count ?? 0;
      const actualDeliveries = successRes.count ?? 0;

      const effectiveTarget = totalTargetContacts > 0 ? totalTargetContacts : totalProcessed;

      if (totalTargetContacts > 0) {
        const missingContacts = await getRemainingAudienceContacts(supabase, campaignId, campaignTargetContacts);
        if (missingContacts.length > 0) {
          console.log(
            `⚠️ Campaign ${campaignId}: blocking completion because ${missingContacts.length}/${totalTargetContacts} contacts are still not accepted. Re-invoking missing contacts.`,
          );

          const continuationSuccess = await queueContinuation(missingContacts, currentBatch.length);
          if (!continuationSuccess) {
            await sleep(2000);
            const retrySuccess = await queueContinuation(missingContacts, currentBatch.length);
            if (!retrySuccess) {
              console.error(
                `❌ Failed to re-invoke missing contacts for campaign ${campaignId}. ${missingContacts.length} contacts not processed.`,
              );
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Missing contacts queued before completion",
              campaignId,
              processed: currentBatch.length,
              remaining: missingContacts.length,
              results,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
      }

      if (totalProcessed === 0) {
        console.log(`⚠️ Campaign ${campaignId}: No messages processed in this batch.`);
      } else if (remainingContacts.length === 0) {
        // Only mark as completed if this was truly the last batch
        console.log(
          `✅ Campaign ${campaignId}: Last batch processed (no remainingContacts in payload).`,
        );
        
        // RE-FETCH REMAINING TO BE ABSOLUTELY SURE
        const missingFromDatabase = await getRemainingAudienceContacts(supabase, campaignId, campaignTargetContacts);
        
        if (missingFromDatabase.length > 0) {
          console.log(`⚠️ Campaign ${campaignId}: Found ${missingFromDatabase.length} contacts still missing in DB. Re-invoking.`);
          const continuationSuccess = await queueContinuation(missingFromDatabase, currentBatch.length);
          if (!continuationSuccess) {
            console.error(`❌ Failed to re-invoke missing contacts for campaign ${campaignId}.`);
          }
          return new Response(
            JSON.stringify({ success: true, message: "Missing contacts re-queued", remaining: missingFromDatabase.length }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        if (awaitingCallbackCount > 0) {
          console.log(
            `⏳ Campaign ${campaignId}: ${awaitingCallbackCount} message(s) still waiting real WhatsApp delivery callback. Keeping active.`,
          );
        } else {
          console.log(
            `✅ Campaign ${campaignId}: All ${totalTargetContacts} contacts processed and confirmed. Marking as completed.`,
          );
          const { data: finalCampaign } = await supabase.from("campaigns").select("status").eq("id", campaignId).single();
          if (finalCampaign?.status === "active" || finalCampaign?.status === "sending") {
            await supabase
              .from("campaigns")
              .update({ status: "completed", updated_at: new Date().toISOString() })
              .eq("id", campaignId);
            console.log(`✅ Campaign ${campaignId} completed!`);
          } else {
            console.log(`⚠️ Campaign ${campaignId} status is ${finalCampaign?.status}, skipping completion update.`);
          }
        }
      }
    }

    const sentCount = results.filter((result) => result.success).length;
    const failedCount = results.filter((result) => !result.success).length;

    return new Response(
      JSON.stringify({
        success: failedCount === 0,
        partial: sentCount > 0 && failedCount > 0,
        message: "Batch processed",
        campaignId,
        processed: currentBatch.length,
        remaining: remainingContacts.length,
        sentCount,
        failedCount,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error) {
    console.error(`💥 send-campaign error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
