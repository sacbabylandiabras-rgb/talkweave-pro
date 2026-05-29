import { useState, useEffect } from "react";
import { Copy, RefreshCw, Loader2, CheckCircle2, ShieldCheck, Clock, Mail, AlertTriangle, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


export default function CheckoutEmailSection() {
  const [emailDomain, setEmailDomain] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [senderSaving, setSenderSaving] = useState(false);
  const [emailVerification, setEmailVerification] = useState<any>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  useEffect(() => {
    fetchProfileAndStatus();
  }, []);

  const fetchProfileAndStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Fetch profile for sender info
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profile) {
      setSenderName((profile as any).email_sender_name || "");
      setSenderEmail((profile as any).email_sender_address || "");
    }


    fetchEmailStatus();
  };

  const fetchEmailStatus = async (domain?: string) => {
    setStatusChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "email_status", hostname: domain || emailDomain },
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
      toast.success("Domínio de e-mail registrado!");
      fetchEmailStatus(domain);
    } catch (err: any) {
      toast.error("Erro ao registrar e-mail: " + err.message);
    }
    setEmailSaving(false);
  };

  const handleSaveSenderInfo = async () => {
    setSenderSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase.from("profiles").update({
        email_sender_name: senderName,
        email_sender_address: senderEmail,
      } as any).eq("id", user.id);

      
      if (error) throw error;
      toast.success("Informações de remetente salvas!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
    setSenderSaving(false);
  };

  const handleRefreshEmailStatus = async () => {
    await fetchEmailStatus();
    toast.success("Status do e-mail atualizado!");
  };

  const handleVerifyEmailDNS = async () => {
    setStatusChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "verify_email", hostname: emailDomain },
      });
      if (error) throw error;
      
      if (data?.email_verification) {
        setEmailVerification(data.email_verification);
        if (data.email_verification.status === "verified") {
          toast.success("Domínio verificado com sucesso!");
        } else if (data.error) {
          toast.error(`Erro: ${data.error}`);
        } else {
          toast.info("DNS ainda não propagado ou registros incorretos. Verifique no seu provedor.");
        }
      }
    } catch (err: any) {
      toast.error("Erro ao verificar DNS: " + err.message);
    }
    setStatusChecking(false);
  };

  const handleDeleteEmailDomain = async () => {
    if (!emailDomain) return;
    
    if (!confirm(`Tem certeza que deseja remover o domínio ${emailDomain}? Isso interromperá os envios de e-mail.`)) {
      return;
    }

    setEmailSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "delete_email", hostname: emailDomain },
      });
      
      if (error) throw error;
      
      setEmailDomain("");
      setEmailVerification(null);
      toast.success("Domínio de e-mail removido com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao remover domínio: " + err.message);
    }
    setEmailSaving(false);
  };



  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#a78bfa]" />
            Configuração de Remetente
          </CardTitle>
          <CardDescription className="text-xs">
            Defina como os e-mails aparecerão para seus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Remetente</Label>
              <Input 
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                placeholder="Ex: Equipe de Suporte"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail do Remetente</Label>
              <Input 
                value={senderEmail}
                onChange={e => setSenderEmail(e.target.value)}
                placeholder="Ex: contato@seudominio.com"
                className="text-xs font-mono"
              />
            </div>
          </div>
          <Button 
            variant="outline"
            className="w-full text-xs h-8"
            onClick={handleSaveSenderInfo}
            disabled={senderSaving}
          >
            {senderSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
            Salvar Dados do Remetente
          </Button>
          <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
            <strong>Dica:</strong> O e-mail do remetente deve pertencer ao domínio verificado abaixo para evitar que caia no SPAM.
          </p>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#a78bfa]" />
            Autenticação de Domínio (Zaplynx)
          </CardTitle>
          <CardDescription className="text-xs">
            Configure o DKIM e SPF para garantir a entrega dos e-mails pela Zaplynx.
          </CardDescription>

        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Domínio para Disparo</Label>
            <div className="flex gap-2 mt-1">
              <Input 
                value={emailDomain}
                onChange={e => setEmailDomain(e.target.value)}
                placeholder="seusite.com"
                className="font-mono text-xs"
                disabled={emailVerification?.status === "verified"}
              />
              <Button 
                className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-5 text-xs h-9"
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
              <strong>Importante:</strong> Use o domínio raiz (ex: <code>seusite.com</code>) ou um subdomínio específico para e-mails.
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
                    <p className="text-xs font-medium">Status de Verificação</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{emailDomain}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] ${
                  emailVerification?.status === "verified" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"
                }`}>
                  {emailVerification?.status === "verified" ? "Verificado" : "Aguardando DNS"}
                </Badge>
              </div>

              {emailVerification?.records && emailVerification.records.length > 0 && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-blue-500/10 bg-blue-500/5 flex flex-col gap-3">
                    <div>
                      <p className="text-[11px] text-blue-400 font-medium mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Configuração de DNS Necessária
                      </p>
                      <p className="text-[10px] text-blue-400/80">
                        Adicione os registros abaixo no seu provedor de domínio (Cloudflare, GoDaddy, etc) para validar o envio.
                      </p>
                      <p className="text-[10px] text-blue-400/80 mt-1">
                        <strong>Dica:</strong> Se o seu provedor de DNS já adiciona o domínio automaticamente, use apenas <code>resend._domainkey</code> como nome do registro DKIM.
                      </p>
                    </div>
                    
                    {emailVerification?.status !== "verified" && (
                      <Button 
                        onClick={handleVerifyEmailDNS} 
                        disabled={statusChecking}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs h-8"
                      >
                        {statusChecking ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <ShieldCheck className="w-3 h-3 mr-1.5" />}
                        Verificar DNS na Zaplynx
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-3">

                    {[
                      ...emailVerification.records,
                      {
                        type: "TXT",
                        name: "_dmarc",
                        value: "v=DMARC1; p=none;",
                        optional: true,
                      },
                    ].map((record: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg border border-[#2A2A2A] bg-muted/20 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[9px] font-mono uppercase">{record.type}</Badge>
                            {record.priority && <Badge variant="outline" className="text-[9px]">Prioridade: {record.priority}</Badge>}
                            {record.optional && <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground">Opcional</Badge>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-muted-foreground">Nome:</span>
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
        </CardContent>
      </Card>
    </div>
  );
}

