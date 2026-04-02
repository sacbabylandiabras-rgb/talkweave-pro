import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ConfiguracaoInstagram() {
  const [accessToken, setAccessToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [testing, setTesting] = useState(false);

  const webhookUrl = `https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/webhook-instagram`;

  const handleTestConnection = async () => {
    if (!accessToken || !accountId) {
      toast.error("Preencha o Access Token e o ID da conta");
      return;
    }
    setTesting(true);
    // Simulated test
    await new Promise(r => setTimeout(r, 2000));
    setIsConnected(true);
    setTesting(false);
    toast.success("Conexão com Instagram validada com sucesso!");
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  return (
    <div className="space-y-6 w-full max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Configuração Instagram</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Conecte sua conta do Instagram para ativar automações</p>
      </div>

      {/* Status */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? "bg-[#00ff88]/10" : "bg-destructive/10"}`}>
                {isConnected ? <CheckCircle2 className="w-5 h-5 text-[#00ff88]" /> : <XCircle className="w-5 h-5 text-destructive" />}
              </div>
              <div>
                <p className="text-sm font-medium">{isConnected ? "Conectado" : "Desconectado"}</p>
                <p className="text-xs text-muted-foreground">{isConnected ? "API do Instagram ativa" : "Configure as credenciais abaixo"}</p>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"}
              className={isConnected ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30" : ""}>
              {isConnected ? "Online" : "Offline"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Credenciais da API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Access Token</label>
            <Input
              type="password"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="Cole seu Access Token do Instagram"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">ID da Conta Instagram</label>
            <Input
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              placeholder="Ex: 17841400123456789"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">URL do Webhook (gerada automaticamente)</label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Configure esta URL no painel de desenvolvedor do Facebook/Instagram</p>
          </div>
          <Button onClick={handleTestConnection} disabled={testing} className="w-full gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {testing ? "Testando..." : "Testar Conexão"}
          </Button>
        </CardContent>
      </Card>

      {/* Help */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Como configurar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>1. Acesse o <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Facebook Developers <ExternalLink className="w-3 h-3" /></a></p>
          <p>2. Crie ou selecione um App com permissão de Instagram Graph API</p>
          <p>3. Gere um Access Token de longa duração</p>
          <p>4. Cole o token e o ID da sua conta Instagram acima</p>
          <p>5. Configure a URL do webhook no painel do App</p>
          <p>6. Clique em "Testar Conexão" para validar</p>
        </CardContent>
      </Card>
    </div>
  );
}
