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

function getVolumeLabel(item: any) {
  if (item.promotion_type !== "VOLUME" && item.type !== "VOLUME") return null;
  
  const subType = item.sub_type;
  const buyQ = item.buy_quantity;
  const payQ = item.pay_quantity;
  const discP = item.discount_percentage;

  if (subType === "BNGM" && buyQ && payQ) {
    return `Leve ${buyQ} Pague ${payQ}`;
  }
  if (subType === "BNSP" && buyQ && discP) {
    return `Compre ${buyQ} com ${discP}% OFF`;
  }
  if (subType === "SPONTH" && buyQ && discP) {
    return `${discP}% OFF na ${buyQ}ª unidade`;
  }
  return null;
}

function getPromotionLabel(item: any) {
  const volumeLabel = getVolumeLabel(item);
  if (volumeLabel) return volumeLabel;

  switch (item.promotion_type) {
    case "PRE_NEGOTIATED":
      return "Desconto Exclusivo";
    case "PRICE_DISCOUNT":
    case "CUSTOM_PRICE":
      return "Desconto Individual";
    case "LIGHTNING":
      return "Oferta Relâmpago";
    case "SMART":
      return "Oferta Inteligente";
    case "DEAL":
      return "Oferta Especial";
    case "MARKETPLACE_CAMPAIGN":
      return "Campanha Co-participada";
    case "DOD":
      return "Oferta do Dia";
    default:
      return null;
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
  // Se não houver query nem categoria, busca as ofertas do dia do usuário se possível, ou ofertas gerais
  const searchUrl = new URL("https://api.mercadolibre.com/sites/MLB/search");
  
  if (query) {
    searchUrl.searchParams.set("q", query);
  } else if (category) {
    searchUrl.searchParams.set("category", category);
  } else {
    // Busca padrão de ofertas
    searchUrl.searchParams.set("q", "ofertas");
  }
  
  searchUrl.searchParams.set("limit", String(limit));
  searchUrl.searchParams.set("offset", String(offset));

  try {
    const res = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });
    
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    
    return results.map((item: any) => {
      let thumbnail = item.thumbnail || item.secure_thumbnail || null;
      if (thumbnail) {
        thumbnail = thumbnail.replace(/^http:/, "https:").replace(/-[WIGM]\.(jpg|jpeg|png|webp)$/i, "-O.$1");
      }
      
      const price = item.price;
      const originalPrice = item.original_price;

      return {
        id: item.id,
        name: item.title,
        price: formatMoney(price, item.currency_id || "BRL"),
        priceValue: price,
        originalPrice: originalPrice && originalPrice > price
          ? formatMoney(originalPrice, item.currency_id || "BRL")
          : null,
        discount: originalPrice && originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : null,
        thumbnail,
        link: decorateAffiliateLink(item.permalink, accountId),
        source: "ml",
        available: true,
      };
    });
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
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
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
    const mode = body.mode || body.deals || "search";
    const limit = Math.min(Number(body.limit || 50), 100);
    const offset = Number(body.offset || 0);

    // Tenta carregar do banco de dados primeiro (mais confiável)
    console.log(`[DB] Looking for connection for user: ${user.id}`);
    const { data: dbData, error: dbErr } = await admin
      .from("affiliate_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", PROVIDER)
      .maybeSingle();

    let record: any = null;

    if (dbData) {
      console.log("[DB] Found connection in database");
      record = {
        ...dbData,
        // Map metadata back if present
        affiliate_source_id: dbData.metadata?.source_id || dbData.affiliate_source_id
      };
    } else {
      if (dbErr) console.warn("[DB] Error fetching connection:", dbErr.message);
      
      // Fallback para storage
      const storagePath = `${user.id}/${PROVIDER}.json`;
      console.log(`[Storage] Falling back to storage: ${storagePath}`);
      const { data: storageData, error: storageErr } = await admin.storage
        .from(BUCKET)
        .download(storagePath);

      if (storageErr || !storageData) {
        console.log("No connection found in storage or DB for user:", user.id);
        const publicProducts = await fetchPublicOffers(query, category, null, limit, offset);
        return json({ products: publicProducts, total: 1000, fallback: true });
      }
      
      record = JSON.parse(await storageData.text());
      console.log("[Storage] Found connection in storage");
    }

    let accessToken = record.access_token;
    if (!accessToken) {
      console.log("Record found but no access_token. Fallback to public.");
      const publicProducts = await fetchPublicOffers(query, category, null, limit, offset);
      return json({ products: publicProducts, total: 1000, fallback: true });
    }

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
        
        // Update both Storage and DB
        await admin.storage
          .from(BUCKET)
          .upload(`${user.id}/${PROVIDER}.json`, JSON.stringify(updatedRecord), {
            upsert: true,
            contentType: "application/json",
          });

        try {
          await admin.from("affiliate_connections").upsert({
            user_id: user.id,
            provider: PROVIDER,
            access_token: accessToken,
            refresh_token: newData.refresh_token || record.refresh_token,
            expires_at: updatedRecord.expires_at,
            updated_at: updatedRecord.updated_at
          }, { onConflict: "user_id,provider" });
        } catch (e) {
          console.warn("[DB] Failed to update refreshed connection:", e.message);
        }
          
        record = updatedRecord;
      } else {
        const errText = await refreshRes.text();
        console.error("Failed to refresh ML token:", refreshRes.status, errText);
      }
    }


    let results: any[] = [];
    let total = 0;

    // Modo de busca: se for "offers" ou "deals" e não tiver query, busca as promoções.
    // O Mercado Livre permite filtrar por descontos significativos ou ofertas do dia usando o parâmetro "deal_ids" 
    // mas o mais comum para busca geral de ofertas é usar filtros de preço original e filtros de categoria.
    if ((mode === "offers" || mode === "deals") && !query) {
      try {
        console.log(`[Affiliate] Fetching seller-promotions...`);
        // 1. Listamos as promoções disponíveis para o vendedor
        // Buscamos tanto DEAL quanto MARKETPLACE_CAMPAIGN (co-participação)
        const promoTypes = ["DEAL", "MARKETPLACE_CAMPAIGN", "VOLUME", "PRICE_DISCOUNT", "CUSTOM_PRICE", "LIGHTNING", "SMART", "PRE_NEGOTIATED", "DOD", "SELLER_CAMPAIGN"];
        let allPromoItems: any[] = [];
        let totalCount = 0;

        for (const type of promoTypes) {
          const promoRes = await fetch(`https://api.mercadolibre.com/seller-promotions/promotions?promotion_type=${type}&app_version=v2`, {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "ZapLynx/1.0",
            },
          });


          if (promoRes.ok) {
            const promoText = await promoRes.text();
            if (!promoText) continue;
            
            const promoData = JSON.parse(promoText);
            const activePromos = promoData.results || [];
            console.log(`[Affiliate] Found ${activePromos.length} active promotions of type ${type}`);

            for (const promo of activePromos) {
              if (allPromoItems.length >= limit) break;
              
              console.log(`[Affiliate] Fetching items for promotion: ${promo.id} (${type})`);
              const itemsRes = await fetch(`https://api.mercadolibre.com/seller-promotions/promotions/${promo.id}/items?promotion_type=${type}&app_version=v2`, {
                headers: { 
                  Authorization: `Bearer ${accessToken}`,
                  "User-Agent": "ZapLynx/1.0",
                },
              });

              if (itemsRes.ok) {
                const itemsText = await itemsRes.text();
                if (!itemsText) continue;
                
                const itemsData = JSON.parse(itemsText);
                const promoItems = itemsData.results || [];
                console.log(`[Affiliate] Found ${promoItems.length} items in promotion ${promo.id}`);
                
                const itemsWithMetadata = promoItems.map((item: any) => ({
                  ...item,
                  promotion_id: promo.id,
                  promotion_type: type
                }));
                allPromoItems = [...allPromoItems, ...itemsWithMetadata];
                totalCount += itemsData.paging?.total || promoItems.length;
              }
            }
          }
          if (allPromoItems.length >= limit) break;
        }

        if (allPromoItems.length > 0) {
          results = allPromoItems.slice(0, limit);
          total = totalCount;
        }

        // Se não encontrou nada via seller-promotions, fallback para busca de ofertas gerais
        if (results.length === 0) {
          console.log(`[Affiliate] No seller-promotions found, falling back to general offers search...`);
          const searchUrl = new URL(`https://api.mercadolibre.com/sites/MLB/search`);
          const q = (category && CATEGORY_KEYWORDS[category]) || "ofertas";
          searchUrl.searchParams.set("q", q);
          if (category) searchUrl.searchParams.set("category", category);
          searchUrl.searchParams.set("sort", "relevance");
          searchUrl.searchParams.set("limit", String(limit));
          searchUrl.searchParams.set("offset", String(offset));

          const res = await fetch(searchUrl.toString(), {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "ZapLynx/1.0",
            },
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data && data.results) {
              results = data.results.filter((r: any) => r.original_price && r.original_price > r.price);
              if (results.length < 5) results = data.results;
              total = data.paging?.total || 0;
            }
          }
        }
      } catch (err) {
        console.error("[Affiliate] Error fetching deals:", err);
      }
    }

    // Se ainda não tem resultados (ou se for modo search), faz a busca padrão
    if (results.length === 0) {
      const q = query || (category && CATEGORY_KEYWORDS[category]) || "ofertas";
      const searchUrl = new URL(`https://api.mercadolibre.com/sites/MLB/search`);
      searchUrl.searchParams.set("q", q);
      if (category) searchUrl.searchParams.set("category", category);
      searchUrl.searchParams.set("limit", String(limit));
      searchUrl.searchParams.set("offset", String(offset));

      console.log(`[Search] query="${q}" category=${category} offset=${offset}`);

      // Tenta Autenticado
      try {
        const authRes = await fetch(searchUrl.toString(), {
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "ZapLynx/1.0",
          },
        });
        if (authRes.ok) {
          const data = await authRes.json();
          results = data.results || [];
          total = data.paging?.total || 0;
          console.log(`[Auth] Search success: ${results.length} items`);
        }
      } catch (err) {
        console.warn("[Auth] Search error:", err);
      }

      // Fallback Público se falhar
      if (results.length === 0) {
        try {
          const pubRes = await fetch(searchUrl.toString());
          if (pubRes.ok) {
            const data = await pubRes.json();
            results = data.results || [];
            total = data.paging?.total || 0;
            console.log(`[Public] Search success: ${results.length} items`);
          }
        } catch (err) {
          console.warn("[Public] Search error:", err);
        }
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
        promotionLabel: getPromotionLabel(r),
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
