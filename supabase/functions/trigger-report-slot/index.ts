import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function que será chamada por pg_cron
 * Triggers: 00:00, 08:00, 12:00, 16:30, 18:00 (horário de Brasília)
 * Nota: O cron precisa ser UTC, então:
 *   00:00 BRT = 03:00 UTC
 *   08:00 BRT = 11:00 UTC
 *   12:00 BRT = 15:00 UTC
 *   16:30 BRT = 19:30 UTC
 *   18:00 BRT = 21:00 UTC
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Chamar send-period-reports com força de execução
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-period-reports?force=auto`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    const data = await res.json();
    console.log("[trigger-report-slot] Response:", data);

    return new Response(JSON.stringify({ success: true, triggered: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[trigger-report-slot] Error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
