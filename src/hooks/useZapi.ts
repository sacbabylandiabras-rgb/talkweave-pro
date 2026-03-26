import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { ZapiInstance } from '@/hooks/useZapiInstances';

// Instância override - permite que componentes passem uma instância específica
let _instanceOverride: ZapiInstance | null = null;

// Modo revezamento - cicla entre todas as instâncias
let _rotateInstances: ZapiInstance[] = [];
let _rotateIndex = 0;

export const setZapiInstanceOverride = (instance: ZapiInstance | null) => {
  _instanceOverride = instance;
  _rotateInstances = [];
  _rotateIndex = 0;
};

export const setZapiRotateMode = (instances: ZapiInstance[]) => {
  _rotateInstances = instances;
  _rotateIndex = 0;
  _instanceOverride = null;
};

export const getSelectedInstanceId = (): string | undefined => {
  return _instanceOverride?.id || undefined;
};

export const getSelectedCampaignInstanceId = (): string | undefined => {
  if (_rotateInstances.length > 0) {
    return '__rotate_all__';
  }

  return _instanceOverride?.id || undefined;
};


const getZAPIConfig = async () => {
  // Se há modo revezamento ativo, ciclar entre instâncias
  if (_rotateInstances.length > 0) {
    const inst = _rotateInstances[_rotateIndex % _rotateInstances.length];
    _rotateIndex++;
    console.log(`🔄 Usando instância em revezamento: ${inst.instance_name} (${inst.zapi_instance_id})`);
    return {
      instanceId: inst.zapi_instance_id,
      token: inst.zapi_token,
      clientToken: inst.zapi_client_token,
      apiProvider: inst.api_provider || 'zapi',
      evolutionApiUrl: inst.evolution_api_url || null,
      evolutionApiKey: inst.evolution_api_key || null,
    };
  }

  // Se há override de instância, usar ela
  if (_instanceOverride) {
    console.log(`📌 Usando instância override: ${_instanceOverride.instance_name} (${_instanceOverride.zapi_instance_id})`);
    return {
      instanceId: _instanceOverride.zapi_instance_id,
      token: _instanceOverride.zapi_token,
      clientToken: _instanceOverride.zapi_client_token,
      apiProvider: _instanceOverride.api_provider || 'zapi',
      evolutionApiUrl: _instanceOverride.evolution_api_url || null,
      evolutionApiKey: _instanceOverride.evolution_api_key || null,
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Usuário não autenticado. Faça login para continuar.');
  }

  // Buscar instância padrão da nova tabela
  const { data: instances, error } = await (supabase as any)
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .limit(1);

  if (error) {
    throw new Error('Erro ao buscar credenciais: ' + error.message);
  }

  const instance = instances?.[0];

  if (!instance?.zapi_instance_id || !instance?.zapi_token || !instance?.zapi_client_token) {
    // Fallback: tentar profiles (compatibilidade)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('zapi_instance_id, zapi_token, zapi_client_token')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.zapi_instance_id || !profile?.zapi_token || !profile?.zapi_client_token) {
      throw new Error('Nenhuma instância Z-API configurada. Peça ao administrador para configurar.');
    }

    return {
      instanceId: profile.zapi_instance_id,
      token: profile.zapi_token,
      clientToken: profile.zapi_client_token,
      apiProvider: 'zapi',
      evolutionApiUrl: null,
      evolutionApiKey: null,
    };
  }

  return {
    instanceId: instance.zapi_instance_id,
    token: instance.zapi_token,
    clientToken: instance.zapi_client_token,
    apiProvider: instance.api_provider || 'zapi',
    evolutionApiUrl: instance.evolution_api_url || null,
    evolutionApiKey: instance.evolution_api_key || null,
  };
};

