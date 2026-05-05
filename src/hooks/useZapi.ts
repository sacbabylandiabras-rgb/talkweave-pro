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
  if (_rotateInstances.length > 0) {
    const inst = _rotateInstances[_rotateIndex % _rotateInstances.length];
    _rotateIndex++;
    
  const sendSticker = async (phone: string, sticker: string) => {
    setLoading(true);
    try {
      const data = await invokeSendMessageEdge({ phone, mediaUrl: sticker, mediaType: 'sticker' }, 'Erro ao enviar figurinha');
      toast({ title: "Figurinha enviada!" });
      return data;
    } catch (error: any) {
      toast({ title: "Erro ao enviar figurinha", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const sendPoll = async (phone: string, pollName: string, options: string[]) => {
    setLoading(true);
    try {
      const data = await invokeSendMessageEdge({ phone, message: pollName, mediaType: 'poll', specialPayload: { options } }, 'Erro ao enviar enquete');
      toast({ title: "Enquete enviada!" });
      return data;
    } catch (error: any) {
      toast({ title: "Erro ao enviar enquete", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

    return {
      instanceId: inst.zapi_instance_id,
      token: inst.zapi_token,
      clientToken: inst.zapi_client_token,
    };
  }

  if (_instanceOverride) {
    return {
      instanceId: _instanceOverride.zapi_instance_id,
      token: _instanceOverride.zapi_token,
      clientToken: _instanceOverride.zapi_client_token,
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado. Faça login para continuar.');

  const { data: instances, error } = await (supabase as any)
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .limit(1);

  if (error) throw new Error('Erro ao buscar credenciais: ' + error.message);

  const instance = instances?.[0];

  if (!instance?.zapi_instance_id || !instance?.zapi_token || !instance?.zapi_client_token) {
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
    };
  }

  return {
    instanceId: instance.zapi_instance_id,
    token: instance.zapi_token,
    clientToken: instance.zapi_client_token,
  };
};

export const useZapi = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const ensureZapiSendConfirmed = (data: any, fallbackMessage: string) => {
    const hasAck = Boolean(data?.messageId || data?.zaapId || data?.id || data?.key?.id || data?.status === 'PENDING' || data?.success === true);
    const explicitError = data?.error || (data?.success === false ? data?.message : null);

    if (explicitError) {
      throw new Error(String(explicitError));
    }

    if (!hasAck) {
      const safeDetails = typeof data === 'object' ? JSON.stringify(data) : String(data || 'sem detalhes');
      throw new Error(`${fallbackMessage} O provedor não confirmou entrega. Detalhes: ${safeDetails}`);
    }
  };

  const getInvokeErrorMessage = async (error: any, fallbackMessage: string) => {
    const response = error?.context;

    if (response?.json && typeof response.json === 'function') {
      try {
        const errorData = await response.json();
        const detailedMessage =
          errorData?.message ||
          errorData?.error ||
          errorData?.details?.message ||
          errorData?.details?.error;

        if (detailedMessage) {
          return String(detailedMessage);
        }

        return JSON.stringify(errorData);
      } catch {
        // fallback below
      }
    }

    if (response instanceof Response) {
      try {
        const errorData = await response.clone().json();
        const detailedMessage =
          errorData?.message ||
          errorData?.error ||
          errorData?.details?.message ||
          errorData?.details?.error;

        if (detailedMessage) {
          return String(detailedMessage);
        }

        return JSON.stringify(errorData);
      } catch {
        try {
          const errorText = await response.clone().text();
          if (errorText) return errorText;
        } catch {
          // ignore body parse issues
        }
      }

      return `${fallbackMessage} (status ${response.status})`;
    }

    return error?.message || fallbackMessage;
  };

  const invokeSendMessageEdge = async (
    payload: {
      phone: string;
      message?: string;
      mediaUrl?: string;
      mediaType?: string;
      viewOnce?: boolean;
      instanceId?: string;
      title?: string;
      footer?: string;
      buttonList?: { buttons: Array<{ id: string; label: string }> };
      optionList?: {
        title: string;
        buttonLabel: string;
        options: Array<{ id: string; title: string; description: string }>;
      };
      buttonActions?: Array<{
        id: string;
        type: 'CALL' | 'URL' | 'REPLY' | 'OPTION' | 'COPY';
        label: string;
        phone?: string;
        url?: string;
      }>;
      specialType?: 'pix' | 'localizacao' | 'contato';
      specialPayload?: Record<string, any>;
      carouselCards?: Array<{
        id?: string;
        image?: string;
        title?: string;
        description?: string;
        buttons?: Array<{ id?: string; text?: string; type?: string; value?: string }>;
      }>;
    },
    fallbackMessage: string,
  ) => {
    let body = { ...payload };
    if (!body.instanceId) {
      try {
        const config = await getZAPIConfig();
        body.instanceId = config.instanceId;
      } catch {
        // Let edge function use default
      }
    }

    const { data, error } = await supabase.functions.invoke('send-message', {
      body,
    });

    if (error) {
      throw new Error(await getInvokeErrorMessage(error, fallbackMessage));
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

      ensureZapiSendConfirmed(data, '❌ Falha no envio da mensagem.');

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
      const data = await invokeSendMessageEdge({
        phone,
        message,
        buttonList: {
          buttons,
        },
      }, 'Erro ao enviar mensagem com botões');

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
    footer?: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'gif' | 'poll' | 'reaction' | 'order' | 'product' | 'catalog'
  ) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({
        phone,
        message,
        title,
        footer,
        ...(mediaUrl ? { mediaUrl, mediaType: mediaType || 'image' } : {}),
        buttonActions: buttons.map(btn => {
          const buttonData: {
            id: string;
            type: 'CALL' | 'URL' | 'REPLY' | 'OPTION' | 'COPY';
            label: string;
            phone?: string;
            url?: string;
          } = {
            id: btn.id,
            type: btn.type,
            label: btn.label,
          };

          if (btn.type === 'CALL' && btn.phone) {
            buttonData.phone = btn.phone;
          } else if (btn.type === 'URL' && btn.url) {
            buttonData.url = btn.url;
          } else if (btn.type === 'COPY' && btn.copyText) {
            buttonData.type = 'URL';
            buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText)}`;
          }

          return buttonData;
        }),
      }, 'Erro ao enviar mensagem com botões de ação');

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

  const sendVideo = async (phone: string, video: string, caption?: string, viewOnce?: boolean, isPtv?: boolean) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({ phone, mediaUrl: video, mediaType: 'video', message: caption || '', ...(viewOnce ? { viewOnce: true } : {}), ...(isPtv ? { isPtv: true } : {}) }, 'Erro ao enviar vídeo');

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
      const data = await invokeSendMessageEdge({ phone, mediaUrl: audio, mediaType: 'audio' }, 'Erro ao enviar áudio');

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
        throw new Error(error.message || 'Erro ao gerar código de conexão');
      }

      if (!data?.success || !data?.data?.code) {
        throw new Error(data?.error || data?.message || 'Falha ao gerar código de conexão');
      }

      toast({
        title: "🎯 Código gerado!",
        description: `Código: ${data.data.code}`,
        variant: "default"
      });
      
      return data;
    } catch (error) {
      console.error('Erro ao gerar código de conexão:', error);
      
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
      const data = await invokeSendMessageEdge({
        phone,
        message,
        optionList,
      }, 'Erro ao enviar lista de opções');

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

  const sendSpecialTemplate = async (
    phone: string,
    specialType: 'pix' | 'localizacao' | 'contato' | 'uaz_status' | 'uaz_location_button' | 'uaz_request_payment',
    specialPayload: Record<string, any>,
  ) => {
    setLoading(true);
    try {
      // UAZAPI-only special endpoints → roteia para edge function dedicada
      if (specialType === 'uaz_status' || specialType === 'uaz_location_button' || specialType === 'uaz_request_payment') {
        const kindMap: Record<string, string> = {
          uaz_status: 'status',
          uaz_location_button: 'location-button',
          uaz_request_payment: 'request-payment',
        };
        const kind = kindMap[specialType];

        // Monta o payload no formato esperado pelo endpoint da UAZAPI
        let apiPayload: Record<string, any> = {};
        if (kind === 'status') {
          const t = specialPayload.statusType || 'text';
          // UAZAPI background_color: integer 1-19 (19=cinza padrão)
          // Mapeia hex → índice numérico mais próximo
          const hexToUazBg = (hex: string): number => {
            if (!hex || typeof hex !== 'string') return 19;
            const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
            if (!m) {
              // Já é número?
              const n = Number(hex);
              if (!isNaN(n) && n >= 1 && n <= 19) return Math.round(n);
              return 19;
            }
            const r = parseInt(m[1].slice(0, 2), 16);
            const g = parseInt(m[1].slice(2, 4), 16);
            const b = parseInt(m[1].slice(4, 6), 16);
            // heurística simples
            if (r > 200 && g > 200 && b < 100) return 2;       // amarelo
            if (g > 150 && r < 150 && b < 150) return 5;       // verde
            if (b > 150 && r < 150) return 8;                  // azul
            if (r > 150 && b > 150 && g < 150) return 11;      // lilás
            if (r > 200 && b > 100 && g < 100) return 13;      // magenta
            if (r > 200 && g < 150 && b > 150) return 14;      // rosa
            if (r > 100 && g > 60 && b < 80) return 16;        // marrom
            return 19;                                         // cinza/preto/padrão
          };
          if (t === 'text') {
            apiPayload = {
              type: 'text',
              text: specialPayload.text || specialPayload.description || '',
              background_color: hexToUazBg(specialPayload.backgroundColor || '19'),
              font: Number(specialPayload.font || 1),
            };
          } else {
            apiPayload = {
              type: t,
              file: specialPayload.media || '',
              text: specialPayload.caption || '',
            };
          }
        } else if (kind === 'location-button') {
          apiPayload = {
            latitude: Number(specialPayload.latitude || 0),
            longitude: Number(specialPayload.longitude || 0),
            name: specialPayload.name || '',
            address: specialPayload.address || '',
            text: specialPayload.text || specialPayload.description || '',
            buttonText: specialPayload.buttonLabel || 'Ver no mapa',
            buttonUrl: specialPayload.url || '',
          };
        } else if (kind === 'request-payment') {
          apiPayload = {
            amount: Number(specialPayload.amount || 0),
            currency: specialPayload.currency || 'BRL',
            note: specialPayload.note || specialPayload.description || '',
            ...(specialPayload.expiry ? { expiry: Number(specialPayload.expiry) } : {}),
          };
        }

        const selectedSpecialInstanceId = getSelectedInstanceId();
        const { data, error } = await supabase.functions.invoke('send-uazapi-special', {
          body: {
            kind,
            phone,
            payload: apiPayload,
            ...(selectedSpecialInstanceId ? { instanceId: selectedSpecialInstanceId } : {}),
          },
        });
        if (error) throw new Error(error.message || `Erro ao enviar ${specialType}`);
        if (data && data.success === false) throw new Error(data.error || `Falha no envio (${specialType})`);

        toast({
          title:
            kind === 'status'
              ? 'Status enviado!'
              : kind === 'location-button'
                ? 'Botão de localização enviado!'
                : 'Solicitação de pagamento enviada!',
          description: 'A mensagem foi enviada com sucesso.',
        });
        return data;
      }

      const data = await invokeSendMessageEdge(
        { phone, specialType, specialPayload },
        `Erro ao enviar ${specialType}`,
      );

      ensureZapiSendConfirmed(data, `❌ Falha no envio (${specialType}).`);

      toast({
        title:
          specialType === 'pix'
            ? 'Cobrança PIX enviada!'
            : specialType === 'localizacao'
              ? 'Localização enviada!'
              : 'Contato enviado!',
        description: 'A mensagem foi enviada com sucesso.',
      });

      return data;
    } catch (error) {
      console.error(`Erro ao enviar ${specialType}:`, error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendCarousel = async (
    phone: string,
    carouselCards: Array<{
      id?: string;
      image?: string;
      title?: string;
      description?: string;
      buttons?: Array<{ id?: string; text?: string; type?: string; value?: string }>;
    }>,
    message?: string,
  ) => {
    setLoading(true);
    try {
      const data = await invokeSendMessageEdge(
        { phone, message: message || '', carouselCards },
        'Erro ao enviar carrossel',
      );

      ensureZapiSendConfirmed(data, '❌ Falha no envio do carrossel.');

      toast({
        title: 'Carrossel enviado!',
        description: `${carouselCards.length} cards enviados.`,
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar carrossel:', error);
      toast({
        title: 'Erro ao enviar carrossel',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
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
    sendSpecialTemplate,
    sendCarousel,
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