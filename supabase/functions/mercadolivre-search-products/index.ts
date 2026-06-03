import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "affiliate-connections";
const PROVIDER = "mercadolivre";

const CATEGORY_KEYWORDS: Record<string, string> = {
  MLB1574: "moveis decoracao cozinha",
  MLB1499: "material construcao ferramentas",
  MLB1430: "roupas moda tenis camiseta",
  MLB1132: "brinquedos infantis promocao",
  MLB1051: "celular smartphone oferta",
  MLB1648: "notebook computador informatica",
  MLB5726: "eletrodomesticos cozinha oferta",
  MLB1276: "esportes fitness bicicleta",
  MLB1246: "beleza perfume maquiagem",
  MLB1196: "livros promocao",
  MLB1743: "acessorios automotivos carro moto",
  MLB1071: "pet cachorro gato racao",
  MLB1953: "ofertas promocao desconto",
  MLB3000: "ofertas", // Adicionando uma padrão para promoções gerais
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

// Envelopa o link final no encurtador interno do ZapLynx para rastreio (link_clicks)
function wrapInTracker(link: string | null, userId: string | null): string | null {
  if (!link) return null;
  try {
    const tracker = new URL("https://go.zaplynxpro.online/r");
    tracker.searchParams.set("url", link);
    tracker.searchParams.set("src", "afiliado");
    tracker.searchParams.set("flow", "mercadolivre");
    tracker.searchParams.set("btn", "produto");
    if (userId) tracker.searchParams.set("uid", userId);
    return tracker.toString();
  } catch {
    return link;
  }
}

// Gera shortlinks oficiais mercadolivre.com/sec/XXX via API do Programa de Afiliados.
// Usa cache em public.ml_affiliate_link_cache para evitar regerar o mesmo link.
async function generateAffiliateShortlinks(
  admin: any,
  userId: string,
  accessToken: string,
  sourceId: string | null,
  originalUrls: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!sourceId || originalUrls.length === 0) return map;

  // 1) Consulta cache
  try {
    const { data: cached } = await admin
      .from("ml_affiliate_link_cache")
      .select("original_url, short_url")
      .eq("user_id", userId)
      .eq("source_id", sourceId)
      .in("original_url", originalUrls);
    for (const row of cached ?? []) map[row.original_url] = row.short_url;
  } catch (err) {
    console.warn("ml shortlink cache read failed:", err);
  }

  const missing = originalUrls.filter((u) => !map[u]);
  if (missing.length === 0) return map;

  // 2) Tenta múltiplos endpoints conhecidos da API de afiliados
  const endpoints = [
    "https://api.mercadolibre.com/affiliate-program/v1/links",
    "https://api.mercadolibre.com/affiliate-program/v1/advertisers/me/links",
  ];

  const generated: Array<{ original: string; short: string }> = [];
  for (const endpoint of endpoints) {
    if (generated.length > 0) break;
    // Processa em lotes de 20
    for (let i = 0; i < missing.length; i += 20) {
      const batch = missing.slice(i, i + 20);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ urls: batch, source_id: sourceId }),
        });
        const data: any = await res.json().catch(() => null);
        if (!res.ok) {
          console.warn(`ml shortlink ${endpoint} -> ${res.status}`, JSON.stringify(data).slice(0, 300));
          break;
        }
        const list = Array.isArray(data) ? data : (data?.urls ?? data?.links ?? data?.results ?? []);
        for (let k = 0; k < list.length; k++) {
          const entry = list[k];
          const original = entry?.original_url ?? entry?.url ?? entry?.long_url ?? batch[k];
          const short = entry?.short_url ?? entry?.shortened_url ?? entry?.url_short ?? entry?.url;
          if (original && short && /\/sec\//.test(String(short))) {
            generated.push({ original: String(original), short: String(short) });
            map[String(original)] = String(short);
          }
        }
      } catch (err) {
        console.warn(`ml shortlink ${endpoint} batch failed:`, err);
      }
    }
  }

  // 3) Grava cache
  if (generated.length > 0) {
    try {
      await admin.from("ml_affiliate_link_cache").upsert(
        generated.map(({ original, short }) => ({
          user_id: userId,
          source_id: sourceId,
          original_url: original,
          short_url: short,
        })),
        { onConflict: "user_id,source_id,original_url" },
      );
    } catch (err) {
      console.warn("ml shortlink cache write failed:", err);
    }
  }

  return map;
}

