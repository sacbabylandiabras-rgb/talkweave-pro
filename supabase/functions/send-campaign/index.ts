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
    userId?: string; // Add userId to contact to help with normalization
  }>;

  instanceId?: string;
  rotationOffset?: number;
  _isContinuation?: boolean;
  _userId?: string; // Used by service-role re-invocations to bypass JWT auth
  forceSend?: boolean; // If true, ignore previous successful sends for the same phone in the same campaign
}

interface CampaignSendRecord {
  campaign_id: string;
  phone: string;
  contact_name?: string;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
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
  uazapiUrl?: string;
  uazapiToken?: string;
}

type CampaignCredentials = {
  instanceId: string;
  token: string;
  clientToken: string;
  userId: string;
  instanceName: string;
  apiProvider?: string;
  uazapiUrl?: string;
  uazapiToken?: string;
};

const PUBLIC_TRACKING_URL = "https://go.zaplynxpro.online/r";
const WHATSAPP_META_APP_ID = "26985190684454065";

async function getMetaCredentials(supabase: any, userId: string, phoneId?: string) {
  const query = supabase
    .from("meta_credentials")
    .select("access_token, phone_number_id, waba_id")
    .eq("user_id", userId)
    .eq("app_id", WHATSAPP_META_APP_ID)
    .eq("connected", true);

  if (phoneId) {
    query.eq("phone_number_id", phoneId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

async function sendMetaMessage(creds: { access_token: string; phone_number_id: string }, payload: any, phone: string) {
  const to = phone.replace(/\D/g, "");
  const baseUrl = `https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`;
  const headers = {
    Authorization: `Bearer ${creds.access_token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) {
    console.error("Meta API error:", data);
    throw new Error(data?.error?.message || "Erro na Meta API");
  }
  return data;
}

function buildMetaPayload(template: any, fullMessage: string, phone: string, campaignId: string, userId: string, campaignName: string) {
  const to = phone.replace(/\D/g, "");
  const { media_url: mediaUrl, buttons, type } = template;
  let payload: any = { messaging_product: "whatsapp", to };

  const metaButtons = (buttons || []).slice(0, 3).map((btn: any, idx: number) => {
    const btnType = String(btn.type || 'url').toUpperCase();
    if (btnType === 'URL') {
      return {
        type: "url",
        url: buildTrackedCampaignUrl(btn.url || btn.value || 'https://z-api.io', {
          campaignId,
          userId,
          phone,
          label: btn.text || btn.label || "Abrir",
          campaignName,
        })
      };
    }
    return {
      type: "reply",
      reply: { id: btn.id || String(idx), title: (btn.label || btn.text || "Botão").slice(0, 20) },
    };
  });

  const replyButtons = metaButtons.filter((b: any) => b.type === "reply");

  if (replyButtons.length > 0) {
    payload.type = "interactive";
    payload.interactive = {
      type: "button",
      body: { text: fullMessage || "Escolha uma opção:" },
      action: { buttons: replyButtons },
    };

    if (mediaUrl && type?.startsWith("imagem")) {
      payload.interactive.header = { type: "image", image: { link: mediaUrl } };
    } else if (mediaUrl && type?.startsWith("video")) {
      payload.interactive.header = { type: "video", video: { link: mediaUrl } };
    }
  } else if (mediaUrl) {
    const typeMap: Record<string, string> = { image: "image", video: "video", audio: "audio", document: "document" };
    const mediaType = type?.split('_')[0] || "image";
    const metaType = typeMap[mediaType] || "document";
    payload.type = metaType;
    payload[metaType] = { link: mediaUrl };
    if (fullMessage && metaType !== "audio") payload[metaType].caption = fullMessage;
  } else {
    payload.type = "text";
    payload.text = { body: fullMessage };
  }

  return payload;
}


const normalizePublicInviteUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'pay.zaplynxpro.online') {
      const slug = parsed.pathname.replace(/^\/invite\//, '/').replace(/^\/+|\/+$/g, '').split('/')[0];
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
    .replace(/https?:\/\/pay\.zaplynxpro\.online\/invite\/([^\s)\]}>"']+)/gi, (_match, slug) => `https://go.zaplynxpro.online/invite/${slug}`)
    .replace(/https?:\/\/pay\.zaplynxpro\.online\/r\?/gi, 'https://go.zaplynxpro.online/r?');
};

const mapResolvedInstance = (instance: {
  id?: string;
  zapi_instance_id: string;
  zapi_token: string | null;
  zapi_client_token: string | null;
  instance_name: string | null;
  api_provider?: string | null;
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
} | null): ResolvedInstance | null => {
  if (!instance?.zapi_instance_id) return null;

  const provider = instance.api_provider || 'zapi';

  if (provider === 'uazapi') {
    const hasUazapiCreds = Boolean(instance.evolution_api_url && (instance.evolution_api_key || instance.zapi_token));
    if (!hasUazapiCreds) return null;

    return {
      dbId: instance.id,
      zapiInstanceId: instance.zapi_instance_id,
      zapiToken: instance.zapi_token || instance.evolution_api_key || '',
      zapiClientToken: instance.zapi_client_token || instance.zapi_token || instance.evolution_api_key || '',
      instanceName: instance.instance_name || 'Instância',
      apiProvider: 'uazapi',
      uazapiUrl: instance.evolution_api_url || '',
      uazapiToken: instance.evolution_api_key || instance.zapi_token || '',
    };
  }

  const hasZapiCreds = Boolean(instance.zapi_instance_id && instance.zapi_token && instance.zapi_client_token);
  if (!hasZapiCreds) return null;

  return {
    dbId: instance.id,
    zapiInstanceId: instance.zapi_instance_id,
    zapiToken: instance.zapi_token || '',
    zapiClientToken: instance.zapi_client_token || '',
    instanceName: instance.instance_name || 'Instância',
    apiProvider: 'zapi',
    uazapiUrl: '',
    uazapiToken: '',
  };
};

const resolvePreferredUserInstance = async (
  supabase: any,
  userId: string,
): Promise<ResolvedInstance | null> => {
  const selectFields = 'id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key';

  const { data: defaultInstance } = await supabase
    .from('zapi_instances')
    .select(selectFields)
    .eq('user_id', userId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle();

  const mappedDefault = mapResolvedInstance(defaultInstance);
  if (mappedDefault) return mappedDefault;

  const { data: activeInstance } = await supabase
    .from('zapi_instances')
    .select(selectFields)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return mapResolvedInstance(activeInstance);
};

const buildCampaignCredentials = (userId: string, instance: ResolvedInstance): CampaignCredentials => ({
  instanceId: instance.zapiInstanceId,
  token: instance.zapiToken,
  clientToken: instance.zapiClientToken,
  userId,
  instanceName: instance.instanceName,
  apiProvider: instance.apiProvider || 'zapi',
  uazapiUrl: instance.uazapiUrl || '',
  uazapiToken: instance.uazapiToken || '',
});

const resolveContactInstance = async (
  supabase: any,
  userId: string,
  sourceInstanceId?: string | null,
): Promise<ResolvedInstance | null> => {
  if (!sourceInstanceId) return null;

  // Handle Meta API instances
  if (sourceInstanceId.startsWith("meta:")) {
    const phoneId = sourceInstanceId.split(":")[1];
    return {
      zapiInstanceId: sourceInstanceId,
      zapiToken: "",
      zapiClientToken: "",
      instanceName: `Meta API (${phoneId})`,
      apiProvider: "meta",
      uazapiUrl: "",
      uazapiToken: "",
    };
  }


  let instance: {
    id: string;
    zapi_instance_id: string;
    zapi_token: string;
    zapi_client_token: string;
    instance_name: string | null;
    api_provider?: string | null;
    evolution_api_url?: string | null;
    evolution_api_key?: string | null;
  } | null = null;

  const { data: byZapiInstanceId } = await supabase
    .from('zapi_instances')
    .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
    .eq('user_id', userId)
    .eq('zapi_instance_id', sourceInstanceId)
    .eq('is_active', true)
    .maybeSingle();

  instance = byZapiInstanceId;

  if (!instance) {
    const { data: byTableId } = await supabase
      .from('zapi_instances')
      .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
      .eq('user_id', userId)
      .eq('id', sourceInstanceId)
      .eq('is_active', true)
      .maybeSingle();

    instance = byTableId;
  }

  return mapResolvedInstance(instance);
};

const resolveGroupInstanceFromInboundLogs = async (
  supabase: any,
  userId: string,
  phone: string,
): Promise<ResolvedInstance | null> => {
  if (!isGroupDestination(phone)) return null;

  const numericGroupId = phone.replace(/[@\-].*$/, '').replace(/\D/g, '');
  if (!numericGroupId) return null;

  const groupVariants = [
    `${numericGroupId}-group`,
    `${numericGroupId}@g.us`,
    numericGroupId,
  ];

  const { data: groupLogs } = await supabase
    .from('message_logs')
    .select('instance_id')
    .in('phone', groupVariants)
    .not('instance_id', 'is', null)
    .is('keyword_matched', null)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(1);

  let resolvedGroupInstanceId = (groupLogs as Array<{ instance_id: string | null }> | null)?.[0]?.instance_id || null;

  if (!resolvedGroupInstanceId) {
    const { data: groupLogsFallback } = await supabase
      .from('message_logs')
      .select('instance_id, keyword_matched')
      .in('phone', groupVariants)
      .not('instance_id', 'is', null)
      .not('message_received', 'is', null)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(5);

    const inboundLog = (groupLogsFallback as Array<{ instance_id: string | null; keyword_matched: string | null }> | null)?.find((log) => log.keyword_matched !== '__manual_send__');
    resolvedGroupInstanceId = inboundLog?.instance_id || null;
  }

  if (!resolvedGroupInstanceId) return null;

  const { data: correctInstance } = await supabase
    .from('zapi_instances')
    .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
    .or(`zapi_instance_id.eq.${resolvedGroupInstanceId},id.eq.${resolvedGroupInstanceId}`)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  const correctInstanceRow = correctInstance as {
    zapi_instance_id?: string | null;
    zapi_token?: string | null;
    zapi_client_token?: string | null;
    instance_name?: string | null;
    api_provider?: string | null;
    evolution_api_url?: string | null;
    evolution_api_key?: string | null;
  } | null;
  return mapResolvedInstance(correctInstanceRow as any);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getZapiAckId = (payload: any) => payload?.messageId || payload?.zapiMessageId || payload?.zaapId || payload?.id || payload?.key?.id || payload?.message?.id || null;
const getZapiExplicitError = (payload: any) => payload?.error || payload?.erro || (payload?.success === false ? payload?.message : null) || null;
const getUazapiAckId = (payload: any) => getZapiAckId(payload) || payload?.data?.messageId || payload?.data?.id || payload?.message?.key?.id || payload?.queueId || null;

const hasUazapiExplicitError = (payload: any) => {
  const candidates = [
    payload?.error,
    payload?.erro,
    payload?.details?.error,
    payload?.details?.message,
    payload?.message,
    payload?.reason,
    payload?.response,
    payload?.success === false ? payload?.message : null,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'object') {
      const nested = (candidate as any).message || (candidate as any).error || (candidate as any).reason;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }

  if (payload?.error === true || payload?.success === false) {
    return 'Número não está no WhatsApp ou recusou a mensagem (@lid/desconhecido).';
  }

  return null;
};

const isUazapiSendConfirmed = (payload: any) => {
  const ackId = getUazapiAckId(payload);
  const status = String(payload?.status || payload?.messageStatus || payload?.state || payload?.result || '').toLowerCase();

  return Boolean(
    ackId ||
    payload?.queued === true ||
    payload?.enqueued === true ||
    ['success', 'queued', 'queue', 'pending', 'processing', 'accepted'].includes(status)
  );
};

// Detect WhatsApp rate-limit / temporary restriction errors (e.g. error 463).
// When this happens, sending more messages will only deepen the block,
// so we must pause the campaign immediately and let the user retry later.
const isWhatsAppRateLimitError = (payload: any, httpStatus?: number): boolean => {
  const haystack = JSON.stringify(payload || {}).toLowerCase();
  if (!haystack) return false;
  return (
    haystack.includes('error 463') ||
    haystack.includes('"code":463') ||
    haystack.includes('temporary restriction') ||
    haystack.includes('temporarily restricted') ||
    haystack.includes('currently connected account is under') ||
    haystack.includes('sending volume or quality') ||
    haystack.includes('rate limit') ||
    haystack.includes('rate-limit') ||
    haystack.includes('rate_limit') ||
    httpStatus === 429
  );
};
 
 const recordShadowBan = async (
   supabase: any,
   instanceDbId: string,
   errorText: string
 ) => {
   try {
     const isCapping = /cycle_end|new_chat_message_capping|capping/i.test(errorText);
     const extractCycleEnd = (text: string): string | null => {
       try {
         const m = text.match(/"cycle_end"\s*:\s*"([^"]+)"/i);
         if (m && m[1]) return new Date(m[1]).toISOString();
       } catch (_) { /* ignore */ }
       return null;
     };
 
     const blockedUntil = extractCycleEnd(errorText);
     const blockType = isCapping ? "new_chat_capping" : "shadowban";
 
     await supabase
       .from("warmup_instance_health")
       .upsert(
         {
           instance_ref: instanceDbId,
           block_type: blockType,
           blocked_until: blockedUntil,
           last_detected_at: new Date().toISOString(),
           detail: errorText.slice(0, 240),
         },
         { onConflict: "instance_ref,block_type" }
       );
     console.log(`🛡️ Recorded ${blockType} for instance ${instanceDbId}`);
   } catch (e: any) {
     console.warn(`  ⚠ Failed to record shadowban health: ${e?.message}`);
   }
 };

const isZapiConfirmed = (payload: any) => {
  const ackId = getZapiAckId(payload);
  const status = String(payload?.status || payload?.message?.status || '').toUpperCase();
  const result = String(payload?.result || '').toUpperCase();
  
  // Special case: "shadow ban" warning from Z-API
  // Even if they include an ID, if this specific message is present, it's NOT a successful send.
  const error = String(payload?.error || payload?.message || '').toLowerCase();
  if (error.includes('likely shadow ban')) return false;

  // Status de sucesso real de envio. 
  // Incluímos PENDING e QUEUED pois o Z-API aceitou a mensagem para sua fila interna.
  // Se houver um messageId/ackId, consideramos que o envio foi aceito com sucesso.
  const successStatuses = ['SENT', 'SUCCESS', 'OK', 'PENDING', 'QUEUED', 'ENQUEUED', 'ACCEPTED', 'PROCESSING'];
  const deliveryStatuses = ['DELIVERED', 'RECEIVED', 'READ', 'READ_BY_ME'];
  
  // Se tiver ID e status de sucesso ou entrega, confirmamos. 
  return Boolean(ackId) && (successStatuses.includes(status) || successStatuses.includes(result) || deliveryStatuses.includes(status));
};

 const isGroupDestination = (phone: string) => (phone.includes('@g.us') || phone.includes('-group')) && !phone.includes('@newsletter') && !phone.includes('-community');
 const isCommunityDestination = (phone: string) => phone.includes('-community');
 const isChannelDestination = (phone: string) => phone.includes('@newsletter');
const isLidIdentifier = (phone?: string | null) => Boolean(phone && phone.includes('@lid') && !isGroupDestination(phone));

const SPECIAL_TEMPLATE_PREFIX = '__SPECIAL_TEMPLATE__:';

const getUazapiTargetNumber = (phone: string) => {
  if (isGroupDestination(phone)) {
    const numericGroup = phone.replace(/[@\-].*$/, '').replace(/\D/g, '');
    return numericGroup ? `${numericGroup}@g.us` : phone;
  }

  if (isCommunityDestination(phone) || isChannelDestination(phone)) return phone;

  if (phone.includes('@lid')) return phone;

  return phone.replace(/^\+/, '').replace(/\D/g, '');
};

// For Z-API the phone field must contain only digits for números normais.
// Para identificadores @lid, preservamos o sufixo completo (ex: 12345@lid)
// porque o usuário quer que o provedor receba o destino tal como está.
const getZapiTargetPhone = (phone: string) => {
  if (!phone) return phone;
  
  // Handle Group Destinations
  if (isGroupDestination(phone)) {
    const numericId = phone.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
    return numericId ? `${numericId}-group` : phone;
  }

  // Handle Community/Channel
  if (isCommunityDestination(phone) || isChannelDestination(phone)) return phone;
  
  // Handle @lid
  if (phone.includes('@lid')) return phone;

  // For private numbers, remove all non-digits and leading +
  let cleaned = phone.replace(/^\+/, '').replace(/\D/g, '');

  // Robust Brazilian Mobile Number Normalization
  // Rules for Brazil (Country Code 55):
  if (cleaned.length === 11 && !cleaned.startsWith('55')) {
    // If it has 11 digits (e.g. 19999487082) and doesn't start with 55, 
    // it's likely a Brazilian mobile number (DDD + 9 digits).
    // Prepend 55 for Z-API.
    console.log(`[Normalization] Prepended 55 to Brazilian mobile: ${cleaned} -> 55${cleaned}`);
    cleaned = `55${cleaned}`;
  } else if (cleaned.length === 10 && !cleaned.startsWith('55')) {
    // If it has 10 digits (e.g. 1999487082) and doesn't start with 55,
    // it's likely a Brazilian number without the 9th digit.
    // Prepend 55.
    console.log(`[Normalization] Prepended 55 to Brazilian number: ${cleaned} -> 55${cleaned}`);
    cleaned = `55${cleaned}`;
  }

  // Handle case where user put 55 but missing DDD or something else
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    // Correct format: 55 + DDD + 9 digits.
  }

  return cleaned || phone;
};



const buildTrackedCampaignUrl = (url: string, opts: { campaignId: string; userId: string; phone: string; label: string; campaignName?: string | null; sendId?: string | null }) => {
  const cleanUrl = normalizePublicInviteUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  if (!opts.campaignId || !opts.userId) return cleanUrl;

  const params = new URLSearchParams({
    url: cleanUrl,
    cid: opts.campaignId,
    uid: opts.userId,
    ph: opts.phone.replace(/\D/g, ''),
    btn: opts.label,
    flow: opts.campaignName || 'Campanha',
    src: 'campaign',
  });

  if (opts.sendId) params.set('cs', opts.sendId);

  return cleanUrl.includes('go.zaplynxpro.online/invite/') ? cleanUrl : `${PUBLIC_TRACKING_URL}?${params.toString()}`;
};

const isConfirmedRateLimitHit = (payload: any, errorMessage?: string | null, httpStatus?: number) => {
  const hasRateLimitPayload = isWhatsAppRateLimitError(payload, httpStatus);
  if (!hasRateLimitPayload) return false;

  const message = String(errorMessage || '').toLowerCase();
  if (!message) return false;

  return (
    message.includes('temporary restriction') ||
    message.includes('temporarily restricted') ||
    message.includes('currently connected account is under a temporary restriction') ||
    message.includes('sending volume or quality') ||
    message.includes('rate limit') ||
    message.includes('rate-limit')
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

const parseCoordinate = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  const match = raw.match(/-?\d+(?:[\.,]\d+)?/);
  if (!match) return null;
  const normalized = match[0].replace(',', '.');
  const coordinate = Number(normalized);
  return Number.isFinite(coordinate) ? String(coordinate) : null;
};

// Dispatch PIX/location/contact via Z-API native endpoints
const dispatchZapiSpecial = async (
  baseUrl: string,
  clientToken: string,
  phone: string,
  special: any,
  supabase?: any,
  userId?: string,
) => {
  let url = '';
  let body: Record<string, unknown> = {};
  
  // Normalize type
  const type = special.type === 'gateway_billing' ? 'gateway-billing' : special.type;

  if (type === 'pix' || type === 'gateway-billing' || type === 'request-payment' || type === 'pagamento') {
    const amountReais = Number(String(special.amount || special.pixAmount || '0.00').replace(',', '.'));
    const amountCents = Math.round(amountReais * 100);
    const description = String(special.description || special.text || special.pixDescription || special.paymentDescription || 'Pagamento').trim();
    const isGateway = special.pixSource === 'gateway' || special.paymentSource === 'gateway' || type === 'gateway-billing';
    
    let brCode = '';
    let qrCodeImage = '';

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
          console.log(`✅ [Gateway] Charge generated for ${phone}: ${brCode ? 'Copied code received' : 'No code received'}`);
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
      // If we have a gateway code, send it as a "Copy & Paste" button for better UX
      url = `${baseUrl}/send-button-otp`;
      body = {
        phone,
        message: description || 'Realize o pagamento via PIX:',
        code: brCode,
        footer: 'Clique abaixo para copiar o código PIX'
      };
    } else {
      // Fallback or manual PIX
      url = `${baseUrl}/send-button-pix`;
      const pixKey = String(special.pixKey || special.paymentReceiver || '').trim();
      const merchantName = String(special.merchantName || special.paymentReceiver || 'Pagamento').trim();
      const rawType = String(special.pixKeyType || 'cpf').toUpperCase();
      
      const typeMap: Record<string, string> = {
        TELEFONE: 'PHONE',
        CELULAR: 'PHONE',
        'E-MAIL': 'EMAIL',
        ALEATORIA: 'EVP',
        'ALEATÓRIA': 'EVP',
        RANDOM: 'EVP',
      };

      body = {
        phone,
        pixKey,
        type: typeMap[rawType] || rawType,
        merchantName,
        amount: amountReais || 0,
      };
    }
  } else if (type === 'localizacao' || type === 'uaz_location_button' || type === 'location' || type === 'location_button' || type === 'request-location') {
    url = `${baseUrl}/send-location`;
    const latitude = parseCoordinate(special.latitude || special.locLatitude);
    const longitude = parseCoordinate(special.longitude || special.locLongitude);
    if (!latitude || !longitude) {
      throw new Error('Template de localização com latitude/longitude inválidos');
    }
    const title = String(special.title || special.name || special.address || special.locTitle || 'Localização').trim();
    const address = String(special.address || special.description || special.locAddress || title).trim();
    body = {
      phone,
      title,
      address,
      latitude,
      longitude,
    };
  } else if (type === 'contato') {
    url = `${baseUrl}/send-contact`;
    body = {
      phone,
      contactName: special.contactName || '',
      contactPhone: String(special.contactPhone || '').replace(/\D/g, ''),
      ...(special.description ? { contactBusinessDescription: special.description } : {}),
    };
  } else if (type === 'uaz_status' || type === 'status' || (phone === 'status@broadcast')) {
    // WhatsApp Status (Stories) via Z-API
    const statusType = String(special.statusType || 'text').toLowerCase();
    if (statusType === 'image') {
      url = `${baseUrl}/send-status-image`;
      body = {
        image: special.media || special.image || '',
        ...(special.text ? { caption: special.text } : {}),
      };
    } else if (statusType === 'video') {
      url = `${baseUrl}/send-status-video`;
      body = {
        video: special.media || special.video || '',
        ...(special.text ? { caption: special.text } : {}),
      };
    } else {
      url = `${baseUrl}/send-status-text`;
      body = {
        message: special.text || special.message || '',
        ...(special.backgroundColor ? { backgroundColor: special.backgroundColor } : {}),
        ...(special.font !== undefined && special.font !== null ? { font: Number(special.font) || 1 } : {}),
      };
    }
  } else if (type === 'order-status' || type === 'status_pedido' || type === 'order_status') {
    url = `${baseUrl}/order-status-update`;
    body = {
      phone,
      orderStatus: special.orderStatus || 'PROCESSING',
      referenceId: special.referenceId || '',
      order: special.order || {},
    };
  } else if (type === 'order-payment' || type === 'pagamento_pedido' || type === 'order_payment') {
    url = `${baseUrl}/order-status-update`;
    body = {
      phone,
      paymentStatus: special.paymentStatus || 'PAID',
      referenceId: special.referenceId || '',
      order: special.order || {},
    };
  } else if (type === 'copia_cola' || type === 'copy_paste') {
    // Botão "Copiar Código" nativo do WhatsApp via endpoint Z-API /send-button-otp
    const code = String(special.copyText || special.code || '').trim();
    const message = String(special.description || special.text || '').trim() || ' ';
    url = `${baseUrl}/send-button-otp`;
    body = {
      phone,
      message,
      code,
    };
  }
  return { url, body };
};

const sendZapiLocationButtonFollowUp = async (
  baseUrl: string,
  clientToken: string,
  phone: string,
  special: any,
) => {
  const latitude = parseCoordinate(special.latitude || special.locLatitude);
  const longitude = parseCoordinate(special.longitude || special.locLongitude);
  const buttonUrl = String(special.url || (latitude && longitude ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : '')).trim();
  if (!buttonUrl) {
    return { ok: false, ack: null, error: 'Template de localização com botão sem URL do mapa', raw: null };
  }

  const normalizedUrl = /^https?:\/\//i.test(buttonUrl) ? buttonUrl : `https://${buttonUrl}`;
  const message = String(
    special.text ||
    special.description ||
    [special.name || special.title || special.locTitle, special.address || special.locAddress].filter(Boolean).join('\n') ||
    'Abrir localização no mapa'
  ).trim();
  const buttonLabel = String(special.buttonLabel || special.locButtonLabel || 'Ver no mapa').trim() || 'Ver no mapa';
  const body = {
    phone,
    message,
    buttonActions: [{ type: 'URL', label: buttonLabel, url: normalizedUrl }],
  };

  const res = await fetch(`${baseUrl}/send-button-actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try {
    const responseText = await res.text();
    if (responseText && responseText.trim()) data = JSON.parse(responseText);
  } catch {}

  const explicitError = getZapiExplicitError(data);
  const confirmed = isZapiConfirmed(data);
  console.log(`📍 Z-API location button follow-up for ${phone}: status=${res.status}, confirmed=${confirmed}, ack=${getZapiAckId(data) || 'none'}, body=${JSON.stringify(data).substring(0, 300)}`);
  if (!res.ok || explicitError || !confirmed) {
    return { ok: false, ack: null, error: explicitError || (!confirmed ? 'Z-API não confirmou o botão da localização' : `HTTP ${res.status}`), raw: data };
  }

  return { ok: true, ack: getZapiAckId(data), error: null, raw: data };
};

// Dispatch PIX/location/contact via UAZAPI native endpoints
const dispatchUazapiSpecial = async (
  instance: ResolvedInstance,
  phone: string,
  special: any,
  supabase?: any,
  userId?: string,
) => {
  const baseUrl = String(instance.uazapiUrl || '').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', token: String(instance.uazapiToken || '') };
  const targetNumber = getUazapiTargetNumber(phone);

  let endpoint = '';
  let body: Record<string, unknown> = {};

  // Normalize type
  const type = special.type === 'gateway_billing' ? 'gateway-billing' : special.type;

  if (type === 'pix' || type === 'gateway-billing' || type === 'request-payment' || type === 'pagamento') {
    const amountReais = Number(String(special.amount || special.pixAmount || '0.00').replace(',', '.'));
    const amountCents = Math.round(amountReais * 100);
    const description = String(special.description || special.text || special.pixDescription || special.paymentDescription || 'Pagamento').trim();
    const isGateway = special.pixSource === 'gateway' || special.paymentSource === 'gateway' || type === 'gateway-billing';
    
    let brCode = '';
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
        const chargeData = await chargeRes.json();
        brCode = chargeData?.brCode || "";
      } catch (e) {
        console.error("❌ [Gateway Uaz] Failed to generate charge:", e);
      }
    }

    if (type === 'pix') {
    endpoint = '/send/text';
    const pixLines = [
      `💰 *Cobrança PIX*`,
      special.merchantName ? `Recebedor: ${special.merchantName}` : '',
        amountReais ? `Valor: R$ ${amountReais}` : '',
        `Chave (${special.pixKeyType || 'pix'}): ${brCode || special.pixKey || ''}`,
      special.description ? `\n${special.description}` : '',
    ].filter(Boolean).join('\n');
    body = { number: targetNumber, text: pixLines };
    } else {
      endpoint = '/send/text';
      const pixKey = brCode || String(special.pixKey || special.paymentReceiver || '').trim();
      const merchant = String(special.merchantName || special.paymentReceiver || '').trim();
      
      const lines = [
        `💰 *Solicitação de Pagamento*`,
        merchant ? `Recebedor: ${merchant}` : '',
        amountReais ? `Valor: R$ ${amountReais}` : '',
        pixKey ? `Chave PIX: ${pixKey}` : '',
        description ? `\n${description}` : '',
      ].filter(Boolean).join('\n');
      
      body = { number: targetNumber, text: lines };
    }
  } else if (type === 'localizacao' || type === 'uaz_location_button' || type === 'location' || type === 'location_button' || type === 'request-location') {
    endpoint = '/send/location';
    body = {
      number: targetNumber,
      latitude: Number(special.latitude || special.locLatitude) || 0,
      longitude: Number(special.longitude || special.locLongitude) || 0,
      name: special.title || special.locTitle || '',
      address: special.address || special.locAddress || '',
    };
  } else if (type === 'contato') {
    endpoint = '/send/contact';
    body = {
      number: targetNumber,
      fullName: special.contactName || '',
      phoneNumber: String(special.contactPhone || '').replace(/\D/g, ''),
    };
  } else if (type === 'copia_cola' || type === 'copy_paste') {
    endpoint = '/send/text';
    const code = String(special.copyText || special.code || '').trim();
    const desc = String(special.description || special.text || '').trim();
    const txt = [desc, code ? `\n\`\`\`${code}\`\`\`` : ''].filter(Boolean).join('\n').trim() || code;
    body = { number: targetNumber, text: txt };
  }

  try {
    const res = await fetchUazapiWithRetry(`${baseUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const raw = await res.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    const explicitError = hasUazapiExplicitError(data);
    const confirmed = isUazapiSendConfirmed(data);
    console.log(`📬 Campaign UAZAPI special response for ${phone}: status=${res.status}, confirmed=${confirmed}, ack=${getUazapiAckId(data) || 'none'}, body=${JSON.stringify(data).substring(0, 300)}`);
    if (!res.ok || explicitError) {
      return { ok: false, ack: null, error: explicitError || `UAZAPI HTTP ${res.status}`, raw: data };
    }
    return { ok: true, ack: getUazapiAckId(data), error: null, raw: data };
  } catch (e) {
    return { ok: false, ack: null, error: e instanceof Error ? e.message : 'UAZAPI dispatch error', raw: null };
  }
};

const MAX_BATCH_SIZE = 50;
const MIN_BATCH_SIZE = 3;
const MAX_BATCH_RUNTIME_MS = 40_000;
const MAX_INTERACTIVE_BODY_CHARS = 1000;
const INTERACTIVE_FALLBACK_BODY = 'Escolha uma opção abaixo:';

const isInteractiveBodyTooLong = (message?: string | null) => String(message || '').length > MAX_INTERACTIVE_BODY_CHARS;

const getBatchSizeForDelay = (delayMs: number) => {
  const safeDelayMs = Number.isFinite(delayMs) ? Math.max(delayMs, 0) : 2000;
  const estimatedPerContactMs = Math.max(safeDelayMs + 2500, 3000);
  return Math.max(MIN_BATCH_SIZE, Math.min(MAX_BATCH_SIZE, Math.floor(MAX_BATCH_RUNTIME_MS / estimatedPerContactMs)));
};

const normalizeCampaignPhoneKey = (phone?: string | null) => {
  if (!phone) return '';
  return String(phone).replace(/@lid$/i, '').replace(/\D/g, '');
};

const getRemainingAudienceContacts = async (
  supabase: any,
  campaignId: string,
  targetContacts: SendCampaignRequest['contacts'],
) => {
  const acceptedPhones = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('campaign_sends')
      .select('phone, status')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'sent', 'delivered'])
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;
    for (const send of data) {
      const phoneKey = normalizeCampaignPhoneKey(send.phone);
      if (phoneKey) acceptedPhones.add(phoneKey);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const remaining = new Map<string, SendCampaignRequest['contacts'][number]>();
  for (const contact of targetContacts) {
    const phoneKey = normalizeCampaignPhoneKey(contact.phone);
    if (!phoneKey || acceptedPhones.has(phoneKey) || remaining.has(phoneKey)) continue;
    remaining.set(phoneKey, contact);
  }
  return Array.from(remaining.values());
};

// Best-effort fetch: retries on network errors and HTTP 5xx (UAZAPI server hiccups).
// Returns the final Response or throws on definitive network failure after all retries.
const fetchUazapiWithRetry = async (
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> => {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 500 : 1500));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 500 : 1500));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('UAZAPI fetch failed after retries');
};

// === UAZAPI dispatch helper ===
// Sends a campaign message via UAZAPI endpoints. Returns { ok, ack, error, raw }.
const dispatchUazapiCampaign = async (
  instance: ResolvedInstance,
  phone: string,
  template: any,
  fullMessage: string,
  opts: { viewOnce?: boolean; isPtv?: boolean; campaignId?: string; userId?: string; campaignName?: string },
) => {
  const baseUrl = String(instance.uazapiUrl || '').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', token: String(instance.uazapiToken || '') };
  if (!baseUrl || !headers.token) {
    return { ok: false, ack: null, error: 'UAZAPI URL/Token não configurados', raw: null };
  }

  const targetNumber = getUazapiTargetNumber(phone);

  const templateType = template?.type || 'texto';
  const hasMedia = template?.media_url && String(template.media_url).trim() !== '';
  const hasButtons = Array.isArray(template?.buttons) && template.buttons.length > 0;
  const hasListItems = Array.isArray(template?.list_items) && template.list_items.length > 0;
  const hasCarouselCards = Array.isArray(template?.carousel_cards) && template.carousel_cards.length > 0;
  const footerText = template?.footer ? String(template.footer) : '';

  let endpoint = '/send/text';
  let body: Record<string, unknown> = { number: targetNumber, text: fullMessage };

  // Wrap URL buttons with track-flow-click for click-tracking metrics
  const wrapUrlForTracking = (url: string, btnLabel: string) => {
    if (!opts.campaignId || !opts.userId) return normalizePublicInviteUrl(url);
    if (!/^https?:\/\//i.test(url)) return normalizePublicInviteUrl(url);
    const finalUrl = normalizePublicInviteUrl(url);
    const params = new URLSearchParams({
      url: finalUrl,
      cid: opts.campaignId,
      uid: opts.userId,
      ph: phone.replace(/\D/g, ''),
      btn: btnLabel,
      flow: opts.campaignName || 'Campanha',
      src: 'campaign',
    });
    return finalUrl.includes('go.zaplynxpro.online/invite/') ? finalUrl : `${PUBLIC_TRACKING_URL}?${params.toString()}`;
  };

  const buildChoices = (buttons: any[]) =>
    buttons.slice(0, 10).map((btn: any, idx: number) => {
      const label = String(btn?.text || btn?.label || `Opção ${idx + 1}`).trim();
      const t = String(btn?.type || 'url').toUpperCase();
      if ((t === 'URL' || t === 'COPY') && (btn?.url || btn?.value)) {
        let url = String(btn.url || btn.value);
        if (!url.startsWith('http')) url = 'https://' + url;
        if (t === 'URL') url = wrapUrlForTracking(url, label);
        return `${label}|${url}`;
      }
      if (t === 'CALL' && (btn?.phone || btn?.value)) return `${label}|${btn.phone || btn.value}`;
      return label;
    });

  if (hasMedia && (templateType === 'imagem' || templateType === 'imagem_botoes')) {
    endpoint = '/send/media';
    body = { number: targetNumber, type: 'image', file: template.media_url, ...(fullMessage ? { text: fullMessage } : {}) };
    if (hasButtons && templateType === 'imagem_botoes') {
      // Send image first, then buttons via /send/menu
      await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => null);
      endpoint = '/send/menu';
      body = { number: targetNumber, type: 'button', text: fullMessage || 'Selecione:', ...(footerText ? { footerText } : {}), choices: buildChoices(template.buttons) };
    }
  } else if (hasMedia && (templateType === 'video' || templateType === 'video_botoes')) {
    endpoint = '/send/media';
    body = { number: targetNumber, type: opts.isPtv ? 'ptv' : 'video', file: template.media_url, ...(fullMessage && !opts.isPtv ? { text: fullMessage } : {}), ...(opts.viewOnce ? { viewOnce: true } : {}) };
    if (hasButtons && templateType === 'video_botoes') {
      await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => null);
      endpoint = '/send/menu';
      body = { number: targetNumber, type: 'button', text: fullMessage || 'Selecione:', ...(footerText ? { footerText } : {}), choices: buildChoices(template.buttons) };
    }
  } else if (hasMedia && templateType === 'audio') {
    endpoint = '/send/media';
    body = { number: targetNumber, type: 'ptt', file: template.media_url };
  } else if (hasMedia && templateType === 'audio_botoes') {
    // UAZAPI: Send audio then menu
    endpoint = '/send/media';
    body = { number: targetNumber, type: 'ptt', file: template.media_url };
    await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => null);
    endpoint = '/send/menu';
    body = { number: targetNumber, type: 'button', text: fullMessage || 'Selecione:', ...(footerText ? { footerText } : {}), choices: buildChoices(template.buttons) };
  } else if (hasMedia && (templateType === 'documento' || templateType === 'arquivo')) {
    endpoint = '/send/media';
    body = { number: targetNumber, type: 'document', file: template.media_url, ...(fullMessage ? { text: fullMessage } : {}) };
  } else if (hasCarouselCards) {
    endpoint = '/send/carousel';
    const carousel = template.carousel_cards.map((card: any) => {
      const image = String(card?.image || '').trim();
      const text = [String(card?.title || '').trim(), String(card?.description || '').trim()]
        .filter(Boolean)
        .join('\n');
      const buttons = Array.isArray(card?.buttons)
        ? card.buttons.slice(0, 3).map((b: any, idx: number) => {
            const t = String(b?.type || 'REPLY').toUpperCase();
            const label = String(b?.text || b?.label || `Botão ${idx + 1}`).trim();
            let id = b?.id || label;
            if (t === 'URL' && (b?.value || b?.url)) id = b.value || b.url;
            if (t === 'CALL' && (b?.value || b?.phone)) id = b.value || b.phone;
            return { id: String(id).trim(), text: label, type: t };
          }).filter((b: any) => b.id && b.text)
        : [];
      return { text, image, buttons };
    });
    body = { number: targetNumber, text: fullMessage || '', carousel };
  } else if (hasListItems) {
    endpoint = '/send/menu';
    const choices = template.list_items.slice(0, 10).map((it: any, idx: number) =>
      String(it?.title || it?.label || it?.description || `Opção ${idx + 1}`).trim()
    );
    body = {
      number: targetNumber,
      type: 'list',
      text: fullMessage || 'Selecione uma opção:',
      ...(footerText ? { footerText } : {}),
      choices,
    };
  } else if (hasButtons) {
    endpoint = '/send/menu';
    body = { number: targetNumber, type: 'button', text: fullMessage || 'Selecione:', ...(footerText ? { footerText } : {}), choices: buildChoices(template.buttons) };
  }

  try {
    const res = await fetchUazapiWithRetry(`${baseUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const raw = await res.text();
    let data: any = {};
    try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    const explicitError = hasUazapiExplicitError(data);
    const confirmed = isUazapiSendConfirmed(data);
    console.log(`📬 Campaign UAZAPI response for ${phone} via ${instance.instanceName}: status=${res.status}, confirmed=${confirmed}, ack=${getUazapiAckId(data) || 'none'}, body=${JSON.stringify(data).substring(0, 300)}`);
    if (!res.ok || explicitError) {
      return { ok: false, ack: null, error: explicitError || `UAZAPI HTTP ${res.status}`, raw: data };
    }
    return { ok: true, ack: getUazapiAckId(data), error: null, raw: data };
  } catch (e) {
    return { ok: false, ack: null, error: e instanceof Error ? e.message : 'UAZAPI dispatch error', raw: null };
  }
};

const readDeviceConnectivity = (deviceStatus: any) => {
  const status = String(deviceStatus?.status || deviceStatus?.device?.status || '').toLowerCase();
  const connectedFlag = deviceStatus?.connected;
  const isConnected = connectedFlag === true ||
    (typeof connectedFlag === 'string' && connectedFlag.toLowerCase() === 'true') ||
    deviceStatus?.session === true ||
    deviceStatus?.smartphoneConnected === true ||
    deviceStatus?.device?.connected === true ||
    ['connected', 'open', 'online'].includes(status);

  const isExplicitlyDisconnected = !isConnected && (
    connectedFlag === false ||
    ['disconnected', 'close', 'closed'].includes(status)
  );

  return { connected: isConnected, explicitlyDisconnected: isExplicitlyDisconnected };
};

const fetchDeviceStatusSnapshot = async (instance: ResolvedInstance) => {
  try {
    // === Meta API status check (always connected if configured) ===
    if (instance.apiProvider === 'meta' || instance.zapiInstanceId?.startsWith("meta:")) {
      return { connected: true, explicitlyDisconnected: false, ok: true, raw: { provider: 'meta' } };
    }

    // === UAZAPI status check ===

    if (instance.apiProvider === 'uazapi' && instance.uazapiUrl && instance.uazapiToken) {
      const baseUrl = String(instance.uazapiUrl).replace(/\/+$/, '');
      const uazRes = await fetch(`${baseUrl}/instance/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', token: String(instance.uazapiToken) },
      });
      if (!uazRes.ok) {
        return { connected: false, explicitlyDisconnected: false, ok: false, raw: { error: `UAZAPI HTTP ${uazRes.status}` } };
      }
      const uazRaw = await uazRes.json().catch(() => ({}));
      const status = String(uazRaw?.instance?.status || uazRaw?.status || '').toLowerCase();
      const connected = status === 'connected' || status === 'open' || uazRaw?.connected === true || uazRaw?.loggedIn === true;
      const explicitlyDisconnected = !connected && (status === 'disconnected' || status === 'closed' || uazRaw?.connected === false);
      return { connected, explicitlyDisconnected, ok: true, raw: uazRaw };
    }

    const deviceStatusUrl = `https://api.z-api.io/instances/${instance.zapiInstanceId}/token/${instance.zapiToken}/status`;
    const deviceResponse = await fetch(deviceStatusUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapiClientToken },
    });

    if (!deviceResponse.ok) {
      return { connected: false, explicitlyDisconnected: false, ok: false, raw: { error: `HTTP ${deviceResponse.status}` } };
    }

    const raw = await deviceResponse.json();
    const connectivity = readDeviceConnectivity(raw);
    return { ...connectivity, ok: true, raw };
  } catch (error) {
    return { connected: false, explicitlyDisconnected: false, ok: false, raw: { error: error instanceof Error ? error.message : 'Unknown status error' } };
  }
};

const clearInstanceQueue = async (_instance: ResolvedInstance) => {
  // Intentionally disabled for campaigns: Z-API queue deletion removes messages
  // that are still waiting to be processed, which can drop group sends.
  return;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase configuration');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const reqPayload: SendCampaignRequest & { _directSendTemplateId?: string } = await req.json();
    const body = reqPayload;
    let { 
      campaignId, 
      contacts, 
      instanceId: requestedInstanceIdRaw, 
      rotationOffset: initialRotationOffset, 
      _isContinuation, 
      _userId,
      _directSendTemplateId 
    } = body;
    const rotationOffset = initialRotationOffset || 0;
    const requestedContacts = Array.isArray(contacts) ? contacts : [];

    // Fetch campaign data early to get the most up-to-date configuration from DB
    // This is critical to override old "zombie" re-invocations if the user changed settings
    let campaign: any = null;
    let campaignTemplate: any = null;
    if (!_directSendTemplateId && campaignId) {
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*, template:message_templates(*)')
        .eq('id', campaignId)
        .maybeSingle();
      
      if (campaignData) {
        campaign = campaignData;
        campaignTemplate = campaign.template;
        const sendConfig = campaign.target_audience?.__sendConfig;
        
        // If we have a persisted configuration in the database, it MUST take precedence
        // over the request body to ensure settings changes are respected globally immediately.
        if (sendConfig && (sendConfig.instanceId || sendConfig.rotateAll)) {
          console.log(`📋 [Config] Using persisted send configuration from DB for campaign ${campaignId}`);
          requestedInstanceIdRaw = sendConfig.instanceId || (sendConfig.rotateAll ? '__rotate_all__' : null);
        }
      }
    }

    let isRotateMode = requestedInstanceIdRaw === '__rotate_all__' || (typeof requestedInstanceIdRaw === 'string' && requestedInstanceIdRaw.startsWith('rotate:'));
    let requestedInstanceId = isRotateMode ? undefined : requestedInstanceIdRaw;

    if (!_directSendTemplateId && (!campaignId || requestedContacts.length === 0)) {
      return new Response(JSON.stringify({ error: 'Campaign ID and contacts are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }



    console.log(`🚀 Campaign ${campaignId}: ${requestedContacts.length} contacts to process (continuation: ${!!_isContinuation}, offset: ${rotationOffset}, mode: ${isRotateMode ? 'rotate' : 'single'}, target: ${requestedInstanceIdRaw || 'default'})`);

    // For continuations with _userId, resolve credentials directly via service role (no JWT needed)
    let credentials: CampaignCredentials;
    let forcedRequestedInstance: ResolvedInstance | null = null;
    let rotatePool: ResolvedInstance[] = [];

    if (_isContinuation && _userId) {
      console.log(`🔑 Continuation mode: resolving credentials for user ${_userId} via service role`);
      
      let continuationInstance = null;
      if (requestedInstanceId && requestedInstanceId !== '__rotate_all__') {
        continuationInstance = await resolveContactInstance(supabase, _userId, requestedInstanceId);
      }
      
      if (!continuationInstance && (!requestedInstanceId || requestedInstanceId === '__rotate_all__')) {
        continuationInstance = await resolvePreferredUserInstance(supabase, _userId);
      }
      
      if (!continuationInstance) {
        // Se ainda não encontrou e tem requestedInstanceId, tenta fallback z-api puro
        const { data: fallbackInst } = await supabase.from('zapi_instances').select('*').eq('user_id', _userId).eq('is_active', true).limit(1).maybeSingle();
        continuationInstance = fallbackInst ? mapResolvedInstance(fallbackInst) : null;
      }

      if (!continuationInstance) throw new Error('Instância ativa não encontrada para continuação');
      credentials = buildCampaignCredentials(_userId, continuationInstance);
    } else {
      const baseCredentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
      
      let preferredInstance = null;
      if (requestedInstanceId && requestedInstanceId !== '__rotate_all__') {
        preferredInstance = await resolveContactInstance(supabase, baseCredentials.userId, requestedInstanceId);
        if (!preferredInstance) {
          console.error(`❌ CRITICAL: Requested instance ${requestedInstanceId} could not be resolved!`);
        }
      }
      
      if (!preferredInstance && (!requestedInstanceId || requestedInstanceId === '__rotate_all__')) {
        preferredInstance = await resolvePreferredUserInstance(supabase, baseCredentials.userId);
      }

      credentials = preferredInstance
        ? buildCampaignCredentials(baseCredentials.userId, preferredInstance)
        : {
            instanceId: baseCredentials.instanceId,
            token: baseCredentials.token,
            clientToken: baseCredentials.clientToken,
            userId: baseCredentials.userId,
            instanceName: baseCredentials.instanceName,
            apiProvider: 'zapi',
            uazapiUrl: '',
            uazapiToken: '',
          };
      
      // If we are in rotate mode, and we have a preferred instance from getUserZAPICredentials, 
      // we still want to ensure it doesn't leak into forcedRequestedInstance.
      if (isRotateMode) {
        forcedRequestedInstance = null;
        console.log(`🔄 [Mode] Rotate Mode enabled for campaign ${campaignId}. Ignoring preferred instance for forced routing.`);
      }
    }

    let zapiInstanceId = credentials.instanceId;
    let zapiToken = credentials.token;
    let zapiClientToken = credentials.clientToken;

    // Use already defined isRotateMode
    // (forcedRequestedInstance and rotatePool are already declared above)


    if (!isRotateMode && credentials.instanceId) {
      forcedRequestedInstance = {
        zapiInstanceId: credentials.instanceId,
        zapiToken: credentials.token,
        zapiClientToken: credentials.clientToken,
        instanceName: credentials.instanceName,
        apiProvider: credentials.apiProvider,
        uazapiUrl: credentials.uazapiUrl,
        uazapiToken: credentials.uazapiToken,
      };
      console.log(`📍 [Mode] Single Instance mode: forcing all sends through ${credentials.instanceName} (${credentials.instanceId})`);
    }



    if (isRotateMode) {
      let query = supabase
        .from('zapi_instances')
        .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
        .eq('user_id', credentials.userId)
        .eq('is_active', true);

      if (typeof requestedInstanceIdRaw === 'string' && requestedInstanceIdRaw.startsWith('rotate:')) {
        const specificIds = requestedInstanceIdRaw.replace('rotate:', '').split(',').filter(Boolean);
        if (specificIds.length > 0) {
          console.log(`🎯 [Mode] Rotation restricted to ${specificIds.length} specific instances: ${specificIds.join(', ')}`);
          query = query.in('id', specificIds);
        } else {
          // Fallback to zapi-only if rotate: was empty
          query = query.or('api_provider.is.null,api_provider.eq.zapi');
        }
      } else {
        // For __rotate_all__, use ALL active instances for this user
        console.log(`🔄 [Mode] Rotating through all active instances for user ${credentials.userId}`);
      }


      const { data: allActiveInstances } = await query.order('created_at', { ascending: true });

      const rawRotatePool: ResolvedInstance[] = (allActiveInstances || [])
        .map((instance: any) => mapResolvedInstance(instance))
        .filter(Boolean) as ResolvedInstance[];

      const rotateStatuses = await Promise.all(
        rawRotatePool.map(async (instance) => ({
          instance,
          status: await fetchDeviceStatusSnapshot(instance),
        })),
      );

      rotatePool = rotateStatuses
        // Incluindo todas as instâncias selecionadas, mesmo que pareçam desconectadas,
        // para que o erro apareça no diálogo de envio ao invés de serem ignoradas silenciosamente.
        .map(({ instance }) => instance);


      const unavailableInstances = rotateStatuses
        .filter(({ status }) => !status.connected)
        .map(({ instance, status }) => `${instance.instanceName} (${status.ok ? 'desconectada' : 'status indisponível'})`);

      console.log(`🔄 Rotate mode: ${rawRotatePool.length} instances loaded, ${rotatePool.length} connected`);

      if (unavailableInstances.length > 0) {
        console.log(`⚠️ Rotate mode ignoring unavailable instances: ${unavailableInstances.join(', ')}`);
      }

      if (rotatePool.length === 0) {
        await supabase
          .from('campaigns')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', campaignId);

        return new Response(JSON.stringify({
          error: 'Nenhuma instância conectada disponível no modo rotativo. A campanha foi pausada.',
          stopped: true,
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    } else if (requestedInstanceId) {
      const specificInstance = await resolveContactInstance(supabase, credentials.userId, requestedInstanceId);

      // Modo instância única: usa EXCLUSIVAMENTE a instância selecionada.
      // Se ela não existir mais ou estiver desconectada, pausa a campanha
      // — nunca faz fallback para outra instância.
      if (!specificInstance) {
        console.log(`⏸️ Requested instance ${requestedInstanceId} not found. Pausing campaign (no fallback).`);
        await supabase
          .from('campaigns')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', campaignId)
          .eq('user_id', credentials.userId);
        return new Response(JSON.stringify({
          error: 'A conexão selecionada não foi encontrada. A campanha foi pausada. Reconecte o número selecionado e retome.',
          stopped: true,
          paused: true,
          reason: 'instance_not_found',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const status = await fetchDeviceStatusSnapshot(specificInstance);
      if (!status.connected && !(reqPayload as SendCampaignRequest).forceSend) {
        console.log(`⚠️ Selected instance ${specificInstance.instanceName} is offline. Proceeding to show errors in send logs.`);
      }

      if (!status.connected) {
        console.log(`⚠️ [Force] Selected instance ${specificInstance.instanceName} appears offline, but forceSend=true. Proceeding anyway.`);
      }

      forcedRequestedInstance = specificInstance;
      zapiInstanceId = specificInstance.zapiInstanceId;
      zapiToken = specificInstance.zapiToken;
      zapiClientToken = specificInstance.zapiClientToken;
      credentials.apiProvider = specificInstance.apiProvider || 'zapi';
      credentials.uazapiUrl = specificInstance.uazapiUrl || '';
      credentials.uazapiToken = specificInstance.uazapiToken || '';
      credentials.instanceName = specificInstance.instanceName;
    }

    const getInstanceForIndex = (index: number): ResolvedInstance => {
      if (isRotateMode && rotatePool.length > 0) {
        return rotatePool[(index + rotationOffset) % rotatePool.length];
      }
      return {
        zapiInstanceId,
        zapiToken,
        zapiClientToken,
        instanceName: credentials.instanceName,
        apiProvider: credentials.apiProvider || 'zapi',
        uazapiUrl: credentials.uazapiUrl || '',
        uazapiToken: credentials.uazapiToken || '',
      };
    };

    const queueContinuation = async (
      contactsToContinue: SendCampaignRequest['contacts'],
      processedInThisRun: number,
    ) => {
      if (!contactsToContinue.length) return true;

      const newRotationOffset = (rotationOffset + processedInThisRun) % (rotatePool.length || 1);

      try {
        const continuationPromise = fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            campaignId,
            contacts: contactsToContinue,
            instanceId: requestedInstanceIdRaw,
            rotationOffset: newRotationOffset,
            _isContinuation: true,
            _userId: credentials.userId,
          }),
        })
          .then(async (reInvokeResponse) => {
            if (!reInvokeResponse.ok) {
              const errorBody = await reInvokeResponse.text().catch(() => '');
              console.error(`❌ Re-invocation HTTP error: ${reInvokeResponse.status} ${errorBody}`);
            }
          })
          .catch((reError) => {
            console.error(`❌ Re-invocation failed:`, reError);
          });

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

    // Check campaign status or resolve direct template


    if (_directSendTemplateId) {
      const { data: directTpl, error: tplErr } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', _directSendTemplateId)
        .maybeSingle();

      if (tplErr || !directTpl) {
        throw new Error('Template not found for direct send');
      }
      
      campaignTemplate = directTpl;
      // Mock a campaign object for internal logic consistency
      campaign = {
        id: campaignId || `direct-${Date.now()}`,
        name: 'Envio Direto',
        status: 'active',
        user_id: credentials.userId,
        template_id: _directSendTemplateId,
        delay_seconds: 0
      };
    } else {
      // If we already fetched the campaign data during early config resolution, use it.
      // Otherwise fetch it now.
      if (!campaign) {
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select(`*, template:message_templates(*)`)
          .eq('id', campaignId)
          .eq('user_id', credentials.userId)
          .single();

        if (campaignError || !campaignData) {
          console.error(`❌ Campaign not found: ${campaignError?.message}`);
          throw new Error('Campaign not found');
        }
        campaign = campaignData;
      }

      if (campaign.status === 'paused' || campaign.status === 'completed' || campaign.status === 'cancelled') {
        console.log(`🛑 Campaign ${campaignId} is ${campaign.status}. Not processing.`);
        return new Response(JSON.stringify({ stopped: true, status: campaign.status, message: `Campaign is ${campaign.status}` }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      if (campaign.status === 'draft') {
        await supabase.from('campaigns').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', campaign.id).eq('user_id', credentials.userId);
      }
      
      campaignTemplate = campaign.template;
    }


    // Fallback for missing template relation - try fetching manually if needed
    if (!campaignTemplate && campaign.template_id) {
      console.log(`🔍 Campaign ${campaignId}: template relation missing, fetching template ${campaign.template_id} manually...`);
      const { data: manualTpl } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', campaign.template_id)
        .maybeSingle();

      if (manualTpl) {
        campaignTemplate = manualTpl;
      }
    }

    const campaignTargetContacts = _directSendTemplateId 
      ? requestedContacts 
      : (Array.isArray(campaign.target_audience?.contacts)
          ? campaign.target_audience.contacts.filter((contact: any) => Boolean(contact?.phone))
          : []);

    let existingSendsCount = 0;
    if (!_directSendTemplateId) {
      const { count } = await supabase
        .from('campaign_sends')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);
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

    // Determine if this is a flow-based campaign
    const isFlowCampaign = campaign.target_audience?.campaign_type === 'flow' && campaign.target_audience?.flow_id;
    const flowId = campaign.target_audience?.flow_id;

    if (!isFlowCampaign && !campaignTemplate) {
      console.error(`❌ Campaign ${campaignId}: template not found (ID: ${campaign.template_id})`);
      throw new Error('Campaign template not found');
    }

    const getBatchSizeForDelay = (delayMs: number) => {
      if (delayMs >= 20000) return 2; // Even smaller batch for very long delays
      if (delayMs >= 10000) return 4;
      if (delayMs >= 5000) return 8;
      return 15; // Slightly smaller default batch
    };

    const isGroupCampaign = campaign.target_audience?.type === 'groups' || campaign.target_audience?.mode === 'groups';
    // Respeita o delay configurado na campanha mesmo para grupos, se houver
    const delayMs = (campaign.delay_seconds || (isGroupCampaign ? 0 : 2)) * 1000;
    // For group campaigns, we allow a much larger batch size and faster processing
    const batchSize = isGroupCampaign ? 200 : getBatchSizeForDelay(delayMs);


    // Split contacts into current batch and remaining
    const currentBatch = executionContacts.slice(0, batchSize);
    const remainingContacts = executionContacts.slice(batchSize);

    console.log(`📦 Processing batch of ${currentBatch.length} contacts (batchSize=${batchSize}, delay=${delayMs}ms). Remaining: ${remainingContacts.length}`);

    // Check device connectivity before processing batch
    const firstInstance = getInstanceForIndex(0);
    try {
      const shouldPause = async () => {
        if (isRotateMode && rotatePool.length > 0) {
          const statuses = await Promise.all(rotatePool.map(async (inst) => ({ ...await fetchDeviceStatusSnapshot(inst), instanceName: inst.instanceName })));
          const allDown = statuses.length > 0 && statuses.every(s => s.ok && s.explicitlyDisconnected && !s.connected);
          if (!allDown) return false;
          await sleep(1500);
          const recheck = await Promise.all(rotatePool.map(async (inst) => ({ ...await fetchDeviceStatusSnapshot(inst) })));
          return recheck.length > 0 && recheck.every(s => s.ok && s.explicitlyDisconnected && !s.connected);
        }

        const first = await fetchDeviceStatusSnapshot(firstInstance);
        if (!first.ok || !first.explicitlyDisconnected || first.connected) return false;
        await sleep(1500);
        const second = await fetchDeviceStatusSnapshot(firstInstance);
        return second.ok && second.explicitlyDisconnected && !second.connected;
      };

      if (!(reqPayload as SendCampaignRequest).forceSend && await shouldPause()) {
        console.log(`⚠️ DISPOSITIVO DESCONECTADO! Mas continuando conforme nova diretriz de não trocar instância.`);
        // Removemos a pausa automática aqui para permitir que as falhas apareçam individualmente nos registros de envio,
        // conforme solicitado: "se o numero tiver algum bloqueio avisa mas nao troca a instancia".
      }

    } catch (e) {
      console.error('Device check error:', e);
    }

    // Normalize group phone IDs to use "-group" suffix (required by Z-API)
    const normalizeGroupPhone = (phone: string): string => {
      const isGroup = phone.includes('@g.us') || phone.includes('-group');
      if (!isGroup) return phone;
      const numericId = phone.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
      return numericId ? `${numericId}-group` : phone;
    };

    const isMissingMessageIdColumn = (error: any) => {
      const message = String(error?.message || error?.details || "").toLowerCase();
      return error?.code === "42703" ||
        error?.code === "PGRST204" ||
        (message.includes("message_id") && (message.includes("column") || message.includes("schema cache")));
    };

    const withoutMessageId = (recordWithMessageId: CampaignSendRecord) => {
      const { message_id: _messageId, ...recordWithoutMessageId } = recordWithMessageId;
      return recordWithoutMessageId;
    };

    const persistCampaignSend = async (record: CampaignSendRecord, existingId?: string | null): Promise<string | null> => {
      if (existingId) {
        const { error: updateError } = await supabase
          .from('campaign_sends')
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
          .eq('id', existingId);

        if (!updateError) return existingId;

        if (isMissingMessageIdColumn(updateError)) {
          const { error: retryUpdateError } = await supabase
            .from('campaign_sends')
            .update(withoutMessageId({
              phone: record.phone,
              contact_name: record.contact_name,
              message_content: record.message_content,
              status: record.status,
              sent_at: record.sent_at ?? null,
              delivered_at: record.delivered_at ?? null,
              error_message: record.error_message ?? null,
              user_id: record.user_id,
              instance_name: record.instance_name,
            } as CampaignSendRecord))
            .eq('id', existingId);

          if (!retryUpdateError) return existingId;
          console.error(`❌ Failed to update campaign_send ${existingId} without message_id for ${record.phone}:`, retryUpdateError.message);
        }

        console.error(`❌ Failed to update campaign_send ${existingId} for ${record.phone}:`, updateError.message);
      }

      const { data: inserted, error: insertError } = await supabase.from('campaign_sends').insert([record]).select('id').maybeSingle();
      if (insertError) {
        if (isMissingMessageIdColumn(insertError)) {
          const { data: retryInserted, error: retryInsertError } = await supabase.from('campaign_sends').insert([withoutMessageId(record)]).select('id').maybeSingle();
          if (!retryInsertError) return retryInserted?.id || null;
          console.error(`❌ Failed to insert campaign_send without message_id for ${record.phone}:`, retryInsertError.message);
        }
        console.error(`❌ Failed to insert campaign_send for ${record.phone}:`, insertError.message);
      }
      return inserted?.id || null;
    };

    // Process current batch
    const results = [];
    let rateLimitHitsInBatch = 0;
    let shouldStop = false;
    let stopReason = '';

    if (isGroupCampaign) {
      console.log(`🚀 Group campaign detected: processing ${currentBatch.length} groups in semi-parallel`);
      const CONCURRENCY = 5;
      for (let i = 0; i < currentBatch.length; i += CONCURRENCY) {
        const chunk = currentBatch.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (item, chunkIdx) => {
          const contactIdx = i + chunkIdx;
          const contact = { ...item, phone: normalizeGroupPhone(item.phone) };
          
          // CRITICAL FIX: FORCED REQUESTED INSTANCE MUST ALWAYS TAKE PRECEDENCE
          let currentInstance;
          if (forcedRequestedInstance && !isRotateMode) {
            currentInstance = forcedRequestedInstance;
          } else {
            // If contact has a source instance, check if it's acceptable
            const contactInst = await resolveContactInstance(supabase, credentials.userId, item.sourceInstanceId);
            
            // If we have a restricted rotation pool, ONLY use the contact's source if it belongs to that pool
            if (contactInst && isRotateMode && rotatePool.length > 0) {
              const isInPool = rotatePool.some(p => p.zapiInstanceId === contactInst.zapiInstanceId);
              if (isInPool) currentInstance = contactInst;
            }
            
            if (!currentInstance) {
              currentInstance = (isGroupDestination(contact.phone) ? await resolveGroupInstanceFromInboundLogs(supabase, credentials.userId, contact.phone) : null) || 
                                getInstanceForIndex(contactIdx);
            }
          }

          console.log(`🔍 [Decision] Contact ${contact.phone} (idx ${contactIdx}) will use instance: ${currentInstance.instanceName} (${currentInstance.zapiInstanceId}) [Method: ${(forcedRequestedInstance && !isRotateMode) ? 'Forced Selection' : (currentInstance.zapiInstanceId === item.sourceInstanceId ? 'Explicit Source' : (isGroupDestination(contact.phone) ? 'Group Auto-Detect' : (isRotateMode ? 'Rotation Mode' : 'Default')))}]`);


          const res = await processContact(contact, currentInstance, contactIdx, true);
          if (res?.stop) {
            shouldStop = true;
            stopReason = res.status || 'paused';
          }
        }));
        if (shouldStop) break;
        if (i + CONCURRENCY < currentBatch.length) await sleep(500);
      }
      if (shouldStop) {
        return new Response(JSON.stringify({ success: true, stopped: true, message: `Stopped: campaign ${stopReason}` }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } else {
      for (let i = 0; i < currentBatch.length; i++) {
        const contact = { ...currentBatch[i], phone: normalizeGroupPhone(currentBatch[i].phone) };
        
        // CRITICAL FIX: FORCED REQUESTED INSTANCE MUST ALWAYS TAKE PRECEDENCE
        let currentInstance;
        if (forcedRequestedInstance && !isRotateMode) {
          currentInstance = forcedRequestedInstance;
        } else {
          // If contact has a source instance, check if it's acceptable
          const contactInst = await resolveContactInstance(supabase, credentials.userId, currentBatch[i].sourceInstanceId);
          
          // If we have a restricted rotation pool, ONLY use the contact's source if it belongs to that pool
          if (contactInst && isRotateMode && rotatePool.length > 0) {
            const isInPool = rotatePool.some(p => p.zapiInstanceId === contactInst.zapiInstanceId);
            if (isInPool) currentInstance = contactInst;
          }
          
          if (!currentInstance) {
            currentInstance = (isGroupDestination(contact.phone) ? await resolveGroupInstanceFromInboundLogs(supabase, credentials.userId, contact.phone) : null) || 
                              getInstanceForIndex(i);
          }
        }

        console.log(`🔍 [Decision] Contact ${contact.phone} (idx ${i}) will use instance: ${currentInstance.instanceName} (${currentInstance.zapiInstanceId}) [Method: ${(forcedRequestedInstance && !isRotateMode) ? 'Forced Selection' : (currentInstance.zapiInstanceId === currentBatch[i].sourceInstanceId ? 'Explicit Source' : (isGroupDestination(contact.phone) ? 'Group Auto-Detect' : (isRotateMode ? 'Rotation Mode' : 'Default')))}]`);



        const res = await processContact(contact, currentInstance, i, false);
        if (res?.stop) {
          return new Response(JSON.stringify({ success: true, stopped: true, processed: i, message: `Stopped: campaign ${res.status || 'paused'}` }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (i < currentBatch.length - 1) {
          await sleep(delayMs);
        }
      }
    }

    // Helper function to encapsulate contact processing logic
    async function processContact(contact: any, currentInstance: ResolvedInstance, i: number, isParallel: boolean) {
      let campaignSend: CampaignSendRecord | undefined;
      let reusableSendId: string | null = null;

      try {
        const { data: statusCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
        if (statusCheck?.status === 'paused' || statusCheck?.status === 'cancelled' || statusCheck?.status === 'completed') {
          return { stop: true, status: statusCheck?.status };
        }

        const { data: existingSends } = await supabase.from('campaign_sends').select('id, status, created_at').eq('campaign_id', campaignId).eq('phone', contact.phone);
        const successfulForPhone = existingSends?.filter(s => s.status === 'delivered').length || 0;
        const pendingForPhone = existingSends?.filter(s => s.status === 'pending').length || 0;
        const phoneOccurrencesBefore = currentBatch.slice(0, i).filter((c: any) => c.phone === contact.phone).length;

        // Skip check if forceSend is enabled
        if (!(reqPayload as SendCampaignRequest).forceSend) {
          if (successfulForPhone > phoneOccurrencesBefore) {
            console.log(`⏭️ Skipping ${contact.phone} - already successfully sent in this campaign.`);
            results.push({ phone: contact.phone, success: true, messageId: 'already-sent' });
            return { stop: false };
          }
          if (pendingForPhone > phoneOccurrencesBefore) {
            console.log(`⏭️ Skipping ${contact.phone} - message is still pending callback.`);
            // No results.push here to keep it from appearing as a success in the UI stats
            // if it hasn't actually been sent yet in this run.
            return { stop: false };
          }

        } else {
          console.log(`🔄 [Force] Re-sending to ${contact.phone} even if already sent (forceSend=true).`);
        }


        const failedOnly = [...(existingSends || [])].filter(s => s.status === 'failed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        reusableSendId = failedOnly?.id || null;

        console.log(`🚀 [Dispatch] Executing send to ${contact.phone} via Z-API: ${currentInstance.instanceName} (${currentInstance.zapiInstanceId})`);

        if (isFlowCampaign && flowId) {
          campaignSend = { campaign_id: campaignId, phone: contact.phone, contact_name: contact.name, message_content: `[Fluxo: ${flowId}]`, status: 'pending', user_id: credentials.userId, instance_name: currentInstance.instanceName };
          try {
            const isMeta = currentInstance.apiProvider === 'meta' || currentInstance.zapiInstanceId?.startsWith("meta:");
            const webhookUrl = isMeta ? `${supabaseUrl}/functions/v1/webhook-meta` : `${supabaseUrl}/functions/v1/webhook-zapi`;
            const webhookPayload = { phone: contact.phone, instanceId: currentInstance.zapiInstanceId, __manual_flow_trigger__: true, flowId: flowId, body: { message: { text: { body: `__flow_trigger_${flowId}__` } } }, fromMe: false, __tagId__: campaign.target_audience?.tag_id };
            const flowResponse = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` }, body: JSON.stringify(webhookPayload) });

            if (flowResponse.ok) {
              campaignSend.status = 'pending';
              results.push({ phone: contact.phone, success: true, messageId: 'flow-triggered' });
            } else {
              campaignSend.status = 'failed';
              campaignSend.error_message = `Flow trigger failed: ${await flowResponse.text()}`;
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            }
          } catch (flowError) {
            campaignSend.status = 'failed';
            campaignSend.error_message = String(flowError);
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
          }
          await persistCampaignSend(campaignSend, reusableSendId);
          return { stop: false };
        }

        // === TEMPLATE-BASED CAMPAIGN ===
        let messageContent = normalizePublicRedirectUrlsInText(campaignTemplate.content);
        messageContent = messageContent.replace(/{nome}/g, contact.name || 'Cliente');
        messageContent = messageContent.replace(/{empresa}/g, 'Nossa Empresa');
        messageContent = messageContent.replace(/{data}/g, new Date().toLocaleDateString('pt-BR'));
        messageContent = messageContent.replace(/{hora}/g, new Date().toLocaleTimeString('pt-BR'));

        if (contact.variables) {
          Object.entries(contact.variables).forEach(([key, value]) => {
            messageContent = messageContent.replace(new RegExp(`{${key}}`, 'g'), value);
          });
        }

        let fullMessage = '';
        const isAudioWithMedia = (campaignTemplate.type === 'audio_imagem_botoes' || campaignTemplate.type === 'audio_video_botoes');
        if (campaignTemplate.header && !isAudioWithMedia) fullMessage += normalizePublicRedirectUrlsInText(campaignTemplate.header) + '\n\n';
        fullMessage += messageContent;
        if (campaignTemplate.footer) fullMessage += '\n\n' + normalizePublicRedirectUrlsInText(campaignTemplate.footer);

        console.log(`📝 [Content] Message for ${contact.phone}: ${fullMessage.slice(0, 100)}${fullMessage.length > 100 ? '...' : ''}`);


        // Construct a "visual" version for the message logs
        let visualContent = fullMessage;
        if (campaignTemplate.media_url) {
          const type = campaignTemplate.type?.split('_')[0] || 'image';
          visualContent = `[media:${type}:${campaignTemplate.media_url}]\n${visualContent}`;
        }
        if (campaignTemplate.buttons && Array.isArray(campaignTemplate.buttons) && campaignTemplate.buttons.length > 0) {
          const buttonLabels = campaignTemplate.buttons.map((b: any) => String(b.text || b.label || '').trim()).filter(Boolean);
          if (buttonLabels.length > 0) {
            visualContent += `\n\n[Botões: ${buttonLabels.join(' | ')}]`;
          }
        }

        campaignSend = {
          campaign_id: campaignId,
          phone: contact.phone,
          contact_name: contact.name,
          message_content: visualContent,
          status: 'pending',
          user_id: credentials.userId,
          instance_name: currentInstance.instanceName,
        };

        const templateType = campaignTemplate.type || 'texto';
        const hasButtons = campaignTemplate.buttons && Array.isArray(campaignTemplate.buttons) && campaignTemplate.buttons.length > 0;
        const hasMedia = campaignTemplate.media_url && campaignTemplate.media_url.trim() !== '';
        const hasCarouselCards = campaignTemplate.carousel_cards && Array.isArray(campaignTemplate.carousel_cards) && campaignTemplate.carousel_cards.length > 0;
        const campaignViewOnce = campaign.target_audience?.viewOnce === true;
        const campaignIsPtv = campaign.target_audience?.isPtv === true;
        const specialTpl = parseSpecialTemplate(campaignTemplate.content);

        const sanitizeCallPhone = (raw: string) => String(raw || '').replace(/\D+/g, '');

          const formatZapiButtons = (buttons: any[], sendId?: string | null) => buttons
          .map((btn: any, index: number) => {
            let btnType = String(btn?.type || 'url').toUpperCase();
            const label = String(btn?.text || btn?.label || `Botão ${index + 1}`).trim().slice(0, 20);
            
            const buttonData: any = {
              id: String(index + 1),
              type: 'URL',
              label,
            };

            if (btnType === 'COPY') {
              const code = String(btn?.copyText || btn?.value || '').trim();
              if (code) {
                btnType = 'URL';
                buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(code)}`;
              }
            }

            if (btnType === 'CALL') {
              const phone = sanitizeCallPhone(btn?.phone || btn?.value);
              if (!phone) return null;
              buttonData.type = 'CALL';
              buttonData.phone = phone;
            } else if (btnType === 'REPLY' || btnType === 'OPTION' || btnType === 'QUICK_REPLY') {
              buttonData.type = 'REPLY';
            } else {
              const rawUrl = btn?.url || btn?.value || '';
              const finalUrl = buildTrackedCampaignUrl(rawUrl || 'https://z-api.io', {
                campaignId,
                userId: credentials.userId,
                phone: contact.phone,
                label,
                campaignName: campaign?.name,
                sendId,
              });
              if (!finalUrl) return null;
              buttonData.type = 'URL';
              buttonData.url = finalUrl;
            }
            return buttonData;
          })
          .filter(Boolean);

        const buildZapiButtonActionPayload = (buttons: any[], message: string, sendId?: string | null) => {
          const formattedButtons = formatZapiButtons(buttons, sendId).slice(0, 3);
          // Envia TODOS os botões juntos (REPLY + URL + CALL) via /send-button-actions,
          // mantendo paridade com a página "Enviar Mensagem".
          return {
            message,
            buttonActions: formattedButtons.map((btn: any, idx: number) => ({ ...btn, id: String(idx + 1) })),
          };
        };

        const instId = currentInstance.zapiInstanceId;
        const instToken = currentInstance.zapiToken;
        const instClientToken = currentInstance.zapiClientToken;

        // === Meta API ROUTING (short-circuit) ===
        if (currentInstance.apiProvider === 'meta' || currentInstance.zapiInstanceId?.startsWith("meta:")) {
          const metaPhoneId = currentInstance.zapiInstanceId.startsWith("meta:") ? currentInstance.zapiInstanceId.split(":")[1] : currentInstance.zapiInstanceId;
          const metaCreds = await getMetaCredentials(supabase, credentials.userId, metaPhoneId);
          if (!metaCreds) throw new Error("Credenciais Meta não encontradas ou desconectadas.");

          const metaPayload = buildMetaPayload(campaignTemplate, fullMessage, contact.phone, campaignId, credentials.userId, campaign?.name);
          const metaResult = await sendMetaMessage(metaCreds as any, metaPayload, contact.phone);
          
          campaignSend.status = 'sent';
          campaignSend.sent_at = new Date().toISOString();
          const ackId = metaResult?.messages?.[0]?.id;
          if (ackId) campaignSend.message_id = String(ackId);
          results.push({ phone: contact.phone, success: true, messageId: ackId });
          
          await persistCampaignSend(campaignSend, reusableSendId);
          return { stop: false };
        }

        // === UAZAPI ROUTING (short-circuit) ===
        if (currentInstance.apiProvider === 'uazapi' && currentInstance.uazapiUrl && currentInstance.uazapiToken) {

          if (specialTpl) {
          const uazSpecial = await dispatchUazapiSpecial(currentInstance, contact.phone, specialTpl, supabase, credentials.userId);
            if (uazSpecial.ok) {
              campaignSend.status = 'sent';
              campaignSend.sent_at = new Date().toISOString();
              results.push({ phone: contact.phone, success: true, messageId: uazSpecial.ack });
              console.log(`📨 [UAZAPI] Sent ${contact.phone} via ${currentInstance.instanceName} (ack=${uazSpecial.ack || 'none'})`);
            } else {
              campaignSend.status = 'failed';
              campaignSend.error_message = uazSpecial.error || 'UAZAPI special envio falhou';
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            }
            await persistCampaignSend(campaignSend, reusableSendId);
            return { stop: false };
          }
          const uazResult = await dispatchUazapiCampaign(
            currentInstance,
            contact.phone,
            campaignTemplate,
            fullMessage,
            {
              viewOnce: campaignViewOnce,
              isPtv: campaignIsPtv,
              campaignId,
              userId: credentials.userId,
              campaignName: campaign?.name,
            },
          );

          if (uazResult.ok && !isLidIdentifier(contact.phone)) {
            campaignSend.status = 'sent';
            campaignSend.sent_at = new Date().toISOString();
            results.push({ phone: contact.phone, success: true, messageId: uazResult.ack });
            console.log(`📨 Sent ${contact.phone} via ${currentInstance.instanceName} (ack=${uazResult.ack || 'none'})`);
          } else {
            campaignSend.status = 'failed';
            campaignSend.error_message = uazResult.error || 'Envio não confirmado pelo WhatsApp';
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            console.log(`❌ Failed ${contact.phone}: ${campaignSend.error_message}`);

            const isShadowBan = isConfirmedRateLimitHit(uazResult.raw, campaignSend.error_message, undefined);
            if (isShadowBan && currentInstance.dbId) {
              await recordShadowBan(admin, currentInstance.dbId, JSON.stringify(uazResult.raw || { message: campaignSend.error_message }));
            }

            if (isShadowBan && !isLidIdentifier(contact.phone)) {
              rateLimitHitsInBatch += 1;
            } else {
              rateLimitHitsInBatch = 0;
            }

            if (rateLimitHitsInBatch >= 2) {
              console.log(`⚠️ Rate-limit detectado em ${campaignId}, mas configurado para continuar enviando.`);
              rateLimitHitsInBatch = 0;
            }
          }

          await persistCampaignSend(campaignSend, reusableSendId);
          return { stop: false };
        }
        // === END UAZAPI ROUTING ===

        let zapiUrl: string = '';
        let requestBody: any = {};
        const baseZapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}`;

        if (isLidIdentifier(contact.phone)) {
          console.log(`📞 [Z-API] Enviando @lid: ${contact.phone}`);
          // Para IDs @lid com nomes (ex: cliente\t123@lid), limpamos para o Z-API aceitar
          const cleanLid = contact.phone.split(/[\s\t]+/).pop() || contact.phone;
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
          const { url, body: specialBody } = await dispatchZapiSpecial(baseZapiUrl, instClientToken, contact.phone, specialTpl, supabase, credentials.userId);
          zapiUrl = url;
          requestBody = specialBody;

          // Se for um template especial (PIX, Localização, etc), enviamos e continuamos para o próximo contato
          // para evitar que os blocos de template genérico abaixo (hasButtons, send-text) sobrescrevam o requestBody.
          if (zapiUrl) {
            const zapiResponse = await fetch(zapiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken },
              body: JSON.stringify(requestBody),
            });

            let zapiResult: any = {};
            try {
              const responseText = await zapiResponse.text();
              if (responseText && responseText.trim()) zapiResult = JSON.parse(responseText);
            } catch {}

            const confirmed = isZapiConfirmed(zapiResult);
            const explicitError = getZapiExplicitError(zapiResult);
            console.log(`📬 [Special] Campaign Z-API response for ${contact.phone}: status=${zapiResponse.status}, confirmed=${confirmed}`);

            if ((zapiResponse.ok && !explicitError && confirmed) || (isLidIdentifier(contact.phone) && zapiResponse.ok)) {
              campaignSend.status = 'sent';
              campaignSend.sent_at = new Date().toISOString();
              const ackId = getZapiAckId(zapiResult);
              if (ackId) campaignSend.message_id = String(ackId);
              results.push({ phone: contact.phone, success: true, messageId: ackId });
            } else {
              campaignSend.status = 'failed';
              campaignSend.error_message = explicitError || (!confirmed ? 'Z-API não confirmou o envio especial' : `HTTP ${zapiResponse.status}`);
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            }
            
            await persistCampaignSend(campaignSend, reusableSendId);
            return { stop: false };
          }
        } else if (templateType === 'carrossel' && hasCarouselCards) {
          const carouselItems = campaignTemplate.carousel_cards.map((card: any, idx: number) => {
            const text = [card.title, card.description].filter((s: any) => s && String(s).trim() !== '').join('\n\n') || (card.text || '');
            const item: any = { text };
            if (card.image && String(card.image).trim() !== '') item.image = card.image;
            if (card.buttons && Array.isArray(card.buttons) && card.buttons.length > 0) {
              item.buttons = card.buttons.map((btn: any, bIdx: number) => {
                const btnType = String(btn.type || 'url').toUpperCase();
                const button: any = {
                  id: String(btn.id || `${idx}-${bIdx}`),
                  label: btn.text || btn.label || 'Abrir',
                };
                if (btnType === 'CALL') {
                  button.type = 'CALL';
                  button.phone = btn.phone || btn.value || '';
                } else if (btnType === 'REPLY' || btnType === 'OPTION') {
                  button.type = 'REPLY';
                } else {
                  button.type = 'URL';
                  button.url = buildTrackedCampaignUrl(btn.url || btn.value || 'https://z-api.io', {
                    campaignId,
                    userId: credentials.userId,
                    phone: contact.phone,
                    label: button.label || 'Abrir',
                    campaignName: campaign?.name,
                  });
                }
                return button;
              });
            }
            return item;
          });

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-carousel`;
          requestBody = {
            phone: contact.phone,
            message: fullMessage || ' ',
            carousel: carouselItems,
          };

          console.log('[send-campaign] Enviando carrossel Z-API:', JSON.stringify(requestBody));
          const carouselResponse = await fetch(zapiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, body: JSON.stringify(requestBody) });
          const carouselText = await carouselResponse.text();
          console.log('[send-campaign] Resposta carrossel Z-API:', carouselResponse.status, carouselText);
          if (!carouselResponse.ok) throw new Error(`Erro ao enviar carrossel: ${carouselText}`);

          campaignSend.status = 'sent';
          campaignSend.sent_at = new Date().toISOString();
          results.push({ phone: contact.phone, success: true, messageId: 'carousel-sent' });

          await persistCampaignSend(campaignSend, reusableSendId);
          return { stop: false };

         } else if (templateType === 'video_botoes' && hasMedia && hasButtons && !campaignIsPtv) {
          const hasActionButtons = (campaignTemplate.buttons || []).some((b: any) => ['CALL', 'URL', 'COPY'].includes(String(b.type || '').toUpperCase()));
          const zapiButtons = formatZapiButtons(campaignTemplate.buttons, reusableSendId);
          const hasActionButtonsInFormatted = zapiButtons.some((b: any) => b.type === 'URL' || b.type === 'CALL');


          if (!hasActionButtonsInFormatted) {
            const listEndpoint = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
            const listPayload = {
              phone: contact.phone,
              message: fullMessage || ' ',
              buttonList: {
                video: campaignTemplate.media_url,
                buttons: (campaignTemplate.buttons || []).slice(0, 3).map((b: any, idx: number) => ({
                  id: b.id || String(idx + 1),
                  label: String(b.text || b.label || `Botão ${idx + 1}`).trim().slice(0, 20)
                }))
              },
              ...(campaignViewOnce ? { viewOnce: true } : {})
            };

            console.log(`🎬 [Campaign] Attempting ${listEndpoint}`);
            const listResponse = await fetch(listEndpoint, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, 
              body: JSON.stringify(listPayload) 
            });

            if (listResponse.ok) {
              const result = await listResponse.json();
              campaignSend.status = 'sent';
              campaignSend.sent_at = new Date().toISOString();
              const ackId = getZapiAckId(result);
              if (ackId) campaignSend.message_id = String(ackId);
              results.push({ phone: contact.phone, success: true, messageId: ackId });
              await persistCampaignSend(campaignSend, reusableSendId);
              return { stop: false };
            }

            const errorBody = await listResponse.json().catch(() => ({}));
            if (listResponse.status !== 404 && errorBody.error !== 'NOT_FOUND') {
               throw new Error(`Erro ao enviar botões de lista (video): ${JSON.stringify(errorBody)}`);
            }
            
            console.log(`🔄 [Campaign] send-button-list not found, falling back to /send-button-actions`);
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
            const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage || ' ', reusableSendId);
            requestBody = { 
              phone: contact.phone, 
              ...buttonPayload, 
              video: campaignTemplate.media_url,
              ...(campaignViewOnce ? { viewOnce: true } : {})
            };
          } else {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
            const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage || ' ', reusableSendId);
            requestBody = { 
              phone: contact.phone, 
              ...buttonPayload, 
              video: campaignTemplate.media_url,
              ...(campaignViewOnce ? { viewOnce: true } : {})
            };
          }
        } else if (templateType === 'video_botoes' && hasMedia && hasButtons && campaignIsPtv) {
          // PTV must be sent separately as it's a special message type
          const ptvUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-ptv`;
          const ptvResponse = await fetch(ptvUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, body: JSON.stringify({ phone: contact.phone, ptv: campaignTemplate.media_url }) });
          if (!ptvResponse.ok) throw new Error(`Erro ao enviar PTV: ${await ptvResponse.text()}`);
          
          await sleep(Math.max(delayMs / 2, 1000));
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage, reusableSendId);
          requestBody = { phone: contact.phone, ...buttonPayload };

        } else if ((templateType === 'audio_botoes' || templateType === 'audio_imagem_botoes' || templateType === 'audio_video_botoes') && hasMedia && hasButtons) {
          // Z-API não suporta áudio + botões em uma única chamada.
          // Enviamos áudio primeiro e depois os botões com a mensagem.
          const audioUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-audio`;
          const audioResponse = await fetch(audioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken },
            body: JSON.stringify({ phone: contact.phone, audio: campaignTemplate.media_url, waveform: true }),
          });
          if (!audioResponse.ok) throw new Error(`Erro ao enviar áudio: ${await audioResponse.text()}`);

          // Delay maior para garantir ordem e evitar sobrecarga na instância
          await sleep(Math.max(delayMs / 2, 2500));

          // Extract secondary media
          const secondaryFromCarousel = Array.isArray(campaignTemplate.carousel_cards) && campaignTemplate.carousel_cards[0]?.id === 'secondary'
            ? campaignTemplate.carousel_cards[0].image
            : null;
          
          const secondaryUrl = secondaryFromCarousel || (campaignTemplate.header?.startsWith('http') ? campaignTemplate.header : null);
          const headerTitle = secondaryFromCarousel ? campaignTemplate.header : (!campaignTemplate.header?.startsWith('http') ? campaignTemplate.header : undefined);
          const zapiButtons = formatZapiButtons(campaignTemplate.buttons, reusableSendId);
          const hasActionButtonsInFormatted = zapiButtons.some((b: any) => b.type === 'URL' || b.type === 'CALL');

          const sType = templateType === 'audio_video_botoes' ? 'video' : 'image';

          console.log(`🎬 [Campaign] Composite secondary media debug: url=${secondaryUrl}, type=${sType}, title=${headerTitle}`);

          if (secondaryUrl && !hasActionButtonsInFormatted && (sType === 'image' || sType === 'video')) {
            const listEndpoint = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
            const listPayload: any = {
              phone: contact.phone,
              message: fullMessage || ' ',
              buttonList: {
                [sType]: secondaryUrl,
                buttons: (campaignTemplate.buttons || []).slice(0, 3).map((b: any, idx: number) => ({
                  id: b.id || String(idx + 1),
                  label: String(b.text || b.label || `Botão ${idx + 1}`).trim().slice(0, 20)
                }))
              }
            };

            console.log(`🎬 [Campaign] Attempting composite ${listEndpoint}`);
            const listResponse = await fetch(listEndpoint, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, 
              body: JSON.stringify(listPayload) 
            });

            if (listResponse.ok) {
              const result = await listResponse.json();
              if (isZapiConfirmed(result)) {
                campaignSend.status = 'sent';
                campaignSend.sent_at = new Date().toISOString();
                const ackId = getZapiAckId(result);
                if (ackId) campaignSend.message_id = String(ackId);
                results.push({ phone: contact.phone, success: true, messageId: ackId });
                await persistCampaignSend(campaignSend, reusableSendId);
                return { stop: false };
              }
              console.log(`⚠️ [Campaign] ${listEndpoint} não confirmou envio (confirmed=false)`);
            } else {
              const errorBody = await listResponse.json().catch(() => ({}));
              if (listResponse.status !== 404 && errorBody.error !== 'NOT_FOUND') {
                console.warn(`⚠️ [Campaign] Erro ao enviar composite list layout: ${JSON.stringify(errorBody)}`);
              }
            }
          }

          // Fallback para send-button-actions (mais estável para vídeos compostos)
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage || ' ', reusableSendId);
          requestBody = { 
            phone: contact.phone, 
            ...buttonPayload,
            ...(headerTitle ? { title: headerTitle } : {})
          };

          if (secondaryUrl) {
            requestBody[sType] = secondaryUrl;
          }

        } else if (templateType === 'imagem_botoes' && hasMedia && hasButtons) {
          const zapiButtons = formatZapiButtons(campaignTemplate.buttons, reusableSendId);
          const hasActionButtonsInFormatted = zapiButtons.some((b: any) => b.type === 'URL' || b.type === 'CALL');

          
          if (!hasActionButtonsInFormatted) {
            const listEndpoint = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
            const listPayload = {
              phone: contact.phone,
              message: fullMessage || ' ',
              buttonList: {
                image: campaignTemplate.media_url,
                buttons: (campaignTemplate.buttons || []).slice(0, 3).map((b: any, idx: number) => ({
                  id: b.id || String(idx + 1),
                  label: String(b.text || b.label || `Botão ${idx + 1}`).trim().slice(0, 20)
                }))
              }
            };

            console.log(`🎬 [Campaign] Attempting ${listEndpoint}`);
            const listResponse = await fetch(listEndpoint, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, 
              body: JSON.stringify(listPayload) 
            });

            if (listResponse.ok) {
              const result = await listResponse.json();
              campaignSend.status = 'sent';
              campaignSend.sent_at = new Date().toISOString();
              const ackId = getZapiAckId(result);
              if (ackId) campaignSend.message_id = String(ackId);
              results.push({ phone: contact.phone, success: true, messageId: ackId });
              await persistCampaignSend(campaignSend, reusableSendId);
              return { stop: false };
            }

            const errorBody = await listResponse.json().catch(() => ({}));
            if (listResponse.status !== 404 && errorBody.error !== 'NOT_FOUND') {
               throw new Error(`Erro ao enviar botões de lista (image): ${JSON.stringify(errorBody)}`);
            }
            
            console.log(`🔄 [Campaign] send-button-list not found, falling back to /send-button-actions`);
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
            const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage || ' ', reusableSendId);
            requestBody = { 
              phone: contact.phone, 
              ...buttonPayload, 
              image: campaignTemplate.media_url 
            };
          } else {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
            const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage || ' ', reusableSendId);
            requestBody = { 
              phone: contact.phone, 
              ...buttonPayload, 
              image: campaignTemplate.media_url 
            };
          }
        } else if (templateType === 'imagem') {
          if (!hasMedia) throw new Error('Template tipo "imagem" requer uma imagem');
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-image`;
          requestBody = { phone: contact.phone, image: campaignTemplate.media_url, caption: fullMessage };

        } else if (templateType === 'video') {
          if (!hasMedia) throw new Error('Template tipo "video" requer um vídeo');
          if (campaignIsPtv) {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-ptv`;
            requestBody = { phone: contact.phone, ptv: campaignTemplate.media_url };
          } else {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-video`;
            const videoUrl = campaignTemplate.media_url;
            console.log(`🎬 Enviando vídeo para ${contact.phone}: ${videoUrl}`);
            requestBody = { phone: contact.phone, video: videoUrl, caption: fullMessage, ...(campaignViewOnce ? { viewOnce: true } : {}) };
          }

        } else if (templateType === 'audio') {
          if (!hasMedia) throw new Error('Template tipo "audio" requer um áudio');
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-audio`;
          requestBody = { phone: contact.phone, audio: campaignTemplate.media_url, waveform: true };

        } else if (templateType === 'status') {
          // Postar no Status (Stories) do próprio WhatsApp logado (Z-API)
          const statusType = String((campaignTemplate as any).status_type || 'text').toLowerCase();
          if (statusType === 'image') {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-status-image`;
            requestBody = { image: campaignTemplate.media_url, caption: fullMessage };
          } else if (statusType === 'video') {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-status-video`;
            requestBody = { video: campaignTemplate.media_url, caption: fullMessage };
          } else {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-status-text`;
            requestBody = { message: fullMessage };
          }
          // Forçar destino como status@broadcast para o Z-API
          requestBody.phone = 'status@broadcast';

        } else if (templateType === 'documento' || templateType === 'arquivo') {
          if (!hasMedia) throw new Error(`Template tipo "${templateType}" requer um arquivo`);
          // Determinar extensão a partir do file_type (mime) ou da própria URL
          const mimeExt = campaignTemplate.file_type?.split('/').pop()?.toLowerCase();
          const urlExt = String(campaignTemplate.media_url || '')
            .split('?')[0]
            .split('#')[0]
            .split('.')
            .pop()
            ?.toLowerCase();
          const extension = (mimeExt && mimeExt !== 'octet-stream' ? mimeExt : urlExt) || 'pdf';
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-document/${extension}`;
          requestBody = {
            phone: contact.phone,
            document: campaignTemplate.media_url,
            fileName: campaignTemplate.file_name || `documento.${extension}`,
            caption: fullMessage,
          };

        } else if (templateType === 'imagem_lista_opcao' && hasMedia) {
          const rawItems = Array.isArray(campaignTemplate.list_items)
            ? campaignTemplate.list_items
            : (Array.isArray((campaignTemplate as any).listItems) ? (campaignTemplate as any).listItems : []);
          const cleanItems = rawItems
            .filter((it: any) => it && String(it.title || '').trim() !== '')
            .slice(0, 10)
            .map((it: any, idx: number) => ({
              title: String(it.title).trim(),
              description: String(it.description || '').trim(),
              rowId: String(it.id || `opt_${idx + 1}`),
            }));
          
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-list`;
          requestBody = {
            phone: contact.phone,
            message: fullMessage || ' ',
            image: campaignTemplate.media_url,
            buttonList: {
              title: campaignTemplate.header || '',
              buttonLabel: 'Ver opções',
              options: cleanItems,
            },
          };
        } else if (templateType === 'lista_opcao' || templateType === 'lista' || templateType === 'lista de opção') {
          const rawItems = Array.isArray(campaignTemplate.list_items)
            ? campaignTemplate.list_items
            : (Array.isArray((campaignTemplate as any).listItems) ? (campaignTemplate as any).listItems : []);
          const cleanItems = rawItems
            .filter((it: any) => it && String(it.title || '').trim() !== '')
            .slice(0, 10)
            .map((it: any, idx: number) => ({
              title: String(it.title).trim(),
              description: String(it.description || '').trim(),
              rowId: String(it.id || `opt_${idx + 1}`),
            }));
          if (cleanItems.length === 0) throw new Error('Template tipo "lista" requer pelo menos um item');

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-option-list`;
          requestBody = {
            phone: contact.phone,
            message: fullMessage || ' ',
            optionList: {
              title: campaignTemplate.header || '',
              buttonLabel: 'Ver opções',
              options: cleanItems,
            },
          };

        } else if (hasButtons) {
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          const buttonPayload = buildZapiButtonActionPayload(campaignTemplate.buttons, fullMessage, reusableSendId);
          requestBody = { phone: contact.phone, ...buttonPayload };

        } else {
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-text`;
          requestBody = { phone: contact.phone, message: fullMessage };
        }

        if (zapiUrl) {
          if (zapiUrl.endsWith('/send-button-actions') && requestBody?._useButtonList) {
            zapiUrl = `${baseZapiUrl}/send-button-list`;
            delete requestBody._useButtonList;
            console.log(`📌 Enviando respostas rápidas por lista de botões para melhor renderização no WhatsApp.`);
          }

          const tagId = campaign.target_audience?.tag_id;
          if (tagId && tagId !== 'none' && !isGroupDestination(contact.phone)) {
            try {
              console.log(`🏷️ Applying tag ${tagId} to ${contact.phone}`);
              const tagUrl = `${baseZapiUrl}/add-tag-chat`;
              await fetch(tagUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken },
                body: JSON.stringify({ phone: contact.phone, tagId }),
              });
            } catch (tagErr) {
              console.error(`⚠️ Failed to apply tag to ${contact.phone}:`, tagErr);
            }
          }

          // [DEBUG] Log the actual URL and payload being sent to Z-API
          console.log(`🚀 [Dispatch] Z-API URL: ${zapiUrl}`);
          console.log(`📦 [Dispatch] Z-API Payload: ${JSON.stringify({ ...requestBody, phone: contact.phone })}`);

          const zapiResponse = await fetch(zapiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken },
            body: JSON.stringify(requestBody),
          });


          let zapiResult: any = {};
          try {
            const responseText = await zapiResponse.text();
            if (responseText && responseText.trim()) zapiResult = JSON.parse(responseText);
          } catch {}

          const explicitError = getZapiExplicitError(zapiResult);
          const confirmed = isZapiConfirmed(zapiResult);
          const messageIdFromResponse = getZapiAckId(zapiResult);
          
          console.log(`📬 Campaign Z-API response for ${contact.phone} via ${currentInstance.instanceName}: status=${zapiResponse.status}, confirmed=${confirmed}, ack=${messageIdFromResponse || 'none'}`);

          // Para identificadores @lid, forçamos o status 'sent' se o HTTP for 200,
          // ignorando erros internos da API ou falta de confirmação imediata.
          if (zapiResponse.ok && (isLidIdentifier(contact.phone) || (!explicitError && confirmed))) {
            const isLocationButton = specialTpl?.type === 'uaz_location_button' || 
                                   specialTpl?.type === 'location_button' || 
                                   specialTpl?.type === 'request-location';
            
            if (isLocationButton) {
              await sleep(Math.max(1000, Math.min(delayMs / 2, 3000)));
              const buttonResult = await sendZapiLocationButtonFollowUp(baseZapiUrl, instClientToken, contact.phone, specialTpl);
              if (!buttonResult.ok) {
                campaignSend.status = 'failed';
                campaignSend.error_message = buttonResult.error || 'Falha ao enviar botão da localização';
                results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
                console.log(`❌ Failed location button follow-up ${contact.phone}: ${campaignSend.error_message}`);
                await persistCampaignSend(campaignSend, reusableSendId);
                return { stop: false };
              }
            }

            campaignSend.status = 'sent';
            campaignSend.sent_at = new Date().toISOString();
            const ackId = getZapiAckId(zapiResult);
            if (ackId) campaignSend.message_id = String(ackId);
            results.push({ phone: contact.phone, success: true, messageId: ackId });
            console.log(`📨 Sent for ${contact.phone} after accepted send`);
          } else if (!zapiResponse.ok || (explicitError && !isLidIdentifier(contact.phone)) || (!confirmed && !isLidIdentifier(contact.phone))) {

            const isShadowBan = explicitError && (
              explicitError.toLowerCase().includes("shadow ban") || 
              explicitError.toLowerCase().includes("restricted") || 
              explicitError.toLowerCase().includes("unauthorized") ||
              explicitError.toLowerCase().includes("capping")
            );
            
            if (isShadowBan && currentInstance.dbId) {
              await recordShadowBan(admin, currentInstance.dbId, JSON.stringify(zapiResult));
            }

            campaignSend.status = 'failed';
            campaignSend.error_message = isShadowBan 
              ? "Shadow Ban detectado: Seu número WhatsApp está com restrições de envio ou desconectado da API."
              : (explicitError || (!confirmed ? 'WhatsApp não confirmou o envio (possível shadow ban ou número inválido)' : `HTTP ${zapiResponse.status}`));
            
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            console.log(`❌ Failed ${contact.phone}: ${campaignSend.error_message}`);

            // 🚨 WhatsApp rate-limit (error 463 / temporary restriction):
            // pause the campaign immediately so the remaining contacts stay
            // pending and can be resumed later when the account recovers.
            // 🚨 WhatsApp rate-limit (error 463 / temporary restriction):
            if (isConfirmedRateLimitHit(zapiResult, campaignSend.error_message, zapiResponse.status) && !isLidIdentifier(contact.phone)) {
              rateLimitHitsInBatch += 1;
            } else {
              rateLimitHitsInBatch = 0;
            }

            if (rateLimitHitsInBatch >= 2 && !(reqPayload as SendCampaignRequest).forceSend) {
              console.log(`🚨 Rate-limit detectado e persistente em ${campaignId}. Pausando campanha para proteção.`);
              await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
              return { stop: true, status: 'paused' };
            } else if (rateLimitHitsInBatch >= 2 && (reqPayload as SendCampaignRequest).forceSend) {
              console.log(`⚠️ Rate-limit detectado mas ignorado devido ao forceSend=true.`);
              rateLimitHitsInBatch = 0;
            }

            // Mid-batch disconnection detection desabilitado a pedido do usuário:
            // continuar tentando os próximos contatos mesmo após falha.
          }
        }

      } catch (error) {
        console.error(`❌ Error processing ${contact.phone}:`, error);
        if (!campaignSend) {
          campaignSend = {
            campaign_id: campaignId, phone: contact.phone, contact_name: contact.name,
            message_content: 'Error processing message', status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            user_id: credentials.userId, instance_name: currentInstance.instanceName,
          };
        } else {
          campaignSend.status = 'failed';
          campaignSend.error_message = error instanceof Error ? error.message : 'Unknown error';
        }
        results.push({ phone: contact.phone, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }

      // Persist campaign_send record immediately after each contact
      if (campaignSend) {
        // Safety check: if we finished processing but it's still pending, mark as failed
        // unless it's a flow trigger or some other async process.
        if (campaignSend.status === 'pending' && !isFlowCampaign) {
          console.log(`⚠️ Contact ${contact.phone} was left as pending. Marking as failed for safety.`);
          campaignSend.status = 'failed';
          campaignSend.error_message = campaignSend.error_message || 'Erro desconhecido durante o processamento (timeout ou resposta vazia)';
        }
        await persistCampaignSend(campaignSend, reusableSendId);
      }

      return { stop: false };
    }


    // If there are remaining contacts, schedule continuation
    if (remainingContacts.length > 0) {
      // Re-check campaign status before continuing
      const { data: continueCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
      if (continueCheck?.status === 'paused' || continueCheck?.status === 'cancelled' || continueCheck?.status === 'completed') {
        console.log(`🛑 Campaign ${campaignId} is ${continueCheck?.status}. Not continuing with remaining ${remainingContacts.length} contacts.`);
        return new Response(JSON.stringify({
          success: true,
          stopped: true,
          processed: currentBatch.length,
          remaining: remainingContacts.length,
          message: `Stopped: campaign ${continueCheck?.status}`,
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      console.log(`🔄 Re-invoking for remaining ${remainingContacts.length} contacts...`);

      const continuationSuccess = await queueContinuation(remainingContacts, currentBatch.length);
      if (!continuationSuccess) {
        // Retry once after 2s
        console.log(`⚠️ Re-invocation failed. Retrying in 2s...`);
        await sleep(2000);
        const retrySuccess = await queueContinuation(remainingContacts, currentBatch.length);
        if (!retrySuccess) {
          console.error(`❌ Re-invocation failed after retry. Campaign ${campaignId} stuck with ${remainingContacts.length} remaining contacts.`);
          // Do NOT mark as completed - leave as active so it can be retried
        }
      }
    } else {
      // Last batch finished - check if ALL contacts from the audience were actually processed
      const totalTargetContacts = campaignTargetContacts.length;
      const [processedRes, awaitingCallbackRes, successRes] = await Promise.all([
        supabase
          .from('campaign_sends')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId),
        supabase
          .from('campaign_sends')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .eq('status', 'pending'),
        supabase
          .from('campaign_sends')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .in('status', ['delivered', 'sent']),
      ]);

      const totalProcessed = processedRes.count ?? 0;
      const awaitingCallbackCount = awaitingCallbackRes.count ?? 0;
      const actualDeliveries = successRes.count ?? 0;

      // STRICT completion check: only complete if processed >= target audience
      // If target audience is 0 (edge case), use the current batch as reference
      const effectiveTarget = totalTargetContacts > 0 ? totalTargetContacts : totalProcessed;

      if (totalTargetContacts > 0) {
        // Still missing accepted contacts - DO NOT mark as completed.
        // Use phone keys instead of array position so stalled/duplicate batches resume the real remainder.
        const missingContacts = await getRemainingAudienceContacts(supabase, campaignId, campaignTargetContacts);
        if (missingContacts.length > 0) {
          console.log(`⚠️ Campaign ${campaignId}: blocking completion because ${missingContacts.length}/${totalTargetContacts} contacts are still not accepted. Re-invoking missing contacts.`);

          const continuationSuccess = await queueContinuation(missingContacts, currentBatch.length);
          if (!continuationSuccess) {
            await sleep(2000);
            const retrySuccess = await queueContinuation(missingContacts, currentBatch.length);
            if (!retrySuccess) {
              console.error(`❌ Failed to re-invoke missing contacts for campaign ${campaignId}. ${missingContacts.length} contacts not processed.`);
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Missing contacts queued before completion',
            campaignId,
            processed: currentBatch.length,
            remaining: missingContacts.length,
            results,
          }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }

      if (totalProcessed === 0) {
        console.log(`⚠️ Campaign ${campaignId}: ${totalProcessed} processed. Pausing instead of completing.`);
        await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
      } else if (awaitingCallbackCount > 0) {
        console.log(`⏳ Campaign ${campaignId}: ${awaitingCallbackCount} message(s) still waiting real WhatsApp delivery callback. Keeping active.`);
      } else if (actualDeliveries === 0 && !(reqPayload as SendCampaignRequest).forceSend) {
        console.log(`⚠️ Campaign ${campaignId}: 0 real deliveries confirmed. Pausing for safety.`);
        await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
      } else if (actualDeliveries < effectiveTarget && awaitingCallbackCount === 0 && !(reqPayload as SendCampaignRequest).forceSend) {
        console.log(`⚠️ Campaign ${campaignId}: only ${actualDeliveries}/${effectiveTarget} real deliveries confirmed. Pausing instead of completing.`);
        await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
      } else if (actualDeliveries < effectiveTarget && awaitingCallbackCount > 0) {
        console.log(`⏳ Campaign ${campaignId}: ${actualDeliveries}/${effectiveTarget} delivered, but ${awaitingCallbackCount} still pending callback. Keeping active.`);
      } else {
        console.log(`✅ Campaign ${campaignId}: ${actualDeliveries} delivered / ${totalProcessed} processed out of ${effectiveTarget} target. Marking as completed.`);
        const { data: finalCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
        if (finalCampaign?.status === 'active' || finalCampaign?.status === 'draft') {
          await supabase.from('campaigns').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', campaignId);
          console.log(`✅ Campaign ${campaignId} completed!`);
        }
      }
    }

    const sentCount = results.filter((result) => result.success).length;
    const failedCount = results.filter((result) => !result.success).length;

    return new Response(JSON.stringify({
      success: failedCount === 0,
      partial: sentCount > 0 && failedCount > 0,
      message: 'Batch processed',
      campaignId,
      processed: currentBatch.length,
      remaining: remainingContacts.length,
      sentCount,
      failedCount,
      results,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error(`💥 send-campaign error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
