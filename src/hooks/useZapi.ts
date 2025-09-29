import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Função para obter configurações do localStorage
const getZAPIConfig = () => {
  const saved = localStorage.getItem('zapLynx_zapi_config');
  if (saved) {
    return JSON.parse(saved);
  }
  // Credenciais atualizadas da imagem - que funcionavam antes
  return {
    instanceId: '3E6DD0DEED00C0FD52197AE2AD17DA62',
    token: '9E09CAB81F22425F5954C6C2',
    clientToken: 'Fd1c0871baaa5449db5ea1628166c0566S'
  };
};

export const useZapi = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async (phone: string, message: string) => {
    setLoading(true);
    const config = getZAPIConfig();
    
    try {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-text`;
      console.log('Enviando mensagem para Z-API:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify({
          phone: phone,
          message: message
        }),
      });

      console.log('Resposta Z-API status:', response.status);
      const data = await response.json();
      console.log('Dados da resposta:', data);

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        if (data.message) errorMessage += `: ${data.message}`;
        if (data.error) errorMessage += `: ${data.error}`;
        
        // Mensagens específicas para erros comuns
        if (response.status === 400 && data.error === 'Instance not found') {
          errorMessage = '❌ Instância Z-API não encontrada! Verifique suas credenciais na página "Config Z-API" no menu lateral.';
        } else if (response.status === 404) {
          errorMessage = '❌ Instância não encontrada. Acesse developer.z-api.io e verifique se sua instância está ativa.';
        } else if (response.status === 401) {
          errorMessage = '❌ Token inválido. Verifique suas credenciais Z-API.';
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: "Mensagem enviada!",
        description: "A mensagem foi enviada com sucesso via Z-API.",
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
    const config = getZAPIConfig();
    
    try {
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
    const config = getZAPIConfig();
    
    try {
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
            // Para botão COPY, usar a URL especial do WhatsApp
            buttonData.type = "URL";
            buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(btn.copyText)}`;
          }
          // Para REPLY e OPTION, só precisamos do id, type e label
          
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
    const config = getZAPIConfig();
    
    try {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-image`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify({
          phone: phone,
          image: image,
          caption: caption || ''
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar imagem');
      }

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
    const config = getZAPIConfig();
    
    try {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-document/${extension}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify({
          phone: phone,
          document: document,
          filename: filename,
          caption: caption || ''
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar documento');
      }

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
    const config = getZAPIConfig();
    
    try {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-video`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify({
          phone: phone,
          video: video,
          caption: caption || ''
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar vídeo');
      }

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
    const config = getZAPIConfig();
    
    try {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-audio`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
        body: JSON.stringify({
          phone: phone,
          audio: audio,
          caption: caption || ''
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar áudio');
      }

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
    const config = getZAPIConfig();
    
    try {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/status`;
      console.log('Buscando status do dispositivo Z-API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
      });

      console.log('Status response:', response.status);
      const data = await response.json();
      console.log('Status data:', data);

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        if (data.message) errorMessage += `: ${data.message}`;
        if (data.error) errorMessage += `: ${data.error}`;
        
        throw new Error(errorMessage);
      }

      return { success: true, data };
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
    const config = getZAPIConfig();
    
    try {
      const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/qr-code`;
      console.log('Buscando QR Code da Z-API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken
        },
      });

      console.log('QR Code response status:', response.status);
      const data = await response.json();
      console.log('QR Code data:', data);

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        if (data.message) errorMessage += `: ${data.message}`;
        if (data.error) errorMessage += `: ${data.error}`;
        
        throw new Error(errorMessage);
      }

      return { success: true, data };
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
      console.log('Chamando edge function disconnect-device...');
      const { data, error } = await supabase.functions.invoke('disconnect-device');
      
      console.log('Resposta da edge function:', { data, error });

      if (error) {
        console.error('Erro da edge function:', error);
        throw new Error(error.message || 'Erro ao desconectar dispositivo');
      }

      if (!data?.success) {
        console.error('Função retornou erro:', data);
        throw new Error(data?.error || 'Erro ao desconectar dispositivo');
      }

      toast({
        title: "✅ Dispositivo desconectado",
        description: "Dispositivo desconectado com sucesso. Você pode reconectar usando o QR Code."
      });

      return data;
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
      console.log('Chamando edge function restart-instance...');
      const { data, error } = await supabase.functions.invoke('restart-instance');
      
      console.log('Resposta da edge function:', { data, error });

      if (error) {
        console.error('Erro da edge function:', error);
        throw new Error(error.message || 'Erro ao reiniciar instância');
      }

      if (!data?.success) {
        console.error('Função retornou erro:', data);
        throw new Error(data?.error || 'Erro ao reiniciar instância');
      }

      toast({
        title: "✅ Instância reiniciada",
        description: "A instância foi reiniciada com sucesso. Aguarde alguns segundos para reconectar."
      });

      return data;
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
      const { instanceId, token, clientToken } = getZAPIConfig();
      const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/phone-code/${phoneNumber}`;
      
      console.log('Gerando código de pareamento Z-API para:', phoneNumber);
      
      toast({
        title: "🔍 Gerando código Z-API",
        description: "Processando solicitação...",
      });
      
      const response = await fetch(zapiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken
        }
      });
      
      const result = await response.json();
      
      if (response.ok && result.code) {
        toast({
          title: "🎯 Código Z-API gerado!",
          description: `Código: ${result.code}`,
          variant: "default"
        });
        
        return { 
          success: true, 
          data: { 
            code: result.code,
            isReal: true,
            method: 'zapi'
          } 
        };
      } else {
        throw new Error(result.error || "Falha ao gerar código na Z-API");
      }
      
    } catch (error) {
      console.error('Erro ao gerar código de pareamento Z-API:', error);
      
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
    const config = getZAPIConfig();
    
    try {
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
    loading,
  };
};