import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Chama uma tool de um endpoint MCP.
 * Body: { url, headers?, tool, arguments? }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body.url || "").trim();
    const tool = String(body.tool || "").trim();
    const args = body.arguments || {};
    if (!url || !tool) return json({ error: "url e tool obrigatórios" }, 400);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    };
    const raw = body.headers;
    if (Array.isArray(raw)) {
      for (const h of raw) if (h?.key) headers[String(h.key)] = String(h.value ?? "");
    } else if (raw && typeof raw === "object") {
      for (const k of Object.keys(raw)) headers[k] = String((raw as any)[k] ?? "");
    }

    // initialize (sessões MCP são por requisição lógica; mantemos simples)
    const initRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "zaplynx-agent", version: "1.0.0" } },
      }),
    });
    const sid = initRes.headers.get("mcp-session-id") || initRes.headers.get("Mcp-Session-Id");
    if (sid) headers["Mcp-Session-Id"] = sid;
    await readMaybeStream(initRes);
    try {
      await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
    } catch (_) {}

    const callRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } }),
    });
    const data = await readMaybeStream(callRes);
    if (!callRes.ok) return json({ ok: false, error: `MCP retornou ${callRes.status}`, detail: data }, 502);
    if (data?.error) return json({ ok: false, error: data.error?.message || "Erro MCP", detail: data.error }, 502);
    return json({ ok: true, result: data?.result ?? data });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});

async function readMaybeStream(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!text) return null;
  if (ct.includes("text/event-stream")) {
    const lines = text.split(/\r?\n/);
    let payload = "";
    for (const ln of lines) if (ln.startsWith("data:")) payload += ln.slice(5).trim();
    try { return JSON.parse(payload); } catch { return payload; }
  }
  try { return JSON.parse(text); } catch { return text; }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}