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
    if (category) url.searchParams.set("category", category);
    if (offset > 0) url.searchParams.set("_from", String(offset + 1));
  } else {
    url = new URL("https://www.mercadolivre.com.br/ofertas");
    if (category) url.searchParams.set("category", category);
    if (offset > 0) url.searchParams.set("offset", String(offset));
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    
    // Poly-card parsing improvement
    // We try to find products using multiple selector patterns
    const cards = html.match(/<div\s+class="[^"]*poly-card[^"]*"[\s\S]*?(?=<div\s+class="[^"]*poly-card[^"]*"|<\/main>|$)/g) || 
                  html.match(/<li\s+class="[^"]*ui-search-layout__item[^"]*"[\s\S]*?(?=<li\s+class="[^"]*ui-search-layout__item[^"]*"|<\/ol>|$)/g) || [];
    
    console.log(`Found ${cards.length} cards via scraping`);

    const products: any[] = [];
    for (const card of cards) {
      // Look for the product link
      const linkMatch = card.match(/href="(https:\/\/[^"]+MLB[^"]+)"/);
      if (!linkMatch) continue;
      
      const rawLink = linkMatch[1];

      // Look for the title
      const titleMatch = card.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/(?:a|h2)>/i) || 
                         card.match(/aria-label="([^"]+)"/i) ||
                         card.match(/alt="([^"]+)"/i);
      
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "Produto Mercado Livre";

      // Improved thumbnail detection
      let thumbnail = null;
      
      // 1. Check for images specifically in the poly-card__portada or similar wrappers
      // We look for any img tag and try to extract its source
      const imgTags = card.match(/<img[\s\S]*?>/gi) || [];
      for (const tag of imgTags) {
        // Try various source attributes
        const srcMatch = tag.match(/(?:data-src|src|data-lazy|data-actualsrc|srcset)="([^"]+)"/i);
        if (srcMatch) {
          let url = srcMatch[1];
          // If it's a srcset, take the last one
          if (url.includes(",")) {
            const parts = url.split(",");
            url = parts[parts.length - 1].trim().split(" ")[0];
          }
          
          if (url && url.startsWith("http") && !url.includes("pixel") && !url.includes("blank") && !url.includes("data:image")) {
            thumbnail = url;
            break;
          }
        }
      }

      // 2. Try generic URL search in card if no img tag found
      if (!thumbnail) {
        const genericUrls = card.match(/https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)/gi) || [];
        for (const url of genericUrls) {
          if (!url.includes("pixel") && !url.includes("blank")) {
            thumbnail = url;
            break;
          }
        }
      }

      if (thumbnail) {
        thumbnail = thumbnail.replace(/^http:/, "https:");
        // Improve resolution from -I.jpg to -O.jpg or -V.jpg
        thumbnail = thumbnail.replace(/-I\.(jpg|jpeg|png|webp)/, "-O.$1");
        // Also handle the case where ML uses different size suffixes
        thumbnail = thumbnail.replace(/-M\.(jpg|jpeg|png|webp)/, "-O.$1");
      }

      // Look for price
      const priceMatch = card.match(/aria-label="([^"]*reais[^"]*)"/i) || 
                         card.match(/class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
                         card.match(/class="[^"]*poly-price__current[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      
      const price = priceMatch ? priceMatch[1].replace(/<[^>]*>/g, "").trim() : "Consulte o preço";
      
      products.push({
        id: rawLink.match(/MLB-?(\d+)/)?.[0] ?? "S_" + Math.random().toString(36).substr(2, 9),
        name: title,
        price: price,
        priceValue: 0, 
        thumbnail: thumbnail,
        link: decorateAffiliateLink(rawLink, accountId),
        source: "ml",
        available: true,
      });
      if (products.length >= limit) break;
    }
    return products;
  } catch (err) {
    console.error("Scraping error:", err);
    return [];
  }
}

async function getDetails(ids: string[], accessToken: string) {
  const map = new Map<string, any>();
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    try {
      const res = await fetch(`https://api.mercadolibre.com/items?ids=${batch.join(",")}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
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

    const objectPath = `${user.id}/${PROVIDER}.json`;
    const { data: fileData } = await admin.storage.from(BUCKET).download(objectPath);
    if (!fileData) {
      console.log("Fallback to public offers - account not connected for user:", user.id);
      const publicProducts = await fetchPublicOffers(query, category, null, limit, offset);
      return json({ products: publicProducts, total: 1000, fallback: true });
    }

    let record = JSON.parse(await fileData.text());
    let accessToken = record.access_token;

    // Refresh token check
    const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
    if (expiresAt < Date.now() + 60000 && record.refresh_token) {
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
        record = {
          ...record,
          access_token: accessToken,
          refresh_token: newData.refresh_token || record.refresh_token,
          expires_at: new Date(Date.now() + newData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };
        await admin.storage.from(BUCKET).upload(objectPath, new Blob([JSON.stringify(record)], { type: "application/json" }), { upsert: true });
      }
    }

    const searchUrl = new URL(`https://api.mercadolibre.com/sites/MLB/search`);
    const q = query || (category && CATEGORY_KEYWORDS[category]) || "promocao";
    searchUrl.searchParams.set("q", q);
    if (category) searchUrl.searchParams.set("category", category);
    searchUrl.searchParams.set("limit", String(limit));
    searchUrl.searchParams.set("offset", String(offset));

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let results = [];
    let total = 0;

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      results = searchData.results || [];
      total = searchData.paging?.total || 0;
    }

    if (results.length === 0) {
      const publicProducts = await fetchPublicOffers(query, category, record.account_id, limit, offset);
      return json({ products: publicProducts, total: 1000, fallback: true });
    }

    const itemIds = results.map((r: any) => r.id).filter(Boolean);
    const detailsMap = await getDetails(itemIds, accessToken);

    let products = results.map((r: any) => {
      const item = detailsMap.get(r.id) || r;
      const price = item.price || r.price;
      const originalPrice = item.original_price || r.original_price;
      
      // Ensure we get a high-quality thumbnail if pictures are available
      let thumbnail = item.pictures?.[0]?.secure_url || item.thumbnail || r.thumbnail;
      if (thumbnail) {
        thumbnail = thumbnail.replace(/^http:/, "https:");
        // Convert typical thumbnail sizes to higher resolution if it matches the pattern
        thumbnail = thumbnail.replace(/-I\.(jpg|jpeg|png|webp)/, "-O.$1");
      }
      
      return {
        id: item.id,
        name: item.title,
        price: formatMoney(price),
        priceValue: price,
        originalPrice: originalPrice && originalPrice > price ? formatMoney(originalPrice) : null,
        discount: originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : null,
        thumbnail: thumbnail,
        link: item.permalink || r.permalink,
        source: "ml",
        available: item.status === "active",
      };
    }).filter((p: any) => p.link);

    // Shortlink generation
    const sourceId = record.affiliate_source_id;
    if (sourceId && products.length > 0) {
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
