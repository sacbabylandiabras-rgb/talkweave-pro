import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isMobileZapiInstance, type ZapiInstance } from '@/hooks/useZapiInstances';

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

  const { data: instances, error } = await supabase
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, instance_name, instance_type')
    .eq('user_id', user.id)
    .eq('is_active', true)
      .or('api_provider.is.null,api_provider.eq.zapi')
    .order('is_default', { ascending: false })
    .limit(10);

  if (error) throw new Error('Erro ao buscar credenciais: ' + error.message);

  const instance = instances?.find((item) => !isMobileZapiInstance(item as any));

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
 
   const setOverride = (instance: ZapiInstance | null) => {
     setZapiInstanceOverride(instance);
   };

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
      phone: string | string[];
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
       specialType?: 'pix' | 'localizacao' | 'contato' | 'sticker';
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

  const sendMessage = async (phone: string, message: string, options?: any) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({ phone, message, ...(options || {}) }, 'Erro ao enviar mensagem');

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
      mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'gif' | 'poll' | 'reaction' | 'order' | 'product' | 'catalog' | 'product-catalog' | 'contact',
     specialPayload?: Record<string, any>
  ) => {
    setLoading(true);
    
    try {
      const data = await invokeSendMessageEdge({
        phone,
        message,
        title,
        footer,
         ...(mediaUrl ? { mediaUrl, mediaType: mediaType || 'image' } : {}),
         ...(specialPayload ? { specialPayload } : {}),
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
       toast({ title: "Áudio enviado!", description: "O áudio foi enviado com sucesso." });
       return data;
     } catch (error) {
       console.error('Erro ao enviar áudio:', error);
       toast({ title: "Erro ao enviar áudio", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
       throw error;
     } finally {
       setLoading(false);
     }
   };

   const sendSticker = async (phone: string, stickerUrl: string) => {
     setLoading(true);
     try {
       const data = await invokeSendMessageEdge({ phone, mediaUrl: stickerUrl, mediaType: 'sticker' }, 'Erro ao enviar figurinha');
       toast({ title: "Figurinha enviada!", description: "A figurinha foi enviada com sucesso." });
       return data;
     } catch (error) {
       console.error('Erro ao enviar figurinha:', error);
       toast({ title: "Erro ao enviar figurinha", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
       throw error;
     } finally {
       setLoading(false);
     }
   };

   const sendGif = async (phone: string, gifUrl: string, caption?: string) => {
     setLoading(true);
     try {
       const data = await invokeSendMessageEdge({ phone, mediaUrl: gifUrl, mediaType: 'gif', message: caption || '' }, 'Erro ao enviar GIF');
       toast({ title: "GIF enviado!", description: "O GIF foi enviado com sucesso." });
       return data;
     } catch (error) {
       console.error('Erro ao enviar GIF:', error);
       toast({ title: "Erro ao enviar GIF", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
       throw error;
     } finally {
       setLoading(false);
     }
   };

  const sendMessageContact = async (
    phone: string,
    contactName: string,
    contactPhone: string,
    contactBusinessDescription?: string
  ) => {
    setLoading(true);
    try {
      const data = await invokeSendMessageEdge(
        {
          phone,
          mediaType: 'contact',
          specialPayload: {
            contactName,
            contactPhone,
            contactBusinessDescription
          }
        },
        'Erro ao enviar contato'
      );

      ensureZapiSendConfirmed(data, '❌ Falha no envio do contato.');

      toast({
        title: "Contato enviado!",
        description: "O cartão de contato foi enviado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar contato:', error);
      toast({
        title: "Erro ao enviar contato",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendMessageCatalog = async (
    phone: string,
    catalogId: string,
    productId: string,
    message?: string,
    footer?: string
  ) => {
    setLoading(true);
    try {
      const data = await invokeSendMessageEdge(
        {
          phone,
          message,
          footer,
          mediaType: 'product-catalog',
          specialPayload: { catalogId, productId }
        },
        'Erro ao enviar mensagem de catálogo'
      );

      ensureZapiSendConfirmed(data, '❌ Falha no envio da mensagem de catálogo.');

      toast({
        title: "Mensagem de catálogo enviada!",
        description: "O produto foi enviado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagem de catálogo:', error);
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

  const sendMultipleMessages = async (phones: string[], message: string) => {
    setLoading(true);
    try {
      const data = await invokeSendMessageEdge(
        {
          phone: phones,
          message,
        },
        'Erro ao enviar mensagens múltiplas'
      );

      ensureZapiSendConfirmed(data, '❌ Falha no envio de mensagens múltiplas.');

      toast({
        title: "Mensagens enviadas!",
        description: `As mensagens foram enviadas para ${phones.length} contatos.`,
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagens múltiplas:', error);
      toast({
        title: "Erro ao enviar mensagens",
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
    specialType: 'pix' | 'localizacao' | 'contato',
    specialPayload: Record<string, any>,
  ) => {
    setLoading(true);
    try {
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
    const finalInstanceDbId = instanceDbId || getSelectedInstanceId();
    console.log(`[useZapi] Invoking action: ${action}, instanceDbId: ${finalInstanceDbId}`);
    
    const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
      body: {
        action,
        phone,
        payload,
        instanceDbId: finalInstanceDbId,
      },
    });

    if (error) {
      console.error(`[useZapi] Error invoking ${action}:`, error);
      throw new Error(error.message || `Erro ao executar ação ${action}`);
    }

    if (data?.error) {
      console.error(`[useZapi] API error in ${action}:`, data);
      const raw = data.error;
      const msg =
        typeof raw === 'string'
          ? raw
          : raw?.message || raw?.error || raw?.value || data.message;
      throw new Error(msg || `Erro na API ao executar ${action}`);
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
 
   const getContactProfilePicture = async (phone: string, instanceDbId?: string) => {
     setLoading(true);
     try {
       try {
         const { data, error } = await supabase.functions.invoke('get-profile-picture', {
           body: { phone, instanceId: instanceDbId }
         });
         if (!error && data) return data;
       } catch (e) {
         console.warn('[useZapi] get-profile-picture function failed, falling back to actions', e);
       }
       return await invokeZapiAction('get-profile-picture', phone, {}, instanceDbId);
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

  const sendCall = async (phone: string, duration: number = 20, audioUrl?: string) => {
    setLoading(true);
    try {
      const cleanPhone = String(phone || '').replace(/\D/g, '');
      const data = await invokeZapiAction('send-call', cleanPhone, { callDuration: duration, audioUrl });
      toast({ 
        title: "Chamada iniciada", 
        description: `O comando de chamada foi enviado (Duração: ${duration}s).` 
      });
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
      return await invokeZapiAction('call-token');
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
      return await invokeZapiAction('sip-token');
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
      return await invokeZapiAction('sip-info');
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

  const createCollection = (payload: { name: string, products: { id: string }[] }) => invokeGroupAction('create-collection', payload);
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

  const addTagChat = async (phone: string, tagId: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('add-tag-chat', phone, { tagId, add: true });
      toast({ title: "Etiqueta adicionada", description: "O contato foi marcado com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao adicionar etiqueta:', error);
      toast({ title: "Erro ao adicionar etiqueta", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeTagChat = async (phone: string, tagId: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('remove-tag-chat', phone, { tagId, add: false });
      toast({ title: "Etiqueta removida", description: "A marcação foi removida com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao remover etiqueta:', error);
      toast({ title: "Erro ao remover etiqueta", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const listTags = async () => {
    setLoading(true);
    try {
      return await invokeZapiAction('list-tags');
    } catch (error) {
      console.error('Erro ao listar etiquetas:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const saveChatNote = async (phone: string, notes: string) => {
    setLoading(true);
    try {
      const data = await invokeZapiAction('save-chat-notes', phone, { notes });
      return data;
    } catch (error) {
      console.error('Erro ao salvar nota do chat:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const forwardMessage = async (
    originPhone: string,
    messageId: string,
    destinationPhone: string,
  ) => {
    setLoading(true);
    try {
      const cleanDest = String(destinationPhone || '').replace(/\D/g, '');
      if (!cleanDest) throw new Error('Informe um número de destino válido');
      const data = await invokeZapiAction('forward-message', cleanDest, {
        phone: cleanDest,
        messageId,
        messagePhone: String(originPhone || '').replace(/\D/g, ''),
      });
      toast({ title: "Mensagem encaminhada", description: "A mensagem foi encaminhada com sucesso." });
      return data;
    } catch (error) {
      console.error('Erro ao encaminhar mensagem:', error);
      toast({ title: "Erro ao encaminhar", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendEvent = async (payload: {
    phone: string;
    title: string;
    startTime: number;
    description?: string;
    endTime?: number;
    location?: string;
    isAllDay?: boolean;
    url?: string;
    instanceDbId?: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-event', {
        body: payload,
      });

      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao enviar evento'));
      if (data?.error) throw new Error(data.message || data.error);

      toast({
        title: "Evento enviado!",
        description: "O convite de evento foi enviado com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao enviar evento:', error);
      toast({
        title: "Erro ao enviar evento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendEditEvent = async (payload: {
    phone: string;
    messageIdToEdit: string;
    title?: string;
    startTime?: number;
    description?: string;
    endTime?: number;
    location?: string;
    isAllDay?: boolean;
    url?: string;
    cancelEvent?: boolean;
    instanceDbId?: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-edit-event', {
        body: payload,
      });

      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao editar evento'));
      if (data?.error) throw new Error(data.message || data.error);

      toast({
        title: payload.cancelEvent ? "Evento cancelado!" : "Evento editado!",
        description: `O evento foi ${payload.cancelEvent ? 'cancelado' : 'atualizado'} com sucesso.`,
      });

      return data;
    } catch (error) {
      console.error('Erro ao editar evento:', error);
      toast({
        title: "Erro ao editar evento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendEventResponse = async (payload: {
    phone: string;
    eventMessageId: string;
    eventResponse: string | number;
    instanceDbId?: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-event-response', {
        body: { ...payload, eventResponse: String(payload.eventResponse) },
      });

      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao responder evento'));
      if (data?.error) throw new Error(data.message || data.error);

      toast({
        title: "Resposta enviada!",
        description: "Sua resposta ao evento foi registrada.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao responder evento:', error);
      toast({
        title: "Erro ao responder evento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendOrderStatusUpdate = async (payload: {
    phone: string;
    orderStatus: string;
    paymentStatus?: string;
    order?: any;
    referenceId?: string;
    messageId?: string;
    orderRequestId?: string;
    instanceDbId?: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-order-status-update', {
        body: payload,
      });

      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao atualizar status do pedido'));
      if (data?.error) throw new Error(data.message || data.error);

      toast({
        title: "Status do pedido atualizado!",
        description: "A atualização foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      toast({
        title: "Erro ao atualizar status",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendOrderPaymentUpdate = async (payload: {
    phone: string;
    paymentStatus: string;
    orderStatus?: string;
    order?: any;
    referenceId?: string;
    messageId?: string;
    orderRequestId?: string;
    instanceDbId?: string;
  }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-order-payment-update', {
        body: payload,
      });

      if (error) throw new Error(await getInvokeErrorMessage(error, 'Erro ao atualizar pagamento do pedido'));
      if (data?.error) throw new Error(data.message || data.error);

      toast({
        title: "Pagamento do pedido atualizado!",
        description: "A atualização de pagamento foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Erro ao atualizar pagamento do pedido:', error);
      toast({
        title: "Erro ao atualizar pagamento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendReaction = async (phone: string, messageId: string, emoji: string) => {
    try {
      return await invokeZapiAction('send-message-reaction', phone, { messageId, reaction: emoji });
    } catch (error) {
      console.error('Erro ao enviar reação:', error);
      toast({ title: "Erro ao reagir", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    }
  };

  const removeReaction = async (phone: string, messageId: string) => {
    try {
      return await invokeZapiAction('send-remove-reaction', phone, { messageId });
    } catch (error) {
      console.error('Erro ao remover reação:', error);
      toast({ title: "Erro ao remover reação", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" });
      throw error;
    }
  };

  // Status Functions
    return {
      setZapiInstanceOverride: setOverride,
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
      getContactProfilePicture: (phone: string) => getContactProfilePicture(phone),
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
       createCollection,
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
      addTagChat,
      removeTagChat,
      listTags,
      saveChatNote,
      forwardMessage,
        sendReaction,
        sendSticker,
        sendGif,
      removeReaction,
      sendMessageCatalog,
      sendMessageContact,
      sendMultipleMessages,
      sendEvent,
      sendEditEvent,
      sendEventResponse,
      sendOrderStatusUpdate,
      sendOrderPaymentUpdate,
      setOverride,
      loading,
    };
  };