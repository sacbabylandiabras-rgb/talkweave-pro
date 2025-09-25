import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Função para obter configurações do localStorage
const getEvolutionConfig = () => {
  const saved = localStorage.getItem('zapLynx_evolution_config');
  if (saved) {
    return JSON.parse(saved);
  }
  // Configuração padrão Evolution API
  return {
    baseUrl: 'https://evolution-api.com', // Será atualizado com a URL real
    instanceName: 'zaplynx-instance',
    apiKey: 'evolution-api-key' // Será atualizado
  };
};

export const useZapi = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async (phone: string, message: string) => {
    setLoading(true);
    const config = getEvolutionConfig();
    
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
    const config = getEvolutionConfig();
    
    try {
      const url = `${config.baseUrl}/instance/connectionState/${config.instanceName}`;
      console.log('Buscando status do dispositivo Evolution API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
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

      // Mapear resposta da Evolution API para formato esperado
      const mappedData = {
        connected: data.state === 'open',
        session: data.state === 'open', 
        created: Date.now(),
        error: data.state !== 'open' ? 'You are not connected.' : null,
        smartphoneConnected: data.state === 'open'
      };

      return { success: true, data: mappedData };
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
    const config = getEvolutionConfig();
    
    try {
      const url = `${config.baseUrl}/instance/connect/${config.instanceName}`;
      console.log('Buscando QR Code da Evolution API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
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

      // Evolution API retorna { code: "qr-string", pairingCode: "XXXX", count: 1 }
      return { success: true, data: { 
        value: data.code, 
        pairingCode: data.pairingCode,
        connected: data.state === 'open' || false,
        session: data.state === 'open' || false
      } };
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
    const config = getEvolutionConfig();
    
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
    const config = getEvolutionConfig();
    
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

  const getPairingCode = async (phoneNumber: string) => {
    setLoading(true);
    const config = getEvolutionConfig();
    
    try {
      // Evolution API: o mesmo endpoint /instance/connect retorna tanto QR quanto pairing code
      const url = `${config.baseUrl}/instance/connect/${config.instanceName}`;
      console.log('Buscando código de pareamento Evolution API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
        }
      });

      console.log('Pairing code response status:', response.status);
      const data = await response.json();
      console.log('Pairing code data:', data);

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}`;
        if (data.message) errorMessage += `: ${data.message}`;
        if (data.error) errorMessage += `: ${data.error}`;
        
        throw new Error(errorMessage);
      }

      // Evolution API retorna { pairingCode: "XXXX", code: "qr-string", count: 1 }
      if (data.pairingCode) {
        toast({
          title: "✅ Código de pareamento gerado",
          description: `Código: ${data.pairingCode}`,
        });
        return { success: true, data: { code: data.pairingCode } };
      } else {
        throw new Error("Pairing code não encontrado na resposta");
      }

    } catch (error) {
      console.error('Erro ao buscar código de pareamento:', error);
      toast({
        title: "❌ Erro ao gerar código",
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
    disconnectDevice,
    restartInstance,
    loading,
  };
};