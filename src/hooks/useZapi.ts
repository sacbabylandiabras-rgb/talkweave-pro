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

   const invokeZapiAction = async (action: string, phone: string = '', payload: any = {}, instanceDbId?: string) => {
     const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
       body: {
         action,
         phone,
         payload,
         instanceDbId: instanceDbId || getSelectedInstanceId(),
       },
     });
 
     if (error) {
       throw new Error(error.message || `Erro ao executar ação ${action}`);
     }
 
     if (data?.error) {
       throw new Error(data.message || data.error || `Erro na API Z-API ao executar ${action}`);
     }
 
     return data?.data ?? data;
   };
 
   const getContacts = async (page: number = 1, pageSize: number = 50) => {
     setLoading(true);
     try {
       return await invokeZapiAction('get-contacts', '', { page, pageSize });
     } catch (error) {
       console.error('Erro ao buscar contatos:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const addContacts = async (contacts: Array<{ firstName: string; lastName?: string; phone: string }>) => {
     setLoading(true);
     try {
       const data = await invokeZapiAction('add-contacts', '', contacts);
       toast({ title: "Contatos adicionados", description: "Os contatos foram salvos na agenda com sucesso." });
       return data;
     } catch (error) {
       console.error('Erro ao adicionar contatos:', error);
       toast({ title: "Erro ao adicionar contatos", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const removeContacts = async (phones: Array<{ phone: string }>) => {
     setLoading(true);
     try {
       const data = await invokeZapiAction('remove-contacts', '', phones);
       toast({ title: "Contatos removidos", description: "Os contatos foram removidos da agenda com sucesso." });
       return data;
     } catch (error) {
       console.error('Erro ao remover contatos:', error);
       toast({ title: "Erro ao remover contatos", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const getContactMetadata = async (phone: string) => {
     setLoading(true);
     try {
       return await invokeZapiAction('get-metadata-contact', phone);
     } catch (error) {
       console.error('Erro ao buscar metadata do contato:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const getContactProfilePicture = async (phone: string) => {
     setLoading(true);
     try {
       return await invokeZapiAction('get-profile-picture', phone);
     } catch (error) {
       console.error('Erro ao buscar foto do contato:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const checkIsWhatsApp = async (phone: string) => {
     setLoading(true);
     try {
       return await invokeZapiAction('get-iswhatsapp', phone);
     } catch (error) {
       console.error('Erro ao verificar WhatsApp:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const checkIsWhatsAppBatch = async (phones: string[]) => {
     setLoading(true);
     try {
       return await invokeZapiAction('get-iswhatsapp-batch', '', { phones });
     } catch (error) {
       console.error('Erro ao verificar lote de WhatsApp:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const blockContact = async (phone: string) => {
     setLoading(true);
     try {
       const data = await invokeZapiAction('block-contact', phone);
       toast({ title: "Contato bloqueado", description: "O contato foi bloqueado com sucesso." });
       return data;
     } catch (error) {
       console.error('Erro ao bloquear contato:', error);
       toast({ title: "Erro ao bloquear contato", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const reportContact = async (phone: string) => {
     setLoading(true);
     try {
       const data = await invokeZapiAction('report-contact', phone);
       toast({ title: "Contato denunciado", description: "O contato foi denunciado com sucesso." });
       return data;
     } catch (error) {
       console.error('Erro ao denunciar contato:', error);
       toast({ title: "Erro ao denunciar contato", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const listChats = async (page: number = 1, pageSize: number = 50) => {
     setLoading(true);
     try {
       return await invokeZapiAction('list-chats', '', { page, pageSize });
     } catch (error) {
       console.error('Erro ao listar conversas:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const getChatMetadata = async (phone: string) => {
     setLoading(true);
     try {
       return await invokeZapiAction('metadata', phone);
     } catch (error) {
       console.error('Erro ao buscar metadata da conversa:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const readChat = async (phone: string) => {
     setLoading(true);
     try {
       return await invokeZapiAction('read', phone);
     } catch (error) {
       console.error('Erro ao marcar conversa como lida:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const archiveChat = async (phone: string, archive: boolean = true) => {
     setLoading(true);
     try {
       return await invokeZapiAction(archive ? 'archive' : 'unarchive', phone);
     } catch (error) {
       console.error(`Erro ao ${archive ? 'arquivar' : 'desarquivar'} conversa:`, error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const pinChat = async (phone: string, pin: boolean = true) => {
     setLoading(true);
     try {
       return await invokeZapiAction(pin ? 'pin' : 'unpin', phone);
     } catch (error) {
       console.error(`Erro ao ${pin ? 'fixar' : 'desafixar'} conversa:`, error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const muteChat = async (phone: string, mute: boolean = true, muteFor: number = 28800) => {
     setLoading(true);
     try {
       return await invokeZapiAction(mute ? 'mute' : 'unmute', phone, { muteFor });
     } catch (error) {
       console.error(`Erro ao ${mute ? 'silenciar' : 'reativar som'} da conversa:`, error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const clearChat = async (phone: string) => {
     setLoading(true);
     try {
       return await invokeZapiAction('clear', phone);
     } catch (error) {
       console.error('Erro ao limpar conversa:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const deleteChat = async (phone: string) => {
     setLoading(true);
     try {
       return await invokeZapiAction('delete', phone);
     } catch (error) {
       console.error('Erro ao deletar conversa:', error);
       throw error;
     } finally {
       setLoading(false);
     }
   };
 
   const setChatExpiration = async (phone: string, expiration: number = 0) => {
     setLoading(true);
     try {
       return await invokeZapiAction('expiration', phone, { expiration });
     } catch (error) {
       console.error('Erro ao definir expiração da conversa:', error);
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

  const sendCall = async (phone: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
        body: { action: 'send-call', phone },
      });
      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao realizar chamada'));
      toast({ title: "Chamada iniciada", description: "O comando de chamada foi enviado." });
      return data;
    } catch (error) {
      toast({
        title: "Erro ao realizar chamada",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getCallToken = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
        body: { action: 'call-token' },
      });
      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao buscar token de chamada'));
      return data?.data || data;
    } catch (error) {
      toast({
        title: "Erro ao buscar token",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getSipToken = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
        body: { action: 'sip-token' },
      });
      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao buscar token SIP'));
      return data?.data || data;
    } catch (error) {
      toast({
        title: "Erro ao buscar token SIP",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getSipInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
        body: { action: 'sip-info' },
      });
      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao buscar info SIP'));
      return data?.data || data;
    } catch (error) {
       toast({
         title: "Erro ao buscar info SIP",
         description: error instanceof Error ? error.message : "Erro desconhecido",
         variant: "destructive",
       });
       throw error;
     } finally {
       setLoading(false);
     }
   };

  const invokeGroupAction = async (action: string, payload?: any, phone?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
        body: { action, payload, phone },
      });
      if (error) throw new Error(await getInvokeErrorMessage(error, `Erro ao executar ação de grupo: ${action}`));
      return data?.data || data;
    } catch (error) {
      toast({
        title: "Erro na ação de grupo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getGroups = (page = 1, pageSize = 50) => invokeGroupAction('get-groups', { page, pageSize });
  const createGroup = (payload: { groupName: string, phones: string[] }) => invokeGroupAction('create-group', payload);
  const updateGroupName = (payload: { phone: string, groupName: string }) => invokeGroupAction('update-group-name', payload);
  const updateGroupPhoto = (payload: { phone: string, image: string }) => invokeGroupAction('update-group-photo', payload);
  const addParticipant = (payload: { phone: string, participantPhone: string }) => invokeGroupAction('add-participant', payload);
  const removeParticipant = (payload: { phone: string, participantPhone: string }) => invokeGroupAction('remove-participant', payload);
  const approveParticipant = (payload: { phone: string, participantPhone: string }) => invokeGroupAction('approve-participant', payload);
  const reject_participant = (payload: { phone: string, participantPhone: string }) => invokeGroupAction('reject-participant', payload);
  const mentionParticipant = (payload: { phone: string, participantPhone: string, message: string }) => invokeGroupAction('mention-participant', payload);
  const mentionGroup = (payload: { phone: string, message: string }) => invokeGroupAction('mention-group', payload);
  const mentionAll = (payload: { phone: string, message: string }) => invokeGroupAction('mention-all', payload);
  const addAdmin = (payload: { phone: string, participantPhone: string }) => invokeGroupAction('add-admin', payload);
  const removeAdmin = (payload: { phone: string, participantPhone: string }) => invokeGroupAction('remove-admin', payload);
  const leaveGroup = (payload: { phone: string }) => invokeGroupAction('leave-group', payload);
  const getGroupMetadata = (phone: string) => invokeGroupAction('metadata-group', null, phone);
  const getLightGroupMetadata = (phone: string) => invokeGroupAction('light-group-metadata', null, phone);
  const getGroupInvitationMetadata = (inviteUrl: string) => invokeGroupAction('group-invitation-metadata', { inviteUrl });
  const updateGroupSettings = (payload: { phone: string, editGroup?: boolean, sendMessage?: boolean }) => invokeGroupAction('update-group-settings', payload);
  const updateGroupDescription = (payload: { phone: string, description: string }) => invokeGroupAction('update-group-description', payload);
  const redefineInvitationLink = (payload: { phone: string }) => invokeGroupAction('redefine-invitation-link', payload);
  const getInvitationLink = (phone: string) => invokeGroupAction('get-invitation-link', null, phone);
  const acceptGroupInvite = (payload: { inviteUrl: string }) => invokeGroupAction('accept-group-invite', payload);

  // Status Functions
  const sendTextStatus = async (text: string, backgroundColor?: string, font?: number) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('send-text-status', '', { message: text, backgroundColor: backgroundColor || "#000000", font: font || 1 });
      toast({ title: "Status enviado", description: "O status de texto foi publicado com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao enviar status de texto:', error);
      toast({ title: "Erro ao enviar status", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendImageStatus = async (image: string, caption?: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('send-image-status', '', { image, caption });
      toast({ title: "Status enviado", description: "O status de imagem foi publicado com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao enviar status de imagem:', error);
      toast({ title: "Erro ao enviar status", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendVideoStatus = async (video: string, caption?: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('send-video-status', '', { video, caption });
      toast({ title: "Status enviado", description: "O status de vídeo foi publicado com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao enviar status de vídeo:', error);
      toast({ title: "Erro ao enviar status", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const replyStatusText = async (statusId: string, phone: string, text: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('reply-status-text', phone, { phone, msgId: statusId, message: text });
      toast({ title: "Resposta enviada", description: "A resposta ao status foi enviada com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao responder status:', error);
      toast({ title: "Erro ao responder status", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const replyStatusGif = async (statusId: string, phone: string, gifUrl: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('reply-status-gif', phone, { phone, msgId: statusId, gif: gifUrl });
      toast({ title: "Resposta enviada", description: "O GIF foi enviado como resposta com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao responder status com GIF:', error);
      toast({ title: "Erro ao responder status", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const replyStatusSticker = async (statusId: string, phone: string, stickerUrl: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('reply-status-sticker', phone, { phone, msgId: statusId, sticker: stickerUrl });
      toast({ title: "Resposta enviada", description: "A figurinha foi enviada como resposta com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao responder status com figurinha:', error);
      toast({ title: "Erro ao responder status", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendTextStatus,
    sendImageStatus,
    sendVideoStatus,
    replyStatusText,
    replyStatusGif,
    replyStatusSticker,
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
     getContacts,
     addContacts,
     removeContacts,
     getContactMetadata,
     getContactProfilePicture,
     checkIsWhatsApp,
     checkIsWhatsAppBatch,
     blockContact,
     reportContact,
     listChats,
     getChatMetadata,
     readChat,
     archiveChat,
     pinChat,
     muteChat,
     clearChat,
     deleteChat,
     setChatExpiration,
     sendCall,
     getCallToken,
     getSipToken,
      getSipInfo,
      getGroups,
      createGroup,
      updateGroupName,
      updateGroupPhoto,
      addParticipant,
      removeParticipant,
      approveParticipant,
      reject_participant,
      mentionParticipant,
      mentionGroup,
      mentionAll,
      addAdmin,
      removeAdmin,
      leaveGroup,
      getGroupMetadata,
      getLightGroupMetadata,
      getGroupInvitationMetadata,
      updateGroupSettings,
      updateGroupDescription,
      redefineInvitationLink,
      getInvitationLink,
      acceptGroupInvite,
      loading,
    };
  };