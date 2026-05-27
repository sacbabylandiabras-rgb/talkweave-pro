import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Lista as tools expostas por um endpoint MCP (Streamable HTTP).
 * Body: { url, headers?: { key, value }[] | Record<string,string> }
 * Retorna: { ok, tools: [{ name, description, inputSchema }] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const url = String(body.url || "").trim();
    if (!url) return json({ error: "url obrigatória" }, 400);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    };
    const raw = body.headers;
    if (Array.isArray(raw)) {
      for (const h of raw) {
        if (h?.key) headers[String(h.key)] = String(h.value ?? "");
      }
    } else if (raw && typeof raw === "object") {
      for (const k of Object.keys(raw)) headers[k] = String((raw as any)[k] ?? "");
    }

    // 1) initialize
    const initRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "zaplynx-agent", version: "1.0.0" },
        },
      }),
    });
    const sessionId = initRes.headers.get("mcp-session-id") || initRes.headers.get("Mcp-Session-Id");
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;
    await readMaybeStream(initRes); // discard

    // 2) notifications/initialized
    try {
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      });
    } catch (_) { /* ignore */ }

    // 3) tools/list
    const listRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    const listData = await readMaybeStream(listRes);
    if (!listRes.ok) {
      return json({ error: `MCP retornou ${listRes.status}`, detail: listData }, 502);
    }
    const tools = (listData?.result?.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema || { type: "object", properties: {} },
    }));
    return json({ ok: true, tools, sessionId });
  } catch (e: any) {
    console.error("[agent-mcp-list] error", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

async function readMaybeStream(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!text) return null;
  if (ct.includes("text/event-stream")) {
    // Concatena os blocos `data:` da SSE
    const lines = text.split(/\r?\n/);
    let payload = "";
    for (const ln of lines) {
      if (ln.startsWith("data:")) payload += ln.slice(5).trim();
    }
    try { return JSON.parse(payload); } catch { return payload; }
  }
  try { return JSON.parse(text); } catch { return text; }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}