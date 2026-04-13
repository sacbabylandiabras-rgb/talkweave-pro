import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ConfiguracaoZAPI = () => {
  const [instanceId, setInstanceId] = useState("");
  const [token, setToken] = useState("");
  const [clientToken, setClientToken] = useState("");
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load user's credentials on mount
  useEffect(() => {
    loadUserCredentials();
  }, []);

  const loadUserCredentials = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para configurar a instância",
          variant: "destructive",
        });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('zapi_instance_id, zapi_token, zapi_client_token')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading credentials:', error);
        return;
      }

      if (profile) {
        setInstanceId(profile.zapi_instance_id || '');
        setToken(profile.zapi_token || '');
        setClientToken(profile.zapi_client_token || '');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testarConexao = async () => {
    setStatus('testing');
    setStatusInfo(null);
    
    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
      console.log('=== DEBUG Z-API ===');
      console.log('URL completa:', url);
      console.log('Instance ID:', instanceId);
      console.log('Token:', token);
      console.log('Client Token:', clientToken);
      console.log('==================');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken
        },
      });

      console.log('Status da resposta:', response.status);
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('Dados completos da resposta:', data);

      if (response.ok) {
        setStatus('success');
        setStatusInfo(data);
        toast({
          title: "✅ Conexão bem-sucedida!",
          description: `Status: ${data.status || 'Conectado'}`,
        });
      } else {
        setStatus('error');
        setStatusInfo({
          ...data,
          debug: {
            url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          }
        });
        
        let errorMsg = `Erro ${response.status}`;
        if (data.error) errorMsg += `: ${data.error}`;
        if (data.message) errorMsg += ` - ${data.message}`;
        
        toast({
          title: "❌ Erro na conexão",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      setStatus('error');
      setStatusInfo({ 
        error: 'Network Error', 
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        debug: {
          instanceId,
          token: token.substring(0, 10) + '...',
          clientToken: clientToken.substring(0, 10) + '...',
        }
      });
      console.error('Erro completo:', error);
      toast({
        title: "❌ Erro ao testar conexão",
        description: error instanceof Error ? error.message : "Erro de rede",
        variant: "destructive",
      });
    }
  };

  const salvarCredenciais = async () => {
    if (!instanceId || !token || !clientToken) {
      toast({
        title: "Erro",
        description: "Preencha todas as credenciais antes de salvar",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          zapi_instance_id: instanceId,
          zapi_token: token,
          zapi_client_token: clientToken,
        })
        .eq('id', user.id);

      if (error) throw error;
      
      toast({
        title: "✅ Credenciais salvas!",
        description: "As configurações foram salvas no seu perfil.",
      });
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração da Instância</h1>
        <p className="text-muted-foreground">Configure suas credenciais para conectar o WhatsApp</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Credenciais da Instância
          </CardTitle>
          <CardDescription>
            Insira suas credenciais para conectar o WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="instance-id">Instance ID</Label>
            <Input
              id="instance-id"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="Ex: 3E6DD0DEED00C0FD52197AE2AD17DA62"
            />
          </div>

          <div>
            <Label htmlFor="token">Token</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Ex: 9E09CAB81F22452F5954C6C2"
            />
          </div>

          <div>
            <Label htmlFor="client-token">Client Token</Label>
            <Input
              id="client-token"
              value={clientToken}
              onChange={(e) => setClientToken(e.target.value)}
              placeholder="Ex: Fd1c0871baaa5449db5ea1628166c0566S"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={testarConexao} 
              disabled={status === 'testing'}
              variant="outline"
            >
              {status === 'testing' ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Testar Conexão
            </Button>
            
            <Button onClick={salvarCredenciais} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Credenciais'}
            </Button>
          </div>

          {status !== 'idle' && (
            <div className="flex items-center gap-2">
              <Badge variant={status === 'success' ? 'default' : 'destructive'}>
                {status === 'success' ? (
                  <><Check className="w-3 h-3 mr-1" /> Conectado</>
                ) : status === 'error' ? (
                  <><X className="w-3 h-3 mr-1" /> Erro</>
                ) : (
                  <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Testando</>
                )}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resposta da API</CardTitle>
          <CardDescription>
            {status === 'success' ? 'Conexão bem-sucedida!' : 'Detalhes do erro para debug'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-96">
            {JSON.stringify(statusInfo, null, 2)}
          </pre>
          
          {status === 'error' && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <h4 className="font-medium text-destructive mb-2">🔍 Possíveis soluções:</h4>
              <ul className="text-sm space-y-1 text-destructive/80">
                <li>• Verifique se a instância está ATIVA</li>
                <li>• Confirme se não há espaços extras nas credenciais</li>
                <li>• Teste se a instância não expirou ou foi pausada</li>
                <li>• Verifique se o Client Token está correto</li>
                <li>• Tente recriar a instância se necessário</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>⚠️ Problemas Comuns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="font-medium text-amber-800 mb-1">Instance not found (Error 400)</p>
            <p className="text-amber-700">1. Instância foi desativada ou expirou</p>
            <p className="text-amber-700">2. Instance ID incorreto</p>
                <p className="text-amber-700">3. Conta suspensa</p>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-medium text-blue-800 mb-1">Como verificar:</p>
             <p className="text-blue-700">1. Acesse o painel da sua instância</p>
            <p className="text-blue-700">2. Vá em "Instâncias" → Sua instância</p>
            <p className="text-blue-700">3. Verifique se o status está "ATIVA"</p>
            <p className="text-blue-700">4. Copie as credenciais novamente</p>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="font-medium text-green-800 mb-1">Se o problema persistir:</p>
            <p className="text-green-700">• Tente recriar a instância no painel Z-API</p>
            <p className="text-green-700">• Entre em contato com o suporte da Z-API</p>
            <p className="text-green-700">• Verifique se sua conta não está em débito</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracaoZAPI;