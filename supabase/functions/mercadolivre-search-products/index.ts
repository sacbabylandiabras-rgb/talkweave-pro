import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "affiliate-connections";
const PROVIDER = "mercadolivre";

const CATEGORY_KEYWORDS: Record<string, string> = {
  MLB1459: "imoveis apartamento casa terreno",
  MLB1499: "material construcao ferramentas",
  MLB1430: "roupas moda tenis camiseta",
  MLB1132: "brinquedos infantis promocao",
  MLB1051: "celular smartphone oferta",
  MLB1648: "notebook computador informatica",
  MLB1574: "casa decoracao cozinha",
  MLB5726: "eletrodomesticos cozinha oferta",
  MLB1276: "esportes fitness bicicleta",
  MLB1246: "beleza perfume maquiagem",
  MLB1196: "livros promocao",
  MLB1743: "acessorios automotivos carro moto",
  MLB1071: "pet cachorro gato racao",
  MLB1953: "ofertas promocao desconto",
};

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

function extractCatalogProductId(product: any): string | null {
  const candidates = [product?.id, product?.catalog_product_id, product?.product_id];
  const productId = candidates.find((value) => typeof value === "string" && /^ML[A-Z]\d+$/i.test(value));
  return productId ? String(productId).toUpperCase() : null;
}

function safeText(value: unknown, maxLength = 80) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function keywordForRequest(mode: string, query: string, category: string | null) {
  if (query) return query;
  if (category && CATEGORY_KEYWORDS[category]) return CATEGORY_KEYWORDS[category];
  return mode === "deals" ? "promocao oferta desconto" : "";
}

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseAriaMoney(label?: string | null) {
  if (!label) return null;
  const match = decodeHtml(label).match(/(\d[\d.]*)\s+reais(?:\s+com\s+(\d{1,2})\s+centavos)?/i);
  if (!match) return null;
  return Number(`${match[1].replace(/\./g, "")}.${match[2] ?? "00"}`);
}

async function fetchPublicOffers(query: string, category: string | null, accountId: string | number | null, limit: number) {
  const url = new URL("https://www.mercadolivre.com.br/ofertas");
  if (category) url.searchParams.set("category_id", category);
  if (query) url.searchParams.set("q", query);
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const cards = html.match(/<div class="andes-card poly-card[\s\S]*?(?=<div class="andes-card poly-card|<\/main>|$)/g) ?? [];
  const products: any[] = [];
  for (const card of cards) {
    const linkMatch = card.match(/href="(https:\/\/produto\.mercadolivre\.com\.br\/MLB-[^"]+)"/);
    const titleMatch = card.match(/class="poly-component__title"[^>]*>([\s\S]*?)<\/a>/);
    const imageMatch = card.match(/class="poly-component__picture"[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/);
    const currentLabel = card.match(/poly-price__current[\s\S]*?aria-label="([^"]+)"/)?.[1];
    const previousLabel = card.match(/andes-money-amount--previous[\s\S]*?aria-label="([^"]+)"/)?.[1];
    const priceValue = parseAriaMoney(currentLabel);
    if (!linkMatch || !titleMatch || !priceValue || products.some((p) => p.link === decodeHtml(linkMatch[1]))) continue;
    const originalPriceValue = parseAriaMoney(previousLabel);
    const discount = Number(card.match(/(\d+)%\s*OFF/i)?.[1] ?? 0) || null;
    const rawLink = decodeHtml(linkMatch[1]);
    products.push({
      id: rawLink.match(/\/(MLB-\d+)/)?.[1] ?? rawLink,
      name: decodeHtml(titleMatch[1].replace(/<[^>]*>/g, "")).trim(),
      price: formatMoney(priceValue),
      priceValue,
      originalPrice: originalPriceValue && originalPriceValue > priceValue ? formatMoney(originalPriceValue) : null,
      discount,
      currency: "BRL",
      thumbnail: imageMatch?.[1] ? decodeHtml(imageMatch[1]).replace(/^http:/, "https:") : null,
      link: decorateAffiliateLink(rawLink, accountId),
      available: true,
      availableQuantity: 1,
      source: "ml" as const,
    });
    if (products.length >= limit) break;
  }
  return products;
}

