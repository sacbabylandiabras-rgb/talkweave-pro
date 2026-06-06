import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { value, dataType, operator, compareValue } = await req.json();

    let result = false;
    const val = String(value || "").trim();
    const comp = String(compareValue || "").trim();

    if (dataType === "number") {
      const nVal = Number(val);
      const nComp = Number(comp);
      if (!isNaN(nVal) && !isNaN(nComp)) {
        switch (operator) {
          case "equals": result = nVal === nComp; break;
          case "not_equals": result = nVal !== nComp; break;
          case "greater": result = nVal > nComp; break;
          case "greater_equals": result = nVal >= nComp; break;
          case "less": result = nVal < nComp; break;
          case "less_equals": result = nVal <= nComp; break;
        }
      }
    } else if (dataType === "boolean") {
      const bVal = val.toLowerCase() === "true" || val === "1";
      if (operator === "is_true") result = bVal === true;
      else if (operator === "is_false") result = bVal === false;
    } else {
      // String
      switch (operator) {
        case "equals": result = val.toLowerCase() === comp.toLowerCase(); break;
        case "not_equals": result = val.toLowerCase() !== comp.toLowerCase(); break;
        case "contains": result = val.toLowerCase().includes(comp.toLowerCase()); break;
        case "not_contains": result = !val.toLowerCase().includes(comp.toLowerCase()); break;
        case "starts_with": result = val.toLowerCase().startsWith(comp.toLowerCase()); break;
        case "ends_with": result = val.toLowerCase().endsWith(comp.toLowerCase()); break;
        case "is_empty": result = val === ""; break;
        case "is_not_empty": result = val !== ""; break;
        case "matches_regex": try { result = new RegExp(comp, "i").test(val); } catch { result = false; } break;
      }
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
