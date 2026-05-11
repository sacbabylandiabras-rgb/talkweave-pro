import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const mimeByExt = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    mjs: "application/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    avif: "image/avif",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    txt: "text/plain; charset=utf-8",
    xml: "application/xml; charset=utf-8",
    pdf: "application/pdf",
    map: "application/json; charset=utf-8",
  };
  return map[ext] || "application/octet-stream";
};

const toAssetUrl = (value: string, pageId: string, dir: string) => {
  const trimmed = value.trim();
  if (/^(https?:)?\/\//i.test(trimmed) || /^(data|mailto|tel|blob):/i.test(trimmed) || trimmed.startsWith("#")) {
    return value;
  }
  const clean = trimmed.startsWith("/") ? trimmed.replace(/^\/+/g, "") : `${dir}${trimmed}`;
  return `/functions/v1/landing-page/${pageId}/${clean}`;
};

const rewriteRelativeUrls = (html: string, pageId: string, currentFile: string) => {
  const dir = currentFile.includes("/") ? `${currentFile.split("/").slice(0, -1).join("/")}/` : "";
  return html.replace(
    /\b(src|href|poster|action)=(['"])([^'"]+)\2/gi,
    (_match, attr, quote, value) => `${attr}=${quote}${toAssetUrl(value, pageId, dir)}${quote}`,
  ).replace(/\bsrcset=(['"])([^'"]+)\1/gi, (_match, quote, value) => {
    const rewritten = value.split(",").map((part: string) => {
      const pieces = part.trim().split(/\s+/);
      if (!pieces[0]) return part;
      return [toAssetUrl(pieces[0], pageId, dir), ...pieces.slice(1)].join(" ");
    }).join(", ");
    return `srcset=${quote}${rewritten}${quote}`;
  }).replace(/url\((['"]?)(?!https?:|\/\/|data:|blob:)([^)'"]+)\1\)/gi, (_match, quote, value) => {
    return `url(${quote}${toAssetUrl(value, pageId, dir)}${quote})`;
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const [pageId, ...fileParts] = url.pathname.split("/landing-page/")[1]?.split("/") || [];

    if (!pageId) {
      return new Response("Landing page não encontrada", { status: 404, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: page, error } = await supabase
      .from("gateway_landing_pages")
      .select("*")
      .eq("id", pageId)
      .eq("status", true)
      .maybeSingle();

    if (error || !page) {
      return new Response("Landing page não encontrada", { status: 404, headers: corsHeaders });
    }

    const files = (page.files || []) as Array<{ name: string; path: string }>;
    const requestedName = decodeURIComponent(fileParts.join("/")) || page.entry_file || files[0]?.name;
    const file = files.find((item) => item.name === requestedName);

    if (!file) {
      return new Response("Arquivo não encontrado", { status: 404, headers: corsHeaders });
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from("landing-pages")
      .download(file.path);

    if (downloadError || !blob) {
      return new Response("Arquivo não encontrado", { status: 404, headers: corsHeaders });
    }

    const contentType = mimeByExt(file.name);
    const headers = new Headers({
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    });

    if (contentType.startsWith("text/html") || contentType.startsWith("text/css")) {
      const text = await blob.text();
      let processed = rewriteRelativeUrls(text, pageId, file.name);

      const linkedCheckoutId = (page as any).checkout_id || (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String((page as any).slug || "")) ? (page as any).slug : null);

      if (contentType.startsWith("text/html") && linkedCheckoutId) {
        try {
          const { data: checkout } = await supabase
            .from("gateway_checkouts")
            .select("id, slug, user_id")
            .eq("id", linkedCheckoutId)
            .maybeSingle();
          if (checkout) {
            let domain = "pay.zaplynxpro.online";
            const { data: profile } = await supabase
              .from("profiles")
              .select("custom_domain")
              .eq("id", (checkout as any).user_id)
              .maybeSingle();
            const cd = (profile as any)?.custom_domain;
            if (cd) domain = String(cd).replace(/^https?:\/\//, "").replace(/\/+$/, "");
            const checkoutUrl = `https://${domain}/checkout/${(checkout as any).slug || (checkout as any).id}`;

            // Replace placeholders and special targets
            processed = processed
              .replace(/\{\{\s*checkout_url\s*\}\}/gi, checkoutUrl)
              .replace(/href=(['"])(#checkout|about:checkout|javascript:checkout\(\))\1/gi, `href=$1${checkoutUrl}$1`)
              .replace(/action=(['"])(#checkout|about:checkout)\1/gi, `action=$1${checkoutUrl}$1`)
              .replace(/data-checkout-link=(['"])[^'"]*\1/gi, `data-checkout-link=$1${checkoutUrl}$1 href=$1${checkoutUrl}$1`);

            // Auto-replace external checkout/payment platform URLs with the linked checkout
            // Detects domains commonly used by Hotmart, Kiwify, Eduzz, Monetizze, Braip,
            // Cakto, Yampi, Ticto, Hubla, Greenn, Doppus, Lastlink, Pepper,
            // Adoorei, Payt, Guru/Digital Manager Guru, Voomp, Kirvano, Stripe, etc.
            const externalCheckoutDomains = [
              // Hotmart
              "pay\\.hotmart\\.com", "checkout\\.hotmart\\.com", "hotmart\\.com/product",
              // Kiwify
              "pay\\.kiwify\\.com\\.br", "pay\\.kiwify\\.com", "kiwify\\.com\\.br/checkout", "kiwify\\.app",
              // Eduzz
              "sun\\.eduzz\\.com", "chk\\.eduzz\\.com", "checkout\\.eduzz\\.com",
              // Monetizze
              "app\\.monetizze\\.com\\.br/checkout", "monetizze\\.com\\.br/checkout",
              // Braip
              "ev\\.braip\\.com", "checkout\\.braip\\.co", "braip\\.com/checkout",
              // Cakto
              "pay\\.cakto\\.com\\.br", "checkout\\.cakto\\.com\\.br",
              // Yampi
              "seguro\\.[a-z0-9-]+\\.com\\.br", "checkout\\.yampi\\.com\\.br", "[a-z0-9-]+\\.pages\\.yampi\\.com\\.br",
              // Ticto
              "checkout\\.ticto\\.com\\.br", "payment\\.ticto\\.com\\.br", "checkout\\.ticto\\.app", "pay\\.ticto\\.app",
              // Hubla
              "pay\\.hub\\.la", "checkout\\.hub\\.la", "hub\\.la/checkout",
              // Greenn
              "checkout\\.greenn\\.com\\.br", "pay\\.greenn\\.com\\.br",
              // Doppus
              "checkout\\.doppus\\.app", "pay\\.doppus\\.app",
              // Lastlink
              "lastlink\\.com/p", "checkout\\.lastlink\\.com",
              // Pepper
              "checkout\\.pepper\\.com\\.br",
              // Adoorei
              "checkout\\.adoorei\\.com\\.br", "pay\\.adoorei\\.com\\.br",
              // Payt
              "checkout\\.payt\\.com\\.br",
              // Guru / Digital Manager Guru
              "clkdmg\\.site", "[a-z0-9-]+\\.dmg\\.com\\.br/checkout",
              // Voomp
              "checkout\\.voompplay\\.com", "pay\\.voompplay\\.com",
              // Kirvano
              "pay\\.kirvano\\.com", "checkout\\.kirvano\\.com",
              // Nuvemshop
              "[a-z0-9-]+\\.nuvemshop\\.com\\.br/checkout",
              // Stripe / Paddle / Generic
              "buy\\.stripe\\.com", "checkout\\.stripe\\.com",
              "pay\\.paddle\\.com", "buy\\.paddle\\.com",
            ];

            const externalCheckoutRegex = new RegExp(
              `(href|action|data-href|data-url|data-link|data-checkout-url)=(['"])(?:https?:)?\\/\\/(?:${externalCheckoutDomains.join("|")})[^'"\\s]*\\2`,
              "gi"
            );
            processed = processed.replace(externalCheckoutRegex, (_m, attr, quote) => {
              return `${attr}=${quote}${checkoutUrl}${quote}`;
            });

            const genericCheckoutUrlRegex = /\b(href|action|data-href|data-url|data-link|data-checkout-url)=(['"])((?:https?:)?\/\/[^'"\s]*(?:checkout|pay|payment|seguro|hotmart|kiwify|eduzz|monetizze|braip|cakto|ticto|lastlink|kirvano|stripe)[^'"\s]*)\2/gi;
            processed = processed.replace(genericCheckoutUrlRegex, (_m, attr, quote) => `${attr}=${quote}${checkoutUrl}${quote}`);

            // Also rewrite inline JS redirects (window.location = "https://pay.hotmart.com/...")
            const jsRedirectRegex = new RegExp(
              `(['"\\\`])(?:https?:)?\\/\\/(?:${externalCheckoutDomains.join("|")})[^'"\\\`\\s]*\\1`,
              "gi"
            );
            processed = processed.replace(jsRedirectRegex, (_m, quote) => {
              return `${quote}${checkoutUrl}${quote}`;
            });
          }
        } catch (_e) {
          // ignore checkout resolve errors
        }
      }

      return new Response(processed, { headers });
    }

    return new Response(blob, { headers });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Erro interno", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
