import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, User, MessageSquare, Users, Zap, CreditCard, Bot, Send, Link2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UserProfile } from "@/hooks/useAdminUsers";
import { isMobileZapiInstance } from "@/hooks/useZapiInstances";

interface Props {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function ViewUserAccountDialog({ user, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (open && user) fetchAll(user.id);
  }, [open, user]);

  const fetchAll = async (userId: string) => {
    setLoading(true);
    try {
      const [
        { data: instances },
        { data: contacts },
        { data: campaigns },
        { data: templates },
        { data: transactions },
        { data: autoResponses },
        { data: flowAutomations },
        { data: agentConfig },
        { data: welcomeConfig },
        { data: redirectLinks },
        { data: metaCreds },
        { data: kycData },
        { data: products },
      ] = await Promise.all([
        supabase.from("zapi_instances").select("*").eq("user_id", userId),
        supabase.from("saved_contacts").select("id, name, phone, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        supabase.from("campaigns").select("id, name, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("message_templates").select("id, name, category, type, usage_count, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("gateway_transactions").select("id, amount, status, payment_method, customer_name, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
        supabase.from("auto_responses").select("id, keyword, response, active").eq("user_id", userId),
        supabase.from("flow_automations").select("id, name, keyword, active, created_at").eq("user_id", userId),
        supabase.from("agent_config").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("welcome_message_config").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("redirect_links").select("id, name, slug, active, created_at").eq("user_id", userId),
        supabase.from("meta_credentials").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("gateway_kyc").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("gateway_products").select("id, name, price, type, status, category, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      ]);

      const visibleInstances = ((instances || []) as any[]).filter((instance) => !isMobileZapiInstance(instance));

      setData({
        instances: visibleInstances,
        contacts: contacts || [],
        campaigns: campaigns || [],
        templates: templates || [],
        transactions: transactions || [],
        autoResponses: autoResponses || [],
        flowAutomations: flowAutomations || [],
        agentConfig,
        welcomeConfig,
        redirectLinks: redirectLinks || [],
        metaCreds,
        kycData,
        products: products || [],
      });
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Conta de {user.full_name || user.email}
          </DialogTitle>
        </DialogHeader>

        {/* Profile summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Email</p>
            <p className="font-medium truncate">{user.email}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Assinatura</p>
            <Badge variant={user.subscription_status === "active" ? "default" : "secondary"} className="mt-0.5">
              {user.subscription_status}
            </Badge>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Tipo</p>
            <p className="font-medium">{user.roles.includes("admin") ? "Admin" : "Usuário"}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Cadastro</p>
            <p className="font-medium">{format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <Tabs defaultValue="instances" className="mt-2">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="instances" className="text-xs gap-1"><Zap className="w-3 h-3" />Instâncias ({data.instances.length})</TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs gap-1"><Users className="w-3 h-3" />Contatos ({data.contacts.length})</TabsTrigger>
              <TabsTrigger value="campaigns" className="text-xs gap-1"><Send className="w-3 h-3" />Campanhas ({data.campaigns.length})</TabsTrigger>
              <TabsTrigger value="templates" className="text-xs gap-1"><MessageSquare className="w-3 h-3" />Modelos ({data.templates.length})</TabsTrigger>
              <TabsTrigger value="products" className="text-xs gap-1"><Package className="w-3 h-3" />Produtos ({data.products.length})</TabsTrigger>
              <TabsTrigger value="transactions" className="text-xs gap-1"><CreditCard className="w-3 h-3" />Transações ({data.transactions.length})</TabsTrigger>
              <TabsTrigger value="automations" className="text-xs gap-1"><Bot className="w-3 h-3" />Automações</TabsTrigger>
              <TabsTrigger value="integrations" className="text-xs gap-1"><Link2 className="w-3 h-3" />Integrações</TabsTrigger>
            </TabsList>

            {/* Instances */}
            <TabsContent value="instances">
              {data.instances.length === 0 ? <EmptyState text="Nenhuma instância configurada" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Provider</TableHead><TableHead>Instance ID</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.instances.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.instance_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{i.api_provider}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{i.zapi_instance_id}</TableCell>
                        <TableCell><Badge variant={i.is_active ? "default" : "secondary"}>{i.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Contacts */}
            <TabsContent value="contacts">
              {data.contacts.length === 0 ? <EmptyState text="Nenhum contato salvo" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.contacts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Campaigns */}
            <TabsContent value="campaigns">
              {data.campaigns.length === 0 ? <EmptyState text="Nenhuma campanha criada" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.campaigns.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Templates */}
            <TabsContent value="templates">
              {data.templates.length === 0 ? <EmptyState text="Nenhum modelo criado" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Usos</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.templates.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-xs">{t.type || "texto"}</TableCell>
                        <TableCell className="text-xs">{t.category}</TableCell>
                        <TableCell>{t.usage_count || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Transactions */}
            <TabsContent value="transactions">
              {data.transactions.length === 0 ? <EmptyState text="Nenhuma transação" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Método</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.transactions.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="text-sm">{t.customer_name || "—"}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(t.amount)}</TableCell>
                        <TableCell className="text-xs uppercase">{t.payment_method}</TableCell>
                        <TableCell><Badge variant={t.status === "approved" ? "default" : "secondary"} className="text-[10px]">{t.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Automations */}
            <TabsContent value="automations" className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Agente IA</h3>
                {data.agentConfig ? (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">Nome:</span> {data.agentConfig.agent_name}</p>
                    <p><span className="text-muted-foreground">Ativo:</span> {data.agentConfig.active ? "✅ Sim" : "❌ Não"}</p>
                    <p className="text-xs text-muted-foreground truncate">Prompt: {data.agentConfig.system_prompt?.substring(0, 100)}...</p>
                  </div>
                ) : <EmptyState text="Agente IA não configurado" />}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Boas-Vindas</h3>
                {data.welcomeConfig ? (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">Ativo:</span> {data.welcomeConfig.active ? "✅ Sim" : "❌ Não"}</p>
                    <p className="text-xs">{data.welcomeConfig.message}</p>
                  </div>
                ) : <EmptyState text="Mensagem de boas-vindas não configurada" />}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Respostas Automáticas ({data.autoResponses.length})</h3>
                {data.autoResponses.length === 0 ? <EmptyState text="Nenhuma resposta automática" /> : (
                  <div className="space-y-1">
                    {data.autoResponses.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 text-sm">
                        <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">{r.active ? "ON" : "OFF"}</Badge>
                        <span className="font-mono font-medium">{r.keyword}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="truncate text-xs text-muted-foreground">{r.response}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Fluxos Visuais ({data.flowAutomations.length})</h3>
                {data.flowAutomations.length === 0 ? <EmptyState text="Nenhum fluxo visual" /> : (
                  <div className="space-y-1">
                    {data.flowAutomations.map((f: any) => (
                      <div key={f.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 text-sm">
                        <Badge variant={f.active ? "default" : "secondary"} className="text-[10px]">{f.active ? "ON" : "OFF"}</Badge>
                        <span className="font-medium">{f.name}</span>
                        {f.keyword && <span className="text-xs font-mono text-muted-foreground">#{f.keyword}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Products */}
            <TabsContent value="products">
              {data.products.length === 0 ? <EmptyState text="Nenhum produto cadastrado" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Categoria</TableHead><TableHead>Preço</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.products.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{p.type}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.category || "—"}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(p.price)}</TableCell>
                        <TableCell><Badge variant={p.status ? "default" : "secondary"} className="text-[10px]">{p.status ? "Ativo" : "Inativo"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Integrations */}
            <TabsContent value="integrations" className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Meta / Instagram</h3>
                {data.metaCreds ? (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">Conectado:</span> {data.metaCreds.connected ? "✅ Sim" : "❌ Não"}</p>
                    <p><span className="text-muted-foreground">Nome:</span> {data.metaCreds.fb_user_name || "—"}</p>
                    <p><span className="text-muted-foreground">WABA ID:</span> {data.metaCreds.waba_id || "—"}</p>
                    <p><span className="text-muted-foreground">Phone Number ID:</span> {data.metaCreds.phone_number_id || "—"}</p>
                    <p><span className="text-muted-foreground">Token:</span> {data.metaCreds.access_token ? "✅ Presente" : "❌ Ausente"}</p>
                  </div>
                ) : <EmptyState text="Meta API não conectada" />}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">KYC Gateway</h3>
                {data.kycData ? (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-[10px]">{data.kycData.status}</Badge></p>
                    <p><span className="text-muted-foreground">WhatsApp:</span> {data.kycData.whatsapp || "—"}</p>
                    {data.kycData.reject_reason && <p><span className="text-muted-foreground">Motivo rejeição:</span> {data.kycData.reject_reason}</p>}
                  </div>
                ) : <EmptyState text="KYC não enviado" />}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Links de Redirecionamento ({data.redirectLinks.length})</h3>
                {data.redirectLinks.length === 0 ? <EmptyState text="Nenhum link de redirecionamento" /> : (
                  <div className="space-y-1">
                    {data.redirectLinks.map((l: any) => (
                      <div key={l.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 text-sm">
                        <Badge variant={l.active ? "default" : "secondary"} className="text-[10px]">{l.active ? "ON" : "OFF"}</Badge>
                        <span className="font-medium">{l.name}</span>
                        <span className="text-xs font-mono text-muted-foreground">/{l.slug}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-4">{text}</p>;
}
