import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

/**
 * Manage Z-API Communities
 * Docs: https://developer.z-api.io/communities/introduction
 *
 * Supported actions:
 * - create-community
 * - list-communities
 * - link-groups
 * - unlink-groups
 * - community-metadata
 * - redefine-invitation-link
 * - add-community-participant
 * - remove-community-participant
 * - add-community-admin
 * - remove-community-admin
 * - community-settings
 * - deactivate-community
 * - update-community-description
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
    const { action, instanceId, instanceToken, instanceClientToken } = body;

    const instId = instanceId || credentials.instanceId;
    const instToken = instanceToken || credentials.token;
    const instClientToken = instanceClientToken || credentials.clientToken;

    if (!instId || !instToken || !instClientToken) {
      return new Response(
        JSON.stringify({ error: "Credenciais Z-API não configuradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}`;
    const headers = {
      "Content-Type": "application/json",
      "Client-Token": instClientToken,
    };

    const requestZapi = async (
      method: "GET" | "POST" | "PUT" | "DELETE",
      path: string,
      payload?: unknown,
    ) => {
      const init: RequestInit = { method, headers };
      if (payload !== undefined && method !== "GET") {
        init.body = JSON.stringify(payload);
      }
      const res = await fetch(`${baseUrl}${path}`, init);
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      console.log(`📡 [communities] ${method} ${path} -> ${res.status}`);
      return { ok: res.ok, status: res.status, data };
    };

    const callZapi = async (
      method: "GET" | "POST" | "PUT" | "DELETE",
      path: string,
      payload?: unknown,
    ) => {
      const { ok, status, data } = await requestZapi(method, path, payload);
      if (!ok) {
        const errMsg = (data as { error?: string; message?: string })?.error
          || (data as { error?: string; message?: string })?.message
          || `Z-API error ${status}`;
        return new Response(
          JSON.stringify({ error: errMsg, details: data, status }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    switch (action) {
      case "create-community": {
        const { name, description, groupIds } = body;
        if (!name) throw new Error("name is required");
        return await callZapi("POST", "/communities", {
          name,
          description: description ?? "",
          ...(Array.isArray(groupIds) && groupIds.length ? { groupIds } : {}),
        });
      }

      case "list-communities": {
        return await callZapi("GET", "/communities");
      }

      case "community-metadata": {
        const { communityId } = body;
        if (!communityId) throw new Error("communityId is required");
        return await callZapi("GET", `/communities-metadata/${encodeURIComponent(communityId)}`);
      }

      case "link-groups": {
        const { communityId, groupIds } = body;
        if (!communityId) throw new Error("communityId is required");
        if (!Array.isArray(groupIds) || !groupIds.length) throw new Error("groupIds is required");
        return await callZapi("POST", `/communities/${encodeURIComponent(communityId)}/link-groups`, { groupIds });
      }

      case "unlink-groups": {
        const { communityId, groupIds } = body;
        if (!communityId) throw new Error("communityId is required");
        if (!Array.isArray(groupIds) || !groupIds.length) throw new Error("groupIds is required");
        return await callZapi("POST", `/communities/${encodeURIComponent(communityId)}/unlink-groups`, { groupIds });
      }

      case "redefine-invitation-link": {
        const { communityId } = body;
        if (!communityId) throw new Error("communityId is required");
        return await callZapi("POST", `/redefine-invitation-link/${encodeURIComponent(communityId)}`);
      }

      case "community-invitation-link": {
        const { communityId } = body;
        if (!communityId) throw new Error("communityId is required");
        const direct = await requestZapi("GET", `/communities/${encodeURIComponent(communityId)}/invitation-link`);
        const directError = direct.data && typeof direct.data === "object"
          && "error" in (direct.data as Record<string, unknown>);
        if (direct.ok && !directError) {
          return new Response(JSON.stringify(direct.data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const renewed = await requestZapi("POST", `/redefine-invitation-link/${encodeURIComponent(communityId)}`);
        const status = renewed.ok ? 200 : renewed.status;
        return new Response(JSON.stringify(renewed.data), {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add-community-participant": {
        const { communityId, phones } = body;
        if (!communityId) throw new Error("communityId is required");
        if (!Array.isArray(phones) || !phones.length) throw new Error("phones is required");
        return await callZapi("POST", "/add-participant", {
          autoInvite: true,
          communityId,
          phones,
        });
      }

      case "remove-community-participant": {
        const { communityId, phones } = body;
        if (!communityId) throw new Error("communityId is required");
        if (!Array.isArray(phones) || !phones.length) throw new Error("phones is required");
        return await callZapi("POST", `/communities/${encodeURIComponent(communityId)}/remove-participant`, { phones });
      }

      case "add-community-admin": {
        const { communityId, phones } = body;
        if (!communityId) throw new Error("communityId is required");
        if (!Array.isArray(phones) || !phones.length) throw new Error("phones is required");
        return await callZapi("POST", `/communities/${encodeURIComponent(communityId)}/add-admin`, { phones });
      }

      case "remove-community-admin": {
        const { communityId, phones } = body;
        if (!communityId) throw new Error("communityId is required");
        if (!Array.isArray(phones) || !phones.length) throw new Error("phones is required");
        return await callZapi("POST", `/communities/${encodeURIComponent(communityId)}/remove-admin`, { phones });
      }

      case "community-settings": {
        const { communityId, adminsOnlyMessage, adminsOnlyAddMember } = body;
        if (!communityId) throw new Error("communityId is required");
        const payload: Record<string, unknown> = {};
        if (typeof adminsOnlyMessage === "boolean") payload.adminsOnlyMessage = adminsOnlyMessage;
        if (typeof adminsOnlyAddMember === "boolean") payload.adminsOnlyAddMember = adminsOnlyAddMember;
        return await callZapi("PUT", `/communities/${encodeURIComponent(communityId)}/settings`, payload);
      }

      case "deactivate-community": {
        const { communityId } = body;
        if (!communityId) throw new Error("communityId is required");
        return await callZapi("DELETE", `/communities/${encodeURIComponent(communityId)}`);
      }

      case "update-community-description": {
        const { communityId, description } = body;
        if (!communityId) throw new Error("communityId is required");
        if (typeof description !== "string") throw new Error("description is required");
        return await callZapi("PUT", `/communities/${encodeURIComponent(communityId)}/description`, { description });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação inválida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("💥 manage-communities error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});