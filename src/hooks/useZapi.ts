import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Temporário: Credenciais Z-API diretamente (não recomendado para produção)
const ZAPI_CONFIG = {
  instanceId: '3E6DD0DEED00C0FD52197AE2AD17DA62',
  token: '9E09CAB81F22452F5954C6C2',
  clientToken: 'Fd1c0871baaa5449db5ea1628166c0566S'
};

export const useZapi = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async (phone: string, message: string) => {
    setLoading(true);
    try {
      const url = `https://api.z-api.io/instances/${ZAPI_CONFIG.instanceId}/token/${ZAPI_CONFIG.token}/send-text`;
      console.log('Enviando mensagem para Z-API:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': ZAPI_CONFIG.clientToken
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
        throw new Error(data.error || `Erro ${response.status}: ${data.message || 'Erro ao enviar mensagem'}`);
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
    try {
      const url = `https://api.z-api.io/instances/${ZAPI_CONFIG.instanceId}/token/${ZAPI_CONFIG.token}/status`;
      console.log('Buscando status do dispositivo Z-API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': ZAPI_CONFIG.clientToken
        },
      });

      console.log('Status response:', response.status);
      const data = await response.json();
      console.log('Status data:', data);

      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}: ${data.message || 'Erro ao buscar status'}`);
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
    try {
      const url = `https://api.z-api.io/instances/${ZAPI_CONFIG.instanceId}/token/${ZAPI_CONFIG.token}/qr-code`;
      console.log('Buscando QR Code da Z-API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': ZAPI_CONFIG.clientToken
        },
      });

      console.log('QR Code response status:', response.status);
      const data = await response.json();
      console.log('QR Code data:', data);

      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}: ${data.message || 'Erro ao buscar QR Code'}`);
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