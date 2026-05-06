import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

/**
 * Manage Z-API Newsletters (Channels)
 * Docs: https://developer.z-api.io/newsletter/introduction
 *
 * Supported actions:
 * - create-newsletter
 * - list-newsletters
 * - update-newsletter-picture
 * - update-newsletter-name
 * - update-newsletter-description
 * - follow-newsletter
 * - unfollow-newsletter
 * - mute-newsletter
 * - unmute-newsletter
 * - delete-newsletter
 * - newsletter-metadata
 * - search-newsletter
 * - update-newsletter-config
 * - accept-newsletter-admin-invite
 * - newsletter-remove-admin
 * - newsletter-revoke-admin-invite
 * - transfer-newsletter-ownership
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    // Canais (newsletters) só são suportados pela Z-API oficial.
    // Ignoramos qualquer instanceId enviado pelo frontend (pode ser uma instância de outro provedor)
    // e sempre usamos as credenciais Z-API resolvidas em getUserZAPICredentials.
    if (credentials.isUazapi) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conexão WhatsApp compatível com Canais foi encontrada. Configure uma conexão Z-API." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instId = credentials.instanceId;
    const instToken = credentials.token;
    const instClientToken = credentials.clientToken;

    if (!instId || !instToken || !instClientToken) {
      return new Response(
        JSON.stringify({ error: "Credenciais Z-API não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}`;
    console.log(`🔗 Calling Z-API for instance ${instId} at path: ${body.action}`);

    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
      "Client-Token": instClientToken
    };

    const callZapi = async (
      method: "GET" | "POST" | "PUT" | "DELETE",
      path: string,
      payload?: unknown,
    ) => {
      const init: RequestInit = { method, headers };
      if (payload !== undefined && method !== "GET") {
        init.body = JSON.stringify(payload);
      }
      console.log(`📡 Fetching from Z-API: ${baseUrl}${path}`);
      const res = await fetch(`${baseUrl}${path}`, init);
      const text = await res.text();
      console.log(`📥 Z-API response (${res.status}): ${text}`);
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const errMsg = (data as { error?: string; message?: string })?.error
          || (data as { error?: string; message?: string })?.message
          || `Z-API error ${res.status}`;
        return new Response(
          JSON.stringify({ error: errMsg, details: data, status: res.status }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    switch (action) {
      case "create-newsletter": {
        const { name, description, imageUrl } = body;
        if (!name) throw new Error("name is required");
        const payload: Record<string, unknown> = { name };
        if (description) payload.description = description;
        if (imageUrl) payload.image = imageUrl;
        return await callZapi("POST", "/create-newsletter", payload);
      }

      case "list-newsletters":
        return await callZapi("GET", "/newsletter");

      case "update-newsletter-picture": {
        const { newsletterId, imageUrl } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        if (!imageUrl) throw new Error("imageUrl is required");
        return await callZapi("POST", "/update-newsletter-picture", { newsletterId, imageUrl });
      }

      case "update-newsletter-name": {
        const { newsletterId, name } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        if (!name) throw new Error("name is required");
        return await callZapi("POST", "/update-newsletter-name", { newsletterId, name });
      }

      case "update-newsletter-description": {
        const { newsletterId, description } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        if (description === undefined) throw new Error("description is required");
        return await callZapi("POST", "/update-newsletter-description", { newsletterId, description });
      }

      case "follow-newsletter": {
        const { newsletterId } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("POST", "/follow-newsletter", { newsletterId });
      }

      case "unfollow-newsletter": {
        const { newsletterId } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("POST", "/unfollow-newsletter", { newsletterId });
      }

      case "mute-newsletter": {
        const { newsletterId } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("POST", "/mute-newsletter", { newsletterId });
      }

      case "unmute-newsletter": {
        const { newsletterId } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("POST", "/unmute-newsletter", { newsletterId });
      }

      case "delete-newsletter": {
        const { newsletterId } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("DELETE", "/delete-newsletter", { newsletterId });
      }

      case "newsletter-metadata": {
        const { newsletterId } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("GET", `/newsletter-metadata?newsletterId=${encodeURIComponent(newsletterId)}`);
      }

      case "search-newsletter": {
        const { query, limit, view, countryCodes } = body;
        const payload: Record<string, unknown> = {
          limit: limit || 50,
        };
        payload.view = view || "RECOMMENDED";
        if (query) payload.searchText = query;
        // Z-API requer filters.countryCodes, mesmo que vazio
        payload.filters = { 
          countryCodes: (countryCodes && Array.isArray(countryCodes)) ? countryCodes : ["BR"] 
        };
        const resp = await callZapi("POST", "/search-newsletter", payload);
        // Z-API pode retornar 200 com {"error":"NOT_FOUND"} quando não há resultados
        try {
          const cloned = resp.clone();
          const json = await cloned.json();
          if (json && !Array.isArray(json) && (json.error === "NOT_FOUND" || /not.?found/i.test(String(json.message || "")))) {
            return new Response(JSON.stringify([]), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (_) { /* ignore */ }
        return resp;
      }

      case "update-newsletter-config": {
        const { newsletterId, reactionMode } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("POST", "/update-newsletter-config", { newsletterId, reactionMode });
      }

      case "accept-newsletter-admin-invite": {
        const { newsletterId } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        return await callZapi("POST", "/accept-newsletter-admin-invite", { newsletterId });
      }

      case "newsletter-remove-admin": {
        const { newsletterId, phone } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        if (!phone) throw new Error("phone is required");
        return await callZapi("POST", "/newsletter-remove-admin", { newsletterId, phone });
      }

      case "newsletter-revoke-admin-invite": {
        const { newsletterId, phone } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        if (!phone) throw new Error("phone is required");
        return await callZapi("POST", "/newsletter-revoke-admin-invite", { newsletterId, phone });
      }

      case "transfer-newsletter-ownership": {
        const { newsletterId, phone } = body;
        if (!newsletterId) throw new Error("newsletterId is required");
        if (!phone) throw new Error("phone is required");
        return await callZapi("POST", "/transfer-newsletter-ownership", { newsletterId, phone });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação inválida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("💥 manage-newsletters error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
