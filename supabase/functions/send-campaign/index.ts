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
  instanceId?: string;
  rotationOffset?: number;
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

interface ResolvedInstance {
  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken: string;
  instanceName: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readDeviceConnectivity = (deviceStatus: any) => {
  const isConnected = deviceStatus?.connected === true ||
    (typeof deviceStatus?.connected === 'string' && deviceStatus.connected.toLowerCase() === 'true') ||
    deviceStatus?.status === 'CONNECTED' ||
    (typeof deviceStatus?.status === 'string' && deviceStatus.status.toLowerCase() === 'connected');

  const isExplicitlyDisconnected = deviceStatus?.connected === false ||
    deviceStatus?.status === 'DISCONNECTED' ||
    (typeof deviceStatus?.status === 'string' && deviceStatus.status.toLowerCase() === 'disconnected');

  return { connected: isConnected, explicitlyDisconnected: isExplicitlyDisconnected };
};

const fetchDeviceStatusSnapshot = async (instance: ResolvedInstance) => {
  try {
    const deviceStatusUrl = `https://api.z-api.io/instances/${instance.zapiInstanceId}/token/${instance.zapiToken}/status`;
    const deviceResponse = await fetch(deviceStatusUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapiClientToken },
    });

    if (!deviceResponse.ok) {
      return { connected: false, explicitlyDisconnected: false, ok: false, raw: { error: `HTTP ${deviceResponse.status}` } };
    }

    const raw = await deviceResponse.json();
    const connectivity = readDeviceConnectivity(raw);
    return { ...connectivity, ok: true, raw };
  } catch (error) {
    return { connected: false, explicitlyDisconnected: false, ok: false, raw: { error: error instanceof Error ? error.message : 'Unknown status error' } };
  }
};

