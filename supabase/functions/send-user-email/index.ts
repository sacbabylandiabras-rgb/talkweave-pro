import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const cssVarFallbacks: Record<string, string> = {
  "color-background-secondary": "#f8fafc",
  "color-background-primary": "#ffffff",
  "color-border-tertiary": "#e2e8f0",
  "color-text-primary": "#0f172a",
  "color-text-secondary": "#475569",
  "color-primary": "#1DFAC8",
  "border-radius-lg": "16px",
  "border-radius-md": "10px",
};

const replaceCssVars = (value: string) =>
  value.replace(/var\(\s*--([\w-]+)\s*(?:,\s*([^\)]+))?\)/g, (_match, name, fallback) =>
    cssVarFallbacks[name] || String(fallback || "").trim() || "inherit"
  );

const cleanEditorArtifacts = (html: string) => replaceCssVars(html)
  .replace(/<div\b[^>]*class=["'][^"']*\bimg-controls\b[^"']*["'][\s\S]*?<\/div>/gi, "")
  .replace(/<div\b[^>]*class=["'][^"']*\bresizer\b[^"']*["'][\s\S]*?<\/div>/gi, "")
  .replace(/<([a-z][\w:-]*)\b[^>]*class=["'][^"']*\bsr-only\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, "")
  .replace(/\s(?:contenteditable|draggable)=["'][^"']*["']/gi, "")
  .replace(/\s(?:onclick|onmousedown|oninput|onchange)=["'][\s\S]*?["']/gi, "")
  .replace(/\sclass=["']([^"']*)\b(?:selected|dragging)\b([^"']*)["']/gi, (_m, a, b) => {
    const cls = `${a} ${b}`.replace(/\s+/g, " ").trim();
    return cls ? ` class="${cls}"` : "";
  });

const extractBody = (html: string) => {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (body) return body[1];
  return html.replace(/<!doctype[^>]*>/gi, "").replace(/<\/?html\b[^>]*>/gi, "").replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "");
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const normalizeEmailCss = (css: string) => replaceCssVars(css)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(-?\d*\.?\d+)rem\b/g, (_m, n) => `${Math.round(Number(n) * 16)}px`);

const addInlineStyle = (tag: string, css: string) => {
  const cleanCss = normalizeEmailCss(css).replace(/\s+/g, " ").trim().replace(/;?$/, ";");
  const styleMatch = tag.match(/\sstyle=(['"])([\s\S]*?)\1/i);
  if (styleMatch) {
    const existing = styleMatch[2].trim().replace(/;?$/, ";");
    return tag.replace(styleMatch[0], ` style="${escapeAttr(`${cleanCss} ${existing}`)}"`);
  }
  return tag.replace(/\s*\/?>$/, (end) => ` style="${escapeAttr(cleanCss)}"${end}`);
};

const inlineEmailCss = (html: string, css: string) => {
  let output = html;
  const rules = Array.from(normalizeEmailCss(css).matchAll(/([^{}@]+)\{([^{}]+)\}/g)).reverse();

  for (const rule of rules) {
    const selectors = rule[1].split(",").map((s) => s.trim()).filter(Boolean);
    const declarations = rule[2].trim();
    if (!declarations) continue;

    for (const selector of selectors) {
      if (!selector || selector.includes(":") || selector.includes("[") || selector.includes(">") || selector.includes("+")) continue;
      const simple = selector.replace(/^#email-editor\s+/, "").trim();
      const idMatch = simple.match(/^#([\w-]+)$/);
      const classMatch = simple.match(/^\.([\w-]+)$/);
      const tagMatch = simple.match(/^(?:\.[\w-]+\s+|#\w[\w-]*\s+)?([a-z][\w:-]*)$/i);

      if (idMatch) {
        const id = escapeRegExp(idMatch[1]);
        output = output.replace(new RegExp(`<([a-z][\\w:-]*)([^>]*\\sid=(['"])${id}\\3[^>]*)>`, "gi"), (tag) => addInlineStyle(tag, declarations));
      } else if (classMatch) {
        const cls = escapeRegExp(classMatch[1]);
        output = output.replace(new RegExp(`<([a-z][\\w:-]*)([^>]*\\sclass=(['"])(?=[^'"]*\\b${cls}\\b)[^'"]*\\3[^>]*)>`, "gi"), (tag) => addInlineStyle(tag, declarations));
      } else if (tagMatch) {
        const tagName = escapeRegExp(tagMatch[1]);
        output = output.replace(new RegExp(`<${tagName}\\b[^>]*>`, "gi"), (tag) => addInlineStyle(tag, declarations));
      }
    }
  }

  return output;
};

const buildFinalHtml = (raw: string, subject: string) => {
  const styleBlocks: string[] = [];
  const withoutStyles = cleanEditorArtifacts(raw).replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css) => {
    styleBlocks.push(replaceCssVars(css));
    return "";
  });
  const isFullDoc = /<!doctype|<html[\s>]/i.test(withoutStyles);
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(withoutStyles);
  const safeTitle = subject.replace(/[<>]/g, "");
  const bodyContent = isFullDoc
    ? extractBody(withoutStyles)
    : looksLikeHtml
      ? `<div id="email-editor">${withoutStyles}</div>`
      : `<div id="email-editor">${withoutStyles.split(/\n{2,}/).map(p => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`).join("")}</div>`;

  const baseCss = `
body { margin:0; padding:0; background-color:#f8fafc; -webkit-text-size-adjust:100%; }
#email-editor { width:100%; max-width:600px; margin:0 auto; box-sizing:border-box; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:#0f172a; line-height:1.6; }
#email-editor img { max-width:100%; height:auto; border:0; }
#email-editor a { color:inherit; }
.email-wrap { background:#f8fafc; padding:32px 24px; border-radius:16px; }
.email-card { max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; font-size:15px; line-height:1.7; color:#0f172a; }
.email-header, .email-hero { background:#0A0F1E; }
.logo-mark { background:#1DFAC8; }
.logo-name, .hero-title { color:#ffffff; }
.logo-sub, .hero-label, .feature-icon, .sig-brand { color:#1DFAC8; }
.body-text, .feature-desc, .footer-text, .footer-link { color:#475569; }
.feature-card, .email-footer { background:#f8fafc; border-color:#e2e8f0; }
.divider { background:#e2e8f0; }
.cta-btn { background:#0A0F1E; color:#1DFAC8; border-color:#1DFAC8; }
@media (max-width: 640px) { .feature-grid { display:block !important; } .feature-card { margin-bottom:12px !important; } }
`;
  const allCss = `${baseCss}\n${styleBlocks.join("\n")}`;
  const inlinedBodyContent = inlineEmailCss(bodyContent, allCss);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeTitle}</title>
<style>${allCss}</style>
</head>
<body>${inlinedBodyContent}</body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const to = Array.isArray(body?.to) ? body.to : (body?.to ? [body.to] : []);
    const subject = String(body?.subject || "").trim();
    const messageBody = String(body?.html || body?.text || "").trim();
    const fromAlias = String(body?.fromAlias || "contato").replace(/[^a-z0-9._-]/gi, "");
    const overrideSenderName = String(body?.senderName || "").trim();

    if (!to.length || !subject || !messageBody) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: to, subject, html ou text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalHtml = buildFinalHtml(messageBody, subject);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: domainData } = await admin
      .from("email_domain_verifications")
      .select("domain, status")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!domainData?.domain) {
      return new Response(JSON.stringify({ error: "Configure e verifique seu domínio antes de enviar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email_sender_name")
      .eq("id", userId)
      .maybeSingle();

    const senderName = overrideSenderName || (profile as any)?.email_sender_name || profile?.full_name || "ZapLynx";
    const from = `${senderName} <${fromAlias}@${domainData.domain}>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Serviço de email indisponível" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ to: string; ok: boolean; error?: string; id?: string }> = [];
    for (const recipient of to.slice(0, 200)) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "X-Resend-Region": "us-east-1",
        },
        body: JSON.stringify({
          from,
          to: recipient,
          subject,
          html: finalHtml,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.id) {
        await admin.from("sent_emails_mapping").insert({
          email_id: j.id,
          user_id: userId,
          subject,
          html: finalHtml,
          recipient,
        });
      }
      results.push({ to: recipient, ok: r.ok, error: r.ok ? undefined : (j?.message || j?.error || `HTTP ${r.status}`), id: j?.id });
    }

    const sent = results.filter(x => x.ok).length;
    return new Response(JSON.stringify({ ok: true, sent, total: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-user-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});