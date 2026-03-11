import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
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

    const { phone, message } = await req.json()

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone and message are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const instanceId = credentials.instanceId;
    const token = credentials.token;
    const clientToken = credentials.clientToken;

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      },
      body: JSON.stringify({ phone, message })
    })

    const zapiData = await zapiResponse.json()

    if (!zapiResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to send message', details: zapiData }),
        { 
          status: zapiResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Log the sent message in message_logs
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase.from('message_logs').insert({
      phone,
      message_received: null,
      response_sent: message,
      keyword_matched: '__manual_send__',
      timestamp: new Date().toISOString(),
      user_id: credentials.userId,
    });

    return new Response(
      JSON.stringify({ success: true, data: zapiData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