const clearInstanceQueue = async (instance: ResolvedInstance) => {
  const clearQueueUrl = `https://api.z-api.io/instances/${instance.zapiInstanceId}/token/${instance.zapiToken}/queue`;
  await fetch(clearQueueUrl, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapiClientToken },
  });
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase configuration');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { campaignId, contacts, instanceId: requestedInstanceId, rotationOffset: initialRotationOffset }: SendCampaignRequest = await req.json();
    const rotationOffset = initialRotationOffset || 0;

    if (!campaignId || !contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign ID and contacts are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    console.log(`🚀 Starting campaign ${campaignId} for ${contacts.length} contacts`);

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    let zapiInstanceId = credentials.instanceId;
    let zapiToken = credentials.token;
    let zapiClientToken = credentials.clientToken;

    const isRotateMode = requestedInstanceId === '__rotate_all__';
    let rotatePool: ResolvedInstance[] = [];

    if (isRotateMode) {
      const { data: allActiveInstances } = await supabase
        .from('zapi_instances')
        .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name')
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      rotatePool = (allActiveInstances || []).map((instance) => ({
        zapiInstanceId: instance.zapi_instance_id,
        zapiToken: instance.zapi_token,
        zapiClientToken: instance.zapi_client_token,
        instanceName: instance.instance_name,
      }));
      console.log(`🔄 Rotate mode: ${rotatePool.length} instances loaded`);
    } else if (requestedInstanceId) {
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
      }
    }

    const getInstanceForIndex = (index: number): ResolvedInstance => {
      if (isRotateMode && rotatePool.length > 0) {
        return rotatePool[(index + rotationOffset) % rotatePool.length];
      }
      return {
        zapiInstanceId,
        zapiToken,
        zapiClientToken,
        instanceName: credentials.instanceName,
      };
    };

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`*, template:message_templates(*)`)
      .eq('id', campaignId)
      .eq('user_id', credentials.userId)
      .single();

    if (campaignError || !campaign) throw new Error('Campaign not found');

    if (campaign.status === 'paused' || campaign.status === 'completed' || campaign.status === 'cancelled') {
      return new Response(JSON.stringify({ error: `Campaign is ${campaign.status}`, stopped: true }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (campaign.status === 'draft') {
      await supabase.from('campaigns').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', campaignId).eq('user_id', credentials.userId);
    }

    if (!campaign.template) throw new Error('Campaign template not found');

    const delayMs = (campaign.delay_seconds || 2) * 1000;
    const MAX_EXEC_MS = 120_000;
    const startTime = Date.now();

    const processContactsInBackground = async () => {
      const results = [];

      const { data: campaignCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
      if (campaignCheck?.status === 'paused' || campaignCheck?.status === 'completed' || campaignCheck?.status === 'cancelled') {
        console.log(`🛑 Campaign ${campaignId} has status "${campaignCheck?.status}". Stopping.`);
        return;
      }

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        let campaignSend: CampaignSendRecord | undefined;
        const currentInstance = getInstanceForIndex(i);
        zapiInstanceId = currentInstance.zapiInstanceId;
        zapiToken = currentInstance.zapiToken;
        zapiClientToken = currentInstance.zapiClientToken;

        try {
          // TIME GUARD
          const elapsed = Date.now() - startTime;
          if (elapsed > MAX_EXEC_MS) {
            const { data: timeoutCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
            if (timeoutCheck?.status === 'paused' || timeoutCheck?.status === 'cancelled' || timeoutCheck?.status === 'completed') return;

            const remainingContacts = contacts.slice(i);
            console.log(`⏰ Re-invoking with ${remainingContacts.length} remaining contacts...`);

            const authHeader = req.headers.get('authorization') || '';
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                body: JSON.stringify({ campaignId, contacts: remainingContacts, instanceId: requestedInstanceId, rotationOffset: (rotationOffset + i) % (rotatePool.length || 1) }),
              });
            } catch (reError) { console.error(`❌ Re-invocation failed:`, reError); }
            return;
          }

          // Check device status every 5 contacts
          if (i % 5 === 0) {
            try {
              const shouldPause = async () => {
                if (isRotateMode && rotatePool.length > 0) {
                  const statuses = await Promise.all(rotatePool.map(async (inst) => ({ ...await fetchDeviceStatusSnapshot(inst), instanceName: inst.instanceName })));
                  const allDown = statuses.length > 0 && statuses.every(s => s.ok && s.explicitlyDisconnected && !s.connected);
                  if (!allDown) return false;
                  await sleep(1500);
                  const recheck = await Promise.all(rotatePool.map(async (inst) => ({ ...await fetchDeviceStatusSnapshot(inst) })));
                  return recheck.length > 0 && recheck.every(s => s.ok && s.explicitlyDisconnected && !s.connected);
                }

                const first = await fetchDeviceStatusSnapshot(currentInstance);
                if (!first.ok || !first.explicitlyDisconnected || first.connected) return false;
                await sleep(1500);
                const second = await fetchDeviceStatusSnapshot(currentInstance);
                return second.ok && second.explicitlyDisconnected && !second.connected;
              };

              if (await shouldPause()) {
                console.log(`❌ DISPOSITIVO DESCONECTADO! PAUSANDO campanha ${campaignId}`);
                await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
                try {
                  if (isRotateMode) await Promise.all(rotatePool.map(inst => clearInstanceQueue(inst)));
                  else await clearInstanceQueue(currentInstance);
                } catch {}
                return;
              }
            } catch {}
          }

          // Check if paused
          const { data: currentCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
          if (currentCampaign?.status === 'paused' || currentCampaign?.status === 'cancelled' || currentCampaign?.status === 'completed') {
            console.log(`🛑 Campaign ${campaignId} is ${currentCampaign?.status}. Stopping.`);
            return;
          }

          // Check duplicates
          const { data: existingSends } = await supabase.from('campaign_sends').select('id, status').eq('campaign_id', campaignId).eq('phone', contact.phone);
          const successfulForPhone = existingSends?.filter(s => s.status === 'sent' || s.status === 'delivered').length || 0;
          const phoneOccurrencesBefore = contacts.slice(0, i).filter(c => c.phone === contact.phone).length;

          if (successfulForPhone > phoneOccurrencesBefore) {
            results.push({ phone: contact.phone, success: true, messageId: 'already-sent' });
            continue;
          }

          const failedOrPending = existingSends?.find(s => s.status === 'failed' || s.status === 'pending');
          if (failedOrPending) {
            await supabase.from('campaign_sends').delete().eq('id', failedOrPending.id);
          }

          console.log(`📤 [${i + 1}/${contacts.length}] Processing contact: ${contact.phone}`);

          let messageContent = campaign.template.content;
          messageContent = messageContent.replace(/{nome}/g, contact.name || 'Cliente');
          messageContent = messageContent.replace(/{empresa}/g, 'Nossa Empresa');
          messageContent = messageContent.replace(/{data}/g, new Date().toLocaleDateString('pt-BR'));
          messageContent = messageContent.replace(/{hora}/g, new Date().toLocaleTimeString('pt-BR'));

          if (contact.variables) {
            Object.entries(contact.variables).forEach(([key, value]) => {
              messageContent = messageContent.replace(new RegExp(`{${key}}`, 'g'), value);
            });
          }

          campaignSend = {
            campaign_id: campaignId,
            phone: contact.phone,
            contact_name: contact.name,
            message_content: messageContent,
            status: 'pending',
            user_id: credentials.userId,
            instance_name: currentInstance.instanceName,
          };

          let fullMessage = '';
          if (campaign.template.header) fullMessage += campaign.template.header + '\n\n';
          fullMessage += messageContent;
          if (campaign.template.footer) fullMessage += '\n\n' + campaign.template.footer;

          const templateType = campaign.template.type || 'texto';
          const hasButtons = campaign.template.buttons && Array.isArray(campaign.template.buttons) && campaign.template.buttons.length > 0;
          const hasMedia = campaign.template.media_url && campaign.template.media_url.trim() !== '';
          const hasCarouselCards = campaign.template.carousel_cards && Array.isArray(campaign.template.carousel_cards) && campaign.template.carousel_cards.length > 0;

          let zapiUrl: string = '';
          let requestBody: any = {};

          if (templateType === 'carrossel' && hasCarouselCards) {
            const carouselCards = campaign.template.carousel_cards.map((card: any) => {
              const cardData: any = { title: card.title || '', description: card.description || '' };
              if (card.image && card.image.trim() !== '') cardData.image = card.image;
              if (card.buttons && Array.isArray(card.buttons) && card.buttons.length > 0) {
                cardData.buttonActions = card.buttons.map((btn: any) => {
                  const btnType = (btn.type || 'url').toUpperCase();
                  const buttonData: any = { label: btn.text || btn.label };
                  if (btnType === 'CALL') { buttonData.type = 'CALL'; buttonData.phone = btn.phone || btn.value; }
                  else if (btnType === 'REPLY' || btnType === 'OPTION') { buttonData.type = 'REPLY'; }
                  else { buttonData.type = 'URL'; let url = btn.url || btn.value || 'https://z-api.io'; if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url; buttonData.url = url; }
                  if (btn.id) buttonData.id = btn.id;
                  return buttonData;
                });
              }
              return cardData;
            });

            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-carousel`;
            requestBody = { phone: contact.phone, cards: carouselCards };

            const carouselResponse = await fetch(zapiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': zapiClientToken }, body: JSON.stringify(requestBody) });
            const carouselText = await carouselResponse.text();
            if (!carouselResponse.ok) throw new Error(`Erro ao enviar carrossel: ${carouselText}`);

            campaignSend.status = 'sent';
            campaignSend.sent_at = new Date().toISOString();
            results.push({ phone: contact.phone, success: true, messageId: 'carousel-sent' });

            if (campaignSend) {
              await supabase.from('campaign_sends').insert([campaignSend]);
            }
            if (i < contacts.length - 1) await sleep(delayMs);
            continue;

          } else if (templateType === 'video_botoes' && hasMedia && hasButtons) {
            const videoUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-video`;
            const videoResponse = await fetch(videoUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': zapiClientToken }, body: JSON.stringify({ phone: contact.phone, video: campaign.template.media_url }) });
            if (!videoResponse.ok) throw new Error(`Erro ao enviar vídeo: ${await videoResponse.text()}`);

            await sleep(Math.max(delayMs / 2, 1000));

            const formattedButtons = campaign.template.buttons.map((btn: any) => {
              const btnType = (btn.type || 'url').toUpperCase();
              const buttonData: any = { label: btn.text || btn.label };
              if (btnType === 'CALL') { buttonData.type = 'CALL'; buttonData.phone = btn.phone || btn.value; }
              else if (btnType === 'REPLY' || btnType === 'OPTION') { buttonData.type = 'REPLY'; }
              else if (btnType === 'COPY') { buttonData.type = 'URL'; buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText || btn.value || '')}`; }
              else { buttonData.type = 'URL'; buttonData.url = btn.url || btn.value || 'https://z-api.io'; }
              if (btn.id) buttonData.id = btn.id;
              return buttonData;
            }).filter((btn: any) => btn !== null);

            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-button-actions`;
            requestBody = { phone: contact.phone, message: fullMessage, buttonActions: formattedButtons };

          } else if (templateType === 'imagem_botoes' && hasMedia && hasButtons) {
            const formattedButtons = campaign.template.buttons.map((btn: any) => {
              const btnType = (btn.type || 'url').toUpperCase();
              const buttonData: any = { label: btn.text || btn.label };
              if (btnType === 'CALL') { buttonData.type = 'CALL'; buttonData.phone = btn.phone || btn.value; }
              else if (btnType === 'REPLY' || btnType === 'OPTION') { buttonData.type = 'REPLY'; }
              else if (btnType === 'COPY') { buttonData.type = 'URL'; buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText || btn.value || '')}`; }
              else { buttonData.type = 'URL'; buttonData.url = btn.url || btn.value || 'https://z-api.io'; }
              if (btn.id) buttonData.id = btn.id;
              return buttonData;
            });

            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-button-actions`;
            requestBody = { phone: contact.phone, message: fullMessage, image: campaign.template.media_url, buttonActions: formattedButtons };

          } else if (templateType === 'imagem') {
            if (!hasMedia) throw new Error('Template tipo "imagem" requer uma imagem');
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-image`;
            requestBody = { phone: contact.phone, image: campaign.template.media_url, caption: fullMessage };

          } else if (templateType === 'video') {
            if (!hasMedia) throw new Error('Template tipo "video" requer um vídeo');
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-video`;
            requestBody = { phone: contact.phone, video: campaign.template.media_url, caption: fullMessage };

          } else if (templateType === 'audio') {
            if (!hasMedia) throw new Error('Template tipo "audio" requer um áudio');
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-audio`;
            requestBody = { phone: contact.phone, audio: campaign.template.media_url, waveform: true };

          } else if (templateType === 'documento' || templateType === 'arquivo') {
            if (!hasMedia) throw new Error(`Template tipo "${templateType}" requer um arquivo`);
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-document`;
            requestBody = { phone: contact.phone, document: campaign.template.media_url, fileName: campaign.template.file_name || 'documento', extension: campaign.template.file_type?.split('/').pop() || 'pdf', caption: fullMessage };

          } else if (hasButtons) {
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-button-actions`;
            const formattedButtons = campaign.template.buttons.map((btn: any) => {
              const btnType = (btn.type || 'url').toUpperCase();
              const buttonData: any = { label: btn.text || btn.label };
              if (btnType === 'CALL') { buttonData.type = 'CALL'; buttonData.phone = btn.phone || btn.value; }
              else if (btnType === 'REPLY' || btnType === 'OPTION') { buttonData.type = 'REPLY'; }
              else if (btnType === 'COPY') { buttonData.type = 'URL'; buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText || btn.value || '')}`; }
              else { buttonData.type = 'URL'; buttonData.url = btn.url || btn.value || 'https://z-api.io'; }
              if (btn.id) buttonData.id = btn.id;
              return buttonData;
            });
            requestBody = { phone: contact.phone, message: fullMessage, buttonActions: formattedButtons };

          } else {
            zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
            requestBody = { phone: contact.phone, message: fullMessage };
          }

          if (zapiUrl) {
            const zapiResponse = await fetch(zapiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Client-Token': zapiClientToken },
              body: JSON.stringify(requestBody),
            });

            let zapiResult: any = {};
            try {
              const responseText = await zapiResponse.text();
              if (responseText && responseText.trim()) zapiResult = JSON.parse(responseText);
            } catch {}

            if (zapiResponse.ok) {
              campaignSend.status = 'sent';
              campaignSend.sent_at = new Date().toISOString();
              results.push({ phone: contact.phone, success: true, messageId: zapiResult.messageId });
            } else {
              campaignSend.status = 'failed';
              campaignSend.error_message = zapiResult.error || `HTTP ${zapiResponse.status}`;
              results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            }
          }

        } catch (error) {
          if (!campaignSend) {
            campaignSend = {
              campaign_id: campaignId, phone: contact.phone, contact_name: contact.name,
              message_content: 'Error processing message', status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              user_id: credentials.userId, instance_name: credentials.instanceName,
            };
          } else {
            campaignSend.status = 'failed';
            campaignSend.error_message = error instanceof Error ? error.message : 'Unknown error';
          }
          results.push({ phone: contact.phone, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }

        if (campaignSend) {
          await supabase.from('campaign_sends').insert([campaignSend]);
        }

        if (i < contacts.length - 1) {
          await sleep(delayMs);

          const { data: afterDelayCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
          if (afterDelayCampaign?.status === 'paused' || afterDelayCampaign?.status === 'cancelled' || afterDelayCampaign?.status === 'completed') {
            console.log(`🛑 Campaign stopped after delay.`);
            return;
          }
        }
      }

      const { data: finalCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
      if (finalCampaign?.status === 'active' || finalCampaign?.status === 'draft') {
        await supabase.from('campaigns').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', campaignId);
        try {
          if (isRotateMode && rotatePool.length > 0) await Promise.all(rotatePool.map(inst => clearInstanceQueue(inst)));
          else await clearInstanceQueue(getInstanceForIndex(0));
        } catch {}
      }
    };

    try {
      await processContactsInBackground();
    } catch (bgError) {
      console.error(`💥 Processing crashed for campaign ${campaignId}:`, bgError);
      try {
        const { data: crashCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
        if (crashCheck?.status === 'active' || crashCheck?.status === 'draft') {
          await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
        }
      } catch {}

      return new Response(JSON.stringify({ error: 'Processing failed', message: bgError instanceof Error ? bgError.message : 'Unknown error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ success: true, message: 'Campaign processada com sucesso.', campaignId, totalContacts: contacts.length }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});