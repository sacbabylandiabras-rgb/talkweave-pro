/**
 * Helpers for Evolution API and custom WhatsApp API variants.
 *
 * Supports two API flavours:
 *   1. Standard Evolution API v2 – uses `apikey` header,
 *      endpoints like `/instance/connectionState/{name}`.
 *   2. Custom WhatsApp API (user's docs at :8000) – uses `Client-Token` header,
 *      endpoints like `/instances/{id}/status`.
 *
 * The strategy helpers below let edge-functions try both flavours automatically.
 */

// ---------------------------------------------------------------------------
// URL candidates (port fallback 8080 ↔ 8000)
// ---------------------------------------------------------------------------

export const buildEvolutionUrlCandidates = (rawUrl?: string | null): string[] => {
  if (!rawUrl) return [];

  const normalized = rawUrl.replace(/\/$/, '');
  const candidates = [normalized];

  try {
    const url = new URL(normalized);

    if (url.port === '8080') {
      const alt = new URL(url.toString());
      alt.port = '8000';
      candidates.push(alt.toString().replace(/\/$/, ''));
    } else if (url.port === '8000') {
      const alt = new URL(url.toString());
      alt.port = '8080';
      candidates.push(alt.toString().replace(/\/$/, ''));
    }
  } catch {
    return [normalized];
  }

  return [...new Set(candidates)];
};

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export const parseEvolutionResponse = async (response: Response) => {
  const rawText = await response.text();

  try {
    return {
      data: rawText ? JSON.parse(rawText) : null,
      rawText,
    };
  } catch {
    return {
      data: { rawText },
      rawText,
    };
  }
};

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export const getEvolutionErrorMessage = (payload: any, status: number, fallback: string) => {
  return payload?.message || payload?.error || payload?.response?.message || `${fallback} (${status})`;
};

export const isEvolutionInstanceNotFound = (payload: any, rawText?: string) => {
  const text = [payload?.message, payload?.error, payload?.response?.message, rawText]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes('instance not found') || text.includes('not found');
};

// ---------------------------------------------------------------------------
// Strategy: try both API flavours for a given operation
// ---------------------------------------------------------------------------

interface ApiAttemptConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

interface EndpointStrategy {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  label: string; // for logging
}

/**
 * Build endpoint strategies for checking device connection status.
 */
export const buildStatusStrategies = (cfg: ApiAttemptConfig): EndpointStrategy[] => {
  const { baseUrl, apiKey, instanceName } = cfg;
  return [
    // Strategy 1: Custom API (/instances/{id}/status with Client-Token)
    {
      url: `${baseUrl}/instances/${encodeURIComponent(instanceName)}/status`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-status',
    },
    // Strategy 2: Standard Evolution v2 (/instance/connectionState/{name} with apikey)
    {
      url: `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      label: 'evo-v2-status',
    },
  ];
};

/**
 * Build endpoint strategies for fetching QR code.
 */
export const buildQrCodeStrategies = (cfg: ApiAttemptConfig): EndpointStrategy[] => {
  const { baseUrl, apiKey, instanceName } = cfg;
  return [
    // Strategy 1: Custom API
    {
      url: `${baseUrl}/instances/${encodeURIComponent(instanceName)}/qr-code`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-qr',
    },
    // Strategy 2: Standard Evolution v2
    {
      url: `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      label: 'evo-v2-qr',
    },
  ];
};

/**
 * Build endpoint strategies for pairing code (phone-based connect).
 */
