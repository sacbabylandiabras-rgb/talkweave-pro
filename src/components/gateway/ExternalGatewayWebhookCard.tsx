import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Webhook, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ExternalGatewayWebhookCard() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from("external_gateway_tokens")
        .select("token")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.token) {
        setToken(data.token);
      } else {
        const newTok = generateToken();
        const { error } = await (supabase as any)
          .from("external_gateway_tokens")
          .insert({ user_id: user.id, token: newTok });
        if (!error) setToken(newTok);
      }
      setLoading(false);
    })();
  }, []);

  const url = token ? `${SUPABASE_URL}/functions/v1/external-gateway-webhook?token=${token}` : "";

  const copy = () => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada", description: "Cole no painel da sua plataforma de pagamento." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-5 h-5" /> Receber vendas de plataformas externas
        </CardTitle>
        <CardDescription>
          Use esta URL única para registrar vendas feitas em qualquer plataforma de pagamento externa.
          Cole no campo de webhook (notificação/postback) do painel da plataforma. Os valores vão aparecer
          em <strong>Pix Gerado</strong> e <strong>Venda Aprovada</strong> no painel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Gerando URL...
          </div>
        ) : url ? (
          <div className="flex gap-2">
            <Input readOnly value={url} className="font-mono text-xs" />
            <Button onClick={copy} variant="outline" size="icon"><Copy className="w-4 h-4" /></Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Faça login para gerar sua URL.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Compatível com Hotmart, Kiwify, Eduzz, Cakto, Monetizze, Braip, Yampi e qualquer plataforma
          que envie notificações por webhook (POST com JSON).
        </p>
      </CardContent>
    </Card>
  );
}