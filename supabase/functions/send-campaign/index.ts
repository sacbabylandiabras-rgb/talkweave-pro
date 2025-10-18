import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

interface SendCampaignRequest {
  campaignId: string;
  contacts: Array<{
    phone: string;
    name?: string;
    variables?: Record<string, string>;
  }>;
}

interface CampaignSendRecord {
  campaign_id: string;
  phone: string;
  contact_name?: string;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    const { campaignId, contacts }: SendCampaignRequest = await req.json();

    if (!campaignId || !contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID and contacts are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Processing campaign ${campaignId} for ${contacts.length} contacts`);

    // Get campaign and template details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        template:message_templates(*)
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    if (!campaign.template) {
      throw new Error('Campaign template not found');
    }

    // Get Z-API credentials
    const zapiInstanceId = '3E6DD0DEED00C0FD52197AE2AD17DA62';
    const zapiToken = '9E09CAB81F22425F5954C6C2';
    const zapiClientToken = 'Fd1c0871baaa5449db5ea1628166c0566S';

    console.log('Using Z-API credentials for campaign');

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      throw new Error('Missing Z-API credentials');
    }

    const results = [];
    
    // Get delay from campaign or use default of 2 seconds
    const delayMs = (campaign.delay_seconds || 2) * 1000;
    console.log(`Using delay of ${campaign.delay_seconds || 2} seconds between messages`);

    // Process each contact
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      let campaignSend: CampaignSendRecord | undefined;
      
      try {
        // Process message template with variables
        let messageContent = campaign.template.content;
        
        // Replace common variables
        messageContent = messageContent.replace(/{nome}/g, contact.name || 'Cliente');
        messageContent = messageContent.replace(/{empresa}/g, 'Nossa Empresa');
        messageContent = messageContent.replace(/{data}/g, new Date().toLocaleDateString('pt-BR'));
        messageContent = messageContent.replace(/{hora}/g, new Date().toLocaleTimeString('pt-BR'));

        // Replace custom variables if provided
        if (contact.variables) {
          Object.entries(contact.variables).forEach(([key, value]) => {
            const regex = new RegExp(`{${key}}`, 'g');
            messageContent = messageContent.replace(regex, value);
          });
        }

        // Create campaign send record
        campaignSend = {
          campaign_id: campaignId,
          phone: contact.phone,
          contact_name: contact.name,
          message_content: messageContent,
          status: 'pending',
        };

        // Build full message with header and footer
        let fullMessage = '';
        if (campaign.template.header) {
          fullMessage += campaign.template.header + '\n\n';
        }
        fullMessage += messageContent;
        if (campaign.template.footer) {
          fullMessage += '\n\n' + campaign.template.footer;
        }

        // Check if template has buttons
        const hasButtons = campaign.template.buttons && Array.isArray(campaign.template.buttons) && campaign.template.buttons.length > 0;
        
        let zapiUrl: string;
        let requestBody: any;

        if (hasButtons) {
          // Send with buttons using send-button-actions
          zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-button-actions`;
          
          // Format buttons for Z-API
          const formattedButtons = campaign.template.buttons.map((btn: any) => ({
            id: btn.id || Date.now().toString(),
            label: btn.text || btn.label,
            type: btn.type || 'url',
            value: btn.value || btn.url || ''
          }));

          requestBody = {
            phone: contact.phone,
            message: fullMessage,
            buttonActions: {
              buttons: formattedButtons
            }
          };

          console.log(`Sending message with ${formattedButtons.length} button(s) to ${contact.phone}`);
        } else {
          // Send simple text message
          zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
          requestBody = {
            phone: contact.phone,
            message: fullMessage,
          };

          console.log(`Sending text message to ${contact.phone}`);
        }
        
        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiClientToken,
          },
          body: JSON.stringify(requestBody),
        });

        const zapiResult = await zapiResponse.json();

        if (zapiResponse.ok) {
          campaignSend.status = 'sent';
          campaignSend.sent_at = new Date().toISOString();
          
          results.push({
            phone: contact.phone,
            success: true,
            messageId: zapiResult.messageId,
          });

          console.log(`Message sent successfully to ${contact.phone}`);
        } else {
          campaignSend.status = 'failed';
          campaignSend.error_message = zapiResult.error || 'Z-API request failed';
          
          results.push({
            phone: contact.phone,
            success: false,
            error: zapiResult.error || 'Z-API request failed',
          });

          console.error(`Failed to send message to ${contact.phone}:`, zapiResult);
        }

      } catch (error) {
        if (!campaignSend) {
          campaignSend = {
            campaign_id: campaignId,
            phone: contact.phone,
            contact_name: contact.name,
            message_content: 'Error processing message',
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          };
        } else {
          campaignSend.status = 'failed';
          campaignSend.error_message = error instanceof Error ? error.message : 'Unknown error';
        }
        
        results.push({
          phone: contact.phone,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        console.error(`Error sending to ${contact.phone}:`, error);
      }

      // Save to database IMMEDIATELY after each send (for real-time progress tracking)
      if (campaignSend) {
        const { error: insertError } = await supabase
          .from('campaign_sends')
          .insert([campaignSend]);

        if (insertError) {
          console.error(`Error saving campaign send for ${contact.phone}:`, insertError);
        } else {
          console.log(`Saved campaign send record for ${contact.phone}`);
        }
      }

      // Add delay BETWEEN messages (after sending and before next iteration)
      // Skip delay after the last message
      if (i < contacts.length - 1) {
        console.log(`Waiting ${campaign.delay_seconds || 2} seconds before next message...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // Update campaign status
    await supabase
      .from('campaigns')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    // Calculate summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Campaign ${campaignId} completed: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Campaign sent to ${contacts.length} contacts`,
        results: {
          total: contacts.length,
          sent: successCount,
          failed: failureCount,
        },
        details: results
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error in send-campaign function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});