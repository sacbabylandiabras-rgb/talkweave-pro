import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🧹 Starting cleanup of orphan data...');

    // Delete orphan message templates (without user_id)
    const { data: orphanTemplates, error: templatesError } = await supabase
      .from('message_templates')
      .delete()
      .is('user_id', null)
      .select();

    if (templatesError) {
      console.error('Error deleting orphan templates:', templatesError);
    } else {
      console.log(`✅ Deleted ${orphanTemplates?.length || 0} orphan templates`);
    }

    // Delete orphan campaigns (without user_id)
    const { data: orphanCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .delete()
      .is('user_id', null)
      .select();

    if (campaignsError) {
      console.error('Error deleting orphan campaigns:', campaignsError);
    } else {
      console.log(`✅ Deleted ${orphanCampaigns?.length || 0} orphan campaigns`);
    }

    // Delete orphan campaign_sends (without user_id)
    const { data: orphanSends, error: sendsError } = await supabase
      .from('campaign_sends')
      .delete()
      .is('user_id', null)
      .select();

    if (sendsError) {
      console.error('Error deleting orphan campaign_sends:', sendsError);
    } else {
      console.log(`✅ Deleted ${orphanSends?.length || 0} orphan campaign sends`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        deleted: {
          templates: orphanTemplates?.length || 0,
          campaigns: orphanCampaigns?.length || 0,
          campaign_sends: orphanSends?.length || 0
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in cleanup-orphan-data:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
