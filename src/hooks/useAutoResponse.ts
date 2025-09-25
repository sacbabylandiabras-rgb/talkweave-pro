import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

export interface AutoResponse {
  id: string
  keyword: string
  response: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface AutoResponseConfig {
  id: string
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
      const { data, error } = await supabase
        .from('auto_responses')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      setResponses(data || [])
    } catch (error) {
      console.error('Erro ao carregar respostas:', error)
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
      const { data, error } = await supabase
        .from('auto_response_config')
        .select('*')
        .single()
      
      if (error) throw error
      
      setConfig(data)
    } catch (error) {
      console.error('Erro ao carregar configuração:', error)
    }
  }

  const addResponse = async (keyword: string, response: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('auto_responses')
        .insert({
          keyword: keyword.trim(),
          response: response.trim(),
          active: true
        })
        .select()
        .single()
      
      if (error) throw error
      
      setResponses(prev => [data, ...prev])
      
      toast({
        title: 'Resposta adicionada',
        description: 'A resposta automática foi criada com sucesso'
      })

      return true
    } catch (error) {
      console.error('Erro ao adicionar resposta:', error)
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

  const updateResponse = async (id: string, updates: Partial<AutoResponse>) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('auto_responses')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      setResponses(prev => 
        prev.map(r => r.id === id ? data : r)
      )
      
      toast({
        title: 'Resposta atualizada',
        description: 'A resposta automática foi atualizada com sucesso'
      })

      return true
    } catch (error) {
      console.error('Erro ao atualizar resposta:', error)
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

  const deleteResponse = async (id: string) => {
    try {
      setLoading(true)
      
      const { error } = await supabase
        .from('auto_responses')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setResponses(prev => prev.filter(r => r.id !== id))
      
      toast({
        title: 'Resposta removida',
        description: 'A resposta automática foi removida com sucesso'
      })

      return true
    } catch (error) {
      console.error('Erro ao remover resposta:', error)
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
      
      const { data, error } = await supabase
        .from('auto_response_config')
        .update({ active })
        .eq('id', config.id)
        .select()
        .single()
      
      if (error) throw error
      
      setConfig(data)
      
      toast({
        title: active ? 'Sistema ativado' : 'Sistema desativado',
        description: `O sistema de respostas automáticas foi ${active ? 'ativado' : 'desativado'}`
      })

      return true
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error)
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
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
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