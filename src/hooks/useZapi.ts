import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

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
    const config = getZAPIConfig();
    
    try {
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
    const config = getZAPIConfig();
    
    try {
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

  const checkRegistrationAvailable = async (phoneNumber: string) => {
    const config = getZAPIConfig();
    
    // Separar DDI e número
    const ddi = phoneNumber.substring(0, 2); // Ex: "55"
    const phone = phoneNumber.substring(2); // Ex: "19983420174"
    
    const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/mobile/registration-available`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.clientToken
      },
      body: JSON.stringify({
        ddi: ddi,
        phone: phone
      })
    });
    
    const data = await response.json();
    console.log('Registration Available:', data);
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${data.message || 'Erro desconhecido'}`);
    }
    
    return data;
  };

  const requestRegistrationCode = async (phoneNumber: string, method: 'sms' | 'voice' | 'wa_old' = 'sms') => {
    const config = getZAPIConfig();
    
    // Separar DDI e número
    const ddi = phoneNumber.substring(0, 2); // Ex: "55"
    const phone = phoneNumber.substring(2); // Ex: "19983420174"
    
    const url = `https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/mobile/request-registration-code`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.clientToken
      },
      body: JSON.stringify({
        ddi: ddi,
        phone: phone,
        method: method
      })
    });
    
    const data = await response.json();
    console.log('Request Registration Code:', data);
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${data.message || 'Erro desconhecido'}`);
    }
    
    return data;
  };

  const getPairingCode = async (phoneNumber: string) => {
    setLoading(true);
    
    try {
      // Passo 1: Verificar disponibilidade do número
      toast({
        title: "🔍 Verificando número",
        description: "Verificando disponibilidade para registro...",
      });
      
      const availability = await checkRegistrationAvailable(phoneNumber);
      
      if (!availability.available) {
        if (availability.blocked) {
          throw new Error("Número bloqueado pelo WhatsApp");
        }
        throw new Error("Número não disponível para registro");
      }
      
      // Passo 2: Solicitar código via SMS
      toast({
        title: "📱 Solicitando código SMS",
        description: "Enviando código para seu WhatsApp...",
      });
      
      const codeRequest = await requestRegistrationCode(phoneNumber, 'sms');
      
      if (codeRequest.success) {
        // Gerar código visual de 6 dígitos para mostrar (SMS será enviado separadamente)
        const displayCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        toast({
          title: "✅ Código SMS enviado!",
          description: `Verifique suas mensagens SMS. Aguarde ${codeRequest.smsWaitSeconds || 60}s`,
        });
        
        return { 
          success: true, 
          data: { 
            code: displayCode,
            isRealSMS: true,
            waitSeconds: codeRequest.smsWaitSeconds || 60
          } 
        };
      } else {
        throw new Error("Falha ao solicitar código SMS");
      }
      
    } catch (error) {
      console.error('Erro ao buscar código de pareamento Z-API Mobile:', error);
      toast({
        title: "❌ Erro ao solicitar código",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    getDeviceStatus,
    getQRCode,
    getPairingCode,
    checkRegistrationAvailable,
    requestRegistrationCode,
    disconnectDevice,
    restartInstance,
    loading,
  };
};