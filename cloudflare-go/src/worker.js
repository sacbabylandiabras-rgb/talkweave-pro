// Cloudflare Worker para o dominio go.zaplynxpro.online
// Resolve:
//   /invite/:slug  -> consulta a edge function `redirect-link` do Supabase
//   /r?...         -> registra clique via `track-flow-click` e redireciona

const SUPABASE_URL = "https://yodgjxdekuraxquxkxhx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8";

const HTML_HEAD = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecionando...</title><style>html,body{height:100%;margin:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.wrap{display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:16px}.spinner{width:36px;height:36px;border:3px solid #eee;border-top-color:#111;border-radius:50%;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}small{color:#666}</style></head><body><div class="wrap"><div class="spinner"></div><small>Redirecionando...</small></div>`;

function loadingHtml(targetUrl) {
  const safe = String(targetUrl).replace(/"/g, "&quot;");
  return `${HTML_HEAD}<script>window.location.replace("${safe}")</script></body></html>`;
}

function notFoundHtml(message) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Link nao encontrado</title><style>html,body{height:100%;margin:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}.wrap{display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:8px;text-align:center;padding:24px}h1{font-size:18px;margin:0}p{color:#666;margin:0}</style></head><body><div class="wrap"><h1>Link nao encontrado</h1><p>${message || "Verifique o link e tente novamente."}</p></div></body></html>`;
}

async function handleInvite(slug) {
  if (!slug) return new Response(notFoundHtml("Slug ausente."), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  try {
    const url = `${SUPABASE_URL}/functions/v1/redirect-link?slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      redirect: "manual",
    });

    // A funcao pode responder com 302 -> Location, ou JSON {url|destination}
    const loc = res.headers.get("location");
    if (loc) {
      return new Response(loadingHtml(loc), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json().catch(() => null);
      const target = data && (data.url || data.destination || data.redirect);
      if (target) {
        return new Response(loadingHtml(target), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
    }
    return new Response(notFoundHtml("Link expirado ou inexistente."), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (err) {
    return new Response(notFoundHtml("Erro ao resolver link."), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

async function handleRedirect(reqUrl) {
  const target = reqUrl.searchParams.get("url");
  if (!target) {
    return new Response(notFoundHtml("Parametro url ausente."), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  // Dispara o tracking sem bloquear o redirect
  try {
    const trackUrl = `${SUPABASE_URL}/functions/v1/track-flow-click?mode=log&${reqUrl.searchParams.toString()}`;
    fetch(trackUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }).catch(() => {});
  } catch (_) {}
  return new Response(loadingHtml(target), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/invite/")) {
      const slug = url.pathname.replace(/^\/invite\//, "").split("/")[0];
      return handleInvite(slug);
    }

    if (url.pathname === "/r" || url.pathname === "/r/") {
      return handleRedirect(url);
    }

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(notFoundHtml("Use um link valido."), { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    }

    return new Response(notFoundHtml(), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  },
};