import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WelcomeMessageRequest {
  phone: string;
  contactName?: string;
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

    const { phone, contactName }: WelcomeMessageRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Processing welcome message for phone:', phone);

    // Verificar se a mensagem de boas-vindas está ativa
    const { data: config, error: configError } = await supabase
      .from('welcome_message_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !config || !config.active) {
      console.log('Welcome message is not active or config not found');
      return new Response(
        JSON.stringify({ message: 'Welcome message not active' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verificar se já enviamos boas-vindas para este número
    const { data: alreadySent } = await supabase
      .from('welcome_message_sent')
      .select('phone')
      .eq('phone', phone)
      .maybeSingle();

    if (alreadySent) {
      console.log('Welcome message already sent to this phone');
      return new Response(
        JSON.stringify({ message: 'Welcome message already sent' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const responseType: string = (config as any).response_type || 'text';

    // Resolver conteúdo baseado no tipo configurado
    let message: string = config.message;

    if (responseType === 'template' && (config as any).template_id) {
      const { data: tpl } = await supabase
        .from('message_templates')
        .select('content')
        .eq('id', (config as any).template_id)
        .maybeSingle();
      if (tpl?.content) message = tpl.content as string;
    }

    if (responseType === 'flow' && (config as any).flow_id) {
      // Dispara o fluxo via webhook-zapi engine
      const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
      const instanceId = credentials.instanceId;

      const { error: invokeError } = await supabase.functions.invoke('webhook-zapi', {
        body: {
          phone,
          message: { text: contactName || 'welcome', fromMe: false },
          fromMe: false,
          flowId: (config as any).flow_id,
          instanceId,
          timestamp: Math.floor(Date.now() / 1000),
          __manual_flow_trigger__: true,
          __respect_selected_instance__: true,
        },
      });

      if (invokeError) {
        console.error('Failed to trigger welcome flow:', invokeError);
        throw new Error('Falha ao disparar fluxo de boas-vindas');
      }

      await supabase.from('welcome_message_sent').insert({ phone });
      await supabase.from('message_logs').insert({
        phone,
        message_received: 'NEW_CONTACT',
        keyword_matched: 'WELCOME_MESSAGE_FLOW',
        response_sent: `flow:${(config as any).flow_id}`,
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Welcome flow triggered' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Processar variáveis na mensagem
    if (contactName) {
      message = message.replace(/{nome}/g, contactName);
    }
    message = message.replace(/{empresa}/g, 'Nossa Empresa');
    message = message.replace(/{data}/g, new Date().toLocaleDateString('pt-BR'));
    message = message.replace(/{hora}/g, new Date().toLocaleTimeString('pt-BR'));

    // Get user's Z-API credentials from their profile
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const zapiInstanceId = credentials.instanceId;
    const zapiToken = credentials.token;
    const zapiClientToken = credentials.clientToken;

    console.log(`✅ Using Z-API credentials for user ${credentials.userId}`);

    // Enviar mensagem via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    console.log('Sending to Z-API URL:', zapiUrl);
    
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken,
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    console.log('Z-API Response Status:', zapiResponse.status);

    if (!zapiResponse.ok) {
      const errorText = await zapiResponse.text();
      console.error('Z-API error response:', errorText);
      
      let errorMessage = `Z-API request failed: ${zapiResponse.status}`;
      if (zapiResponse.status === 404) {
        errorMessage = 'Instância Z-API não encontrada. Verifique se a instância está ativa em developer.z-api.io';
      } else if (zapiResponse.status === 401) {
        errorMessage = 'Token Z-API inválido. Verifique suas credenciais.';
      }
      
      throw new Error(errorMessage);
    }

    const zapiResult = await zapiResponse.json();
    console.log('Welcome message sent successfully:', zapiResult);

    // Marcar como enviado
    await supabase
      .from('welcome_message_sent')
      .insert({ phone });

    // Log da mensagem
    await supabase
      .from('message_logs')
      .insert({
        phone,
        message_received: 'NEW_CONTACT',
        keyword_matched: 'WELCOME_MESSAGE',
        response_sent: message,
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Welcome message sent successfully',
        zapiResponse: zapiResult 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error in send-welcome-message function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});