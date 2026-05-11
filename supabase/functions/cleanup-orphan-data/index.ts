import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
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

    // Verify caller is admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const isAdmin = !!roleData;

    // Handle specific actions
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    if (body?.action === 'delete-instance' && body?.instanceId) {
      let deleteQuery = supabase
        .from('zapi_instances')
        .delete()
        .eq('id', body.instanceId);

      if (!isAdmin) {
        deleteQuery = deleteQuery.eq('user_id', user.id);
      }

      const { data: deleted, error: delError } = await deleteQuery
        .select();

      if (delError) throw delError;
      if (!deleted || deleted.length === 0) {
        return new Response(
          JSON.stringify({ success: false, deleted: 0, error: 'Instância não encontrada ou sem permissão para apagar.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`🗑️ User ${user.id} deleted instance ${body.instanceId}, rows: ${deleted.length}, admin: ${isAdmin}`);

      return new Response(
        JSON.stringify({ success: true, deleted: deleted.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reset campaigns that were marked as completed but have zero successful sends
    if (body?.action === 'reset-broken-campaigns' && body?.targetUserId) {
      if (!isAdmin) throw new Error('Only admins can reset campaigns');

      // Find completed campaigns with 0 successful sends for the target user
      const { data: brokenCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('user_id', body.targetUserId)
        .eq('status', 'completed');

      let resetCount = 0;
      for (const campaign of (brokenCampaigns || [])) {
        const { count } = await supabase
          .from('campaign_sends')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .in('status', ['sent', 'delivered']);

        if ((count ?? 0) === 0) {
          await supabase.from('campaigns').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', campaign.id);
          console.log(`🔄 Reset campaign ${campaign.name} (${campaign.id}) from completed to draft`);
          resetCount++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, resetCount }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) throw new Error('Only admins can run cleanup');

    console.log('🧹 Starting cleanup of orphan data...');

    const { data: orphanTemplates, error: templatesError } = await supabase
      .from('message_templates')
      .delete()
      .is('user_id', null)
      .select();

    if (templatesError) console.error('Error deleting orphan templates:', templatesError);
    else console.log(`✅ Deleted ${orphanTemplates?.length || 0} orphan templates`);

    const { data: orphanCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .delete()
      .is('user_id', null)
      .select();

    if (campaignsError) console.error('Error deleting orphan campaigns:', campaignsError);
    else console.log(`✅ Deleted ${orphanCampaigns?.length || 0} orphan campaigns`);

    const { data: orphanSends, error: sendsError } = await supabase
      .from('campaign_sends')
      .delete()
      .is('user_id', null)
      .select();

    if (sendsError) console.error('Error deleting orphan campaign_sends:', sendsError);
    else console.log(`✅ Deleted ${orphanSends?.length || 0} orphan campaign sends`);

    return new Response(
      JSON.stringify({ 
        success: true,
        deleted: {
          templates: orphanTemplates?.length || 0,
          campaigns: orphanCampaigns?.length || 0,
          campaign_sends: orphanSends?.length || 0
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
