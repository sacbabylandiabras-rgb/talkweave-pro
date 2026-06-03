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

function formatMoney(value: number, currency = "BRL") {
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

function decorateAffiliateLink(permalink: string | null, accountId: string | number | null) {
  if (!permalink) return null;
  try {
    const u = new URL(permalink);
    if (accountId) {
      u.searchParams.set("matt_tool", String(accountId));
      u.searchParams.set("matt_word", "zaplynx");
    }
    return u.toString();
  } catch {
    return permalink;
  }
}

function extractWinnerItemId(product: any): string | null {
  const winner = product?.buy_box_winner ?? product?.winner ?? {};
  const candidates = [winner?.item_id, winner?.item?.id, winner?.id, product?.item_id];
  const itemId = candidates.find((value) => typeof value === "string" && /^ML[A-Z]\d+$/i.test(value));
  return itemId ? String(itemId).toUpperCase() : null;
}

function isUnavailableItem(item: any) {
  const status = String(item?.status ?? "").toLowerCase();
  const qty = Number(item?.available_quantity ?? 0);
  const buyingMode = String(item?.buying_mode ?? "").toLowerCase();
  return status !== "active" || qty <= 0 || (buyingMode && buyingMode !== "buy_it_now");
}

function mapAvailableItem(item: any, fallback: any, accountId: string | number | null) {
  if (!item || isUnavailableItem(item)) return null;

  const winner = fallback?.buy_box_winner ?? {};
  const priceValue = typeof item?.price === "number"
    ? item.price
    : (typeof winner?.price === "number" ? winner.price : null);
  if (!priceValue || priceValue <= 0) return null;

  const originalPriceValue = typeof item?.original_price === "number"
    ? item.original_price
    : (typeof winner?.original_price === "number" ? winner.original_price : null);
  const currency = item?.currency_id || winner?.currency_id || fallback?.currency_id || "BRL";
  const picture = item?.secure_thumbnail || item?.thumbnail || item?.pictures?.[0]?.secure_url || item?.pictures?.[0]?.url || fallback?.thumbnail;
  const link = decorateAffiliateLink(item?.permalink || null, accountId);
  if (!link) return null;

  return {
    id: String(item.id),
    name: String(item.title ?? fallback?.name ?? fallback?.title ?? ""),
    price: formatMoney(priceValue, currency),
    priceValue,
    originalPrice: originalPriceValue != null && originalPriceValue > priceValue ? formatMoney(originalPriceValue, currency) : null,
    discount: originalPriceValue && originalPriceValue > priceValue
      ? Math.round(((originalPriceValue - priceValue) / originalPriceValue) * 100)
      : null,
    currency,
    thumbnail: picture ? String(picture).replace(/^http:/, "https:") : null,
    link,
    available: true,
    availableQuantity: Number(item?.available_quantity ?? 0),
    source: "ml" as const,
  };
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
    const mode = String(body?.mode ?? "search"); // "search" | "deals"
    const site = String(body?.site ?? "MLB").toUpperCase();
    const limit = Math.min(Math.max(Number(body?.limit ?? 24), 1), 50);
    if (mode === "search" && !query) return json({ error: "Informe um termo de busca." }, 400);

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

    if (!accessToken) {
      return json({ error: "Reconecte sua conta para buscar produtos.", fallback: true }, 200);
    }

    // Novo endpoint de catálogo (o /sites/MLB/search público retorna 403 desde 2024)
    const url = new URL("https://api.mercadolibre.com/products/search");
    url.searchParams.set("site_id", site);
    url.searchParams.set("status", "active");
    const q = mode === "deals" ? (query || "promocao") : query;
    url.searchParams.set("q", q);
    url.searchParams.set("limit", String(limit));

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    const res = await fetch(url.toString(), { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("ML search error:", res.status, data);
      return json({ error: "Não foi possível buscar produtos agora.", fallback: true, debug: { status: res.status } }, 200);
    }

    const accountId = record?.account_id ?? null;
    const decorate = (permalink: string | null) => {
      if (!permalink) return null;
      try {
        const u = new URL(permalink);
        if (accountId) {
          // Tracking de afiliado (matt_tool é o parâmetro de tracker do programa do ML)
          u.searchParams.set("matt_tool", String(accountId));
          u.searchParams.set("matt_word", "zaplynx");
        }
        return u.toString();
      } catch {
        return permalink;
      }
    };

    const results = Array.isArray(data?.results) ? data.results : [];
    const products = results.map((p: any) => {
      const priceInfo = p?.buy_box_winner ?? {};
      const priceValue = typeof priceInfo.price === "number" ? priceInfo.price : (typeof p.price === "number" ? p.price : null);
      const originalPriceValue = typeof priceInfo.original_price === "number" ? priceInfo.original_price : null;
      const currency = priceInfo.currency_id || p.currency_id || "BRL";
      const picture = Array.isArray(p.pictures) && p.pictures[0]?.url ? p.pictures[0].url : p.thumbnail;
      const permalink = p.permalink || (p.id ? `https://www.mercadolivre.com.br/p/${p.id}` : null);
      const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency });
      return {
        id: String(p.id),
        name: String(p.name ?? p.title ?? ""),
        price: priceValue != null ? fmt(priceValue) : "",
        priceValue,
        originalPrice: originalPriceValue != null && originalPriceValue > (priceValue ?? 0) ? fmt(originalPriceValue) : null,
        discount: originalPriceValue && priceValue && originalPriceValue > priceValue
          ? Math.round(((originalPriceValue - priceValue) / originalPriceValue) * 100)
          : null,
        currency,
        thumbnail: picture ? String(picture).replace(/^http:/, "https:") : null,
        link: decorate(permalink),
        source: "ml" as const,
      };
    });

    return json({ products, total: data?.paging?.total ?? products.length });
  } catch (err) {
    console.error("ml-search error:", err);
    return json({ error: "Erro inesperado.", fallback: true }, 200);
  }
});