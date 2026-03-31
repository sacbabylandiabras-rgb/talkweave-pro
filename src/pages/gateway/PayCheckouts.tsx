import { useState, useEffect } from "react";
import { Plus, Copy, Trash2, Edit, Loader2, Globe, Save, CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Checkout {
  id: string;
  name: string;
  format: string;
  status: boolean;
  slug: string | null;
  visits: number;
  conversions: number;
  product_id: string | null;
  product_name?: string;
}

export default function PayCheckouts() {
  const navigate = useNavigate();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainOpen, setDomainOpen] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [domainPrefix, setDomainPrefix] = useState("pay");
  const [savedDomain, setSavedDomain] = useState<string | null>(null);
  const [savedPrefix, setSavedPrefix] = useState("pay");
  const [domainStatus, setDomainStatus] = useState<"idle" | "checking" | "active" | "pending">("idle");
  const [domainLoading, setDomainLoading] = useState(false);

  const loadDomainFromLocalStorage = () => {
    const lsDomain = localStorage.getItem("checkout_custom_domain");
    const lsPrefix = localStorage.getItem("checkout_domain_prefix") || "pay";
    const lsRoot = localStorage.getItem("checkout_domain_root") || "";

    if (lsDomain) {
      setSavedDomain(lsDomain);
      setSavedPrefix(lsPrefix);
      setCustomDomain(lsRoot);
      setDomainPrefix(lsPrefix);
      checkDomainStatus(lsDomain);
      return true;
    }

    return false;
  };

  const fetchData = async () => {
    const [ckRes, prodRes] = await Promise.all([
      supabase.from("gateway_checkouts" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("gateway_products" as any).select("id, name").order("name"),
    ]);
    const prods = (prodRes.data || []) as any[];
    const cks = ((ckRes.data || []) as any[]).map((ck: any) => ({
      ...ck,
      product_name: prods.find((p: any) => p.id === ck.product_id)?.name || "—",
    }));
    setCheckouts(cks);
    setLoading(false);
  };

  const fetchDomainFromDB = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      loadDomainFromLocalStorage();
      return;
    }

    try {
      const { data } = await supabase.from("profiles").select("custom_domain, domain_prefix").eq("id", user.id).single();
      if (data) {
        const cd = (data as any).custom_domain;
        const dp = (data as any).domain_prefix || "pay";
        if (cd) {
          setSavedDomain(cd);
          setSavedPrefix(dp);
          setCustomDomain(cd.replace(`${dp}.`, ""));
          setDomainPrefix(dp);
          checkDomainStatus(cd);
          return;
        }
      }
    } catch {
      // columns may not exist yet
    }

    loadDomainFromLocalStorage();
  };

  useEffect(() => {
    fetchData();
    fetchDomainFromDB();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchDomainFromDB();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (domainOpen && savedDomain) {
      checkDomainStatus(savedDomain);
    }
  }, [domainOpen]);

  const checkDomainStatus = async (domain: string) => {
    if (!domain) { setDomainStatus("idle"); return; }
    setDomainStatus("checking");
    try {
      // Try fetching the domain to see if Worker proxy is active
      const res = await fetch(`https://${domain}/`, { method: "HEAD", mode: "no-cors" });
      setDomainStatus("active");
    } catch {
      // Fallback: check DNS resolution
      try {
        const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
        const data = await dnsRes.json();
        const hasRecords = (data.Answer || []).length > 0;
        setDomainStatus(hasRecords ? "active" : "pending");
      } catch {
        setDomainStatus("pending");
      }
    }
  };

  const saveDomain = async () => {
    setDomainLoading(true);
    const cleaned = customDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/^(pay\.|checkout\.)/, "");
    setCustomDomain(cleaned);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDomainLoading(false); return; }

    if (cleaned) {
      const fullDomain = `${domainPrefix}.${cleaned}`;
      // Save to DB
      await supabase.from("profiles").update({
        custom_domain: fullDomain,
        domain_prefix: domainPrefix,
      } as any).eq("id", user.id);
      // Also save to localStorage as fallback
      localStorage.setItem("checkout_custom_domain", fullDomain);
      localStorage.setItem("checkout_domain_prefix", domainPrefix);
      localStorage.setItem("checkout_domain_root", cleaned);
      setSavedDomain(fullDomain);
      setSavedPrefix(domainPrefix);
      checkDomainStatus(fullDomain);
      toast.success("Domínio salvo!");
    } else {
      toast.error("Informe um domínio válido");
    }
    setDomainLoading(false);
  };

  const deleteDomain = async () => {
    setDomainLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDomainLoading(false); return; }

    await supabase.from("profiles").update({
      custom_domain: null,
      domain_prefix: "pay",
    } as any).eq("id", user.id);
    // Clear localStorage fallback
    localStorage.removeItem("checkout_custom_domain");
    localStorage.removeItem("checkout_domain_prefix");
    localStorage.removeItem("checkout_domain_root");

    setSavedDomain(null);
    setSavedPrefix("pay");
    setCustomDomain("");
    setDomainPrefix("pay");
    setDomainStatus("idle");
    setDomainOpen(false);
    toast.success("Domínio removido!");
    setDomainLoading(false);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await supabase.from("gateway_checkouts" as any).update({ status: !current } as any).eq("id", id);
    fetchData();
  };

  const deleteCheckout = async (id: string) => {
    await supabase.from("gateway_checkouts" as any).delete().eq("id", id);
    toast.success("Checkout removido");
    fetchData();
  };

  const totalVisits = checkouts.reduce((a, c) => a + (c.visits || 0), 0);
  const totalConversions = checkouts.reduce((a, c) => a + (c.conversions || 0), 0);
  const avgConversion = totalVisits > 0 ? ((totalConversions / totalVisits) * 100).toFixed(1) : "0";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Checkouts</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie seus checkouts de pagamento</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full px-4 gap-2"
            onClick={() => setDomainOpen(true)}
          >
            <Globe className="w-4 h-4" />
            Domínio
            {savedDomain && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
            )}
          </Button>
          <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full px-6" onClick={() => navigate("/gateway-checkout/checkouts/new")}>
            <Plus className="w-4 h-4 mr-2" /> Novo Checkout
          </Button>
        </div>
      </div>

      {/* Saved domain banner */}
      {savedDomain && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground font-medium">{savedDomain}</span>
            {domainStatus === "active" && <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">Ativo</Badge>}
            {domainStatus === "pending" && <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">Pendente</Badge>}
            {domainStatus === "checking" && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => checkDomainStatus(savedDomain)}>
              <RefreshCw className={`w-3 h-3 ${domainStatus === "checking" ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDomainOpen(true)}>
              <Edit className="w-3 h-3 mr-1" /> Editar
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Checkouts", value: String(checkouts.length) },
          { label: "Visitas Totais", value: totalVisits.toLocaleString("pt-BR") },
          { label: "Conversão Média", value: `${avgConversion}%` },
        ].map(c => (
          <Card key={c.label} className="border-[#2A2A2A]">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {checkouts.length === 0 ? (
        <Card className="border-[#2A2A2A]">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Nenhum checkout criado ainda. Clique em "Novo Checkout" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#2A2A2A]">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A]">
                  <TableHead>Nome</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Conversão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkouts.map(ck => {
                  const conversion = ck.visits > 0 ? (((ck.conversions || 0) / ck.visits) * 100).toFixed(1) : "0.0";
                  return (
                    <TableRow key={ck.id} className="border-[#2A2A2A]">
                      <TableCell className="font-medium">{ck.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{ck.product_name}</TableCell>
                      <TableCell className="text-sm">{ck.format === "one_step" ? "One Step" : ck.format === "multi_step" ? "Multi Step" : ck.format === "full_page" ? "Página Completa" : ck.format === "modal" ? "Modal" : ck.format === "inline" ? "Inline" : ck.format}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${parseFloat(conversion) > 40 ? 'text-emerald-400' : 'text-amber-400'}`}>{conversion}%</span>
                      </TableCell>
                      <TableCell><Switch checked={ck.status} onCheckedChange={() => toggleStatus(ck.id, ck.status)} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/gateway-checkout/checkouts/edit/${ck.id}`)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const defaultLink = `https://talkweave-pro.lovable.app/pay/${ck.slug || ck.id}`; if (savedDomain) { const customLink = `https://${savedDomain}/${ck.slug || ck.id}`; navigator.clipboard.writeText(`${customLink}\n${defaultLink}`); toast.success("Links copiados! (personalizado + padrão)"); } else { navigator.clipboard.writeText(defaultLink); toast.success("Link copiado!"); } }}><Copy className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCheckout(ck.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Domain Dialog */}
      <Dialog open={domainOpen} onOpenChange={setDomainOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" /> Domínio Personalizado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure um domínio próprio para todos os seus checkouts.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Subdomínio</label>
              <div className="flex gap-2">
                <Button
                  variant={domainPrefix === "pay" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setDomainPrefix("pay")}
                >
                  pay.
                </Button>
                <Button
                  variant={domainPrefix === "checkout" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setDomainPrefix("checkout")}
                >
                  checkout.
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Domínio raiz</label>
              <div className="flex gap-2">
                <Input
                  placeholder="seusite.com"
                  value={customDomain}
                  onChange={e => setCustomDomain(e.target.value)}
                />
                <Button size="sm" onClick={saveDomain} disabled={domainLoading}>
                  {domainLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Salvar</>}
                </Button>
              </div>
              {customDomain && (
                <p className="text-[11px] text-muted-foreground">
                  Seu link ficará: <code className="bg-muted px-1 rounded">https://{domainPrefix}.{customDomain.replace(/^(pay\.|checkout\.)/, "")}/pay/seu-produto</code>
                </p>
              )}
            </div>

            {/* Status */}
            {savedDomain && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  {domainStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {domainStatus === "active" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {domainStatus === "pending" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                  <div>
                    <p className="text-sm font-medium">{savedDomain}</p>
                    <p className="text-xs text-muted-foreground">
                      {domainStatus === "checking" && "Verificando DNS..."}
                      {domainStatus === "active" && "DNS apontando corretamente"}
                      {domainStatus === "pending" && "DNS ainda não propagado"}
                      {domainStatus === "idle" && "Salve para verificar"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {domainStatus === "active" ? (
                    <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Ativo</Badge>
                  ) : domainStatus === "pending" ? (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30">Pendente</Badge>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => checkDomainStatus(savedDomain)}>
                    <RefreshCw className={`w-3.5 h-3.5 ${domainStatus === "checking" ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            )}

            {/* Delete domain button */}
            {savedDomain && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-2"
                onClick={deleteDomain}
                disabled={domainLoading}
              >
                {domainLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Excluir Domínio</>}
              </Button>
            )}

            {/* Setup Instructions */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs font-semibold text-foreground">📋 Como configurar (Vercel)</p>
              
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">1. Configure o DNS</p>
                <p className="text-[11px] text-muted-foreground">
                  No provedor DNS do seu domínio, adicione o registro adequado:
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="grid grid-cols-[50px_70px_1fr] gap-2 items-center">
                    <span className="font-semibold text-foreground">Tipo</span>
                    <span className="font-semibold text-foreground">Nome</span>
                    <span className="font-semibold text-foreground">Conteúdo</span>
                  </div>
                  <div className="grid grid-cols-[50px_70px_1fr] gap-2 items-center">
                    <span className="text-muted-foreground">CNAME</span>
                    <span className="text-muted-foreground">{domainPrefix}</span>
                    <div className="flex items-center gap-1">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-foreground text-[11px]">cname.vercel-dns.com</code>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText("cname.vercel-dns.com"); toast.success("Copiado!"); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[50px_70px_1fr] gap-2 items-center">
                    <span className="text-muted-foreground">A</span>
                    <span className="text-muted-foreground">@</span>
                    <div className="flex items-center gap-1">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-foreground text-[11px]">76.76.21.21</code>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText("76.76.21.21"); toast.success("Copiado!"); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Use CNAME para subdomínios (ex: pay.dominio.com) ou A para domínio raiz.</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">2. Ative o domínio</p>
                <p className="text-[11px] text-muted-foreground">
                  Após configurar o DNS, clique em <strong>Salvar</strong> acima. O domínio será registrado automaticamente no Vercel com SSL.
                </p>
              </div>

              <p className="text-[10px] text-muted-foreground mt-1">
                ⏱ A propagação DNS pode levar alguns minutos. Use o botão "Atualizar" para verificar.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
