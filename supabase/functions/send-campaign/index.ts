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
  instanceId?: string; // Optional: specific Z-API instance to use
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
  user_id?: string;
  instance_name?: string;
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

    const { campaignId, contacts, instanceId: requestedInstanceId }: SendCampaignRequest = await req.json();

    if (!campaignId || !contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID and contacts are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`🚀 Starting campaign ${campaignId} for ${contacts.length} contacts`);

    // Get user's Z-API credentials from their profile (auth first)
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    let zapiInstanceId = credentials.instanceId;
    let zapiToken = credentials.token;
    let zapiClientToken = credentials.clientToken;

    // Round-robin rotation: load all active instances
    const isRotateMode = requestedInstanceId === '__rotate_all__';
    let rotatePool: any[] = [];
    
    if (isRotateMode) {
      const { data: allActiveInstances } = await supabase
        .from('zapi_instances')
        .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name')
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      
      rotatePool = allActiveInstances || [];
      console.log(`🔄 Rotate mode: ${rotatePool.length} instances loaded for round-robin`);
    } else if (requestedInstanceId) {
      // If a specific instance was requested, look it up
      const { data: specificInstance } = await supabase
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name')
        .eq('id', requestedInstanceId)
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .maybeSingle();

      if (specificInstance) {
        zapiInstanceId = specificInstance.zapi_instance_id;
        zapiToken = specificInstance.zapi_token;
        zapiClientToken = specificInstance.zapi_client_token;
        console.log(`📌 Using requested instance: ${specificInstance.instance_name} (${requestedInstanceId})`);
      } else {
        console.log(`⚠️ Requested instance ${requestedInstanceId} not found, using default`);
      }
    }

    // Helper to get credentials for a given contact index (supports rotation)
    const getInstanceForIndex = (index: number) => {
      if (isRotateMode && rotatePool.length > 0) {
        const inst = rotatePool[index % rotatePool.length];
        return {
          zapiInstanceId: inst.zapi_instance_id,
          zapiToken: inst.zapi_token,
          zapiClientToken: inst.zapi_client_token,
          instanceName: inst.instance_name,
        };
      }
      return {
        zapiInstanceId,
        zapiToken,
        zapiClientToken,
        instanceName: credentials.instanceName,
      };
    };

    console.log(`✅ Using Z-API credentials for user ${credentials.userId}`);

    // Get campaign and template details (scoped to authenticated user)
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        template:message_templates(*)
      `)
      .eq('id', campaignId)
      .eq('user_id', credentials.userId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // CRITICAL: Don't process paused campaigns - User must manually resume
    if (campaign.status === 'paused') {
      console.log(`❌ Campaign ${campaignId} is PAUSED. Will not process. User must manually resume.`);
      return new Response(
        JSON.stringify({
          error: `Campaign is paused`,
          message: `Esta campanha está pausada. Use o botão "Retomar de onde parou" para continuar.`,
          paused: true
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // If campaign is cancelled/draft, update to active since user explicitly triggered send
    if (campaign.status === 'cancelled' || campaign.status === 'draft') {
      console.log(`🔄 Campaign ${campaignId} was ${campaign.status}. Updating to active.`);
      await supabase
        .from('campaigns')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .eq('user_id', credentials.userId);
    }

    if (!campaign.template) {
      throw new Error('Campaign template not found');
    }

    // Get delay from campaign or use default of 2 seconds
    const delayMs = (campaign.delay_seconds || 2) * 1000;
    console.log(`⏱️  DELAY CONFIGURADO: ${campaign.delay_seconds || 2} segundos (${delayMs}ms) entre mensagens`);

    // Max execution time before self-re-invoking (120s to leave margin before 150s timeout)
    const MAX_EXEC_MS = 120_000;
    const startTime = Date.now();

    // Define background processing function
    const processContactsInBackground = async () => {
      const results = [];
      
      // DOUBLE CHECK: Verify campaign is not paused before starting
      const { data: campaignCheck } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();
      
      if (campaignCheck?.status === 'paused') {
        console.log(`🛑 Campaign ${campaignId} is paused. CANNOT START. User must manually resume.`);
        return;
      }
      
      // Process each contact
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        let campaignSend: CampaignSendRecord | undefined;

        // Resolve instance for this contact (supports round-robin rotation)
        const currentInstance = getInstanceForIndex(i);
        zapiInstanceId = currentInstance.zapiInstanceId;
        zapiToken = currentInstance.zapiToken;
        zapiClientToken = currentInstance.zapiClientToken;
        
        if (isRotateMode) {
          console.log(`🔄 Contact ${i+1}: using instance "${currentInstance.instanceName}" (rotation index ${i % rotatePool.length})`);
        }
        
        try {
          // TIME GUARD: If approaching timeout, re-invoke with remaining contacts
          const elapsed = Date.now() - startTime;
          if (elapsed > MAX_EXEC_MS) {
            const remainingContacts = contacts.slice(i);
            console.log(`⏰ Approaching timeout at contact ${i+1}/${contacts.length} (${Math.round(elapsed/1000)}s). Re-invoking with ${remainingContacts.length} remaining contacts...`);
            
            // Re-invoke self with remaining contacts
            const authHeader = req.headers.get('authorization') || '';
            const reinvokeUrl = `${supabaseUrl}/functions/v1/send-campaign`;
            
            try {
              const reResponse = await fetch(reinvokeUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': authHeader,
                },
                body: JSON.stringify({
                  campaignId,
                  contacts: remainingContacts,
                  instanceId: requestedInstanceId,
                }),
              });
              const reData = await reResponse.text();
              console.log(`🔄 Re-invocation response (${reResponse.status}): ${reData}`);
            } catch (reError) {
              console.error(`❌ Re-invocation failed:`, reError);
              // Don't mark as completed - campaign stays active for manual resume
            }
            return; // Exit current execution
          }
          // CHECK DEVICE STATUS every 5 contacts (not every single one)
          if (i % 5 === 0) {
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
                
                console.log(`📡 Device status check (contact ${i+1}):`, JSON.stringify(deviceStatus));
                
                // Z-API can return { connected: true/false } OR { status: "CONNECTED"/"DISCONNECTED" }
                // Only pause if we EXPLICITLY detect disconnection
                const isConnected = deviceStatus.connected === true || 
                  (typeof deviceStatus.connected === 'string' && deviceStatus.connected.toLowerCase() === 'true') ||
                  deviceStatus.status === 'CONNECTED' ||
                  (typeof deviceStatus.status === 'string' && deviceStatus.status.toLowerCase() === 'connected');
                
                const isExplicitlyDisconnected = deviceStatus.connected === false || 
                  deviceStatus.status === 'DISCONNECTED' ||
                  (typeof deviceStatus.status === 'string' && deviceStatus.status.toLowerCase() === 'disconnected');
                
                if (isExplicitlyDisconnected && !isConnected) {
                  console.log(`❌ DISPOSITIVO DESCONECTADO! PAUSANDO campanha ${campaignId}`);
                  
                  await supabase
                    .from('campaigns')
                    .update({ status: 'paused', updated_at: new Date().toISOString() })
                    .eq('id', campaignId);

                  try {
                    const clearQueueUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/queue`;
                    await fetch(clearQueueUrl, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json', 'Client-Token': zapiClientToken }
                    });
                  } catch (queueError) {
                    console.error('Erro ao limpar fila:', queueError);
                  }
                  
                  return;
                }
              }
            } catch (statusError) {
              // Continue - don't block on status check errors
            }
          }

          // CHECK IF CAMPAIGN WAS PAUSED every 3 contacts
          if (i % 3 === 0) {
            const { data: currentCampaign } = await supabase
              .from('campaigns')
              .select('status')
              .eq('id', campaignId)
              .single();
            
            if (currentCampaign?.status === 'paused') {
              console.log(`🛑 Campaign ${campaignId} paused. Stopping at ${i + 1}/${contacts.length}`);
              return;
            }
          }
          
          // Check if this exact contact iteration was already processed
          // Use count of successful sends for this phone vs how many times this phone appears before current index
          const { data: existingSends } = await supabase
            .from('campaign_sends')
            .select('id, status')
            .eq('campaign_id', campaignId)
            .eq('phone', contact.phone);

          const successfulForPhone = existingSends?.filter(s => s.status === 'sent' || s.status === 'delivered').length || 0;
          const phoneOccurrencesBefore = contacts.slice(0, i).filter(c => c.phone === contact.phone).length;
          const totalNeededForPhone = contacts.filter(c => c.phone === contact.phone).length;
          
          // If we already have enough successful sends for this phone, skip
          if (successfulForPhone > phoneOccurrencesBefore) {
            console.log(`✓ Contact ${contact.phone} (occurrence ${phoneOccurrencesBefore + 1}) already processed, skipping`);
            results.push({
              phone: contact.phone,
              success: true,
              messageId: 'already-sent',
            });
            continue;
          }

          // Remove any failed/pending records for retry (only one)
          const failedOrPending = existingSends?.find(s => s.status === 'failed' || s.status === 'pending');
          if (failedOrPending) {
            console.log(`🔄 Removing old ${failedOrPending.status} record for ${contact.phone} to retry`);
            await supabase
              .from('campaign_sends')
              .delete()
              .eq('id', failedOrPending.id);
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
            user_id: credentials.userId,
            instance_name: credentials.instanceName,
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
          const hasCarouselCards = campaign.template.carousel_cards && Array.isArray(campaign.template.carousel_cards) && campaign.template.carousel_cards.length > 0;
          
          let zapiUrl: string;
          let requestBody: any;

          // PRIORITY 0: Carousel (carrossel)
          if (templateType === 'carrossel' && hasCarouselCards) {
            // First, send the carousel cards
            const carouselCards = campaign.template.carousel_cards.map((card: any) => {
              const cardData: any = {
                title: card.title || '',
                description: card.description || '',
              };
              
              // Add image if available
              if (card.image && card.image.trim() !== '') {
                cardData.image = card.image;
              }
              
              // Add buttons if available
              if (card.buttons && Array.isArray(card.buttons) && card.buttons.length > 0) {
                cardData.buttonActions = card.buttons.map((btn: any) => {
                  const btnType = (btn.type || 'url').toUpperCase();
                  const buttonData: any = {
                    label: btn.text || btn.label
                  };
                  
                  if (btnType === 'CALL') {
                    buttonData.type = 'CALL';
                    buttonData.phone = btn.phone || btn.value;
                  } else if (btnType === 'REPLY' || btnType === 'OPTION') {
                    buttonData.type = 'REPLY';
                  } else {
                    // URL button - ensure it has http:// or https://
                    buttonData.type = 'URL';
                    let url = btn.url || btn.value || 'https://z-api.io';
                    // Add https:// if missing
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      url = 'https://' + url;
                    }
                    buttonData.url = url;
                  }
                  
                  if (btn.id) {
                    buttonData.id = btn.id;
                  }
                  
                  return buttonData;
                });
              }
              
              return cardData;
            });
            
            const carouselUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-carousel`;
            const carouselBody = {
              phone: contact.phone,
              cards: carouselCards
            };
            
            console.log(`[1/2] Sending carousel with ${carouselCards.length} card(s) to ${contact.phone}`);
            console.log(`📞 Z-API URL: ${carouselUrl}`);
            console.log(`📦 Request body:`, JSON.stringify(carouselBody, null, 2));
            
            const carouselResponse = await fetch(carouselUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': zapiClientToken,
              },
              body: JSON.stringify(carouselBody),
            });
            
            const carouselText = await carouselResponse.text();
            console.log(`📥 Carousel Z-API Response (${carouselResponse.status}):`, carouselText);
            
            if (!carouselResponse.ok) {
              throw new Error(`Erro ao enviar carrossel: ${carouselText}`);
            }
            
            // Carousel sent successfully - mark as complete and continue
            campaignSend.status = 'sent';
            campaignSend.sent_at = new Date().toISOString();
            
            results.push({
              phone: contact.phone,
              success: true,
              messageId: 'carousel-sent',
            });

            console.log(`✅ Carousel sent successfully to ${contact.phone}`);
            
            // Save campaign send record
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

            // Add delay before next contact
            if (i < contacts.length - 1) {
              console.log(`⏱️  Aguardando ${delayMs}ms antes do próximo contato...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            continue;
            
          } else if (templateType === 'video_botoes' && hasMedia && hasButtons) {
            // PRIORITY 1: Video with buttons (video_botoes) - Send video then buttons
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
                  // URL button - send as is
                  buttonData.type = 'URL';
                  buttonData.url = btn.url || btn.value || 'https://z-api.io';
                }
                
                if (btn.id) {
                  buttonData.id = btn.id;
                }
                
                return buttonData;
              })
              .filter((btn: any) => btn !== null);
            
            if (formattedButtons.length === 0) {
              console.error('❌ No buttons to send.');
              throw new Error('Nenhum botão para enviar.');
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
              const formattedButtons = campaign.template.buttons.map((btn: any) => {
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
                  // URL button - send as is
                  buttonData.type = 'URL';
                  buttonData.url = btn.url || btn.value || 'https://z-api.io';
                }
                
                if (btn.id) {
                  buttonData.id = btn.id;
                }
                
                return buttonData;
              });
            
            if (formattedButtons.length === 0) {
              console.error('❌ No buttons to send.');
              throw new Error('Nenhum botão válido para enviar.');
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
              audio: campaign.template.media_url,
              waveform: true
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
              user_id: credentials.userId,
              instance_name: credentials.instanceName,
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

      // Update campaign status to completed (only if it wasn't paused or cancelled)
      const { data: finalCampaign } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();
      
      // Mark as completed if campaign is still active OR draft (wasn't paused/cancelled during processing)
      if (finalCampaign?.status === 'active' || finalCampaign?.status === 'draft') {
        await supabase
          .from('campaigns')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId);
        
        console.log(`📊 Campaign ${campaignId} marked as completed`);
      } else {
        console.log(`⚠️ Campaign ${campaignId} not marked as completed (status: ${finalCampaign?.status})`);
      }

      // Calculate summary
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`✅ Campaign ${campaignId} completed: ${successCount} sent, ${failureCount} failed`);
    };

    // Wrap background processing with error handling to prevent silent failures
    const safeBackgroundProcess = async () => {
      try {
        await processContactsInBackground();
      } catch (bgError) {
        console.error(`💥 CRITICAL: Background processing crashed for campaign ${campaignId}:`, bgError);
        // Update campaign status so user knows something went wrong
        try {
          const { data: crashCheck } = await supabase
            .from('campaigns')
            .select('status')
            .eq('id', campaignId)
            .single();
          
          // Only update if still active (not manually paused/completed)
          if (crashCheck?.status === 'active' || crashCheck?.status === 'draft') {
            await supabase
              .from('campaigns')
              .update({ status: 'paused', updated_at: new Date().toISOString() })
              .eq('id', campaignId);
            console.log(`⚠️ Campaign ${campaignId} paused due to error. User can resume.`);
          }
        } catch (_) { /* last resort - can't do anything */ }
      }
    };

    // Start background processing
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(safeBackgroundProcess());

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