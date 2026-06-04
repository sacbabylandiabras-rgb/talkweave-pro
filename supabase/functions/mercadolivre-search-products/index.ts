import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "affiliate-connections";
const PROVIDER = "mercadolivre";

const CATEGORY_KEYWORDS: Record<string, string> = {
  MLB1574: "moveis decoracao",
  MLB1499: "ferramentas construcao",
  MLB1430: "moda roupas",
  MLB1132: "brinquedos",
  MLB1051: "smartphone celular",
  MLB1648: "informatica notebook",
  MLB5726: "eletrodomesticos",
  MLB1276: "esportes",
  MLB1246: "beleza",
  MLB1196: "livros",
  MLB1743: "automotivo",
  MLB1071: "pets",
  MLB1953: "ofertas",
  MLB3000: "promocao",
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

function wrapInTracker(link: string | null, userId: string | null): string | null {
  if (!link) return null;
  try {
    const tracker = new URL("https://go.zaplynxpro.online/r");
    tracker.searchParams.set("url", link);
    tracker.searchParams.set("src", "afiliado");
    tracker.searchParams.set("flow", "mercadolivre");
    if (userId) tracker.searchParams.set("uid", userId);
    return tracker.toString();
  } catch {
    return link;
  }
}

async function generateOfficialShortlinks(
  admin: any,
  userId: string,
  accessToken: string,
  sourceId: string | null,
  originalUrls: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!sourceId || originalUrls.length === 0) return map;

  try {
    const { data: cached } = await admin
      .from("ml_affiliate_link_cache")
      .select("original_url, short_url")
      .eq("user_id", userId)
      .eq("source_id", sourceId)
      .in("original_url", originalUrls);
    for (const row of cached ?? []) map[row.original_url] = row.short_url;
  } catch (err) {
    console.warn("ml link cache error:", err);
  }

  const missing = originalUrls.filter((u) => !map[u]);
  if (missing.length === 0) return map;

  const generated: Array<{ original: string; short: string }> = [];
  for (let i = 0; i < missing.length; i += 20) {
    const batch = missing.slice(i, i + 20);
    try {
      const res = await fetch("https://api.mercadolibre.com/affiliate-program/v1/links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ urls: batch, source_id: sourceId }),
      });
      const data: any = await res.json().catch(() => null);
      if (res.ok) {
        const list = Array.isArray(data) ? data : (data?.urls ?? data?.links ?? []);
        list.forEach((entry: any, k: number) => {
          const original = entry?.original_url ?? batch[k];
          const short = entry?.short_url ?? entry?.url;
          if (original && short) {
            generated.push({ original: String(original), short: String(short) });
            map[String(original)] = String(short);
          }
        });
      }
    } catch (err) {
      console.warn("ml link gen error:", err);
    }
  }

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
      console.warn("ml cache write error:", err);
    }
  }

  return map;
}

async function fetchPublicOffers(query: string, category: string | null, accountId: string | number | null, limit: number, offset = 0) {
  let url: URL;
  if (query) {
    url = new URL("https://lista.mercadolivre.com.br/" + encodeURIComponent(query.replace(/\s+/g, "-")));
    if (offset > 0) url.searchParams.set("_from", String(offset + 1));
  } else {
    url = new URL("https://www.mercadolivre.com.br/ofertas");
    if (category) url.searchParams.set("category", category);
    if (offset > 0) url.searchParams.set("offset", String(offset));
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extrai IDs MLB do HTML usando regex mais robusto
    const idRegex = /MLB-?(\d{8,15})/gi;
    const ids: string[] = [];
    const seen = new Set<string>();
    
    let match;
    while ((match = idRegex.exec(html)) !== null) {
      const id = "MLB" + match[1];
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
      if (ids.length >= limit * 2) break;
    }

    if (ids.length === 0) return [];

    console.log(`Scraping found ${ids.length} MLB IDs, fetching via public API...`);

    // Busca detalhes via API pública (sem autenticação)
    const products: any[] = [];
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      try {
        const detailRes = await fetch(
          `https://api.mercadolibre.com/items?ids=${batch.join(",")}&attributes=id,title,price,original_price,thumbnail,secure_thumbnail,pictures,permalink,status,available_quantity,currency_id`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "application/json",
            }
          }
        );
        if (!detailRes.ok) continue;
        const detailData = await detailRes.json();

        for (const entry of detailData) {
          if (entry.code !== 200 || !entry.body) continue;
          const item = entry.body;
          if (item.status && item.status !== "active") continue;
          if (!item.price || !item.permalink) continue;

          // Pega a melhor foto disponível
          let thumbnail: string | null =
            item.pictures?.[0]?.secure_url ||
            item.pictures?.[0]?.url ||
            item.secure_thumbnail ||
            item.thumbnail ||
            null;

          if (thumbnail) {
            thumbnail = thumbnail.replace(/^http:/, "https:");
            // Upgrade para resolução maior
            thumbnail = thumbnail.replace(/-[WIGM]\.(jpg|jpeg|png|webp)$/i, "-O.$1");
          }

          const originalPrice = item.original_price;
          products.push({
            id: item.id,
            name: item.title,
            price: formatMoney(item.price, item.currency_id || "BRL"),
            priceValue: item.price,
            originalPrice: originalPrice && originalPrice > item.price
              ? formatMoney(originalPrice, item.currency_id || "BRL")
              : null,
            discount: originalPrice && originalPrice > item.price
              ? Math.round(((originalPrice - item.price) / originalPrice) * 100)
              : null,
            thumbnail,
            link: decorateAffiliateLink(item.permalink, accountId),
            source: "ml",
            available: true,
          });

          if (products.length >= limit) break;
        }
      } catch (err) {
        console.warn("Public API batch error:", err);
      }
      if (products.length >= limit) break;
    }

    return products;
  } catch (err) {
    console.error("fetchPublicOffers error:", err);
    return [];
  }
}

