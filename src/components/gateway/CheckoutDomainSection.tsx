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
  const [pathPrefix, setPathPrefix] = useState(() => localStorage.getItem("checkout_path_prefix") || "pay");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainDeleting, setDomainDeleting] = useState(false);
  const [domainStatus, setDomainStatus] = useState<"none" | "pending" | "active" | "error">("none");
  const [domainSslStatus, setDomainSslStatus] = useState<string>("");
  const [domainVerification, setDomainVerification] = useState<any>(null);
  const [sslInfo, setSslInfo] = useState<any>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  useEffect(() => {
    fetchDomainStatus();
  }, []);

  const fetchDomainStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let domain = "";
    try {
      const { data: prof } = await supabase.from("profiles").select("custom_domain").eq("id", user.id).single();
      domain = prof?.custom_domain || "";
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
          Domínio da URL de Checkout
        </CardTitle>
        <CardDescription className="text-xs">
          Personalize o endereço onde seus clientes realizam o pagamento.
        </CardDescription>

      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <Label className="text-xs">Domínio do Checkout</Label>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-[#2A2A2A]">
              Recomendado: <span className="text-[#a78bfa] font-medium">pay</span> ou <span className="text-[#a78bfa] font-medium">checkout</span>
            </span>
          </div>
          <div className="flex gap-2">
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
        </div>

        {domainStatus !== "none" && (
          <div className="space-y-4">
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
                <p className="text-[10px] text-muted-foreground font-mono">{customDomain}</p>
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50 text-center">
                    <span className="text-[9px] text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">Status SSL</span>
                    <span className={`text-xs font-bold ${domainSslStatus === "active" ? "text-emerald-400" : "text-amber-400"}`}>
                      {domainSslStatus === "active" ? "Ativo" : domainSslStatus === "provisioning" ? "Provisionando" : "Pendente"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#2A2A2A] bg-background/50 text-center">
                    <span className="text-[9px] text-muted-foreground block mb-1 uppercase tracking-wider font-semibold">HTTPS</span>
                    <span className={`text-xs font-bold ${sslInfo?.https_reachable ? "text-emerald-400" : "text-destructive"}`}>
                      {sslInfo?.https_reachable ? "Sim" : "Não"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded border border-emerald-500/10 bg-emerald-500/5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <p className="text-[10px] text-muted-foreground">SSL gerenciado automaticamente.</p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#a78bfa]/10 text-[#a78bfa] text-[10px]">1</span>
                Acesse o seu provedor de DNS
              </h4>
              <p className="text-[10px] text-muted-foreground px-7">
                Vá até a Hostinger, GoDaddy, Cloudflare ou onde seu domínio está registrado.
              </p>

              <h4 className="text-xs font-semibold flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#a78bfa]/10 text-[#a78bfa] text-[10px]">2</span>
                Adicione o seguinte registro CNAME
              </h4>
              
              <div className="px-7 space-y-3">
                <div className="bg-background border border-[#2A2A2A] rounded p-3 font-mono text-[10px] space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-[#2A2A2A]">
                    <span className="text-muted-foreground uppercase">Tipo</span>
                    <span className="font-bold text-primary">CNAME</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#2A2A2A]">
                    <span className="text-muted-foreground uppercase">Nome/Host</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">
                        {customDomain ? (customDomain.split('.').length > 2 ? customDomain.split('.')[0] : (customDomain.split('.')[0] === "www" ? "www" : customDomain.split('.')[0])) : "pay"}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        const host = customDomain ? (customDomain.split('.').length > 2 ? customDomain.split('.')[0] : customDomain.split('.')[0]) : "pay";
                        copyToClipboard(host);
                      }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-start pt-1">
                    <span className="text-[9px] text-muted-foreground italic font-medium text-[#a78bfa]">
                      Apenas o prefixo (ex: {customDomain.split('.')[0] || "pay"})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground uppercase">Valor</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">cname.vercel-dns.com</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard("cname.vercel-dns.com")}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded border border-amber-500/10 bg-amber-500/5 flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <strong>Atenção:</strong> O campo "Nome/Host" deve ser preenchido <strong>apenas</strong> com o subdomínio (ex: <code>{customDomain.split('.')[0] || "pay"}</code>). Não coloque o seu domínio completo aqui.
                  </p>
                </div>
              </div>

              <h4 className="text-xs font-semibold flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#a78bfa]/10 text-[#a78bfa] text-[10px]">3</span>
                Aguarde a propagação
              </h4>
              <p className="text-[10px] text-muted-foreground px-7 italic">
                A verificação pode levar de alguns minutos até 24 horas. Clique no botão de atualizar acima para checar o status.
              </p>
            </div>
          </div>
        )}

        {customDomain && domainStatus === "active" && (
          <div>
            <Label className="text-xs">Exemplo de Link</Label>
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
