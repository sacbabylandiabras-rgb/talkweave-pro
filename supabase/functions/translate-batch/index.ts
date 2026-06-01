import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

function buildPrompt(target: string, texts: string[]) {
  const langName = target === "en" ? "English" : target;
  const list = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return [
    {
      role: "system",
      content:
        `You translate short UI strings for a SaaS web app from Portuguese (Brazil) to ${langName}. ` +
        `Output STRICT JSON: an array of objects {i:number,t:string} where "i" matches the input index (1-based) ` +
        `and "t" is the translation. Keep placeholders like {name}, %s, {{var}} unchanged. ` +
        `Keep product/brand names (ZapLynx, WhatsApp, Instagram, Telegram, Pix, PIX) unchanged. ` +
        `Preserve punctuation and emoji. Keep translations concise and natural for UI labels. ` +
        `Return ONLY the JSON array, no prose, no markdown.`,
    },
    {
      role: "user",
      content: `Translate these ${texts.length} items:\n${list}`,
    },
  ];
}

function tryParse(raw: string): { i: number; t: string }[] | null {
  if (!raw) return null;
  // Strip optional ```json fences
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // Find first '[' and last ']'
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    const arr = JSON.parse(s.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    return arr.filter((x) => x && typeof x.i === "number" && typeof x.t === "string");
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_api_key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const target = String(body?.target || "en");
    const texts: string[] = Array.isArray(body?.texts) ? body.texts : [];

    // Cheap validation
    const cleaned = texts
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 400)
      .slice(0, 80);

    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: buildPrompt(target, cleaned),
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "payment_required" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("ai error", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const parsed = tryParse(raw) ?? [];

    const out: Record<string, string> = {};
    for (const { i, t } of parsed) {
      const src = cleaned[i - 1];
      if (src && t && typeof t === "string") {
        out[src] = t;
      }
    }

    return new Response(JSON.stringify({ translations: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate-batch error", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});