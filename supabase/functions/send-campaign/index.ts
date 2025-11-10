import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

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

    console.log(`🚀 Starting campaign ${campaignId} for ${contacts.length} contacts`);

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

    // CRITICAL: Don't process paused campaigns - User must manually resume
    if (campaign.status === 'paused' || campaign.status === 'cancelled') {
      console.log(`❌ Campaign ${campaignId} is ${campaign.status.toUpperCase()}. Will not process. User must manually resume.`);
      return new Response(
        JSON.stringify({ 
          error: `Campaign is ${campaign.status}`,
          message: `Esta campanha está ${campaign.status === 'paused' ? 'pausada' : 'cancelada'}. ${campaign.status === 'paused' ? 'Use o botão "Retomar de onde parou" para continuar.' : ''}`,
          paused: campaign.status === 'paused',
          cancelled: campaign.status === 'cancelled'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!campaign.template) {
      throw new Error('Campaign template not found');
    }

    // Get user's Z-API credentials from their profile
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const zapiInstanceId = credentials.instanceId;
    const zapiToken = credentials.token;
    const zapiClientToken = credentials.clientToken;

    console.log(`✅ Using Z-API credentials for user ${credentials.userId}`);

    // Get delay from campaign or use default of 2 seconds
    const delayMs = (campaign.delay_seconds || 2) * 1000;
    console.log(`⏱️  DELAY CONFIGURADO: ${campaign.delay_seconds || 2} segundos (${delayMs}ms) entre mensagens`);

    // Define background processing function
    const processContactsInBackground = async () => {
      const results = [];
      
      // DOUBLE CHECK: Verify campaign is not paused before starting
      const { data: campaignCheck } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();
      
      if (campaignCheck?.status === 'paused' || campaignCheck?.status === 'cancelled') {
        console.log(`🛑 Campaign ${campaignId} is ${campaignCheck.status}. CANNOT START. User must manually resume.`);
        return;
      }
      
      // Process each contact
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        let campaignSend: CampaignSendRecord | undefined;
        
        try {
          // CHECK DEVICE STATUS FIRST
          console.log(`[${i + 1}/${contacts.length}] Checking device status...`);
          const deviceStatusUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/status`;
          
          try {
            const deviceResponse = await fetch(deviceStatusUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': zapiClientToken
              }
            });

            if (deviceResponse.ok) {
              const deviceStatus = await deviceResponse.json();
              console.log(`Device status:`, deviceStatus);
              
              // Check if device is connected
              if (!deviceStatus.connected || deviceStatus.connected === false) {
                console.log(`⚠️ DEVICE DISCONNECTED! Pausing campaign ${campaignId} at contact ${i + 1}/${contacts.length}`);
                
                // Pause campaign automatically
                await supabase
                  .from('campaigns')
                  .update({ status: 'paused' })
                  .eq('id', campaignId);
                
                return; // Exit background processing
              }
            }
          } catch (statusError) {
            console.error('Error checking device status:', statusError);
            // Continue anyway - don't block on status check errors
          }

          // CHECK IF CAMPAIGN WAS PAUSED - SECOND PRIORITY
          const { data: currentCampaign } = await supabase
            .from('campaigns')
            .select('status')
            .eq('id', campaignId)
            .single();
          
          console.log(`[${i + 1}/${contacts.length}] Checking campaign status: ${currentCampaign?.status}`);
          
          if (currentCampaign?.status === 'paused') {
            console.log(`🛑 Campaign ${campaignId} was PAUSED. Stopping at contact ${i + 1}/${contacts.length}`);
            
            // Update campaign status to ensure it stays paused
            await supabase
              .from('campaigns')
              .update({ status: 'paused' })
              .eq('id', campaignId);
            
            return; // Exit background processing
          }
          
          // Then check if this contact was already processed successfully
          const { data: existingSend } = await supabase
            .from('campaign_sends')
            .select('status')
            .eq('campaign_id', campaignId)
            .eq('phone', contact.phone)
            .in('status', ['sent', 'delivered'])
            .maybeSingle();

          if (existingSend) {
            console.log(`✓ Contact ${contact.phone} already processed, skipping`);
            results.push({
              phone: contact.phone,
              success: true,
              messageId: 'already-sent',
            });
            continue;
          }
          
          console.log(`📤 [${i + 1}/${contacts.length}] Processing contact: ${contact.phone}`);

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

          // Check template type and send accordingly
          const templateType = campaign.template.type || 'texto';
          const hasButtons = campaign.template.buttons && Array.isArray(campaign.template.buttons) && campaign.template.buttons.length > 0;
          const hasMedia = campaign.template.media_url && campaign.template.media_url.trim() !== '';
          
          let zapiUrl: string;
          let requestBody: any;

          // PRIORITY 1: Video with buttons (video_botoes) - Send video then buttons
          if (templateType === 'video_botoes' && hasMedia && hasButtons) {
            // First, send the video WITHOUT caption
            const videoUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-video`;
            const videoBody = {
              phone: contact.phone,
              video: campaign.template.media_url
            };
            
            console.log(`[1/2] Sending video to ${contact.phone}`);
            console.log(`📞 Z-API URL: ${videoUrl}`);
            console.log(`📦 Request body:`, JSON.stringify(videoBody, null, 2));
            
            const videoResponse = await fetch(videoUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': zapiClientToken,
              },
              body: JSON.stringify(videoBody),
            });
            
            const videoText = await videoResponse.text();
            console.log(`📥 Video Z-API Response (${videoResponse.status}):`, videoText);
            
            if (!videoResponse.ok) {
              throw new Error(`Erro ao enviar vídeo: ${videoText}`);
            }
            
            // Wait before sending buttons (use half the delay)
            const buttonDelay = Math.max(delayMs / 2, 1000);
            console.log(`⏱️  Aguardando ${buttonDelay}ms antes de enviar botões...`);
            await new Promise(resolve => setTimeout(resolve, buttonDelay));
            
            // Then, send the buttons message
            // Format buttons for Z-API with URL validation
            const formattedButtons = campaign.template.buttons
              .map((btn: any) => {
                const btnType = (btn.type || 'url').toUpperCase();
                const buttonData: any = {
                  label: btn.text || btn.label
                };
                
                if (btnType === 'CALL') {
                  buttonData.type = 'CALL';
                  buttonData.phone = btn.phone || btn.value;
                } else if (btnType === 'REPLY' || btnType === 'OPTION') {
                  buttonData.type = 'REPLY';
                } else if (btnType === 'COPY') {
                  buttonData.type = 'URL';
                  buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText || btn.value || '')}`;
                } else {
                  // URL button - validate and fix URL
                  let url = btn.url || btn.value || '';
                  
                  // If URL doesn't start with http:// or https://, add https://
                  if (url && !url.match(/^https?:\/\//i)) {
                    url = 'https://' + url;
                    console.log(`⚠️ Fixed URL without protocol: ${btn.url || btn.value} -> ${url}`);
                  }
                  
                  // Validate URL format
                  try {
                    new URL(url);
                    buttonData.type = 'URL';
                    buttonData.url = url;
                  } catch (e) {
                    console.error(`❌ Invalid URL in button "${btn.text || btn.label}": ${btn.url || btn.value}. Button will be skipped.`);
                    return null;
                  }
                }
                
                if (btn.id) {
                  buttonData.id = btn.id;
                }
                
                return buttonData;
              })
              .filter((btn: any) => btn !== null);
            
            if (formattedButtons.length === 0) {
              console.error('❌ All buttons were invalid. Cannot send message with buttons.');
              throw new Error('Todos os botões possuem URLs inválidas. Verifique o template.');
            }

            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-button-actions`;
            requestBody = {
              phone: contact.phone,
              message: fullMessage,
              buttonActions: formattedButtons
            };
            console.log(`[2/2] Sending message with ${formattedButtons.length} button(s) to ${contact.phone}`);
            
          } else if (templateType === 'imagem_botoes' && hasMedia && hasButtons) {
            // Format buttons for Z-API with URL validation
            const formattedButtons = campaign.template.buttons
              .map((btn: any) => {
                const btnType = (btn.type || 'url').toUpperCase();
                const buttonData: any = {
                  label: btn.text || btn.label
                };
                
                if (btnType === 'CALL') {
                  buttonData.type = 'CALL';
                  buttonData.phone = btn.phone || btn.value;
                } else if (btnType === 'REPLY' || btnType === 'OPTION') {
                  buttonData.type = 'REPLY';
                } else if (btnType === 'COPY') {
                  buttonData.type = 'URL';
                  buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText || btn.value || '')}`;
                } else {
                  // URL button - validate and fix URL
                  let url = btn.url || btn.value || '';
                  
                  // If URL doesn't start with http:// or https://, add https://
                  if (url && !url.match(/^https?:\/\//i)) {
                    url = 'https://' + url;
                    console.log(`⚠️ Fixed URL without protocol: ${btn.url || btn.value} -> ${url}`);
                  }
                  
                  // Validate URL format
                  try {
                    new URL(url);
                    buttonData.type = 'URL';
                    buttonData.url = url;
                  } catch (e) {
                    console.error(`❌ Invalid URL in button "${btn.text || btn.label}": ${btn.url || btn.value}. Button will be skipped.`);
                    return null; // Skip invalid buttons
                  }
                }
                
                if (btn.id) {
                  buttonData.id = btn.id;
                }
                
                return buttonData;
              })
              .filter((btn: any) => btn !== null); // Remove null buttons (invalid URLs)
            
            if (formattedButtons.length === 0) {
              console.error('❌ All buttons were invalid. Cannot send message with buttons.');
              throw new Error('Todos os botões possuem URLs inválidas. Verifique o template.');
            }

            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-button-actions`;
            requestBody = {
              phone: contact.phone,
              message: fullMessage,
              image: campaign.template.media_url,
              buttonActions: formattedButtons
            };
            console.log(`Sending image with ${formattedButtons.length} button(s) to ${contact.phone}`);
            
          } else if (templateType === 'imagem') {
            // Simple image without buttons
            if (!hasMedia) {
              throw new Error('Template tipo "imagem" requer uma imagem');
            }
            
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-image`;
            requestBody = {
              phone: contact.phone,
              image: campaign.template.media_url,
              caption: fullMessage
            };
            console.log(`Sending image to ${contact.phone}`);
            
          } else if (templateType === 'video') {
            if (!hasMedia) {
              throw new Error('Template tipo "video" requer um vídeo');
            }
            
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-video`;
            requestBody = {
              phone: contact.phone,
              video: campaign.template.media_url,
              caption: fullMessage
            };
            console.log(`Sending video to ${contact.phone}`);
            
          } else if (templateType === 'audio') {
            if (!hasMedia) {
              throw new Error('Template tipo "audio" requer um áudio');
            }
            
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-audio`;
            requestBody = {
              phone: contact.phone,
              audio: campaign.template.media_url
            };
            console.log(`Sending audio to ${contact.phone}`);
            
          } else if (templateType === 'documento' || templateType === 'arquivo') {
            if (!hasMedia) {
              throw new Error(`Template tipo "${templateType}" requer um arquivo`);
            }
            
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-document`;
            requestBody = {
              phone: contact.phone,
              document: campaign.template.media_url,
              fileName: campaign.template.file_name || 'documento',
              extension: campaign.template.file_type?.split('/').pop() || 'pdf',
              caption: fullMessage
            };
            console.log(`Sending document to ${contact.phone}`);
            
          } else if (hasButtons) {
            // Send with buttons using send-button-actions
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-button-actions`;
            
            // Format buttons for Z-API
            const formattedButtons = campaign.template.buttons.map((btn: any) => {
              // Normalize button type to uppercase
              const btnType = (btn.type || 'url').toUpperCase();
              
              const buttonData: any = {
                label: btn.text || btn.label
              };
              
              // Z-API only supports: CALL, URL, REPLY
              if (btnType === 'CALL') {
                buttonData.type = 'CALL';
                buttonData.phone = btn.phone || btn.value;
              } else if (btnType === 'REPLY' || btnType === 'OPTION') {
                // OPTION maps to REPLY in Z-API
                buttonData.type = 'REPLY';
              } else if (btnType === 'COPY') {
                // COPY is implemented as URL with special WhatsApp link
                buttonData.type = 'URL';
                buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText || btn.value || '')}`;
              } else {
                // Default to URL type
                buttonData.type = 'URL';
                buttonData.url = btn.url || btn.value || 'https://z-api.io';
              }
              
              // Optional ID
              if (btn.id) {
                buttonData.id = btn.id;
              }
              
              return buttonData;
            });

            requestBody = {
              phone: contact.phone,
              message: fullMessage,
              buttonActions: formattedButtons
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
          
          console.log(`📞 Z-API URL: ${zapiUrl}`);
          console.log(`📦 Request body:`, JSON.stringify(requestBody, null, 2));
          
          const zapiResponse = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': zapiClientToken,
            },
            body: JSON.stringify(requestBody),
          });

          let zapiResult: any = {};
          
          // Try to parse JSON response, but handle empty responses
          try {
            const responseText = await zapiResponse.text();
            console.log(`📥 Z-API Response (${zapiResponse.status}):`, responseText);
            if (responseText && responseText.trim()) {
              zapiResult = JSON.parse(responseText);
            }
          } catch (parseError) {
            console.warn(`Could not parse Z-API response for ${contact.phone}:`, parseError);
          }

          if (zapiResponse.ok && zapiResponse.status >= 200 && zapiResponse.status < 300) {
            campaignSend.status = 'sent';
            campaignSend.sent_at = new Date().toISOString();
            
            results.push({
              phone: contact.phone,
              success: true,
              messageId: zapiResult.messageId,
            });

            console.log(`✅ Message sent successfully to ${contact.phone} - MessageID: ${zapiResult.messageId}`);
          } else {
            campaignSend.status = 'failed';
            campaignSend.error_message = zapiResult.error || `HTTP ${zapiResponse.status}: ${zapiResponse.statusText}`;
            
            results.push({
              phone: contact.phone,
              success: false,
              error: zapiResult.error || `HTTP ${zapiResponse.status}: ${zapiResponse.statusText}`,
            });

            console.error(`❌ Failed to send message to ${contact.phone}:`, zapiResult.error || `HTTP ${zapiResponse.status}`);
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
          console.log(`⏳ Aguardando ${campaign.delay_seconds || 2} segundos antes da próxima mensagem...`);
          const startWait = Date.now();
          await new Promise(resolve => setTimeout(resolve, delayMs));
          const endWait = Date.now();
          console.log(`✅ Delay concluído! Esperou ${Math.round((endWait - startWait) / 1000)}s`);
        }
      }

      // Update campaign status to completed (only if it wasn't paused)
      const { data: finalCampaign } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();
      
      // Only mark as completed if campaign is still active (not paused)
      if (finalCampaign?.status === 'active') {
        await supabase
          .from('campaigns')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId);
      }

      // Calculate summary
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`✅ Campaign ${campaignId} completed: ${successCount} sent, ${failureCount} failed`);
    };

    // Start background processing
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processContactsInBackground());

    // Return immediately so UI can track progress
    console.log(`🚀 Campaign ${campaignId} started in background`);
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Campaign iniciada! Acompanhe o progresso em tempo real.`,
        campaignId: campaignId,
        totalContacts: contacts.length,
        started: true
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