function stripAffiliateParams(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    ["matt_tool", "matt_word"].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
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
  // Se for busca manual por termo, não queremos injetar palavras de categoria genéricas
  if (category && !query && CATEGORY_KEYWORDS[category]) return CATEGORY_KEYWORDS[category];
  return mode === "deals" ? "ofertas" : "";
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

async function fetchPublicOffers(query: string, category: string | null, accountId: string | number | null, limit: number, offset = 0) {
  // Se tem query, usa a busca real do ML; se não, usa a página de ofertas
  let url: URL;
  if (query) {
    url = new URL("https://lista.mercadolivre.com.br/" + encodeURIComponent(query.replace(/\s+/g, "-")));
    if (category) url.searchParams.set("category", category);
    if (offset > 0) url.searchParams.set("_from", String(offset + 1));
  } else {
    url = new URL("https://www.mercadolivre.com.br/ofertas");
    if (category) url.searchParams.set("category", category);
    if (offset > 0) url.searchParams.set("offset", String(offset));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });
  if (!res.ok) {
    console.error(`FetchPublicOffers failed: ${res.status} for ${url.toString()}`);
    return [];
  }
  const html = await res.text();
  const cards = html.match(/<div\s+class="[^"]*andes-card\s+poly-card[^"]*"[\s\S]*?(?=<div\s+class="[^"]*andes-card\s+poly-card[^"]*"|<\/main>|$)/g) 
             || html.match(/<li\s+class="[^"]*ui-search-layout__item[^"]*"[\s\S]*?(?=<li\s+class="[^"]*ui-search-layout__item[^"]*"|<\/ol>|$)/g)
             || html.match(/<div\s+class="[^"]*ui-search-result[^"]*"[\s\S]*?(?=<div\s+class="[^"]*ui-search-result[^"]*"|<\/main>|$)/g)
             || [];
             
  console.log(`FetchPublicOffers: HTML length: ${html.length}, Cards found: ${cards.length}`);
  
  const products: any[] = [];
  for (const card of cards) {
    const linkMatch = card.match(/href="(https:\/\/(?:produto\.mercadolivre\.com\.br|www\.mercadolivre\.com\.br)\/[^"]+MLB[^"]+)"/)
                    || card.match(/href="([^"]*articulo\.mercadolibre\.com\.br[^"]*)"/);
    const titleMatch = card.match(/class="(?:poly-component__title|ui-search-item__title|ui-search-item__group__element\s+ui-search-link)"[^>]*>([\s\S]*?)<\/a>/)
                    || card.match(/<h[23] class="ui-search-item__title"[^>]*>([\s\S]*?)<\/h[23]>/)
                    || card.match(/aria-label="([^"]+)"/);
    const imageMatch = card.match(/(?:src|data-src)="(https:\/\/http2\.mlstatic\.com\/[^"]+)"/)
                    || card.match(/src="([^"]+)"/);
    const currentLabel = card.match(/poly-price__current[\s\S]*?aria-label="([^"]+)"/)?.[1]
                     || card.match(/ui-search-price__second-line[\s\S]*?aria-label="([^"]+)"/)?.[1]
                     || card.match(/andes-money-amount[\s\S]*?aria-label="([^"]+)"/)?.[1];
    const previousLabel = card.match(/andes-money-amount--previous[\s\S]*?aria-label="([^"]+)"/)?.[1]
                       || card.match(/ui-search-price__part--old[\s\S]*?aria-label="([^"]+)"/)?.[1];
    
    let priceValue = parseAriaMoney(currentLabel);
    
    // Fallback para preço se aria-label falhar
    if (!priceValue) {
      const priceTextMatch = card.match(/<span class="andes-money-amount__fraction"[^>]*>([\d.]+)<\/span>/);
      if (priceTextMatch) {
        priceValue = Number(priceTextMatch[1].replace(/\./g, ""));
        const centsMatch = card.match(/<span class="andes-money-amount__cents"[^>]*>(\d+)<\/span>/);
        if (centsMatch) priceValue += Number(centsMatch[1]) / 100;
      }
    }

    if (!linkMatch || !titleMatch || !priceValue) continue;
    
    const rawLink = decodeHtml(linkMatch[1]);
    if (products.some((p) => p.link === rawLink)) continue;
    
    const originalPriceValue = parseAriaMoney(previousLabel);
    const discount = Number(card.match(/(\d+)%\s*OFF/i)?.[1] ?? 0) || null;
    
    products.push({
      id: rawLink.match(/MLB-?(\d+)/)?.[0] ?? rawLink,
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

function isUnavailableItem(item: any, strict = true) {
  if (!item) return true;
  const status = String(item?.status ?? "").toLowerCase();
  // Só rejeita se explicitamente pausado/fechado
  if (status && status !== "active" && status !== "") return true;
  if (!strict) return false; // no modo permissivo, não filtra por qty/buying_mode
  const qty = Number(item?.available_quantity ?? -1);
  if (qty === 0) return true; // só rejeita se explicitamente zero
  const buyingMode = String(item?.buying_mode ?? "").toLowerCase();
  if (buyingMode && buyingMode !== "buy_it_now" && buyingMode !== "") return true;
  return false;
}

function mapAvailableItem(item: any, fallback: any, accountId: string | number | null, strict = true) {
  if (!item || isUnavailableItem(item, strict)) return null;

  const winner = fallback?.buy_box_winner ?? {};
  const priceValue = typeof item?.price === "number"
    ? item.price
    : (typeof winner?.price === "number" ? winner.price : null);
  if (!priceValue || priceValue <= 0) return null;

  const originalPriceValue = typeof item?.original_price === "number"
    ? item.original_price
    : (typeof winner?.original_price === "number" ? winner.original_price : null);
  const currency = item?.currency_id || winner?.currency_id || fallback?.currency_id || "BRL";
  const picture = item?.pictures?.[0]?.secure_url || item?.pictures?.[0]?.url || item?.secure_thumbnail || item?.thumbnail || fallback?.thumbnail;
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
    const query = safeText(body?.query ?? body?.q, 100);
    const mode = String(body?.mode ?? "search"); // "search" | "deals"
    const site = /^[A-Z]{3}$/.test(String(body?.site ?? "MLB").toUpperCase()) ? String(body?.site ?? "MLB").toUpperCase() : "MLB";
    const category = typeof body?.category === "string" && /^ML[A-Z]\d+$/i.test(body.category.trim()) ? body.category.trim().toUpperCase() : null;
    const limit = Math.min(Math.max(Number(body?.limit ?? 50), 1), 100);
    const offset = Math.max(Number(body?.offset ?? 0), 0);

    console.log(`[Search] Mode: ${mode}, Query: "${query}", Category: ${category}, Offset: ${offset}, UserID: ${userData.user.id}`);

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

    const q = keywordForRequest(mode, query, category);
    const accountId = record?.account_id ?? null;
    const trackedUserId = userData.user.id;

    // Detectar se a busca contém atributos como voltagem
    const hasVoltage = /\b(110v|220v|127v|bivolt)\b/i.test(q);
    
    const url = new URL(`https://api.mercadolibre.com/sites/${site}/search`);
    if (q) {
      // Normalização: remove excesso de espaços e limpa para a API
      const normalizedQuery = q.trim().replace(/\s+/g, " ");
      url.searchParams.set("q", normalizedQuery);
      
      // CRITICAL: Se o usuário enviou uma palavra-chave específica, queremos os resultados mais RELEVANTES.
      // A API do ML às vezes retorna lixo se usarmos 'scan' ou filtros restritivos.
      // Vamos usar a busca padrão mas garantir que a ordenação de relevância seja respeitada.
      url.searchParams.set("sort", "relevance");
      
      // Experimentar remover search_type=scan que pode estar limitando a busca em alguns casos de produtos muito específicos
      // url.searchParams.set("search_type", "scan");
    }
    
    if (category) url.searchParams.set("category", category);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    
    // Sinônimos e variações comuns para melhor matching
    const SYNONYMS: Record<string, string[]> = {
      "inox": ["inoxidavel", "aço inoxidável", "prateado", "silver", "escovado", "platina"],
      "touch": ["digital", "painel touch", "tela touch", "touchscreen", "led"],
      "painel touch": ["touch", "digital", "display digital", "display led"],
      "fritadeira": ["air fryer", "airfryer", "fritadeira sem oleo", "fritadeira eletrica"],
      "oster": ["osterizer"],
      "5l": ["5 litros", "5lts", "5 l"],
    };

    // Função auxiliar para calcular score de matching do título
    const calculateMatchScore = (productName: string, searchTerm: string) => {
      const name = productName.toLowerCase();
      const term = searchTerm.toLowerCase();
      
      // 1. Match exato total: topo absoluto
      if (name === term) return 10000;
      
      const termWords = term.split(/\s+/).filter(w => w.length >= 2);
      if (termWords.length === 0) return 0;

      let score = 0;
      
      // 2. Ordem exata: se as palavras aparecem na mesma ordem do termo original
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (name.includes(term)) {
        score += 5000;
      }

      // 3. Contagem de palavras e sinônimos
      let matches = 0;
      let lastIndex = -1;
      let wordsInOrder = 0;
      let essentialWordsMatch = 0;

      // Palavras essenciais (geralmente as primeiras da busca como a marca e tipo do produto)
      const essentialWords = termWords.slice(0, 3);

      for (const word of termWords) {
        let foundIndex = name.indexOf(word);
        
        // Se não achou a palavra, tenta os sinônimos
        if (foundIndex === -1 && SYNONYMS[word]) {
          for (const syn of SYNONYMS[word]) {
            const synIndex = name.indexOf(syn);
            if (synIndex !== -1) {
              foundIndex = synIndex;
              break;
            }
          }
        }

        if (foundIndex !== -1) {
          matches++;
          if (essentialWords.includes(word)) essentialWordsMatch++;
          if (foundIndex > lastIndex) {
            wordsInOrder++;
            lastIndex = foundIndex;
          }
        }
      }

      // 4. Bônus agressivo por cobertura de palavras essenciais
      const essentialCoverage = essentialWordsMatch / essentialWords.length;
      score += essentialCoverage * 3000;

      // 5. Bônus por cobertura total (quantas palavras do termo estão no título)
      const coverage = matches / termWords.length;
      score += coverage * 2000;

      // 6. Bônus por ordem relativa
      const orderBonus = wordsInOrder / termWords.length;
      score += orderBonus * 1000;

      // 7. Penalidade por excesso de palavras (títulos muito longos e genéricos perdem para os precisos)
      const nameWords = name.split(/\s+/).length;
      score -= nameWords * 10;

      return score;
    };

    const applyTracker = (items: any[]) => {
      for (const p of items) {
        if (p?.link) p.link = wrapInTracker(p.link, trackedUserId);
      }
      return items;
    };

    console.log(`[Search] Mode: ${mode}, Query: "${query}", Category: ${category}, Offset: ${offset}, UserID: ${userData.user.id}`);
    console.log(`ML Request URL: ${url.toString()}`);
    let { res, data } = await getJson(url.toString(), headers);
    
    console.log(`ML Response status: ${res.status}`);
    console.log(`ML Results count: ${data?.results?.length ?? 'N/A'}`);

    // Se a busca principal falhar (403 ou outros), ou não retornar resultados, tenta abordagens alternativas
    if (!res.ok || (Array.isArray(data?.results) && data.results.length === 0)) {
      console.warn(`ML search ${res.status} ou sem resultados. Tentando catalog search...`);
      
      // Busca ofertas públicas (scraping/HTML) imediatamente em paralelo com outras tentativas se falhou
      const publicOffersPromise = fetchPublicOffers(q, category, accountId, limit, offset);
      
      const catalogUrl = new URL("https://api.mercadolibre.com/products/search");
      catalogUrl.searchParams.set("site_id", site);
      if (q) catalogUrl.searchParams.set("q", q);
      catalogUrl.searchParams.set("limit", String(limit));
      catalogUrl.searchParams.set("offset", String(offset));
      
      console.log(`ML Catalog Request URL: ${catalogUrl.toString()}`);
      const catalogSearch = await getJson(catalogUrl.toString(), headers);
      
      if (catalogSearch.res.ok && Array.isArray(catalogSearch.data?.results) && catalogSearch.data.results.length > 0) {
        console.log("Catalog search obteve resultados.");
        res = catalogSearch.res;
        data = catalogSearch.data;
      } else {
        // Se ainda falhar, aguarda as ofertas públicas
        console.warn("Catalog search falhou ou sem resultados. Aguardando ofertas públicas...");
        const publicOffers = await publicOffersPromise;
        console.log(`Public offers found: ${publicOffers.length}`);
        
        if (publicOffers.length > 0) {
          applyTracker(publicOffers);
          return json({ products: publicOffers, total: 1000, fallback: true }, 200);
        }
        
        // Se realmente não achou nada e o original deu erro
        if (!res.ok) {
          console.error("ML search final error:", res.status, data);
          return json({ error: `Erro na API do Mercado Livre (${res.status}).`, products: [], total: 0 }, 200);
        }
      }
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    
    // Processamento inicial dos produtos diretos com reordenação por matching
    const processAndSortProducts = (items: any[]) => {
      const mapped = items
        .map((p: any) => mapAvailableItem(p, p, accountId, false))
        .filter(Boolean);
      
      if (q && q.length > 1) {
        mapped.sort((a, b) => {
          const scoreA = calculateMatchScore(a.name, q);
          const scoreB = calculateMatchScore(b.name, q);
          return scoreB - scoreA;
        });
      }
      return mapped;
    };

    const directProducts = processAndSortProducts(results);
    
    // Só retorna direto se tiver 50+ produtos com dados completos (preço e link válidos)
    if (directProducts.length >= 50) {
      applyTracker(directProducts);
      return json({ products: directProducts, total: data?.paging?.total ?? 1000 });
    }

    let enrichedResults = results;
    let itemIds = Array.from(new Set(enrichedResults.map(extractWinnerItemId).filter(Boolean))) as string[];
    if (itemIds.length === 0) {
      const productIds = Array.from(new Set(results.map(extractCatalogProductId).filter(Boolean))) as string[];
      const productDetails: any[] = [];
      for (let i = 0; i < productIds.length; i += 6) {
        const details = await Promise.all(productIds.slice(i, i + 6).map(async (productId) => {
          const detail = await getJson(`https://api.mercadolibre.com/products/${productId}`, headers);
          return detail.res.ok ? detail.data : null;
        }));
        productDetails.push(...details.filter(Boolean));
      }
      enrichedResults = productDetails.length > 0 ? productDetails : results;
      itemIds = Array.from(new Set(enrichedResults.map(extractWinnerItemId).filter(Boolean))) as string[];
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

    let products = enrichedResults
      .map((p: any) => {
        const itemId = extractWinnerItemId(p);
        if (!itemId) return null;
        return mapAvailableItem(itemsById.get(itemId) ?? p, p, accountId, false);
      })
      .filter(Boolean);

    if (products.length === 0) {
      const publicOffers = await fetchPublicOffers(q, category, accountId, limit, offset);
      // Reordena ofertas públicas também
      if (q && q.length > 1) {
        publicOffers.sort((a: any, b: any) => calculateMatchScore(b.name, q) - calculateMatchScore(a.name, q));
      }
      applyTracker(publicOffers);
      return json({ products: publicOffers, total: 1000, fallback: true });
    }

    // Ordenação final para resultados enriquecidos
    if (q && q.length > 1) {
      products.sort((a, b) => calculateMatchScore(b.name, q) - calculateMatchScore(a.name, q));
    }

    applyTracker(products);
    return json({ products, total: data?.paging?.total ?? 1000 });

  } catch (err) {
    console.error("ml-search error:", err);
    return json({ error: "Erro inesperado.", fallback: true }, 200);
  }
});