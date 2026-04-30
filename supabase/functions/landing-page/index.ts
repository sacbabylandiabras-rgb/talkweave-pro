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
      .select("id, files, entry_file, status")
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
      return new Response(rewriteRelativeUrls(text, pageId, file.name), { headers });
    }

    return new Response(blob, { headers });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Erro interno", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
