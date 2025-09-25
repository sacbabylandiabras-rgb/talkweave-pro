import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Função para obter configurações do localStorage
const getZAPIConfig = () => {
  const saved = localStorage.getItem('zapLynx_zapi_config');
  if (saved) {
    return JSON.parse(saved);
  }
  // Credenciais atualizadas da imagem
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
        
        if (response.status === 400 && data.error === 'Instance not found') {
          errorMessage = '❌ Instância Z-API não encontrada! Verifique suas credenciais na página "Config Z-API".';
        } else if (response.status === 404) {
          errorMessage = '❌ Instância não encontrada. Acesse developer.z-api.io e verifique se sua instância está ativa.';
        } else if (response.status === 401) {
          errorMessage = '❌ Token inválido. Verifique suas credenciais Z-API.';
        }
        
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
        
        if (response.status === 400 && data.error === 'Instance not found') {
          errorMessage = '❌ Instância Z-API não encontrada! Acesse "Config Z-API" no menu e atualize suas credenciais.';
        } else if (response.status === 404) {
          errorMessage = '❌ Instância não encontrada. Acesse developer.z-api.io e verifique se sua instância está ativa.';
        } else if (response.status === 401) {
          errorMessage = '❌ Token inválido. Verifique suas credenciais Z-API.';
        }
        
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

  return {
    sendMessage,
    getDeviceStatus,
    getQRCode,
    loading,
  };
};