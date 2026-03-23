import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MetaApiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetaApiDialog({ open, onOpenChange }: MetaApiDialogProps) {
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!appId || !accessToken || !phoneNumberId || !businessAccountId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    // Simulate save — replace with actual Supabase logic
    setTimeout(() => {
      setSaving(false);
      toast.success("Credenciais da API Meta salvas com sucesso!");
      onOpenChange(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0668E1]/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0668E1]" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.2A1.25 1.25 0 003.8 21.454l3.032-.892A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-3.97 7.47l.6-.003c.2 0 .37.003.54.41.2.48.63 1.54.69 1.65.06.11.1.25.02.4-.08.15-.12.25-.24.38-.12.13-.25.3-.36.4-.12.12-.24.25-.1.48.14.24.61 1.01 1.32 1.63.91.8 1.68 1.05 1.92 1.17.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.38.65 1.62.77.24.12.4.18.46.28.06.1.06.56-.12 1.1-.18.54-1.06 1.04-1.46 1.1-.38.06-.74.09-2.4-.5-2.01-.72-3.27-2.76-3.37-2.89-.1-.13-.8-1.06-.8-2.02 0-.96.5-1.44.69-1.63.18-.2.4-.24.53-.24z"/>
              </svg>
            </div>
            <div>
              <DialogTitle className="text-base">API Oficial do WhatsApp (Meta)</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Conecte sua conta Business para envios em massa
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Shield className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Suas credenciais são armazenadas de forma segura e criptografada.
          </p>
        </div>

        <Separator />

        {/* Steps guide */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Como obter as credenciais:</p>
          <div className="space-y-1.5">
            {[
              { step: 1, text: "Acesse o Meta for Developers e crie um App" },
              { step: 2, text: "Ative o produto WhatsApp Business no App" },
              { step: 3, text: "Copie o App ID, App Secret e Access Token" },
              { step: 4, text: "Copie o Phone Number ID e Business Account ID" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-2">
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
        </div>

        <Separator />

        {/* Form fields */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              App ID <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
            </Label>
            <Input
              placeholder="Ex: 123456789012345"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">App Secret</Label>
            <Input
              type="password"
              placeholder="Ex: abc123def456..."
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              Access Token Permanente <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
            </Label>
            <Input
              type="password"
              placeholder="EAAxxxxxxx..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                Phone Number ID <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
              </Label>
              <Input
                placeholder="Ex: 1234567890"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                Business Account ID <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Obrigatório</Badge>
              </Label>
              <Input
                placeholder="Ex: 9876543210"
                value={businessAccountId}
                onChange={(e) => setBusinessAccountId(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Webhook Verify Token</Label>
            <Input
              placeholder="Token personalizado para verificação do webhook"
              value={webhookVerifyToken}
              onChange={(e) => setWebhookVerifyToken(e.target.value)}
              className="h-9 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Defina um token único para validar as requisições do webhook da Meta.
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] text-muted-foreground">Versão da API: v21.0</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Conectar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
