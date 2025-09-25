import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

// Mock data para demonstração - em produção seria conectado ao Supabase
const STORAGE_KEYS = {
  RESPONSES: 'auto_responses',
  CONFIG: 'auto_response_config',
  LOGS: 'message_logs'
}

export interface AutoResponse {
  id: number
  keyword: string
  response: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface AutoResponseConfig {
  id: number
  active: boolean
  webhook_url: string
  updated_at: string
}

export const useAutoResponse = () => {
  const [responses, setResponses] = useState<AutoResponse[]>([])
  const [config, setConfig] = useState<AutoResponseConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const fetchResponses = async () => {
    try {
      setLoading(true)
      const stored = localStorage.getItem(STORAGE_KEYS.RESPONSES)
      const data = stored ? JSON.parse(stored) : [
        {
          id: 1,
          keyword: "horário",
          response: "Nosso horário de funcionamento é de segunda a sexta, das 8h às 18h.",
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          keyword: "preço",
          response: "Para informações sobre preços, entre em contato com nossa equipe comercial.",
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 3,
          keyword: "localização",
          response: "Estamos localizados na Rua das Flores, 123 - Centro, São Paulo - SP",
          active: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
      
      if (!stored) {
        localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(data))
      }
      
      setResponses(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar respostas',
        description: 'Não foi possível carregar as respostas automáticas',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchConfig = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONFIG)
      const data = stored ? JSON.parse(stored) : {
        id: 1,
        active: false,
        webhook_url: `${window.location.origin}/supabase/functions/v1/webhook-zapi`,
        updated_at: new Date().toISOString()
      }
      
      if (!stored) {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(data))
      }
      
      setConfig(data)
    } catch (error) {
      console.error('Erro ao carregar configuração:', error)
    }
  }

  const addResponse = async (keyword: string, response: string) => {
    try {
      setLoading(true)
      const newResponse: AutoResponse = {
        id: Date.now(),
        keyword: keyword.trim(),
        response: response.trim(),
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const updatedResponses = [newResponse, ...responses]
      setResponses(updatedResponses)
      localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(updatedResponses))
      
      toast({
        title: 'Resposta adicionada',
        description: 'A resposta automática foi criada com sucesso'
      })

      return true
    } catch (error) {
      toast({
        title: 'Erro ao adicionar resposta',
        description: 'Não foi possível criar a resposta automática',
        variant: 'destructive'
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const updateResponse = async (id: number, updates: Partial<AutoResponse>) => {
    try {
      setLoading(true)
      const updatedResponses = responses.map(r => 
        r.id === id 
          ? { ...r, ...updates, updated_at: new Date().toISOString() }
          : r
      )
      
      setResponses(updatedResponses)
      localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(updatedResponses))
      
      toast({
        title: 'Resposta atualizada',
        description: 'A resposta automática foi atualizada com sucesso'
      })

      return true
    } catch (error) {
      toast({
        title: 'Erro ao atualizar resposta',
        description: 'Não foi possível atualizar a resposta automática',
        variant: 'destructive'
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteResponse = async (id: number) => {
    try {
      setLoading(true)
      const updatedResponses = responses.filter(r => r.id !== id)
      setResponses(updatedResponses)
      localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(updatedResponses))
      
      toast({
        title: 'Resposta removida',
        description: 'A resposta automática foi removida com sucesso'
      })

      return true
    } catch (error) {
      toast({
        title: 'Erro ao remover resposta',
        description: 'Não foi possível remover a resposta automática',
        variant: 'destructive'
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = async (active: boolean) => {
    try {
      if (!config) return false
      
      const updatedConfig = {
        ...config,
        active,
        updated_at: new Date().toISOString()
      }

      setConfig(updatedConfig)
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updatedConfig))
      
      toast({
        title: active ? 'Sistema ativado' : 'Sistema desativado',
        description: `O sistema de respostas automáticas foi ${active ? 'ativado' : 'desativado'}`
      })

      return true
    } catch (error) {
      toast({
        title: 'Erro ao atualizar configuração',
        description: 'Não foi possível atualizar a configuração do sistema',
        variant: 'destructive'
      })
      return false
    }
  }

  const getLogs = async (limit = 50) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LOGS)
      const logs = stored ? JSON.parse(stored) : []
      
      // Mock de alguns logs para demonstração
      if (logs.length === 0) {
        const mockLogs = [
          {
            id: 1,
            phone: '5511999999999',
            message_received: 'Qual o horário de vocês?',
            keyword_matched: 'horário',
            response_sent: 'Nosso horário de funcionamento é de segunda a sexta, das 8h às 18h.',
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 2,
            phone: '5511888888888',
            message_received: 'Quanto custa o produto?',
            keyword_matched: 'preço',
            response_sent: 'Para informações sobre preços, entre em contato com nossa equipe comercial.',
            timestamp: new Date(Date.now() - 7200000).toISOString()
          }
        ]
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(mockLogs))
        return mockLogs.slice(0, limit)
      }
      
      return logs.slice(0, limit)
    } catch (error) {
      toast({
        title: 'Erro ao carregar logs',
        description: 'Não foi possível carregar o histórico de mensagens',
        variant: 'destructive'
      })
      return []
    }
  }

  useEffect(() => {
    fetchResponses()
    fetchConfig()
  }, [])

  return {
    responses,
    config,
    loading,
    addResponse,
    updateResponse,
    deleteResponse,
    updateConfig,
    getLogs,
    refreshResponses: fetchResponses
  }
}