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

async function getAffiliateSources(accessToken: string) {
  try {
    const res = await fetch("https://api.mercadolibre.com/affiliate-program/v1/sources", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : (data.sources || []);
    }
  } catch (err) {
    console.warn("Error fetching affiliate sources:", err);
  }
  return [];
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
  for (let i = 0; i < missing.length; i += 10) {
    const batch = missing.slice(i, i + 10);
    try {
      console.log(`[Affiliate] Generating ${batch.length} shortlinks for source ${sourceId}...`);
      const res = await fetch("https://api.mercadolibre.com/affiliate-program/v1/links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "ZapLynx/1.0"
        },
        body: JSON.stringify({ urls: batch, source_id: Number(sourceId) }),
      });
      
      if (!res.ok) {
        const errText = await res.text().catch(() => "N/A");
        console.warn(`[Affiliate] Shortlink API error: ${res.status} - ${errText}`);
        continue;
      }

      const data: any = await res.json().catch(() => null);
      if (data) {
        const list = Array.isArray(data) ? data : (data?.links || data?.urls || []);
        list.forEach((entry: any, k: number) => {
          const original = entry?.original_url || batch[k];
          const short = entry?.short_url || entry?.url;
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
          created_at: new Date().toISOString()
        })),
        { onConflict: "user_id,source_id,original_url" },
      );
    } catch (err) {
      console.warn("ml cache write error:", err);
    }
  }

  return map;
}

async function getDetails(ids: string[], accessToken?: string) {
  const map = new Map<string, any>();
  if (ids.length === 0) return map;
  
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    try {
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      };
      
      // Attempting details WITHOUT authentication first to avoid 403 on item details if the token has limited scopes
      let res = await fetch(`https://api.mercadolibre.com/items?ids=${batch.join(",")}&attributes=id,title,price,original_price,currency_id,thumbnail,secure_thumbnail,pictures,status,permalink,attributes,catalog_product_id`, { 
        headers
      });

      if (!res.ok && accessToken) {
        console.warn(`[Details] Public details failed with ${res.status}. Retrying with auth...`);
        res = await fetch(`https://api.mercadolibre.com/items?ids=${batch.join(",")}&attributes=id,title,price,original_price,currency_id,thumbnail,secure_thumbnail,pictures,status,permalink,attributes,catalog_product_id`, { 
          headers: { ...headers, "Authorization": `Bearer ${accessToken}` }
        });
      }

      if (res.ok) {
        const data = await res.json();
        data.forEach((item: any) => {
          if (item.code === 200) map.set(item.body.id, item.body);
        });
      } else {
        const errBody = await res.text().catch(() => "N/A");
        console.warn(`[Details] API Error ${res.status}: ${errBody}`);
      }
    } catch (err) {
      console.warn("getDetails error:", err);
    }
  }
  return map;
}