export const useZapi = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const ensureZapiSendConfirmed = (data: any, fallbackMessage: string) => {
    const hasAck = Boolean(data?.messageId || data?.zaapId || data?.id || data?.key?.id || data?.status === 'PENDING');
    const explicitError = data?.error || (data?.success === false ? data?.message : null);

    if (explicitError) {
      throw new Error(String(explicitError));
    }

    if (!hasAck) {
      const safeDetails = typeof data === 'object' ? JSON.stringify(data) : String(data || 'sem detalhes');
      throw new Error(`${fallbackMessage} O provedor não confirmou entrega. Detalhes: ${safeDetails}`);
    }
  };

  const invokeSendMessageEdge = async (
    payload: { phone: string; message?: string; mediaUrl?: string; mediaType?: string; instanceId?: string },
    fallbackMessage: string,
  ) => {
    // If no instanceId in payload, try to get from current config
    let body = { ...payload };
    if (!body.instanceId) {
      try {
        const config = await getZAPIConfig();
        body.instanceId = config.instanceId;
      } catch (e) {
        // Let edge function use default
      }
    }

    const { data, error } = await supabase.functions.invoke('send-message', {
      body,
    });

    if (error) {
      throw new Error(error.message || fallbackMessage);
    }

    if (data?.error) {
      throw new Error(data?.message || data?.error || fallbackMessage);
    }

    return data?.data ?? data;
  };

  const buildButtonFallbackMessage = (
    message: string,
    buttons: Array<{id: string, type: 'CALL' | 'URL' | 'REPLY' | 'OPTION' | 'COPY', label: string, phone?: string, url?: string, copyText?: string}>,
    title?: string,
    footer?: string
  ) => {
    const lines = buttons.map((btn, index) => {
      let extra = '';
      if (btn.type === 'CALL' && btn.phone) extra = `: ${btn.phone}`;
      if (btn.type === 'URL' && btn.url) extra = `: ${btn.url}`;
      if (btn.type === 'COPY' && btn.copyText) extra = `: ${btn.copyText}`;
      return `${index + 1}. ${btn.label}${extra}`;
    });

    return [title, message, lines.length ? `\nOpções:\n${lines.join('\n')}` : '', footer].filter(Boolean).join('\n\n');
  };

  const buildOptionListFallbackMessage = (
    message: string,
    optionList: {
      title: string,
      buttonLabel: string,
      options: Array<{id: string, title: string, description: string}>
    }
  ) => {
    const lines = optionList.options.map((opt, index) => `${index + 1}. ${opt.title}${opt.description ? ` — ${opt.description}` : ''}`);
    return [optionList.title, message, lines.length ? `\n${lines.join('\n')}` : ''].filter(Boolean).join('\n\n');
  };

  const sendMessage = async (phone: string, message: string) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({ phone, message }, 'Erro ao enviar mensagem');

      toast({
        title: "Mensagem enviada!",
        description: "A mensagem foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendButtonList = async (phone: string, message: string, buttons: Array<{id: string, label: string}>) => {
    setLoading(true);
    
    try {
      const config = await getZAPIConfig();

      if (config.apiProvider === 'evolution') {
        const fallbackText = [message, '', 'Botões:', ...buttons.map((btn, index) => `${index + 1}. ${btn.label}`)].join('\n');
        const data = await invokeSendMessageEdge({ phone, message: fallbackText }, 'Erro ao enviar mensagem com botões');

        toast({
          title: "Mensagem enviada!",
          description: "Na Evolution API, os botões foram enviados em formato de texto compatível.",
        });

        return data;
      }
      
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-button-list`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify({
          phone: phone,
          message: message,
          buttonList: {
            buttons: buttons
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem com botões');
      }

      ensureZapiSendConfirmed(data, '❌ Falha no envio com botões.');

      toast({
        title: "Mensagem com botões enviada!",
        description: "A mensagem foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagem com botões:', error);
      toast({
        title: "Erro ao enviar mensagem", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendButtonActions = async (
    phone: string, 
    message: string, 
    buttons: Array<{id: string, type: 'CALL' | 'URL' | 'REPLY' | 'OPTION' | 'COPY', label: string, phone?: string, url?: string, copyText?: string}>,
    title?: string,
    footer?: string
  ) => {
    setLoading(true);
    
    try {
      const config = await getZAPIConfig();

      if (config.apiProvider === 'evolution') {
        const fallbackText = buildButtonFallbackMessage(message, buttons, title, footer);
        const data = await invokeSendMessageEdge({ phone, message: fallbackText }, 'Erro ao enviar mensagem com botões de ação');

        toast({
          title: "Mensagem enviada!",
          description: "Na Evolution API, os botões foram convertidos para texto compatível.",
        });

        return data;
      }
      
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-button-actions`;
      
      const payload: any = {
        phone: phone,
        message: message,
        buttonActions: buttons.map(btn => {
          const buttonData: any = {
            id: btn.id,
            type: btn.type,
            label: btn.label
          };
          
          if (btn.type === "CALL" && btn.phone) {
            buttonData.phone = btn.phone;
          } else if (btn.type === "URL" && btn.url) {
            buttonData.url = btn.url;
          } else if (btn.type === "COPY" && btn.copyText) {
            buttonData.type = "URL";
            buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText)}`;
          }
          
          return buttonData;
        })
      };

      if (title) payload.title = title;
      if (footer) payload.footer = footer;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem com botões de ação');
      }

      ensureZapiSendConfirmed(data, '❌ Falha no envio com botões de ação.');

      toast({
        title: "Mensagem com botões de ação enviada!",
        description: "A mensagem foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagem com botões de ação:', error);
      toast({
        title: "Erro ao enviar mensagem", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendImage = async (phone: string, image: string, caption?: string) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({ phone, mediaUrl: image, mediaType: 'image', message: caption || '' }, 'Erro ao enviar imagem');

      toast({
        title: "Imagem enviada!",
        description: "A imagem foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      toast({
        title: "Erro ao enviar imagem", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendDocument = async (phone: string, document: string, filename: string, extension: string, caption?: string) => {
    setLoading(true);
    
    try {
      const fileLabel = caption?.trim() || filename || `arquivo.${extension}`;
      const data = await invokeSendMessageEdge({ phone, mediaUrl: document, mediaType: 'document', message: fileLabel }, 'Erro ao enviar documento');

      toast({
        title: "Documento enviado!",
        description: "O documento foi enviado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar documento:', error);
      toast({
        title: "Erro ao enviar documento", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendVideo = async (phone: string, video: string, caption?: string) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({ phone, mediaUrl: video, mediaType: 'video', message: caption || '' }, 'Erro ao enviar vídeo');

      toast({
        title: "Vídeo enviado!",
        description: "O vídeo foi enviado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar vídeo:', error);
      toast({
        title: "Erro ao enviar vídeo", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendAudio = async (phone: string, audio: string, caption?: string) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({ phone, mediaUrl: audio, mediaType: 'audio', message: caption || '' }, 'Erro ao enviar áudio');

      toast({
        title: "Áudio enviado!",
        description: "O áudio foi enviado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar áudio:', error);
      toast({
        title: "Erro ao enviar áudio", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getDeviceStatus = async () => {
    setLoading(true);
    
    try {
      const selectedInstanceId = getSelectedInstanceId();
      const { data, error } = await supabase.functions.invoke('get-device-status', {
        body: selectedInstanceId ? { instanceId: selectedInstanceId } : {},
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar status do dispositivo');
      }

      if (data?.error) {
        const details = data?.details;
        let errorMessage = data.error;
        if (data?.message) errorMessage += `: ${data.message}`;
        if (details?.message) errorMessage += `: ${details.message}`;
        if (details?.error) errorMessage += `: ${details.error}`;
        if (details?.response?.message) errorMessage += `: ${details.response.message}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      toast({
        title: "Erro ao buscar status",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getQRCode = async () => {
    setLoading(true);
    
    try {
      const selectedInstanceId = getSelectedInstanceId();
      const { data, error } = await supabase.functions.invoke('get-qr-code', {
        body: selectedInstanceId ? { instanceId: selectedInstanceId } : {},
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar QR Code');
      }

      if (data?.error) {
        const details = data?.details;
        let errorMessage = data.error;
        if (data?.message) errorMessage += `: ${data.message}`;
        if (details?.message) errorMessage += `: ${details.message}`;
        if (details?.error) errorMessage += `: ${details.error}`;
        if (details?.response?.message) errorMessage += `: ${details.response.message}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
      toast({
        title: "Erro ao buscar QR Code",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const disconnectDevice = async () => {
    setLoading(true);
    
    try {
      const config = await getZAPIConfig();
      
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/disconnect`;
      console.log('Desconectando dispositivo Z-API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
      });

      console.log('Disconnect response status:', response.status);
      const data = await response.json();
      console.log('Disconnect data:', data);

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        if (data.message) errorMessage += `: ${data.message}`;
        if (data.error) errorMessage += `: ${data.error}`;
        
        throw new Error(errorMessage);
      }

      toast({
        title: "✅ Dispositivo desconectado",
        description: "Dispositivo desconectado com sucesso. Você pode reconectar usando o QR Code."
      });

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao desconectar dispositivo:', error);
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const restartInstance = async () => {
    setLoading(true);
    
    try {
      const config = await getZAPIConfig();
      
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/restart`;
      console.log('Reiniciando instância Z-API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
      });

      console.log('Restart response status:', response.status);
      const data = await response.json();
      console.log('Restart data:', data);

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        if (data.message) errorMessage += `: ${data.message}`;
        if (data.error) errorMessage += `: ${data.error}`;
        
        throw new Error(errorMessage);
      }

      toast({
        title: "✅ Instância reiniciada",
        description: "A instância foi reiniciada com sucesso. Aguarde alguns segundos para reconectar."
      });

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao reiniciar instância:', error);
      toast({
        title: "Erro ao reiniciar instância",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getPairingCode = async (phoneNumber: string) => {
    setLoading(true);
    
    try {
      const selectedInstanceId = getSelectedInstanceId();

      toast({
        title: "🔍 Gerando código de pareamento",
        description: "Processando solicitação...",
      });

      const { data, error } = await supabase.functions.invoke('get-pairing-code', {
        body: {
          phoneNumber,
          ...(selectedInstanceId ? { instanceId: selectedInstanceId } : {}),
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao gerar código de pareamento');
      }

      if (!data?.success || !data?.data?.code) {
        throw new Error(data?.error || data?.message || 'Falha ao gerar código de pareamento');
      }

      toast({
        title: "🎯 Código gerado!",
        description: `Código: ${data.data.code}`,
        variant: "default"
      });
      
      return data;
    } catch (error) {
      console.error('Erro ao gerar código de pareamento:', error);
      
      toast({
        title: "❌ Erro ao gerar código",
        description: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    } finally {
      setLoading(false);
    }
  };

  const sendOptionList = async (
    phone: string, 
    message: string, 
    optionList: {
      title: string,
      buttonLabel: string,
      options: Array<{id: string, title: string, description: string}>
    }
  ) => {
    setLoading(true);
    
    try {
      const config = await getZAPIConfig();

      if (config.apiProvider === 'evolution') {
        const fallbackText = buildOptionListFallbackMessage(message, optionList);
        const data = await invokeSendMessageEdge({ phone, message: fallbackText }, 'Erro ao enviar lista de opções');

        toast({
          title: "Mensagem enviada!",
          description: "Na Evolution API, a lista foi convertida para texto compatível.",
        });

        return data;
      }
      
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-option-list`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify({
          phone: phone,
          message: message,
          optionList: optionList
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar lista de opções');
      }

      ensureZapiSendConfirmed(data, '❌ Falha no envio da lista de opções.');

      toast({
        title: "Lista de opções enviada!",
        description: "A mensagem foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar lista de opções:', error);
      toast({
        title: "Erro ao enviar mensagem", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfileName = async (name: string) => {
    setLoading(true);
    
    try {
      const config = await getZAPIConfig();
      
      console.log('Atualizando nome do perfil via Edge Function');
      
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: {
          type: 'name',
          value: name,
          instanceId: config.instanceId,
          token: config.token,
          clientToken: config.clientToken,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao atualizar nome');
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Nome atualizado",
        description: "O nome do perfil foi atualizado com sucesso."
      });

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar nome do perfil:', error);
      toast({
        title: "Erro ao atualizar nome",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfilePicture = async (imageUrl: string) => {
    setLoading(true);
    
    try {
      const config = await getZAPIConfig();
      
      console.log('Atualizando foto do perfil via Edge Function');
      
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: {
          type: 'picture',
          value: imageUrl,
          instanceId: config.instanceId,
          token: config.token,
          clientToken: config.clientToken,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao atualizar foto');
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Foto atualizada",
        description: "A foto de perfil foi atualizada com sucesso."
      });

      return { success: true, data };
    } catch (error) {
      console.error('Erro ao atualizar foto do perfil:', error);
      toast({
        title: "Erro ao atualizar foto",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    sendButtonList,
    sendButtonActions,
    sendOptionList,
    sendImage,
    sendVideo,
    sendAudio,
    sendDocument,
    getDeviceStatus,
    getQRCode,
    getPairingCode,
    disconnectDevice,
    restartInstance,
    updateProfileName,
    updateProfilePicture,
    loading,
  };
};