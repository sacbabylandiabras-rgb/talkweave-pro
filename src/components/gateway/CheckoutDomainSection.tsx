import { useState, useEffect } from "react";
import { Copy, RefreshCw, Loader2, AlertTriangle, Globe, CheckCircle2, XCircle, Trash2, Lock, ShieldCheck, Shield, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function CheckoutDomainSection() {
  const [customDomain, setCustomDomain] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [pathPrefix, setPathPrefix] = useState(() => localStorage.getItem("checkout_path_prefix") || "pay");
  const [domainSaving, setDomainSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [domainDeleting, setDomainDeleting] = useState(false);
  const [domainStatus, setDomainStatus] = useState<"none" | "pending" | "active" | "error">("none");
  const [domainSslStatus, setDomainSslStatus] = useState<string>("");
  const [domainVerification, setDomainVerification] = useState<any>(null);
  const [sslInfo, setSslInfo] = useState<any>(null);
  const [emailVerification, setEmailVerification] = useState<any>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  useEffect(() => {
    fetchDomainStatus();
  }, []);

  const fetchDomainStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let domain = "";
    try {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      domain = (prof as any)?.custom_domain || "";
    } catch {}
    if (!domain) {
      domain = localStorage.getItem("checkout_custom_domain") || "";
    }
    
    setCustomDomain(domain);
    if (!domain) return;
    
    setDomainStatus("pending");
    setStatusChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "status", hostname: domain },
      });
      if (error) throw error;
      if (data?.status === "active") {
        setDomainStatus("active");
      } else if (data?.status === "not_found") {
        setDomainStatus("none");
      } else {
        setDomainStatus("pending");
      }
      setDomainSslStatus(data?.ssl_status || "");
      setDomainVerification(data?.verification || null);
      setSslInfo(data?.ssl || null);
      setEmailVerification(data?.email_verification || null);
      if (data?.email_verification?.hostname) {
        setEmailDomain(data.email_verification.hostname);
      }
    } catch (err) {
      console.error("Error checking domain status:", err);
      setDomainStatus("pending");
    }
    setStatusChecking(false);
  };

  const handleSaveDomain = async () => {
    const domain = customDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!domain) {
      handleDeleteDomain();
      return;
    }
    setDomainSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "create", hostname: domain },
      });
      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }
      const savedDomain = data.hostname || domain;
      setCustomDomain(savedDomain);
      localStorage.setItem("checkout_custom_domain", savedDomain);
      setDomainStatus("pending");
      setDomainSslStatus(data.ssl_status || "");
      setDomainVerification(data.verification || null);
      toast.success("Domínio do checkout registrado!");
      fetchDomainStatus();
    } catch (err: any) {
      console.error("Domain error:", err);
      toast.error("Erro: " + (err.message || "Falha ao registrar domínio"));
      setDomainStatus("error");
    }
    setDomainSaving(false);
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
    } catch (err: any) {
      toast.error("Erro ao registrar e-mail: " + err.message);
    }
    setEmailSaving(false);
  };


  const handleDeleteDomain = async () => {
    setDomainDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "delete", hostname: customDomain },
      });
      if (error) throw error;
      setCustomDomain("");
      setDomainStatus("none");
      setDomainVerification(null);
      toast.success("Domínio removido");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
    setDomainDeleting(false);
  };

  const handleRefreshDomainStatus = async () => {
    await fetchDomainStatus();
    toast.success("Status atualizado!");
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copiado!");
  };

  const formatSslExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(typeof dateStr === "number" ? dateStr : dateStr);
      const now = new Date();
      const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        formatted: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        daysLeft: diffDays,
        isExpiringSoon: diffDays < 30,
        isExpired: diffDays < 0,
      };
    } catch { return null; }
  };

  return (
    <Card className="border-[#2A2A2A]">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#a78bfa]" />
          Domínio Personalizado
        </CardTitle>
        <CardDescription className="text-xs">
          Use seu próprio domínio para os links de checkout (ex: pay.seusite.com)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Domínio do Checkout</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              placeholder="pay.seusite.com"
              className="font-mono text-xs"
              disabled={domainStatus === "active" || domainStatus === "pending"}
            />
            {domainStatus === "none" || domainStatus === "error" ? (
              <Button
                className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-5 text-xs"
                onClick={handleSaveDomain}
                disabled={domainSaving || !customDomain.trim()}
              >
                {domainSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Ativar
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefreshDomainStatus} disabled={statusChecking} title="Atualizar status">
                  {statusChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={handleDeleteDomain} disabled={domainDeleting} title="Remover domínio">
                  {domainDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            <strong>Exemplo:</strong> <code>pay.seusite.com</code> ou <code>checkout.seusite.com</code>. Não inclua http:// ou https://.
          </p>

        </div>

        <div>
          <Label className="text-xs">Prefixo da URL</Label>
          <Select
            value={pathPrefix}
            onValueChange={(v) => {
              setPathPrefix(v);
              localStorage.setItem("checkout_path_prefix", v);
            }}
          >
            <SelectTrigger className="w-full mt-1 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pay">/{`pay`}/slug</SelectItem>
              <SelectItem value="checkout">/{`checkout`}/slug</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Escolha se os links usarão /pay/ ou /checkout/ como caminho.
          </p>
        </div>

        {domainStatus !== "none" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-[#2A2A2A] bg-muted/30">
              {domainStatus === "active" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : domainStatus === "error" ? (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-xs font-medium">
                  {domainStatus === "active" ? "Domínio verificado" : domainStatus === "error" ? "Erro na configuração" : "Verificando domínio..."}
                </p>
                <p className="text-[10px] text-muted-foreground">{customDomain}</p>
              </div>
              <Badge variant="outline" className={`text-[10px] ${
                domainStatus === "active" ? "border-emerald-500/30 text-emerald-400" :
                domainStatus === "error" ? "border-destructive/30 text-destructive" :
                "border-amber-500/30 text-amber-400"
              }`}>
                {domainStatus === "active" ? "Verificado" : domainStatus === "error" ? "Erro" : "Pendente"}
              </Badge>
            </div>

            <Card className="border-[#2A2A2A] bg-muted/20">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#a78bfa]" />
                  <p className="text-xs font-medium text-foreground">Certificado SSL</p>
                  {statusChecking && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Status</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {domainSslStatus === "active" ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      ) : domainSslStatus === "provisioning" ? (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-medium">
                        {domainSslStatus === "active" ? "Ativo" : domainSslStatus === "provisioning" ? "Provisionando" : "Pendente"}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">HTTPS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {sslInfo?.https_reachable ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                      )}
                      <span className="text-xs font-medium">
                        {sslInfo?.https_reachable ? "Acessível" : "Inacessível"}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Emissor</span>
                    </div>
                    <span className="text-xs font-medium">
                      {sslInfo?.issuer || "—"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Expira em</span>
                    </div>
                    {(() => {
                      const expiry = formatSslExpiry(sslInfo?.expires_at);
                      if (!expiry) return <span className="text-xs font-medium">—</span>;
                      return (
                        <div>
                          <span className={`text-xs font-medium ${expiry.isExpired ? "text-destructive" : expiry.isExpiringSoon ? "text-amber-400" : ""}`}>
                            {expiry.formatted}
                          </span>
                          <p className={`text-[10px] ${expiry.isExpired ? "text-destructive" : expiry.isExpiringSoon ? "text-amber-400" : "text-muted-foreground"}`}>
                            {expiry.isExpired ? "Expirado!" : `${expiry.daysLeft} dias restantes`}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded border border-emerald-500/10 bg-emerald-500/5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <p className="text-[10px] text-muted-foreground">Renovação automática via Let's Encrypt (Vercel)</p>
                </div>

                {sslInfo?.misconfigured && (
                  <div className="flex items-center gap-2 p-2 rounded border border-amber-500/20 bg-amber-500/5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <p className="text-[10px] text-amber-400">DNS pode estar mal configurado. Verifique os registros abaixo.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email Configuration Section */}
            <Card className="border-[#2A2A2A] bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#a78bfa]" />
                  Configuração de E-mail (DKIM & SPF)
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Configuração obrigatória para garantir que os e-mails de confirmação cheguem na caixa de entrada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50">
                  <div className="flex items-center gap-2">
                    {emailVerification?.status === "verified" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="text-xs font-medium">Status do E-mail</span>
                    {statusChecking && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={handleRefreshDomainStatus}
                      disabled={statusChecking}
                      title="Atualizar status do e-mail"
                    >
                      <RefreshCw className={`w-3 h-3 ${statusChecking ? 'animate-spin' : ''}`} />
                    </Button>
                    <Badge variant="outline" className={`text-[10px] ${
                      emailVerification?.status === "verified" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"
                    }`}>
                      {emailVerification?.status === "verified" ? "Verificado" : "Pendente"}
                    </Badge>
                  </div>
                </div>

                {emailVerification?.records && emailVerification.records.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded border border-blue-500/10 bg-blue-500/5">
                      <p className="text-[10px] text-blue-400">
                        <strong>Ação Necessária:</strong> Copie os registros abaixo e crie-os exatamente no seu DNS (Ex: Hostinger/Cloudflare).
                      </p>
                    </div>
                    <div className="space-y-3">
                      {emailVerification.records.map((record: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50 space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[9px] font-mono uppercase">{record.type}</Badge>
                              {record.priority && <Badge variant="outline" className="text-[9px]">Prioridade: {record.priority}</Badge>}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-muted-foreground font-mono">Host/Nome:</span>
                              <span className="text-[9px] font-mono text-foreground font-medium">{record.name}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 items-start">
                            <div className="flex-1 bg-muted/30 p-2 rounded text-[10px] font-mono break-all line-clamp-3 leading-relaxed border border-[#2A2A2A]">
                              {record.value}
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(record.value)}>
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-400">
                      Integração de e-mail pendente. Certifique-se de que a RESEND_API_KEY está configurada no servidor.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        <Card className="border-[#2A2A2A] bg-muted/20">
          <CardContent className="pt-4 pb-4 space-y-4">
            <p className="text-xs font-medium text-foreground">📋 Guia de Configuração Passo a Passo:</p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#a78bfa]/10 text-[#a78bfa] text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <div className="text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Aponte o Domínio (Site)</p>
                  <p className="mb-2">No seu provedor (Ex: Hostinger, Cloudflare), crie um registro <strong>CNAME</strong> para o seu subdomínio:</p>
                  <div className="bg-background border border-[#2A2A2A] rounded p-2 font-mono text-[10px] flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-muted-foreground">Host: pay (ou o seu subdomínio)</span>
                      <span>cname.vercel-dns.com</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard("cname.vercel-dns.com")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#a78bfa]/10 text-[#a78bfa] text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <div className="text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Configure o E-mail (DNS do Resend)</p>
                  <p className="mb-2">Adicione os registros <strong>DKIM</strong> e <strong>SPF</strong> que aparecerão na seção "Configuração de E-mail" acima. Isso garante que seus e-mails não caiam no SPAM. O sistema já enviou seu domínio para o Resend automaticamente.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#a78bfa]/10 text-[#a78bfa] text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <div className="text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Verificação</p>
                  <p className="mb-1">Após salvar no seu provedor, clique em <strong>"Ativar"</strong> acima. O SSL é provisionado automaticamente. A propagação pode levar de alguns minutos até 24h.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {customDomain && domainStatus !== "none" && (
          <div>
            <Label className="text-xs">Link de exemplo</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                readOnly
                value={`https://${customDomain}/${pathPrefix}/seu-checkout`}
                className="font-mono text-xs opacity-70"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(`https://${customDomain}/${pathPrefix}/seu-checkout`)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

