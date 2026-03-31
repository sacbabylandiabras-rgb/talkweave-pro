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
  _isContinuation?: boolean;
  _userId?: string; // Used by service-role re-invocations to bypass JWT auth
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

const getZapiAckId = (payload: any) => payload?.messageId || payload?.zapiMessageId || payload?.zaapId || payload?.id || payload?.key?.id || payload?.message?.id || null;
const getZapiExplicitError = (payload: any) => payload?.error || payload?.erro || (payload?.success === false ? payload?.message : null) || null;
const isZapiConfirmed = (payload: any) => {
  const ackId = getZapiAckId(payload);
  const status = String(payload?.status || payload?.message?.status || '').toUpperCase();
  const result = String(payload?.result || '').toUpperCase();
  return Boolean(ackId || ['PENDING', 'QUEUED', 'QUEUE', 'SENT', 'SUCCESS', 'OK'].includes(status) || ['PENDING', 'QUEUED', 'SUCCESS', 'OK'].includes(result));
};

const BATCH_SIZE = 50; // Process 50 contacts per invocation

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
    const body: SendCampaignRequest = await req.json();
    const { campaignId, contacts, instanceId: requestedInstanceId, rotationOffset: initialRotationOffset, _isContinuation, _userId } = body;
    const rotationOffset = initialRotationOffset || 0;
    const requestedContacts = Array.isArray(contacts) ? contacts : [];

    if (!campaignId || requestedContacts.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign ID and contacts are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    console.log(`🚀 Campaign ${campaignId}: ${requestedContacts.length} contacts to process (continuation: ${!!_isContinuation}, offset: ${rotationOffset})`);

    // For continuations with _userId, resolve credentials directly via service role (no JWT needed)
    let credentials: { instanceId: string; token: string; clientToken: string; userId: string; instanceName: string };
    if (_isContinuation && _userId) {
      console.log(`🔑 Continuation mode: resolving credentials for user ${_userId} via service role`);
      const { data: instance } = await supabase
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name')
        .eq('user_id', _userId)
        .eq('is_default', true)
        .maybeSingle();

      const inst = instance || (await supabase
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name')
        .eq('user_id', _userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()).data;

      if (!inst?.zapi_instance_id || !inst?.zapi_token || !inst?.zapi_client_token) {
        throw new Error('Z-API credentials not found for continuation');
      }
      credentials = {
        instanceId: inst.zapi_instance_id,
        token: inst.zapi_token,
        clientToken: inst.zapi_client_token,
        userId: _userId,
        instanceName: inst.instance_name || 'Instância',
      };
    } else {
      credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    }

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

    const queueContinuation = async (
      contactsToContinue: SendCampaignRequest['contacts'],
      processedInThisRun: number,
    ) => {
      if (!contactsToContinue.length) return true;

      const newRotationOffset = (rotationOffset + processedInThisRun) % (rotatePool.length || 1);

      try {
        const reInvokeResponse = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            campaignId,
            contacts: contactsToContinue,
            instanceId: requestedInstanceId,
            rotationOffset: newRotationOffset,
            _isContinuation: true,
            _userId: credentials.userId,
          }),
        });

        if (!reInvokeResponse.ok) {
          console.error(`❌ Re-invocation HTTP error: ${reInvokeResponse.status} ${await reInvokeResponse.text()}`);
          return false;
        }

        return true;
      } catch (reError) {
        console.error(`❌ Re-invocation failed:`, reError);
        return false;
      }
    };

    // Check campaign status
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`*, template:message_templates(*)`)
      .eq('id', campaignId)
      .eq('user_id', credentials.userId)
      .single();

    if (campaignError || !campaign) {
      console.error(`❌ Campaign not found: ${campaignError?.message}`);
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'paused' || campaign.status === 'completed' || campaign.status === 'cancelled') {
      console.log(`🛑 Campaign ${campaignId} is ${campaign.status}. Not processing.`);
      return new Response(JSON.stringify({ error: `Campaign is ${campaign.status}`, stopped: true }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (campaign.status === 'draft') {
      await supabase.from('campaigns').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', campaignId).eq('user_id', credentials.userId);
    }

    if (!campaign.template) throw new Error('Campaign template not found');

    const campaignTargetContacts = Array.isArray(campaign.target_audience?.contacts)
      ? campaign.target_audience.contacts.filter((contact: any) => Boolean(contact?.phone))
      : [];

    const { count: existingSendsCount } = await supabase
      .from('campaign_sends')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    const shouldUseCampaignAudience =
      !_isContinuation &&
      (existingSendsCount ?? 0) === 0 &&
      campaignTargetContacts.length > 0 &&
      requestedContacts.length !== campaignTargetContacts.length;

    const executionContacts = shouldUseCampaignAudience ? campaignTargetContacts : requestedContacts;

    if (shouldUseCampaignAudience) {
      console.log(
        `⚠️ Campaign ${campaignId}: request had ${requestedContacts.length} contacts, but campaign audience has ${campaignTargetContacts.length}. Using campaign audience as source of truth.`,
      );
    }

    const delayMs = (campaign.delay_seconds || 2) * 1000;

    // Split contacts into current batch and remaining
    const currentBatch = executionContacts.slice(0, BATCH_SIZE);
    const remainingContacts = executionContacts.slice(BATCH_SIZE);

    console.log(`📦 Processing batch of ${currentBatch.length} contacts. Remaining: ${remainingContacts.length}`);

    // Check device connectivity before processing batch
    const firstInstance = getInstanceForIndex(0);
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

        const first = await fetchDeviceStatusSnapshot(firstInstance);
        if (!first.ok || !first.explicitlyDisconnected || first.connected) return false;
        await sleep(1500);
        const second = await fetchDeviceStatusSnapshot(firstInstance);
        return second.ok && second.explicitlyDisconnected && !second.connected;
      };

      if (await shouldPause()) {
        console.log(`❌ DISPOSITIVO DESCONECTADO! PAUSANDO campanha ${campaignId}`);
        await supabase.from('campaigns').update({ status: 'paused', updated_at: new Date().toISOString() }).eq('id', campaignId);
        try {
          if (isRotateMode) await Promise.all(rotatePool.map(inst => clearInstanceQueue(inst)));
          else await clearInstanceQueue(firstInstance);
        } catch {}
        return new Response(JSON.stringify({ error: 'Device disconnected, campaign paused', stopped: true }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    } catch (e) {
      console.error('Device check error:', e);
    }

    // Process current batch
    const results = [];
    for (let i = 0; i < currentBatch.length; i++) {
      const contact = currentBatch[i];
      const currentInstance = getInstanceForIndex(i);
      let campaignSend: CampaignSendRecord | undefined;

      try {
        // Check if paused/cancelled before EACH contact to stop immediately
        const { data: statusCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
        if (statusCheck?.status === 'paused' || statusCheck?.status === 'cancelled' || statusCheck?.status === 'completed') {
          console.log(`🛑 Campaign ${campaignId} is ${statusCheck?.status} before contact ${i + 1}/${currentBatch.length}. Stopping immediately.`);
          try {
            if (isRotateMode && rotatePool.length > 0) await Promise.all(rotatePool.map(inst => clearInstanceQueue(inst)));
            else await clearInstanceQueue(currentInstance);
          } catch {}
          return new Response(JSON.stringify({ success: true, stopped: true, processed: i, message: `Stopped: campaign ${statusCheck?.status}` }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        // Check duplicates
        const { data: existingSends } = await supabase.from('campaign_sends').select('id, status').eq('campaign_id', campaignId).eq('phone', contact.phone);
        const successfulForPhone = existingSends?.filter(s => s.status === 'sent' || s.status === 'delivered').length || 0;
        const phoneOccurrencesBefore = currentBatch.slice(0, i).filter(c => c.phone === contact.phone).length;

        if (successfulForPhone > phoneOccurrencesBefore) {
          console.log(`⏭️ Skipping ${contact.phone} - already sent`);
          results.push({ phone: contact.phone, success: true, messageId: 'already-sent' });
          continue;
        }

        const failedOrPending = existingSends?.find(s => s.status === 'failed' || s.status === 'pending');
        if (failedOrPending) {
          await supabase.from('campaign_sends').delete().eq('id', failedOrPending.id);
        }

        console.log(`📤 [${i + 1}/${currentBatch.length}] Sending to: ${contact.phone} via ${currentInstance.instanceName}`);

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

        const instId = currentInstance.zapiInstanceId;
        const instToken = currentInstance.zapiToken;
        const instClientToken = currentInstance.zapiClientToken;

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

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-carousel`;
          requestBody = { phone: contact.phone, cards: carouselCards };

          const carouselResponse = await fetch(zapiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, body: JSON.stringify(requestBody) });
          const carouselText = await carouselResponse.text();
          if (!carouselResponse.ok) throw new Error(`Erro ao enviar carrossel: ${carouselText}`);

          campaignSend.status = 'sent';
          campaignSend.sent_at = new Date().toISOString();
          results.push({ phone: contact.phone, success: true, messageId: 'carousel-sent' });

          await supabase.from('campaign_sends').insert([campaignSend]);
          if (i < currentBatch.length - 1) await sleep(delayMs);
          continue;

        } else if (templateType === 'video_botoes' && hasMedia && hasButtons) {
          const videoUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-video`;
          const videoResponse = await fetch(videoUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken }, body: JSON.stringify({ phone: contact.phone, video: campaign.template.media_url }) });
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
          });

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
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

          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
          requestBody = { phone: contact.phone, message: fullMessage, image: campaign.template.media_url, buttonActions: formattedButtons };

        } else if (templateType === 'imagem') {
          if (!hasMedia) throw new Error('Template tipo "imagem" requer uma imagem');
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-image`;
          requestBody = { phone: contact.phone, image: campaign.template.media_url, caption: fullMessage };

        } else if (templateType === 'video') {
          if (!hasMedia) throw new Error('Template tipo "video" requer um vídeo');
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-video`;
          requestBody = { phone: contact.phone, video: campaign.template.media_url, caption: fullMessage };

        } else if (templateType === 'audio') {
          if (!hasMedia) throw new Error('Template tipo "audio" requer um áudio');
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-audio`;
          requestBody = { phone: contact.phone, audio: campaign.template.media_url, waveform: true };

        } else if (templateType === 'documento' || templateType === 'arquivo') {
          if (!hasMedia) throw new Error(`Template tipo "${templateType}" requer um arquivo`);
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-document`;
          requestBody = { phone: contact.phone, document: campaign.template.media_url, fileName: campaign.template.file_name || 'documento', extension: campaign.template.file_type?.split('/').pop() || 'pdf', caption: fullMessage };

        } else if (hasButtons) {
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-button-actions`;
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
          zapiUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}/send-text`;
          requestBody = { phone: contact.phone, message: fullMessage };
        }

        if (zapiUrl) {
          const zapiResponse = await fetch(zapiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': instClientToken },
            body: JSON.stringify(requestBody),
          });

          let zapiResult: any = {};
          try {
            const responseText = await zapiResponse.text();
            if (responseText && responseText.trim()) zapiResult = JSON.parse(responseText);
          } catch {}

          const explicitError = getZapiExplicitError(zapiResult);
          const confirmed = isZapiConfirmed(zapiResult);
          console.log(`📬 Campaign Z-API response for ${contact.phone} via ${currentInstance.instanceName}: status=${zapiResponse.status}, confirmed=${confirmed}, ack=${getZapiAckId(zapiResult) || 'none'}, body=${JSON.stringify(zapiResult).substring(0, 300)}`);

          if (zapiResponse.ok && !explicitError && confirmed) {
            campaignSend.status = 'sent';
            campaignSend.sent_at = new Date().toISOString();
            results.push({ phone: contact.phone, success: true, messageId: getZapiAckId(zapiResult) });
            console.log(`✅ Sent to ${contact.phone}`);
          } else {
            campaignSend.status = 'failed';
            campaignSend.error_message = explicitError || (!confirmed ? 'Z-API não confirmou o envio' : `HTTP ${zapiResponse.status}`);
            results.push({ phone: contact.phone, success: false, error: campaignSend.error_message });
            console.log(`❌ Failed ${contact.phone}: ${campaignSend.error_message}`);
          }
        }

      } catch (error) {
        console.error(`❌ Error processing ${contact.phone}:`, error);
        if (!campaignSend) {
          campaignSend = {
            campaign_id: campaignId, phone: contact.phone, contact_name: contact.name,
            message_content: 'Error processing message', status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            user_id: credentials.userId, instance_name: currentInstance.instanceName,
          };
        } else {
          campaignSend.status = 'failed';
          campaignSend.error_message = error instanceof Error ? error.message : 'Unknown error';
        }
        results.push({ phone: contact.phone, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }

      // Insert campaign_send record immediately after each contact
      if (campaignSend) {
        const { error: insertError } = await supabase.from('campaign_sends').insert([campaignSend]);
        if (insertError) {
          console.error(`❌ Failed to insert campaign_send for ${contact.phone}:`, insertError.message);
        }
      }

      // Delay between contacts (except last)
      if (i < currentBatch.length - 1) {
        await sleep(delayMs);

        // Check pause after delay
        const { data: afterDelayCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
        if (afterDelayCampaign?.status === 'paused' || afterDelayCampaign?.status === 'cancelled' || afterDelayCampaign?.status === 'completed') {
          console.log(`🛑 Campaign stopped after delay at contact ${i + 1}/${currentBatch.length}.`);
          return new Response(JSON.stringify({ success: true, stopped: true, processed: i + 1, message: `Stopped: campaign ${afterDelayCampaign?.status}` }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }
    }

    // If there are remaining contacts, schedule continuation
    if (remainingContacts.length > 0) {
      // Re-check campaign status before continuing
      const { data: continueCheck } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
      if (continueCheck?.status === 'paused' || continueCheck?.status === 'cancelled' || continueCheck?.status === 'completed') {
        console.log(`🛑 Campaign ${campaignId} is ${continueCheck?.status}. Not continuing with remaining ${remainingContacts.length} contacts.`);
        return new Response(JSON.stringify({
          success: true,
          stopped: true,
          processed: currentBatch.length,
          remaining: remainingContacts.length,
          message: `Stopped: campaign ${continueCheck?.status}`,
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      console.log(`🔄 Re-invoking for remaining ${remainingContacts.length} contacts...`);

      await queueContinuation(remainingContacts, currentBatch.length);
    } else {
      const totalTargetContacts = campaignTargetContacts.length;
      const { count: processedCount } = await supabase
        .from('campaign_sends')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      const totalProcessed = processedCount ?? 0;
      const missingContacts = totalTargetContacts > totalProcessed
        ? campaignTargetContacts.slice(totalProcessed)
        : [];

      if (missingContacts.length > 0) {
        console.log(`⚠️ Campaign ${campaignId}: blocking completion because only ${totalProcessed}/${totalTargetContacts} contacts were processed. Re-invoking ${missingContacts.length} missing contacts.`);

        await queueContinuation(missingContacts, currentBatch.length);

        return new Response(JSON.stringify({
          success: true,
          message: 'Missing contacts queued before completion',
          campaignId,
          processed: currentBatch.length,
          remaining: missingContacts.length,
          results,
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // All contacts processed - mark campaign as completed
      const { data: finalCampaign } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
      if (finalCampaign?.status === 'active' || finalCampaign?.status === 'draft') {
        await supabase.from('campaigns').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', campaignId);
        console.log(`✅ Campaign ${campaignId} completed!`);
        try {
          if (isRotateMode && rotatePool.length > 0) await Promise.all(rotatePool.map(inst => clearInstanceQueue(inst)));
          else await clearInstanceQueue(getInstanceForIndex(0));
        } catch {}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Batch processed',
      campaignId,
      processed: currentBatch.length,
      remaining: remainingContacts.length,
      results,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (error) {
    console.error(`💥 send-campaign error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
