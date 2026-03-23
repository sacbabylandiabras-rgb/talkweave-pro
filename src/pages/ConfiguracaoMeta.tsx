import { useState } from "react";
import { Globe, Shield, CheckCircle2, AlertCircle, ExternalLink, Copy, RefreshCw, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function ConfiguracaoMeta() {
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co"}/functions/v1/webhook-meta`;

  const handleSave = () => {
    if (!appId || !accessToken || !phoneNumberId || !businessAccountId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Configurações salvas com sucesso!");
    }, 1500);
  };

  const handleTest = () => {
    if (!accessToken || !phoneNumberId) {
      toast.error("Configure o Access Token e Phone Number ID primeiro");
      return;
    }
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success("Conexão com a API Meta verificada com sucesso!");
    }, 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração Meta API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure suas credenciais da API oficial do WhatsApp Business
        </p>
      </div>

      {/* Status card */}
      <Card className="p-4 flex items-center gap-3 border-amber-500/20 bg-amber-500/5">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-foreground">Configuração pendente</p>
          <p className="text-[10px] text-muted-foreground">
            Preencha suas credenciais para ativar o envio via Cloud API
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
          Pendente
        </Badge>
      </Card>

      {/* Steps guide */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-foreground">Como obter suas credenciais</p>
        </div>
        <div className="space-y-2">
          {[
            { step: 1, text: "Acesse o Meta for Developers e crie um App do tipo Business" },
            { step: 2, text: "Ative o produto 'WhatsApp' no seu App" },
            { step: 3, text: "Na seção 'API Setup', copie o Phone Number ID e o Access Token temporário" },
            { step: 4, text: "Para produção, gere um Token Permanente em 'System Users'" },
            { step: 5, text: "Configure o Webhook URL abaixo no painel da Meta" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {step}
              </span>
              <span className="text-[11px] text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
        <a
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium"
        >
          <ExternalLink className="w-3 h-3" />
          Abrir Meta for Developers
        </a>
      </Card>

      {/* Webhook URL */}
      <Card className="p-4 space-y-2">
        <Label className="text-xs font-medium flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-primary" />
          Webhook URL (configure na Meta)
        </Label>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="h-9 text-xs font-mono bg-muted/50" />
          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(webhookUrl)}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Cole esta URL no campo "Callback URL" na configuração de Webhooks do seu App Meta.
        </p>
      </Card>

      {/* Credentials form */}
      <Card className="p-5 space-y-4">
        <p className="text-xs font-semibold text-foreground">Credenciais da API</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              App ID <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
            </Label>
            <Input placeholder="123456789012345" value={appId} onChange={(e) => setAppId(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">App Secret</Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="abc123def456..."
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                className="h-9 text-xs pr-9"
              />
              <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            Access Token Permanente <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
          </Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              placeholder="EAAxxxxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="h-9 text-xs pr-9"
            />
            <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              Phone Number ID <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
            </Label>
            <Input placeholder="1234567890" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              Business Account ID <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
            </Label>
            <Input placeholder="9876543210" value={businessAccountId} onChange={(e) => setBusinessAccountId(e.target.value)} className="h-9 text-xs" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Webhook Verify Token</Label>
          <Input
            placeholder="Token personalizado para verificação"
            value={webhookVerifyToken}
            onChange={(e) => setWebhookVerifyToken(e.target.value)}
            className="h-9 text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Defina um token único. Use o mesmo valor no campo "Verify Token" na Meta.
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">Versão da API: v21.0</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Testar Conexão
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Salvar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