export const buildPairingCodeStrategies = (cfg: ApiAttemptConfig, phone: string): EndpointStrategy[] => {
  const { baseUrl, apiKey, instanceName } = cfg;
  return [
    // Strategy 1: Standard Evolution v2 POST /instance/connect/{name} with number body
    {
      url: `${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({ number: phone }),
      label: 'evo-v2-pairing',
    },
    // Strategy 2: Custom API (might not support pairing codes directly)
    {
      url: `${baseUrl}/instances/${encodeURIComponent(instanceName)}/qr-code`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-qr-fallback',
    },
  ];
};

/**
 * Execute strategies across URL candidates. Returns first successful result.
 */
export const executeStrategies = async (
  urlCandidates: string[],
  buildStrategies: (cfg: ApiAttemptConfig) => EndpointStrategy[],
  apiKey: string,
  instanceName: string,
  logPrefix: string,
): Promise<{ data: any; rawText: string; status: number; strategy: string }> => {
  let lastPayload: any = null;
  let lastRawText = '';
  let lastStatus = 500;
  let lastStrategy = '';

  for (const candidateUrl of urlCandidates) {
    const strategies = buildStrategies({ baseUrl: candidateUrl, apiKey, instanceName });

    for (const strategy of strategies) {
      console.log(`${logPrefix} Trying ${strategy.label}: ${strategy.url}`);

      try {
        const fetchOpts: RequestInit = {
          method: strategy.method,
          headers: strategy.headers,
        };
        if (strategy.body) fetchOpts.body = strategy.body;

        const response = await fetch(strategy.url, fetchOpts);
        const parsed = await parseEvolutionResponse(response);

        lastStatus = response.status;
        lastPayload = parsed.data;
        lastRawText = parsed.rawText;
        lastStrategy = strategy.label;

        console.log(`${logPrefix} ${strategy.label} status=${lastStatus} body=${lastRawText.substring(0, 300)}`);

        // Success
        if (response.ok) {
          return { data: lastPayload, rawText: lastRawText, status: lastStatus, strategy: strategy.label };
        }

        // If 401/403, try next strategy (maybe wrong auth header)
        if (lastStatus === 401 || lastStatus === 403) {
          continue;
        }

        // If not found, try next strategy
        if (lastStatus === 404 || isEvolutionInstanceNotFound(lastPayload, lastRawText)) {
          continue;
        }

        // Other error, return it
        return { data: lastPayload, rawText: lastRawText, status: lastStatus, strategy: strategy.label };

      } catch (err) {
        console.log(`${logPrefix} ${strategy.label} fetch error: ${err}`);
        lastRawText = String(err);
        continue;
      }
    }
  }

  return { data: lastPayload, rawText: lastRawText, status: lastStatus, strategy: lastStrategy };
};

// ---------------------------------------------------------------------------
// State normalisation
// ---------------------------------------------------------------------------

export const isEvolutionConnected = (payload: any): boolean => {
  // Custom API may return { status: "connected" } or { connected: true }
  if (payload?.connected === true) return true;
  if (payload?.smartphoneConnected === true) return true;

  const state = payload?.instance?.state || payload?.state || payload?.status || payload?.instance?.status || null;
  return ['open', 'connected'].includes(String(state).toLowerCase());
};

// ---------------------------------------------------------------------------
// QR / pairing code extraction
// ---------------------------------------------------------------------------

const detectBase64ImageMime = (value: string): string | null => {
  if (value.startsWith('iVBOR')) return 'image/png';
  if (value.startsWith('/9j/')) return 'image/jpeg';
  if (value.startsWith('R0lGOD')) return 'image/gif';
  if (value.startsWith('UklGR')) return 'image/webp';
  if (value.startsWith('PHN2Zy')) return 'image/svg+xml';
  return null;
};

const normalizeQrImageValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image')) return trimmed;

  const mime = detectBase64ImageMime(trimmed);
  if (mime) {
    return `data:${mime};base64,${trimmed}`;
  }

  return trimmed;
};

export const extractQrCodeValue = (payload: any): string | null => {
  const candidates = [
    payload?.base64,
    payload?.data?.base64,
    payload?.qrCode?.base64,
    payload?.qrcode?.base64,
    payload?.qr_code,
    payload?.data?.qr_code,
    payload?.qr,
    payload?.data?.qr,
    payload?.code,
    payload?.data?.code,
    payload?.qrCode,
    payload?.qrcode,
    payload?.value,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeQrImageValue(candidate);
    if (normalized) return normalized;
  }

  return null;
};

export const extractPairingCode = (payload: any): string | null => {
  return payload?.pairingCode || payload?.data?.pairingCode || payload?.instance?.pairingCode || null;
};