function isUnavailableItem(item: any) {
  const status = String(item?.status ?? "").toLowerCase();
  const qty = Number(item?.available_quantity ?? 0);
  const buyingMode = String(item?.buying_mode ?? "").toLowerCase();
  return (status && status !== "active") || qty <= 0 || (buyingMode && buyingMode !== "buy_it_now");
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
    const query = safeText(body?.query, 100);
    const mode = String(body?.mode ?? "search"); // "search" | "deals"
    const site = /^[A-Z]{3}$/.test(String(body?.site ?? "MLB").toUpperCase()) ? String(body?.site ?? "MLB").toUpperCase() : "MLB";
    const category = typeof body?.category === "string" && /^ML[A-Z]\d+$/i.test(body.category.trim()) ? body.category.trim().toUpperCase() : null;
    const limit = Math.min(Math.max(Number(body?.limit ?? 24), 1), 50);
    if (mode === "search" && !query && !category) return json({ error: "Informe um termo de busca." }, 400);

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

    const url = new URL(`https://api.mercadolibre.com/sites/${site}/search`);
    const q = keywordForRequest(mode, query, category);
    if (q) url.searchParams.set("q", q);
    if (category) url.searchParams.set("category", category);
    url.searchParams.set("condition", "new");
    url.searchParams.set("buying_mode", "buy_it_now");
    url.searchParams.set("sort", "relevance");
    url.searchParams.set("limit", String(Math.min(limit * 3, 50)));

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    const accountId = record?.account_id ?? null;
    let { res, data } = await getJson(url.toString(), headers);
    if (!res.ok) {
      console.warn("ML public search failed, trying catalog:", res.status, data);
      const catalogUrl = new URL("https://api.mercadolibre.com/products/search");
      catalogUrl.searchParams.set("site_id", site);
      catalogUrl.searchParams.set("status", "active");
      catalogUrl.searchParams.set("q", q || "promocao oferta desconto");
      catalogUrl.searchParams.set("limit", String(Math.min(limit * 3, 50)));
      ({ res, data } = await getJson(catalogUrl.toString(), headers));
      if (!res.ok) {
        console.error("ML search error:", res.status, data);
        const publicOffers = await fetchPublicOffers(q, category, accountId, limit);
        return json({ products: publicOffers, total: publicOffers.length, fallback: true, debug: { status: res.status } }, 200);
      }
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    const directProducts = results
      .map((p: any) => mapAvailableItem(p, p, accountId))
      .filter(Boolean)
      .slice(0, limit);
    if (directProducts.length > 0) return json({ products: directProducts, total: data?.paging?.total ?? directProducts.length });

    let enrichedResults = results;
    let itemIds = Array.from(new Set(enrichedResults.map(extractWinnerItemId).filter(Boolean))).slice(0, limit) as string[];
    if (itemIds.length === 0) {
      const productIds = Array.from(new Set(results.map(extractCatalogProductId).filter(Boolean))).slice(0, limit) as string[];
      const productDetails: any[] = [];
      for (let i = 0; i < productIds.length; i += 6) {
        const details = await Promise.all(productIds.slice(i, i + 6).map(async (productId) => {
          const detail = await getJson(`https://api.mercadolibre.com/products/${productId}`, headers);
          return detail.res.ok ? detail.data : null;
        }));
        productDetails.push(...details.filter(Boolean));
      }
      enrichedResults = productDetails.length > 0 ? productDetails : results;
      itemIds = Array.from(new Set(enrichedResults.map(extractWinnerItemId).filter(Boolean))).slice(0, limit) as string[];
    }

    const itemsById = new Map<string, any>();
    for (let i = 0; i < itemIds.length; i += 20) {
      const ids = itemIds.slice(i, i + 20);
      const itemsRes = await fetch(`https://api.mercadolibre.com/items?ids=${encodeURIComponent(ids.join(","))}`, { headers });
      const itemsData = await itemsRes.json().catch(() => []);
      if (!itemsRes.ok) {
        console.error("ML items error:", itemsRes.status, itemsData);
        continue;
      }
      if (Array.isArray(itemsData)) {
        for (const entry of itemsData) {
          if (entry?.code === 200 && entry?.body?.id) itemsById.set(String(entry.body.id).toUpperCase(), entry.body);
        }
      }
    }

    const products = enrichedResults
      .map((p: any) => {
        const itemId = extractWinnerItemId(p);
        if (!itemId) return null;
        return mapAvailableItem(itemsById.get(itemId), p, accountId);
      })
      .filter(Boolean)
      .slice(0, limit);

    return json({ products, total: data?.paging?.total ?? products.length });
  } catch (err) {
    console.error("ml-search error:", err);
    return json({ error: "Erro inesperado.", fallback: true }, 200);
  }
});