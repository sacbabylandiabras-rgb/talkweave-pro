import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { evolution_api_url, evolution_api_key } = await req.json();

    if (!evolution_api_url || !evolution_api_key) {
      return new Response(JSON.stringify({ error: 'URL e API Key são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = evolution_api_url.replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { 'apikey': evolution_api_key, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: errData?.message || `HTTP ${res.status}` }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const normalized = (Array.isArray(data) ? data : []).map((item: any) => ({
      raw: item,
      instanceName:
        item?.instance?.instanceName ||
        item?.instanceName ||
        item?.instance?.name ||
        item?.name ||
        item?.instance?.id ||
        item?.instanceId ||
        item?.id ||
        '',
      status:
        item?.instance?.status ||
        item?.status ||
        item?.connectionStatus ||
        'unknown',
    }));

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
