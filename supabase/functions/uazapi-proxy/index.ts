import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { apiUrl, apiToken, action, proxy_url } = body as {
      apiUrl?: string;
      apiToken?: string;
      action?: 'get' | 'set' | 'delete';
      proxy_url?: string;
    };

    if (!apiUrl || !apiToken) {
      return json({ error: 'Missing apiUrl or apiToken' }, 400);
    }
    if (!action || !['get', 'set', 'delete'].includes(action)) {
      return json({ error: 'Invalid action. Use get, set or delete.' }, 400);
    }

    const baseUrl = apiUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/instance/proxy`;

    const method = action === 'get' ? 'GET' : action === 'set' ? 'POST' : 'DELETE';

    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
    };

    if (action === 'set') {
      const payload: Record<string, unknown> = { enable: true };
      const trimmed = (proxy_url || '').trim();
      if (trimmed) payload.proxy_url = trimmed;
      init.body = JSON.stringify(payload);
    }

    console.log(`[uazapi-proxy] ${method} ${url}`);

    const response = await fetch(url, init);
    const rawText = await response.text();
    let data: any = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { message: rawText }; }

    if (!response.ok) {
      console.error('[uazapi-proxy] error', response.status, rawText);
      return json(
        { error: data?.error || data?.message || `Error ${response.status}`, status: response.status, raw: data },
        200,
      );
    }

    return json({ success: true, ...data });
  } catch (error) {
    console.error('[uazapi-proxy] exception', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});