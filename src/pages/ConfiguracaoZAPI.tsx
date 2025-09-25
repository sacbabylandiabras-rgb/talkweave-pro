import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ConfiguracaoZAPI = () => {
  const [instanceId, setInstanceId] = useState("3E6DD0DEED00C0FD52197AE2AD17DA62");
  const [token, setToken] = useState("9E09CAB81F22452F5954C6C2");
  const [clientToken, setClientToken] = useState("Fd1c0871baaa5449db5ea1628166c0566S");
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const { toast } = useToast();

  const testarConexao = async () => {
    setStatus('testing');
    setStatusInfo(null);
    
    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
      console.log('Testando conexão Z-API:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken
        },
      });

      const data = await response.json();
      console.log('Resposta do teste:', data);

      if (response.ok) {
        setStatus('success');
        setStatusInfo(data);
        toast({
          title: "Conexão bem-sucedida!",
          description: "Credenciais Z-API válidas.",
        });
      } else {
        setStatus('error');
        setStatusInfo(data);
        toast({
          title: "Erro na conexão",
          description: data.message || `Erro ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      setStatus('error');
      console.error('Erro ao testar conexão:', error);
      toast({
        title: "Erro ao testar conexão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const salvarCredenciais = () => {
    // Aqui você pode salvar no localStorage ou contexto
    localStorage.setItem('zapLynx_zapi_config', JSON.stringify({
      instanceId,
      token,
      clientToken
    }));
    
    toast({
      title: "Credenciais salvas!",
      description: "As configurações foram salvas localmente.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração Z-API</h1>
        <p className="text-muted-foreground">Configure suas credenciais da Z-API</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Credenciais Z-API
          </CardTitle>
          <CardDescription>
            Insira suas credenciais da Z-API para conectar o WhatsApp
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
            
            <Button onClick={salvarCredenciais}>
              Salvar Credenciais
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

      {statusInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Resposta da Z-API</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
              {JSON.stringify(statusInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Como obter suas credenciais Z-API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. Acesse o painel da Z-API em <strong>https://developer.z-api.io</strong></p>
          <p>2. Faça login na sua conta</p>
          <p>3. Vá em <strong>Instâncias</strong> e selecione sua instância</p>
          <p>4. Copie o <strong>Instance ID</strong>, <strong>Token</strong> e <strong>Client Token</strong></p>
          <p>5. Cole aqui e teste a conexão</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracaoZAPI;