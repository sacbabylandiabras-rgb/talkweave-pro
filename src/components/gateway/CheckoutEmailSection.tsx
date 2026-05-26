import { useState, useEffect } from "react";
import { Copy, RefreshCw, Loader2, CheckCircle2, ShieldCheck, Clock, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function CheckoutEmailSection() {
  const [emailDomain, setEmailDomain] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailVerification, setEmailVerification] = useState<any>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  useEffect(() => {
    fetchEmailStatus();
  }, []);

  const fetchEmailStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setStatusChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "status" },
      });
      if (error) throw error;
      
      if (data?.email_verification) {
        setEmailVerification(data.email_verification);
        if (data.email_verification.hostname) {
          setEmailDomain(data.email_verification.hostname);
        }
      }
    } catch (err) {
      console.error("Error checking email status:", err);
    }
    setStatusChecking(false);
  };

  const handleSaveEmailDomain = async () => {
    const domain = emailDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!domain) {
      toast.error("Informe um domínio para o e-mail");
      return;
    }
    setEmailSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "create_email", hostname: domain },
      });
      if (error) throw error;
      setEmailVerification(data.email_verification);
      toast.success("Domínio de e-mail enviado para o Resend!");
      fetchEmailStatus();
    } catch (err: any) {
      toast.error("Erro ao registrar e-mail: " + err.message);
    }
    setEmailSaving(false);
  };

  const handleRefreshEmailStatus = async () => {
    await fetchEmailStatus();
    toast.success("Status do e-mail atualizado!");
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copiado!");
  };

  return (
    <Card className="border-[#2A2A2A]">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="w-4 h-4 text-[#a78bfa]" />
          Configuração de E-mail (Resend)
        </CardTitle>
        <CardDescription className="text-xs">
          Envie e-mails usando seu próprio domínio. Isso garante que seus e-mails não caiam no SPAM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Domínio do E-mail</Label>
          <div className="flex gap-2 mt-1">
            <Input 
              value={emailDomain}
              onChange={e => setEmailDomain(e.target.value)}
              placeholder="seusite.com"
              className="font-mono text-xs"
              disabled={emailVerification?.status === "verified"}
            />
            <Button 
              className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-5 text-xs"
              onClick={handleSaveEmailDomain}
              disabled={emailSaving || !emailDomain.trim()}
            >
              {emailSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              {emailVerification?.status === "verified" ? "Registrado" : "Registrar"}
            </Button>
            {emailVerification && (
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleRefreshEmailStatus} disabled={statusChecking}>
                <RefreshCw className={`w-3.5 h-3.5 ${statusChecking ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            <strong>Exemplo:</strong> <code>seusite.com</code>. Não use subdomínios a menos que queira enviar de um subdomínio específico.
          </p>
        </div>

        {emailVerification && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-[#2A2A2A] bg-muted/30">
              <div className="flex items-center gap-2">
                {emailVerification?.status === "verified" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
                <div>
                  <p className="text-xs font-medium">Status do E-mail</p>
                  <p className="text-[10px] text-muted-foreground">{emailDomain}</p>
                </div>
              </div>
              <Badge variant="outline" className={`text-[10px] ${
                emailVerification?.status === "verified" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"
              }`}>
                {emailVerification?.status === "verified" ? "Verificado" : "Pendente"}
              </Badge>
            </div>

            {emailVerification?.records && emailVerification.records.length > 0 && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-blue-500/10 bg-blue-500/5">
                  <p className="text-[11px] text-blue-400 font-medium mb-1">
                    Ação Necessária: Configuração de DNS
                  </p>
                  <p className="text-[10px] text-blue-400/80">
                    Adicione os registros abaixo no painel DNS do seu domínio (ex: Hostinger, Cloudflare).
                  </p>
                </div>
                
                <div className="space-y-3">
                  {emailVerification.records.map((record: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-[#2A2A2A] bg-muted/20 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[9px] font-mono uppercase">{record.type}</Badge>
                          {record.priority && <Badge variant="outline" className="text-[9px]">Prioridade: {record.priority}</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground">Nome/Host:</span>
                          <code className="text-[9px] font-mono text-primary font-bold">{record.name}</code>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(record.name)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 bg-background/50 p-2.5 rounded text-[10px] font-mono break-all leading-relaxed border border-[#2A2A2A] min-h-[40px]">
                          {record.value}
                        </div>
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(record.value)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Card className="border-[#2A2A2A] bg-muted/20">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-xs font-medium text-foreground">📋 Guia Rápido:</p>
            <ul className="space-y-2">
              <li className="flex gap-2 text-[11px] text-muted-foreground">
                <span className="font-bold text-primary">1.</span>
                <span>Copie cada registro acima (Tipo, Nome e Valor).</span>
              </li>
              <li className="flex gap-2 text-[11px] text-muted-foreground">
                <span className="font-bold text-primary">2.</span>
                <span>Vá ao seu provedor de domínio e adicione-os na zona DNS.</span>
              </li>
              <li className="flex gap-2 text-[11px] text-muted-foreground">
                <span className="font-bold text-primary">3.</span>
                <span>Aguarde alguns minutos e clique no botão de atualizar status.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
