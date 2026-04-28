import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");

function normalize(p: string): string | null {
  let d = onlyDigits(p);
  if (!d) return null;
  // Remove leading zeros
  d = d.replace(/^0+/, "");
  // Brazil heuristic: if 10/11 digits add 55
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

async function checkZapi(base: string, headers: Record<string, string>, numbers: string[]) {
  const res = await fetch(`${base}/phone-exists-batch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phones: numbers }),
  });
  const text = await res.text();
  let data: any = [];
  try { data = JSON.parse(text); } catch { data = []; }
  console.log(`[Z-API] status=${res.status} sample=${text.slice(0, 300)}`);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.phones) ? data.phones : [];
  const map = new Map<string, boolean>();
  for (const item of arr) {
    const inp = onlyDigits(item?.inputPhone || item?.phone || item?.number || "");
    const exists = item?.exists === true || item?.isInWhatsapp === true || item?.valid === true;
    if (inp) map.set(inp, exists);
  }
  return numbers.map((n) => {
    // Try exact, then last 10/11 digits match
    if (map.has(n)) return { phone: n, valid: map.get(n) === true };
    for (const [k, v] of map) {
      if (k.endsWith(n) || n.endsWith(k)) return { phone: n, valid: v };
    }
    return { phone: n, valid: false };
  });
}

async function checkUazapi(apiUrl: string, token: string, numbers: string[]) {
  const url = apiUrl.replace(/\/$/, "");
  const res = await fetch(`${url}/chat/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ numbers }),
  });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = {}; }
  console.log(`[UAZAPI] status=${res.status} sample=${text.slice(0, 300)}`);
  const arr = Array.isArray(data) ? data : Array.isArray(data?.response) ? data.response : Array.isArray(data?.result) ? data.result : [];
  const map = new Map<string, boolean>();
  for (const item of arr) {
    const inp = onlyDigits(item?.query || item?.number || item?.phone || item?.jid || "");
    const exists = item?.isInWhatsapp === true || item?.exists === true || item?.IsUser === true || item?.isuser === true || !!item?.jid;
    if (inp) map.set(inp, exists);
  }
  return numbers.map((n) => {
    if (map.has(n)) return { phone: n, valid: map.get(n) === true };
    for (const [k, v] of map) {
      if (k.endsWith(n) || n.endsWith(k)) return { phone: n, valid: v };
    }
    return { phone: n, valid: false };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const phonesIn: string[] = Array.isArray(body?.phones) ? body.phones : [];
    if (!phonesIn.length) {
      return new Response(JSON.stringify({ error: "phones required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize + dedupe; preserve mapping back
    const seen = new Set<string>();
    const normalized: string[] = [];
    const invalidFormat: string[] = [];
    const inputMap = new Map<string, string>(); // normalized -> first original
    for (const raw of phonesIn) {
      const n = normalize(String(raw || ""));
      if (!n) { invalidFormat.push(String(raw)); continue; }
      if (seen.has(n)) continue;
      seen.add(n);
      normalized.push(n);
      inputMap.set(n, String(raw));
    }

    // Pick instance
    const { data: inst } = await admin
      .from("zapi_instances")
      .select("zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key, is_default")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inst) {
      return new Response(JSON.stringify({ error: "Nenhuma conexão WhatsApp ativa encontrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isUaz = String(inst.api_provider || "").toLowerCase() === "uazapi";

    // Process in batches of 50
    const results: { phone: string; valid: boolean }[] = [];
    const BATCH = 50;
    for (let i = 0; i < normalized.length; i += BATCH) {
      const slice = normalized.slice(i, i + BATCH);
      try {
        if (isUaz) {
          const out = await checkUazapi(inst.evolution_api_url || "", inst.zapi_token || "", slice);
          results.push(...out);
        } else {
          const base = `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`;
          const headers = { "Content-Type": "application/json", "Client-Token": inst.zapi_client_token || "" };
          const out = await checkZapi(base, headers, slice);
          results.push(...out);
        }
      } catch (e) {
        console.error("Batch error:", e);
        for (const p of slice) results.push({ phone: p, valid: false });
      }
    }

    const valid: string[] = [];
    const invalid: string[] = [];
    for (const r of results) {
      const original = inputMap.get(r.phone) || r.phone;
      if (r.valid) valid.push(r.phone);
      else invalid.push(original);
    }
    for (const f of invalidFormat) invalid.push(f);

    return new Response(JSON.stringify({
      total: phonesIn.length,
      checked: normalized.length,
      valid,
      invalid,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("validate-whatsapp-numbers error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
