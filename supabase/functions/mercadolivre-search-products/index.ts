import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "affiliate-connections";
const PROVIDER = "mercadolivre";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim();
    const site = String(body?.site ?? "MLB").toUpperCase();
    const limit = Math.min(Math.max(Number(body?.limit ?? 24), 1), 50);
    if (!query) return json({ error: "Informe um termo de busca." }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const objectPath = `${userData.user.id}/${PROVIDER}.json`;

    let accessToken: string | null = null;
    let record: any = null;
    try {
      const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(objectPath);
      if (!dlErr && file) {
        record = JSON.parse(await file.text());
        accessToken = record?.access_token ?? null;

        // Refresh if expired
        const expiresAt = record?.expires_at ? Date.parse(record.expires_at) : 0;
        if (expiresAt && Date.now() > expiresAt - 60_000 && record?.refresh_token && ML_CLIENT_ID && ML_CLIENT_SECRET) {
          const r = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: ML_CLIENT_ID,
              client_secret: ML_CLIENT_SECRET,
              refresh_token: record.refresh_token,
            }),
          });
          const rd = await r.json().catch(() => ({}));
          if (r.ok && rd?.access_token) {
            accessToken = rd.access_token;
            const updated = {
              ...record,
              access_token: rd.access_token,
              refresh_token: rd.refresh_token ?? record.refresh_token,
              expires_at: rd.expires_in ? new Date(Date.now() + Number(rd.expires_in) * 1000).toISOString() : record.expires_at,
              updated_at: new Date().toISOString(),
            };
            await admin.storage.from(BUCKET).upload(
              objectPath,
              new Blob([JSON.stringify(updated)], { type: "application/json" }),
              { contentType: "application/json", upsert: true },
            );
          }
        }
      }
    } catch (e) {
      console.warn("ML token load failed:", e);
    }

    const url = new URL(`https://api.mercadolibre.com/sites/${site}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    const headers: Record<string, string> = { Accept: "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(url.toString(), { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("ML search error:", res.status, data);
      return json({ error: "Falha ao buscar produtos no marketplace.", fallback: true }, 200);
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    const products = results.map((p: any) => ({
      id: String(p.id),
      name: String(p.title ?? ""),
      price: typeof p.price === "number"
        ? p.price.toLocaleString("pt-BR", { style: "currency", currency: p.currency_id || "BRL" })
        : "",
      priceValue: typeof p.price === "number" ? p.price : null,
      currency: p.currency_id ?? "BRL",
      thumbnail: p.thumbnail ? String(p.thumbnail).replace(/^http:/, "https:") : null,
      link: p.permalink ?? null,
      source: "ml" as const,
    }));

    return json({ products, total: data?.paging?.total ?? products.length });
  } catch (err) {
    console.error("ml-search error:", err);
    return json({ error: "Erro inesperado.", fallback: true }, 200);
  }
});