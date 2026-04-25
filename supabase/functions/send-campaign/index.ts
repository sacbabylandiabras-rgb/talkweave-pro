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
  }>;
  instanceId?: string;
  rotationOffset?: number;
  _isContinuation?: boolean;
  _userId?: string; // Used by service-role re-invocations to bypass JWT auth
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
}

interface ResolvedInstance {
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

const mapResolvedInstance = (instance: {
  zapi_instance_id: string;
  zapi_token: string | null;
  zapi_client_token: string | null;
  instance_name: string | null;
  api_provider?: string | null;
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
} | null): ResolvedInstance | null => {
  if (!instance?.zapi_instance_id) return null;

  // Force Z-API for all campaign dispatches (UAZAPI deprecated for campaigns)
  const hasZapiCreds = Boolean(instance.zapi_instance_id && instance.zapi_token && instance.zapi_client_token);
  if (!hasZapiCreds) return null;

  return {
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
  const selectFields = 'zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key';

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

  let instance: {
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
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
    .eq('user_id', userId)
    .eq('zapi_instance_id', sourceInstanceId)
    .eq('is_active', true)
    .maybeSingle();

  instance = byZapiInstanceId;

  if (!instance) {
    const { data: byTableId } = await supabase
      .from('zapi_instances')
      .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
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
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
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
  // Force Z-API for all campaign dispatches
  const correctHasZapi = Boolean(correctInstanceRow?.zapi_instance_id && correctInstanceRow?.zapi_token && correctInstanceRow?.zapi_client_token);
  if (!correctHasZapi) {
    return null;
  }

  return {
    zapiInstanceId: correctInstanceRow.zapi_instance_id,
    zapiToken: correctInstanceRow.zapi_token || '',
    zapiClientToken: correctInstanceRow.zapi_client_token || '',
    instanceName: correctInstanceRow.instance_name || 'Instância',
    apiProvider: 'zapi',
    uazapiUrl: '',
    uazapiToken: '',
  };
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

const isZapiConfirmed = (payload: any) => {
  const ackId = getZapiAckId(payload);
  const status = String(payload?.status || payload?.message?.status || '').toUpperCase();
  const result = String(payload?.result || '').toUpperCase();
  // Status que indicam que a mensagem ficou apenas enfileirada (não entregue de fato)
  const queuedStatuses = ['PENDING', 'QUEUED', 'QUEUE', 'WAITING'];
  if (queuedStatuses.includes(status) || queuedStatuses.includes(result)) return false;
  // Exige um ack id real OU um status explícito de sucesso de envio
  const successStatuses = ['SENT', 'SUCCESS', 'OK', 'DELIVERED', 'RECEIVED'];
  return Boolean(ackId) || successStatuses.includes(status) || successStatuses.includes(result);
};
const isGroupDestination = (phone: string) => phone.includes('@g.us') || phone.includes('-group');
const isLidIdentifier = (phone?: string | null) => Boolean(phone && phone.includes('@lid') && !isGroupDestination(phone));

const SPECIAL_TEMPLATE_PREFIX = '__SPECIAL_TEMPLATE__:';

const getUazapiTargetNumber = (phone: string) => {
  if (isGroupDestination(phone)) {
    const numericGroup = phone.replace(/[@\-].*$/, '').replace(/\D/g, '');
    return numericGroup ? `${numericGroup}@g.us` : phone;
  }

  if (phone.includes('@lid')) return phone;

  return phone.replace(/^\+/, '').replace(/\D/g, '');
};

// For Z-API the phone field must contain only digits. When we have an @lid
// identifier we strip the suffix and send the raw numeric LID — Z-API will
// treat it as an unknown number and either deliver or return an error, but
// at least it won't be silently cancelled by our pre-validation.
const getZapiTargetPhone = (phone: string) => {
  if (!phone) return phone;
  if (isGroupDestination(phone)) return phone;
  if (phone.includes('@lid')) {
    return phone.split('@')[0].replace(/\D/g, '');
  }
  return phone.replace(/^\+/, '').replace(/\D/g, '') || phone;
};

const buildTrackedCampaignUrl = (url: string, opts: { campaignId: string; userId: string; phone: string; label: string; campaignName?: string | null }) => {
  const cleanUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  if (!supabaseUrl || !opts.campaignId || !opts.userId) return cleanUrl;

  const params = new URLSearchParams({
    url: cleanUrl,
    cid: opts.campaignId,
    uid: opts.userId,
    ph: opts.phone.replace(/\D/g, ''),
    btn: opts.label,
    flow: opts.campaignName || 'Campanha',
    src: 'campaign',
  });

  return `${supabaseUrl}/functions/v1/track-flow-click?${params.toString()}`;
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
) => {
  let url = '';
  let body: Record<string, unknown> = {};
  if (special.type === 'pix') {
    url = `${baseUrl}/send-button-pix`;
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
      pixKey: String(special.pixKey || '').trim(),
      type: typeMap[rawType] || rawType,
      ...(special.merchantName ? { merchantName: special.merchantName } : {}),
    };
  } else if (special.type === 'localizacao' || special.type === 'uaz_location_button' || special.type === 'location' || special.type === 'location_button') {
    url = `${baseUrl}/send-location`;
    const latitude = parseCoordinate(special.latitude);
    const longitude = parseCoordinate(special.longitude);
    if (!latitude || !longitude) {
      throw new Error('Template de localização com latitude/longitude inválidos');
    }
    const title = String(special.title || special.name || special.address || 'Localização').trim();
    const address = String(special.address || special.description || title).trim();
    body = {
      phone,
      title,
      address,
      latitude,
      longitude,
    };
  } else if (special.type === 'contato') {
    url = `${baseUrl}/send-contact`;
    body = {
      phone,
      contactName: special.contactName || '',
      contactPhone: String(special.contactPhone || '').replace(/\D/g, ''),
      ...(special.description ? { contactBusinessDescription: special.description } : {}),
    };
  } else if (special.type === 'uaz_status' || special.type === 'status') {
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
  } else if (special.type === 'copia_cola' || special.type === 'copy_paste') {
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
  const latitude = parseCoordinate(special.latitude);
  const longitude = parseCoordinate(special.longitude);
  const buttonUrl = String(special.url || (latitude && longitude ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : '')).trim();
  if (!buttonUrl) {
    return { ok: false, ack: null, error: 'Template de localização com botão sem URL do mapa', raw: null };
  }

  const normalizedUrl = /^https?:\/\//i.test(buttonUrl) ? buttonUrl : `https://${buttonUrl}`;
  const message = String(
    special.text ||
    special.description ||
    [special.name || special.title, special.address].filter(Boolean).join('\n') ||
    'Abrir localização no mapa'
  ).trim();
  const buttonLabel = String(special.buttonLabel || 'Ver no mapa').trim() || 'Ver no mapa';
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
) => {
  const baseUrl = String(instance.uazapiUrl || '').replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', token: String(instance.uazapiToken || '') };
  const targetNumber = getUazapiTargetNumber(phone);

  let endpoint = '';
  let body: Record<string, unknown> = {};
  if (special.type === 'pix') {
    endpoint = '/send/text';
    const pixLines = [
      `💰 *Cobrança PIX*`,
      special.merchantName ? `Recebedor: ${special.merchantName}` : '',
      special.amount ? `Valor: R$ ${special.amount}` : '',
      `Chave (${special.pixKeyType || 'pix'}): ${special.pixKey || ''}`,
      special.description ? `\n${special.description}` : '',
    ].filter(Boolean).join('\n');
    body = { number: targetNumber, text: pixLines };
  } else if (special.type === 'localizacao' || special.type === 'uaz_location_button' || special.type === 'location' || special.type === 'location_button') {
    endpoint = '/send/location';
    body = {
      number: targetNumber,
      latitude: Number(special.latitude) || 0,
      longitude: Number(special.longitude) || 0,
      name: special.title || '',
      address: special.address || '',
    };
  } else if (special.type === 'contato') {
    endpoint = '/send/contact';
    body = {
      number: targetNumber,
      fullName: special.contactName || '',
      phoneNumber: String(special.contactPhone || '').replace(/\D/g, ''),
    };
  } else if (special.type === 'copia_cola' || special.type === 'copy_paste') {
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

const BATCH_SIZE = 50; // Process 50 contacts per invocation

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
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const wrapUrlForTracking = (url: string, btnLabel: string) => {
    if (!opts.campaignId || !opts.userId || !SUPABASE_URL) return url;
    if (!/^https?:\/\//i.test(url)) return url;
    const base = `${SUPABASE_URL}/functions/v1/track-flow-click`;
    const params = new URLSearchParams({
      url,
      cid: opts.campaignId,
      uid: opts.userId,
      ph: phone.replace(/\D/g, ''),
      btn: btnLabel,
      flow: opts.campaignName || 'Campanha',
      src: 'campaign',
    });
    return `${base}?${params.toString()}`;
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
  const isConnected = deviceStatus?.connected === true ||
    (typeof deviceStatus?.connected === 'string' && deviceStatus.connected.toLowerCase() === 'true') ||
    deviceStatus?.status === 'CONNECTED' ||
    (typeof deviceStatus?.status === 'string' && deviceStatus.status.toLowerCase() === 'connected');

  const isExplicitlyDisconnected = deviceStatus?.connected === false ||
    deviceStatus?.status === 'DISCONNECTED' ||
    (typeof deviceStatus?.status === 'string' && deviceStatus.status.toLowerCase() === 'disconnected');

  return { connected: isConnected, explicitlyDisconnected: isExplicitlyDisconnected };
};

const fetchDeviceStatusSnapshot = async (instance: ResolvedInstance) => {
  try {
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
      const connected = status === 'connected' || status === 'open' || uazRaw?.connected === true;
      const explicitlyDisconnected = status === 'disconnected' || status === 'closed' || uazRaw?.connected === false;
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
    const body: SendCampaignRequest = await req.json();
    const { campaignId, contacts, instanceId: requestedInstanceId, rotationOffset: initialRotationOffset, _isContinuation, _userId } = body;
    const rotationOffset = initialRotationOffset || 0;
    const requestedContacts = Array.isArray(contacts) ? contacts : [];

    if (!campaignId || requestedContacts.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign ID and contacts are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    console.log(`🚀 Campaign ${campaignId}: ${requestedContacts.length} contacts to process (continuation: ${!!_isContinuation}, offset: ${rotationOffset})`);

    // For continuations with _userId, resolve credentials directly via service role (no JWT needed)
    let credentials: CampaignCredentials;
    if (_isContinuation && _userId) {
      console.log(`🔑 Continuation mode: resolving credentials for user ${_userId} via service role`);
      const continuationInstance = await resolvePreferredUserInstance(supabase, _userId);
      if (!continuationInstance) throw new Error('Instância ativa não encontrada para continuação');
      credentials = buildCampaignCredentials(_userId, continuationInstance);
    } else {
      const baseCredentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
      const preferredInstance = await resolvePreferredUserInstance(supabase, baseCredentials.userId);
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
    }

    let zapiInstanceId = credentials.instanceId;
    let zapiToken = credentials.token;
    let zapiClientToken = credentials.clientToken;

    const isRotateMode = requestedInstanceId === '__rotate_all__';
    let rotatePool: ResolvedInstance[] = [];

    if (isRotateMode) {
      const { data: allActiveInstances } = await supabase
        .from('zapi_instances')
        .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      const rawRotatePool: ResolvedInstance[] = (allActiveInstances || [])
        .filter((instance: any) => instance.zapi_instance_id && instance.zapi_token && instance.zapi_client_token)
        .map((instance: any) => ({
          zapiInstanceId: instance.zapi_instance_id,
          zapiToken: instance.zapi_token || '',
          zapiClientToken: instance.zapi_client_token || '',
          instanceName: instance.instance_name,
          apiProvider: 'zapi',
          uazapiUrl: '',
          uazapiToken: '',
        }));

      const rotateStatuses = await Promise.all(
        rawRotatePool.map(async (instance) => ({
          instance,
          status: await fetchDeviceStatusSnapshot(instance),
        })),
      );

      rotatePool = rotateStatuses
        .filter(({ status }) => status.connected)
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

      if (specificInstance) {
        zapiInstanceId = specificInstance.zapiInstanceId;
        zapiToken = specificInstance.zapiToken;
        zapiClientToken = specificInstance.zapiClientToken;
        credentials.apiProvider = specificInstance.apiProvider || 'zapi';
        credentials.uazapiUrl = specificInstance.uazapiUrl || '';
        credentials.uazapiToken = specificInstance.uazapiToken || '';
        credentials.instanceName = specificInstance.instanceName;
      } else {
        console.warn(`⚠️ Requested instance ${requestedInstanceId} not found for user ${credentials.userId}; keeping preferred instance ${credentials.instanceName}`);
      }
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
        const reInvokeResponse = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            campaignId,
            contacts: contactsToContinue,
            instanceId: requestedInstanceId,
            rotationOffset: newRotationOffset,
            _isContinuation: true,
            _userId: credentials.userId,
          }),
        });

        if (!reInvokeResponse.ok) {
          console.error(`❌ Re-invocation HTTP error: ${reInvokeResponse.status} ${await reInvokeResponse.text()}`);
          return false;
        }

        return true;
      } catch (reError) {
        console.error(`❌ Re-invocation failed:`, reError);
        return false;
      }
    };

    // Check campaign status
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`*, template:message_templates(*)`)
      .eq('id', campaignId)
      .eq('user_id', credentials.userId)
      .single();

    if (campaignError || !campaign) {
      console.error(`❌ Campaign not found: ${campaignError?.message}`);
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'paused' || campaign.status === 'completed' || campaign.status === 'cancelled') {
      console.log(`🛑 Campaign ${campaignId} is ${campaign.status}. Not processing.`);
      return new Response(JSON.stringify({ error: `Campaign is ${campaign.status}`, stopped: true }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (campaign.status === 'draft') {
      await supabase.from('campaigns').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', campaignId).eq('user_id', credentials.userId);
    }

    // Determine if this is a flow-based campaign
    const isFlowCampaign = campaign.target_audience?.campaign_type === 'flow' && campaign.target_audience?.flow_id;
    const flowId = campaign.target_audience?.flow_id;

    if (!isFlowCampaign && !campaign.template) throw new Error('Campaign template not found');

    const campaignTargetContacts = Array.isArray(campaign.target_audience?.contacts)
      ? campaign.target_audience.contacts.filter((contact: any) => Boolean(contact?.phone))
      : [];

    const { count: existingSendsCount } = await supabase
      .from('campaign_sends')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    const shouldUseCampaignAudience =
      !_isContinuation &&
      (existingSendsCount ?? 0) === 0 &&
      campaignTargetContacts.length > 0 &&
      requestedContacts.length !== campaignTargetContacts.length;

    const executionContacts = shouldUseCampaignAudience ? campaignTargetContacts : requestedContacts;

    if (shouldUseCampaignAudience) {
      console.log(
        `⚠️ Campaign ${campaignId}: request had ${requestedContacts.length} contacts, but campaign audience has ${campaignTargetContacts.length}. Using campaign audience as source of truth.`,
      );
    }

    const delayMs = (campaign.delay_seconds || 2) * 1000;

    // Split contacts into current batch and remaining
    const currentBatch = executionContacts.slice(0, BATCH_SIZE);
    const remainingContacts = executionContacts.slice(BATCH_SIZE);

    console.log(`📦 Processing batch of ${currentBatch.length} contacts. Remaining: ${remainingContacts.length}`);

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

      if (await shouldPause()) {
        console.log(`❌ DISPOSITIVO DESCONECTADO! PAUSANDO campanha ${campaignId}`);
        await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
        return new Response(JSON.stringify({ error: 'Device disconnected, campaign paused', stopped: true }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
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

    const persistCampaignSend = async (record: CampaignSendRecord, existingId?: string | null) => {
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
          })
          .eq('id', existingId);

        if (!updateError) return;

        console.error(`❌ Failed to update campaign_send ${existingId} for ${record.phone}:`, updateError.message);
      }

      const { error: insertError } = await supabase.from('campaign_sends').insert([record]);
      if (insertError) {
        console.error(`❌ Failed to insert campaign_send for ${record.phone}:`, insertError.message);
      }
    };

    // Process current batch
    const results = [];
    let rateLimitHitsInBatch = 0;
    for (let i = 0; i < currentBatch.length; i++) {
      const contact = { ...currentBatch[i], phone: normalizeGroupPhone(currentBatch[i].phone) };

      // Try to resolve @lid identifiers to real phone numbers via message_logs mapping.
      // Never send unresolved @lid identifiers as raw numeric strings because providers
      // expect a real WhatsApp phone number and those synthetic values cause false positives.
      if (isLidIdentifier(contact.phone)) {
        const lidId = contact.phone;
        const { data: lidMapping } = await supabase
          .from('message_logs')
          .select('phone')
          .eq('user_id', credentials.userId)
          .eq('keyword_matched', '__lid_map__')
          .eq('message_received', lidId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let resolvedLidPhone = lidMapping?.phone || null;

        if (!resolvedLidPhone) {
          const { data: legacyLidMapping } = await supabase
            .from('message_logs')
            .select('phone')
            .eq('user_id', credentials.userId)
            .eq('keyword_matched', `lid_map:${lidId}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          resolvedLidPhone = legacyLidMapping?.phone || null;
        }

        if (resolvedLidPhone && !resolvedLidPhone.includes('@lid')) {
          console.log(`✅ Resolved @lid for campaign: ${lidId} → ${resolvedLidPhone}`);
          contact.phone = resolvedLidPhone;
        } else {
          console.log(`⛔ @lid não resolvido para ${lidId} — marcando como falha (mensagem não chegaria no WhatsApp).`);
          const failRecord: CampaignSendRecord = {
            campaign_id: campaignId,
            phone: lidId,
            contact_name: contact.name,
            message_content: '[Não enviado: identificador @lid sem número real]',
            status: 'failed',
            error_message: 'Número não está no WhatsApp ou recusou a mensagem (@lid/desconhecido).',
            user_id: credentials.userId,
            instance_name: '',
          };
          await supabase.from('campaign_sends').insert(failRecord);
          results.push({ phone: lidId, success: false, error: 'unresolved_lid' });
          continue;
        }
      }

      const explicitContactInstance = await resolveContactInstance(supabase, credentials.userId, currentBatch[i].sourceInstanceId);
      const inferredGroupInstance = !explicitContactInstance
        ? await resolveGroupInstanceFromInboundLogs(supabase, credentials.userId, contact.phone)
        : null;
      const currentInstance = explicitContactInstance || inferredGroupInstance || getInstanceForIndex(i);
      let campaignSend: CampaignSendRecord | undefined;
      let reusableSendId: string | null = null;

      try {
        // Check if paused/cancelled before EACH contact to stop immediately
        const { data: statusCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
        if (statusCheck?.status === 'paused' || statusCheck?.status === 'cancelled' || statusCheck?.status === 'completed') {
          console.log(`🛑 Campaign ${campaignId} is ${statusCheck?.status} before contact ${i + 1}/${currentBatch.length}. Stopping immediately.`);
          return new Response(JSON.stringify({ success: true, stopped: true, processed: i, message: `Stopped: campaign ${statusCheck?.status}` }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        // Check duplicates / progress already persisted
        const { data: existingSends } = await supabase
          .from('campaign_sends')
          .select('id, status, created_at')
          .eq('campaign_id', campaignId)
          .eq('phone', contact.phone);
        const successfulForPhone = existingSends?.filter(s => s.status === 'sent' || s.status === 'delivered').length || 0;
        const pendingForPhone = existingSends?.filter(s => s.status === 'pending').length || 0;
        const phoneOccurrencesBefore = currentBatch.slice(0, i).filter((c: { phone: string }) => c.phone === contact.phone).length;

        if (successfulForPhone > phoneOccurrencesBefore) {
          console.log(`⏭️ Skipping ${contact.phone} - already sent`);
          results.push({ phone: contact.phone, success: true, messageId: 'already-sent' });
          continue;
        }

        if (pendingForPhone > phoneOccurrencesBefore) {
          console.log(`⏭️ Skipping ${contact.phone} - already accepted/pending callback`);
          results.push({ phone: contact.phone, success: true, messageId: 'already-pending' });
          continue;
        }

        const failedOnly = [...(existingSends || [])]
          .filter(s => s.status === 'failed')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        reusableSendId = failedOnly?.id || null;

        // Device connectivity is checked once at batch level (above), not per-contact
        // to avoid excessive Z-API calls that cause rate-limiting and silent delivery failures

        console.log(`📤 [${i + 1}/${currentBatch.length}] Sending to: ${contact.phone} via ${currentInstance.instanceName}${isFlowCampaign ? ' [FLOW]' : ''}`);

        // === FLOW-BASED CAMPAIGN ===
        if (isFlowCampaign && flowId) {
          campaignSend = {
            campaign_id: campaignId,
            phone: contact.phone,
            contact_name: contact.name,
            message_content: `[Fluxo: ${flowId}]`,
            status: 'pending',
            user_id: credentials.userId,
            instance_name: currentInstance.instanceName,
          };

          try {
            // Trigger flow via webhook-zapi with __manual_flow_trigger__
            const webhookPayload = {
              phone: contact.phone,
              instanceId: currentInstance.zapiInstanceId,
              __manual_flow_trigger__: true,
              flowId: flowId,
              body: { message: { text: { body: `__flow_trigger_${flowId}__` } } },
              fromMe: false,
            };

            const flowResponse = await fetch(`${supabaseUrl}/functions/v1/webhook-zapi`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify(webhookPayload),
            });

            if (flowResponse.ok) {
              campaignSend.status = 'sent';
              campaignSend.sent_at = new Date().toISOString();
              results.push({ phone: contact.phone, success: true, messageId: 'flow-triggered' });
              console.log(`✅ Flow triggered for ${contact.phone}`);
            } else {
              const errorText = await flowResponse.text();
              campaignSend.status = 'failed';
              campaignSend.error_message = `Flow trigger failed: ${errorText}`;
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
              console.log(`❌ Flow trigger failed for ${contact.phone}: ${errorText}`);
            }
          } catch (flowError) {
            campaignSend.status = 'failed';
            campaignSend.error_message = flowError instanceof Error ? flowError.message : 'Unknown flow error';
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
          }

          await persistCampaignSend(campaignSend, reusableSendId);
          if (i < currentBatch.length - 1) await sleep(delayMs);
          continue;
        }

        // === TEMPLATE-BASED CAMPAIGN ===
        let messageContent = campaign.template.content;
        messageContent = messageContent.replace(/{nome}/g, contact.name || 'Cliente');
        messageContent = messageContent.replace(/{empresa}/g, 'Nossa Empresa');
        messageContent = messageContent.replace(/{data}/g, new Date().toLocaleDateString('pt-BR'));
        messageContent = messageContent.replace(/{hora}/g, new Date().toLocaleTimeString('pt-BR'));

        if (contact.variables) {
          Object.entries(contact.variables).forEach(([key, value]) => {
            messageContent = messageContent.replace(new RegExp(`{${key}}`, 'g'), value);
          });
        }

        campaignSend = {
          campaign_id: campaignId,
          phone: contact.phone,
          contact_name: contact.name,
          message_content: messageContent,
          status: 'pending',
          user_id: credentials.userId,
          instance_name: currentInstance.instanceName,
        };

        let fullMessage = '';
        if (campaign.template.header) fullMessage += campaign.template.header + '\n\n';
        fullMessage += messageContent;
        if (campaign.template.footer) fullMessage += '\n\n' + campaign.template.footer;

        const templateType = campaign.template.type || 'texto';
        const hasButtons = campaign.template.buttons && Array.isArray(campaign.template.buttons) && campaign.template.buttons.length > 0;
        const hasMedia = campaign.template.media_url && campaign.template.media_url.trim() !== '';
        const hasCarouselCards = campaign.template.carousel_cards && Array.isArray(campaign.template.carousel_cards) && campaign.template.carousel_cards.length > 0;
        const campaignViewOnce = campaign.target_audience?.viewOnce === true;
        const campaignIsPtv = campaign.target_audience?.isPtv === true;
        const specialTpl = parseSpecialTemplate(campaign.template.content);

        const formatZapiButtons = (buttons: any[]) => buttons.map((btn: any) => {
          const btnType = (btn.type || 'url').toUpperCase();
          const buttonData: any = { label: btn.text || btn.label };
          if (btnType === 'CALL') { buttonData.type = 'CALL'; buttonData.phone = btn.phone || btn.value; }
          else if (btnType === 'REPLY' || btnType === 'OPTION') { buttonData.type = 'REPLY'; }
          else if (btnType === 'COPY') { buttonData.type = 'URL'; buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText || btn.value || '')}`; }
          else {
            buttonData.type = 'URL';
            buttonData.url = buildTrackedCampaignUrl(btn.url || btn.value || 'https://z-api.io', {
              campaignId,
              userId: credentials.userId,
              phone: contact.phone,
              label: buttonData.label || 'Abrir',
              campaignName: campaign?.name,
            });
          }
          if (btn.id) buttonData.id = btn.id;
          return buttonData;
        });

        const instId = currentInstance.zapiInstanceId;
        const instToken = currentInstance.zapiToken;
        const instClientToken = currentInstance.zapiClientToken;

        // === UAZAPI ROUTING (short-circuit) ===
        if (currentInstance.apiProvider === 'uazapi' && currentInstance.uazapiUrl && currentInstance.uazapiToken) {
          if (specialTpl) {
            const uazSpecial = await dispatchUazapiSpecial(currentInstance, contact.phone, specialTpl);
            if (uazSpecial.ok) {
              campaignSend.status = 'pending';
              results.push({ phone: contact.phone, success: true, messageId: uazSpecial.ack });
              console.log(`⏳ [UAZAPI] Accepted ${contact.phone} via ${currentInstance.instanceName}; waiting callback confirmation`);
            } else {
              campaignSend.status = 'failed';
              campaignSend.error_message = uazSpecial.error || 'UAZAPI special envio falhou';
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            }
            await persistCampaignSend(campaignSend, reusableSendId);
            if (i < currentBatch.length - 1) await sleep(delayMs);
            continue;
          }
          const uazResult = await dispatchUazapiCampaign(
            currentInstance,
            contact.phone,
            campaign.template,
            fullMessage,
            {
              viewOnce: campaignViewOnce,
              isPtv: campaignIsPtv,
              campaignId,
              userId: credentials.userId,
              campaignName: campaign?.name,
            },
          );

          if (uazResult.ok) {
            campaignSend.status = 'pending';
            results.push({ phone: contact.phone, success: true, messageId: uazResult.ack });
            console.log(`⏳ [UAZAPI] Accepted ${contact.phone} via ${currentInstance.instanceName} (ack=${uazResult.ack || 'none'}); waiting callback confirmation`);
          } else {
            campaignSend.status = 'failed';
            campaignSend.error_message = uazResult.error || 'UAZAPI envio falhou';
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            console.log(`❌ [UAZAPI] Failed ${contact.phone}: ${campaignSend.error_message}`);

            if (isConfirmedRateLimitHit(uazResult.raw, campaignSend.error_message, undefined) && !isLidIdentifier(contact.phone)) {
              rateLimitHitsInBatch += 1;
            } else {
              rateLimitHitsInBatch = 0;
            }

            if (rateLimitHitsInBatch >= 2) {
              await persistCampaignSend(campaignSend, reusableSendId);
              await supabase
                .from('campaigns')
                .update({ status: 'paused', updated_at: new Date().toISOString() })
                .eq('id', campaignId);

              return new Response(JSON.stringify({
                error: 'WhatsApp temporary restriction (error 463). Campaign paused to protect the account.',
                stopped: true,
                paused: true,
                reason: 'whatsapp_rate_limit',
                processed: i + 1,
                remaining: (currentBatch.length - i - 1) + remainingContacts.length,
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }
          }

          await persistCampaignSend(campaignSend, reusableSendId);
          if (i < currentBatch.length - 1) await sleep(delayMs);
          continue;
        }
        // === END UAZAPI ROUTING ===

        let zapiUrl: string = '';
        let requestBody: any = {};
        const baseZapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}`;

        // Z-API só aceita dígitos no campo phone. Se o destinatário for um
        // identificador @lid (sem número real resolvido), removemos o sufixo
        // e tentamos enviar como número desconhecido em vez de cancelar.
        if (isLidIdentifier(contact.phone)) {
          const stripped = getZapiTargetPhone(contact.phone);
          if (stripped && stripped !== contact.phone) {
            console.log(`📞 [Z-API] Enviando @lid como número desconhecido: ${contact.phone} → ${stripped}`);
            contact.phone = stripped;
          }
        } else if (!isGroupDestination(contact.phone)) {
          // Z-API exige apenas dígitos no campo phone (sem +, espaços, traços, parênteses).
          // Sem essa normalização, a API pode aceitar a requisição (HTTP 200) mas
          // a mensagem nunca é entregue ao WhatsApp.
          const normalized = getZapiTargetPhone(contact.phone);
          if (normalized && normalized !== contact.phone) {
            console.log(`📞 [Z-API] Normalizando telefone: ${contact.phone} → ${normalized}`);
            contact.phone = normalized;
          }
        }

        if (specialTpl) {
          const { url, body: specialBody } = await dispatchZapiSpecial(baseZapiUrl, instClientToken, contact.phone, specialTpl);
          zapiUrl = url;
          requestBody = specialBody;
        } else if (templateType === 'carrossel' && hasCarouselCards) {
          const carouselItems = campaign.template.carousel_cards.map((card: any, idx: number) => {
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

          const awaitingGroupCallback = isGroupDestination(contact.phone);
          campaignSend.status = awaitingGroupCallback ? 'pending' : 'sent';
          if (!awaitingGroupCallback) {
            campaignSend.sent_at = new Date().toISOString();
          }
          results.push({ phone: contact.phone, success: true, messageId: 'carousel-sent' });

          await persistCampaignSend(campaignSend, reusableSendId);
          if (i < currentBatch.length - 1) await sleep(delayMs);
          continue;

        } else if (templateType === 'video_botoes' && hasMedia && hasButtons) {
          if (campaignIsPtv) {
            const ptvUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-ptv`;
            const ptvResponse = await fetch(ptvUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, body: JSON.stringify({ phone: contact.phone, ptv: campaign.template.media_url }) });
            if (!ptvResponse.ok) throw new Error(`Erro ao enviar PTV: ${await ptvResponse.text()}`);
          } else {
            const videoUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-video`;
            const videoResponse = await fetch(videoUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, body: JSON.stringify({ phone: contact.phone, video: campaign.template.media_url, ...(campaignViewOnce ? { viewOnce: true } : {}) }) });
            if (!videoResponse.ok) throw new Error(`Erro ao enviar vídeo: ${await videoResponse.text()}`);
          }

          await sleep(Math.max(delayMs / 2, 1000));

          const formattedButtons = formatZapiButtons(campaign.template.buttons);

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          requestBody = { phone: contact.phone, message: fullMessage, buttonActions: formattedButtons };

        } else if (templateType === 'audio_botoes' && hasMedia && hasButtons) {
          // Z-API não suporta áudio + botões em uma única chamada.
          // Enviamos áudio primeiro e depois os botões com a mensagem.
          const audioUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-audio`;
          const audioResponse = await fetch(audioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken },
            body: JSON.stringify({ phone: contact.phone, audio: campaign.template.media_url, waveform: true }),
          });
          if (!audioResponse.ok) throw new Error(`Erro ao enviar áudio: ${await audioResponse.text()}`);

          await sleep(Math.max(delayMs / 2, 1000));

          const formattedButtons = formatZapiButtons(campaign.template.buttons);

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          requestBody = { phone: contact.phone, message: fullMessage || ' ', buttonActions: formattedButtons };

        } else if (templateType === 'imagem_botoes' && hasMedia && hasButtons) {
          const formattedButtons = formatZapiButtons(campaign.template.buttons);

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          requestBody = { phone: contact.phone, message: fullMessage, image: campaign.template.media_url, buttonActions: formattedButtons };

        } else if (templateType === 'imagem') {
          if (!hasMedia) throw new Error('Template tipo "imagem" requer uma imagem');
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-image`;
          requestBody = { phone: contact.phone, image: campaign.template.media_url, caption: fullMessage };

        } else if (templateType === 'video') {
          if (!hasMedia) throw new Error('Template tipo "video" requer um vídeo');
          if (campaignIsPtv) {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-ptv`;
            requestBody = { phone: contact.phone, ptv: campaign.template.media_url };
          } else {
            zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-video`;
            requestBody = { phone: contact.phone, video: campaign.template.media_url, caption: fullMessage, ...(campaignViewOnce ? { viewOnce: true } : {}) };
          }

        } else if (templateType === 'audio') {
          if (!hasMedia) throw new Error('Template tipo "audio" requer um áudio');
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-audio`;
          requestBody = { phone: contact.phone, audio: campaign.template.media_url, waveform: true };

        } else if (templateType === 'documento' || templateType === 'arquivo') {
          if (!hasMedia) throw new Error(`Template tipo "${templateType}" requer um arquivo`);
          // Determinar extensão a partir do file_type (mime) ou da própria URL
          const mimeExt = campaign.template.file_type?.split('/').pop()?.toLowerCase();
          const urlExt = String(campaign.template.media_url || '')
            .split('?')[0]
            .split('#')[0]
            .split('.')
            .pop()
            ?.toLowerCase();
          const extension = (mimeExt && mimeExt !== 'octet-stream' ? mimeExt : urlExt) || 'pdf';
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-document/${extension}`;
          requestBody = {
            phone: contact.phone,
            document: campaign.template.media_url,
            fileName: campaign.template.file_name || `documento.${extension}`,
            caption: fullMessage,
          };

        } else if (templateType === 'lista_opcao' || templateType === 'lista' || templateType === 'lista de opção') {
          const rawItems = Array.isArray(campaign.template.list_items)
            ? campaign.template.list_items
            : (Array.isArray((campaign.template as any).listItems) ? (campaign.template as any).listItems : []);
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
              title: campaign.template.header || '',
              buttonLabel: 'Ver opções',
              options: cleanItems,
            },
          };

        } else if (hasButtons) {
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          const formattedButtons = formatZapiButtons(campaign.template.buttons);
          requestBody = { phone: contact.phone, message: fullMessage, buttonActions: formattedButtons };

        } else {
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-text`;
          requestBody = { phone: contact.phone, message: fullMessage };
        }

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

          const explicitError = getZapiExplicitError(zapiResult);
          const confirmed = isZapiConfirmed(zapiResult);
          console.log(`📬 Campaign Z-API response for ${contact.phone} via ${currentInstance.instanceName}: status=${zapiResponse.status}, confirmed=${confirmed}, ack=${getZapiAckId(zapiResult) || 'none'}, body=${JSON.stringify(zapiResult).substring(0, 300)}`);

          if (zapiResponse.ok && !explicitError && confirmed) {
            if (specialTpl?.type === 'uaz_location_button') {
              await sleep(Math.max(1000, Math.min(delayMs / 2, 3000)));
              const buttonResult = await sendZapiLocationButtonFollowUp(baseZapiUrl, instClientToken, contact.phone, specialTpl);
              if (!buttonResult.ok) {
                campaignSend.status = 'failed';
                campaignSend.error_message = buttonResult.error || 'Falha ao enviar botão da localização';
                results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
                console.log(`❌ Failed location button follow-up ${contact.phone}: ${campaignSend.error_message}`);
                await persistCampaignSend(campaignSend, reusableSendId);
                if (i < currentBatch.length - 1) await sleep(delayMs);
                continue;
              }
            }

            const awaitingGroupCallback = isGroupDestination(contact.phone);
            campaignSend.status = awaitingGroupCallback ? 'pending' : 'sent';
            if (!awaitingGroupCallback) {
              campaignSend.sent_at = new Date().toISOString();
            }
            results.push({ phone: contact.phone, success: true, messageId: getZapiAckId(zapiResult) });
            console.log(awaitingGroupCallback
              ? `⏳ Accepted by Z-API for ${contact.phone}; waiting callback to mark as sent/delivered`
              : `✅ Sent to ${contact.phone}`);
          } else {
            campaignSend.status = 'failed';
            campaignSend.error_message = explicitError || (!confirmed ? 'Z-API não confirmou o envio' : `HTTP ${zapiResponse.status}`);
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            console.log(`❌ Failed ${contact.phone}: ${campaignSend.error_message}`);

            // 🚨 WhatsApp rate-limit (error 463 / temporary restriction):
            // pause the campaign immediately so the remaining contacts stay
            // pending and can be resumed later when the account recovers.
            if (isConfirmedRateLimitHit(zapiResult, campaignSend.error_message, zapiResponse.status) && !isLidIdentifier(contact.phone)) {
              rateLimitHitsInBatch += 1;
            } else {
              rateLimitHitsInBatch = 0;
            }

            if (rateLimitHitsInBatch >= 2) {
              console.log(`🚨 WhatsApp rate-limit detectado (error 463 / temporary restriction). Pausando campanha ${campaignId} para preservar a conta.`);
              await persistCampaignSend(campaignSend, reusableSendId);
              await supabase
                .from('campaigns')
                .update({ status: 'paused', updated_at: new Date().toISOString() })
                .eq('id', campaignId);
              return new Response(JSON.stringify({
                error: 'WhatsApp temporary restriction (error 463). Campaign paused to protect the account.',
                stopped: true,
                paused: true,
                reason: 'whatsapp_rate_limit',
                processed: i + 1,
                remaining: (currentBatch.length - i - 1) + remainingContacts.length,
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              });
            }

            // Mid-batch disconnection detection: after a send failure, check if device went offline
            try {
              const midBatchInstance = currentInstance;
              const midCheck = await fetchDeviceStatusSnapshot(midBatchInstance);
              if (midCheck.ok && midCheck.explicitlyDisconnected && !midCheck.connected) {
                // Double-check after 1.5s to confirm
                await sleep(1500);
                const midRecheck = await fetchDeviceStatusSnapshot(midBatchInstance);
                if (midRecheck.ok && midRecheck.explicitlyDisconnected && !midRecheck.connected) {
                  console.log(`❌ DISPOSITIVO DESCONECTOU DURANTE O ENVIO! Pausando campanha ${campaignId} no contato ${i + 1}/${currentBatch.length}`);
                  
                  // Persist this failed send before pausing
                  await persistCampaignSend(campaignSend, reusableSendId);
                  
                  await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
                  
                  return new Response(JSON.stringify({
                    error: 'Device disconnected mid-batch, campaign paused',
                    stopped: true,
                    processed: i + 1,
                    remaining: (currentBatch.length - i - 1) + remainingContacts.length,
                  }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                  });
                }
              }
            } catch (midCheckErr) {
              console.error('Mid-batch device check error:', midCheckErr);
            }
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

      // Persist campaign_send record immediately after each contact without deleting prior history rows
      if (campaignSend) {
        await persistCampaignSend(campaignSend, reusableSendId);
      }

      // Delay between contacts (except last)
      if (i < currentBatch.length - 1) {
        await sleep(delayMs);

        // Check pause after delay
        const { data: afterDelayCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
        if (afterDelayCampaign?.status === 'paused' || afterDelayCampaign?.status === 'cancelled' || afterDelayCampaign?.status === 'completed') {
          console.log(`🛑 Campaign stopped after delay at contact ${i + 1}/${currentBatch.length}.`);
          return new Response(JSON.stringify({ success: true, stopped: true, processed: i + 1, message: `Stopped: campaign ${afterDelayCampaign?.status}` }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }
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
      const [processedRes, pendingRes, successRes] = await Promise.all([
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
          .in('status', ['sent', 'delivered']),
      ]);

      const totalProcessed = processedRes.count ?? 0;
      const pendingCount = pendingRes.count ?? 0;
      const actualSuccesses = successRes.count ?? 0;

      // STRICT completion check: only complete if processed >= target audience
      // If target audience is 0 (edge case), use the current batch as reference
      const effectiveTarget = totalTargetContacts > 0 ? totalTargetContacts : totalProcessed;

      if (totalTargetContacts > 0 && totalProcessed < totalTargetContacts) {
        // Still missing contacts - DO NOT mark as completed
        const missingContacts = campaignTargetContacts.slice(totalProcessed);
        console.log(`⚠️ Campaign ${campaignId}: blocking completion because only ${totalProcessed}/${totalTargetContacts} contacts were processed. Re-invoking ${missingContacts.length} missing contacts.`);

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

      // Consider 'pending' sends as accepted by the provider (queued).
      // They may never receive a delivery callback (e.g. groups, disconnects),
      // so we should not block completion waiting for them.
      const acceptedSends = actualSuccesses + pendingCount;

      if (totalProcessed === 0 || acceptedSends === 0) {
        // No sends created or ALL sends failed — mark as paused, not completed
        console.log(`⚠️ Campaign ${campaignId}: ${totalProcessed} processed, ${actualSuccesses} successful, ${pendingCount} pending. Pausing instead of completing.`);
        await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
      } else {
        console.log(`✅ Campaign ${campaignId}: ${actualSuccesses} sent + ${pendingCount} pending / ${totalProcessed} processed out of ${effectiveTarget} target. Marking as completed.`);
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
