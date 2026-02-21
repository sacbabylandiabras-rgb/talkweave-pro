import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Webhook, RefreshCw, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const GatewayIntegracoes = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const webhookUrl = userId
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-gateway?user_id=${userId}`
    : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL copiada!" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações Gateway</h1>
        <p className="text-muted-foreground">Cole esta URL no serviço externo para receber webhooks</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            Sua URL de Webhook
          </CardTitle>
          <CardDescription>Copie e cole esta URL no GhostsPay ou qualquer outro serviço externo</CardDescription>
        </CardHeader>
        <CardContent>
          {userId ? (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="font-mono text-sm"
              />
              <Button onClick={copyUrl} className="shrink-0">
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GatewayIntegracoes;