function isProductIdentifier(query: string): boolean {
  const q = query.trim();
  return /^\d{8,14}$/.test(q);
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
    const siteId = body.site || "MLB";
    const limit = Math.min(Number(body.limit || 10), 50);
    const offset = Number(body.offset || 0);

    const { data: record } = await admin
      .from("affiliate_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", PROVIDER)
      .maybeSingle();

    let accessToken = record?.access_token;
    
    // Refresh token if needed
    if (record && record.refresh_token) {
      const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
      if (expiresAt < Date.now() + 300000) {
        try {
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
            await admin.from("affiliate_connections").update({
              access_token: accessToken,
              refresh_token: newData.refresh_token || record.refresh_token,
              expires_at: new Date(Date.now() + newData.expires_in * 1000).toISOString(),
            }).eq("user_id", user.id).eq("provider", PROVIDER);
          }
        } catch (e) {
          console.error("Refresh error:", e);
        }
      }
    }

    let results: any[] = [];
    let total = 0;
    let isBlocked = false;

    // Build Search URL logic
    let searchUrl = new URL(`https://api.mercadolibre.com/sites/${siteId}/search`);
    searchUrl.searchParams.set("limit", String(limit));
    searchUrl.searchParams.set("offset", String(offset));

    if ((mode === "offers" || mode === "deals" || mode === "highlights" || mode === "lightning") && !query) {
      if (mode === "lightning") {
        searchUrl.searchParams.set("q", "oferta relampago");
      } else {
        searchUrl.searchParams.set("q", "oferta do dia");
      }
      if (category) searchUrl.searchParams.set("category", category);
    } else if (query) {
      // If it's a URL, extract ID
      const urlMatch = query.match(/MLB-?(\d+)/i) || query.match(/item\/(\d+)/i);
      if (urlMatch) {
        const itemId = `MLB${urlMatch[1]}`;
        const details = await getDetails([itemId], accessToken);
        const item = details.get(itemId);
        if (item) {
          results = [item];
          total = 1;
        }
      }

      if (results.length === 0) {
        let q = query || (category && CATEGORY_KEYWORDS[category]) || "ofertas";
        if (isProductIdentifier(q)) {
          searchUrl.searchParams.set("q", q.trim());
        } else {
          searchUrl.searchParams.set("q", q);
        }
        if (category) searchUrl.searchParams.set("category", category);
      }
    } else {
       searchUrl.searchParams.set("q", "ofertas");
       if (category) searchUrl.searchParams.set("category", category);
    }

    // Execute Search if results not already populated (by ID match)
    if (results.length === 0) {
      console.log(`[Search] Requesting: ${searchUrl.toString()}`);
      
      const commonHeaders = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "X-Custom-Header": Math.random().toString(36).substring(7) // Cache busting
      };

      // Try public search first
      let res = await fetch(searchUrl.toString(), { headers: commonHeaders });
      
      if (!res.ok && accessToken) {
        console.warn(`[Search] Public search failed with ${res.status}. Retrying with auth...`);
        res = await fetch(searchUrl.toString(), { 
          headers: { ...commonHeaders, "Authorization": `Bearer ${accessToken}` } 
        });
      }

      if (res.ok) {
        const data = await res.json();
        results = data.results || [];
        total = data.paging?.total || 0;
      } else {
        const errText = await res.text().catch(() => "N/A");
        console.error(`[Search] API Error: ${res.status} - ${errText}`);
        
        // If still blocked, attempt a search without any specific query/category as a last resort
        if (res.status === 403 || res.status === 429) {
          console.log("[Search] Rate limited or forbidden. Attempting basic search fallback...");
          const basicUrl = `https://api.mercadolibre.com/sites/${siteId}/search?q=ofertas&limit=${limit}`;
          const basicRes = await fetch(basicUrl, { headers: commonHeaders });
          if (basicRes.ok) {
            const basicData = await basicRes.json();
            results = basicData.results || [];
            total = basicData.paging?.total || 0;
          } else {
             isBlocked = true;
          }
        }
      }
    }

    // Fallback if still empty for deals
    if (results.length === 0 && (mode === "deals" || mode === "lightning") && !isBlocked) {
       console.log("[Search] No results for specific deals, trying general offers...");
       searchUrl.searchParams.set("q", "ofertas");
       const fallbackRes = await fetch(searchUrl.toString(), { 
         headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } 
       });
       if (fallbackRes.ok) {
         const data = await fallbackRes.json();
         results = data.results || [];
         total = data.paging?.total || 0;
       }
    }

    if (results.length === 0) {
      return json({ products: [], total: 0, isBlocked });
    }

    // Enrichment and detail gathering
    const itemIds = results.map(r => r.id);
    const detailsMap = await getDetails(itemIds, accessToken);

    let products = results.map(r => {
      const item = detailsMap.get(r.id) || r;
      const price = item.price || r.price;
      const originalPrice = item.original_price || r.original_price;

      let thumbnail = null;
      if (item.pictures && item.pictures.length > 0) {
        thumbnail = item.pictures[0].secure_url || item.pictures[0].url;
      }
      if (!thumbnail) {
        thumbnail = item.secure_thumbnail || item.thumbnail || r.thumbnail || r.secure_thumbnail;
      }
      if (thumbnail) {
        thumbnail = thumbnail
          .replace(/^http:/, "https:")
          .replace(/\/D_NQ_NP_(\d+-\w+)-[A-Z]\.(\w+)$/i, "/D_NQ_NP_$1-O.$2")
          .replace(/-[WIGM]\.(jpg|jpeg|png|webp)$/i, "-O.$1");
      }

      const identifiers: Record<string, string> = {};
      if (item.attributes) {
        const ean = item.attributes.find((a: any) => a.id === "GTIN" || a.id === "EAN")?.value_name;
        if (ean) identifiers.ean = ean;
        const brand = item.attributes.find((a: any) => a.id === "BRAND")?.value_name;
        if (brand) identifiers.brand = brand;
      }

      return {
        id: r.id,
        name: r.title,
        price: formatMoney(price, r.currency_id || "BRL"),
        priceValue: price,
        originalPrice: originalPrice && originalPrice > price ? formatMoney(originalPrice, r.currency_id || "BRL") : null,
        discount: originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null,
        thumbnail,
        link: r.permalink,
        source: "ml",
        available: item.status === "active" || !item.status,
        catalog_id: item.catalog_product_id,
        identifiers
      };
    });

    // Affiliate Link Generation
    let sourceId = record?.affiliate_source_id || record?.metadata?.source_id;
    
    // If we have an access token but no source_id, try to fetch it
    if (accessToken && !sourceId) {
       console.log("[Affiliate] Missing sourceId, attempting to fetch from API...");
       const sources = await getAffiliateSources(accessToken);
       if (sources.length > 0) {
         sourceId = sources[0].id || sources[0].source_id;
         console.log(`[Affiliate] Found sourceId: ${sourceId}. Saving to DB.`);
         await admin.from("affiliate_connections").update({
           affiliate_source_id: String(sourceId),
           metadata: { ...record?.metadata, source_id: sourceId }
         }).eq("user_id", user.id).eq("provider", PROVIDER);
       }
    }

    if (sourceId && products.length > 0 && accessToken) {
      const originalUrls = products.map(p => p.link).filter(Boolean);
      const shortlinkMap = await generateOfficialShortlinks(admin, user.id, accessToken, String(sourceId), originalUrls);
      products = products.map(p => {
        const shortUrl = shortlinkMap[p.link];
        return shortUrl ? { ...p, link: shortUrl, isOfficialAffiliate: true } : p;
      });
    }

    return json({ products, total });

  } catch (err) {
    console.error("[Fatal] Error processing request:", err);
    return json({ error: "Internal server error", details: err.message }, 500);
  }
});
