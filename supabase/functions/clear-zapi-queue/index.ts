import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Get user's Z-API credentials from their profile
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const instanceId = credentials.instanceId;
    const token = credentials.token;
    const clientToken = credentials.clientToken;

    console.log(`🧹 Clearing Z-API queue for instance ${instanceId}`);

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/queue`

    const zapiResponse = await fetch(zapiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      }
    })

    const zapiData = await zapiResponse.json()

    if (!zapiResponse.ok) {
      console.error('❌ Failed to clear Z-API queue:', zapiData);
      return new Response(
        JSON.stringify({ error: 'Failed to clear Z-API queue', details: zapiData }),
        { 
          status: zapiResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`✅ Z-API queue cleared successfully`);

    return new Response(
      JSON.stringify({ success: true, message: 'Z-API queue cleared', data: zapiData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error clearing Z-API queue:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
