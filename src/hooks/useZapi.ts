import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useZapi = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendMessage = async (phone: string, message: string) => {
    setLoading(true);
    try {
      const response = await fetch('/functions/v1/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }

      toast({
        title: "Mensagem enviada!",
        description: "A mensagem foi enviada com sucesso.",
      });

      return data;
    } catch (error) {
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
      const response = await fetch('/functions/v1/get-device-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar status do dispositivo');
      }

      return data;
    } catch (error) {
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

  return {
    sendMessage,
    getDeviceStatus,
    loading,
  };
};