async function getDetails(ids: string[], accessToken: string) {
  const map = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
      
      const res = await fetch(`https://api.mercadolibre.com/items?ids=${batch.join(",")}`, { 
        headers: {
          ...headers,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
      });
      if (res.ok) {
        const data = await res.json();
        data.forEach((item: any) => {
          if (item.code === 200) map.set(item.body.id, item.body);
        });
      }
    } catch {}
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

    const authHeader = req.headers.get("authorization") || "";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const query = body.query || body.q || "";
    const category = body.category || null;
    const mode = body.mode || "search";
    const limit = Math.min(Number(body.limit || 50), 100);
    const offset = Number(body.offset || 0);

    // Busca token no storage (BUCKET/user_id/provider.json)
    const { data: storageData, error: storageErr } = await admin.storage
      .from(BUCKET)
      .download(`${user.id}/${PROVIDER}.json`);

    if (storageErr || !storageData) {
      console.log("Fallback to public offers - account not connected for user (storage):", user.id);
      const publicProducts = await fetchPublicOffers(query, category, null, limit, offset);
      return json({ products: publicProducts, total: 1000, fallback: true });
    }

    let record = JSON.parse(await storageData.text());
    let accessToken = record.access_token;

    // Refresh token check
    const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
    if (expiresAt < Date.now() + 60000 && record.refresh_token) {
      console.log("Refreshing ML token for user:", user.id);
      const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: ML_CLIENT_ID!,
          client_secret: ML_CLIENT_SECRET!,
          refresh_token: record.refresh_token,
        }),
      });
      if (refreshRes.ok) {
        const newData = await refreshRes.json();
        accessToken = newData.access_token;
        const updatedRecord = {
          ...record,
          access_token: accessToken,
          refresh_token: newData.refresh_token || record.refresh_token,
          expires_at: new Date(Date.now() + newData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await admin.storage
          .from(BUCKET)
          .upload(`${user.id}/${PROVIDER}.json`, JSON.stringify(updatedRecord), {
            upsert: true,
            contentType: "application/json",
          });
          
        record = updatedRecord;
      } else {
        const errText = await refreshRes.text();
        console.error("Failed to refresh ML token:", refreshRes.status, errText);
      }
    }

    // Tenta API pública de busca (sem autenticação) como primeira opção para busca e detalhes
    // pois o token pode ter restrições de permissão para busca pública
    const q = query || (category && CATEGORY_KEYWORDS[category]) || "ofertas";
    console.log(`[Search] query="${q}" category=${category} offset=${offset}`);

    const searchUrl = new URL(`https://api.mercadolibre.com/sites/MLB/search`);
    searchUrl.searchParams.set("q", q);
    if (category) searchUrl.searchParams.set("category", category);
    searchUrl.searchParams.set("limit", String(limit));
    searchUrl.searchParams.set("offset", String(offset));

    let searchRes;
    let searchData: any = null;

    // Tentativa 1: Busca Autenticada (Com Token) - Prioridade agora que corrigimos o token
    if (accessToken) {
      try {
        console.log(`[Auth] Searching: ${searchUrl.toString()}`);
        searchRes = await fetch(searchUrl.toString(), {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (searchRes.ok) {
          searchData = await searchRes.json();
          console.log(`[Auth] Success: found ${searchData?.results?.length || 0} results`);
        } else {
          console.warn(`[Auth] Search failed: ${searchRes.status}`);
        }
      } catch (err) {
        console.error(`[Auth] Search error:`, err);
      }
    }

    // Tentativa 2: Busca Pública (Sem Token) - Caso a autenticada falhe ou não tenha token
    if (!searchData || !searchData.results || searchData.results.length === 0) {
      try {
        console.log(`[Public] Searching: ${searchUrl.toString()}`);
        searchRes = await fetch(searchUrl.toString(), {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          }
        });
        if (searchRes.ok) {
          searchData = await searchRes.json();
          console.log(`[Public] Success: found ${searchData?.results?.length || 0} results`);
        } else {
          console.warn(`[Public] Search failed: ${searchRes.status}`);
        }
      } catch (err) {
        console.error(`[Public] Search error:`, err);
      }
    }


    let results = searchData?.results || [];
    let total = searchData?.paging?.total || 0;

    // Tentativa 3: Scraping (Último Recurso)
    if (results.length === 0) {
      console.log("[Fallback] No results from API, trying scraping...");
      const publicProducts = await fetchPublicOffers(query, category, record?.account_id, limit, offset);
      if (publicProducts && publicProducts.length > 0) {
        console.log(`[Done] Returning ${publicProducts.length} scraped products`);
        return json({ products: publicProducts, total: 1000, fallback: true });
      }
    }

    // Se ainda não tiver resultados, retorna lista vazia antes de tentar processar
    if (results.length === 0) {
      return json({ products: [], total: 0 });
    }

    // Busca detalhes via API pública (sem autenticação, não precisa de token)
    const itemIds = results.map((r: any) => r.id).filter(Boolean);
    
    // Tenta com token, senão sem token
    let detailsMap = await getDetails(itemIds, accessToken);
    if (detailsMap.size === 0) {
      detailsMap = await getDetails(itemIds, ""); // sem token
    }

    let products = results.map((r: any) => {
      const item = detailsMap.get(r.id) || r;
      const price = item.price || r.price;
      const originalPrice = item.original_price || r.original_price;

      // Pega a melhor thumbnail disponível, em ordem de preferência
      let thumbnail: string | null = null;

      // 1. Primeira foto de alta res das pictures do item detalhado
      if (item.pictures && item.pictures.length > 0) {
        thumbnail = item.pictures[0].secure_url || item.pictures[0].url || null;
      }

      // 2. Thumbnail do item detalhado
      if (!thumbnail) {
        thumbnail = item.secure_thumbnail || item.thumbnail || null;
      }

      // 3. Thumbnail do resultado bruto da busca
      if (!thumbnail) {
        thumbnail = r.thumbnail || r.secure_thumbnail || null;
      }

      // 4. Limpa e faz upgrade de resolução
      if (thumbnail) {
        thumbnail = thumbnail
          .replace(/^http:/, "https:")
          .replace(/\/D_NQ_NP_(\d+-\w+)-[A-Z]\.(\w+)$/i, "/D_NQ_NP_$1-O.$2")
          .replace(/-[WIGM]\.(jpg|jpeg|png|webp)$/i, "-O.$1");
      }

      return {
        id: item.id || r.id,
        name: item.title || r.title,
        price: formatMoney(price),
        priceValue: price,
        originalPrice: originalPrice && originalPrice > price ? formatMoney(originalPrice) : null,
        discount: originalPrice && originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : null,
        thumbnail,
        link: item.permalink || r.permalink,
        source: "ml",
        available: item.status === "active" || !item.status,
      };
    }).filter((p: any) => p.link);

    // Shortlink generation
    // Tenta usar affiliate_source_id do banco, ou extrai do raw se disponível
    const sourceId = record.account_id || record.raw?.affiliate_source_id;
    if (sourceId && products.length > 0 && accessToken) {
      const originalUrls = products.map(p => p.link);
      const shortlinkMap = await generateOfficialShortlinks(admin, user.id, accessToken, sourceId, originalUrls);
      products = products.map(p => ({
        ...p,
        link: shortlinkMap[p.link] || decorateAffiliateLink(p.link, record.account_id),
      }));
    } else {
      products = products.map(p => ({
        ...p,
        link: decorateAffiliateLink(p.link, record.account_id),
      }));
    }

    // Tracker wrapping
    products = products.map(p => ({
      ...p,
      link: wrapInTracker(p.link, user.id),
    }));

    return json({ products, total });

  } catch (err) {
    console.error("Main error:", err);
    return json({ error: "Internal error", details: err.message }, 500);
  }
});
