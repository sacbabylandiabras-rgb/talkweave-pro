import { useState, useEffect } from "react";
import { Plus, Pencil, Settings2, Calendar, Search, Globe, ChevronDown, Bot, Link2, Image as ImageIcon, AudioLines, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PlanRow {
  id: string;
  title: string;
  price: string;
  charge: string;
  cycle: string;
  message: string;
}

const CYCLE_LABELS: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
  lifetime: "Vitalício",
  "one-time": "Único",
};

async function ensureTelegramProduct(userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from("gateway_products")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Planos Telegram")
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from("gateway_products")
    .insert({
      user_id: userId,
      name: "Planos Telegram",
      description: "Planos de assinatura usados nos bots do Telegram",
      price: 0,
      type: "digital",
      status: true,
      visible_in_store: false,
    } as any)
    .select("id")
    .single();
  if (error) {
    console.error("ensureTelegramProduct error", error);
    return null;
  }
  return created?.id || null;
}

export default function TelegramPlanos() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async (pid: string) => {
    const { data } = await supabase
      .from("gateway_plans" as any)
      .select("id, name, price, billing_cycle, description")
      .eq("product_id", pid)
      .order("created_at", { ascending: false });
    const rows: PlanRow[] = (data || []).map((p: any) => ({
      id: p.id,
      title: p.name,
      price: `R$ ${Number(p.price || 0).toFixed(2).replace(".", ",")}`,
      charge: CYCLE_LABELS[p.billing_cycle] || p.billing_cycle || "—",
      cycle: "0",
      message: p.description || "-",
    }));
    setPlans(rows);
  };

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const pid = await ensureTelegramProduct(uid);
      setProductId(pid);
      if (pid) await reload(pid);
      setLoading(false);
    })();
  }, []);

  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Modais
  const [openPix, setOpenPix] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // PIX
  const [preMsg, setPreMsg] = useState("Aguarde um momento enquanto preparamos tudo :)");
  const [pixMsg, setPixMsg] = useState('Para efetuar o pagamento, utilize a opção "Pagar" > "PIX copia e Cola" no aplicativo do seu banco.');
  const [statusMsg, setStatusMsg] = useState("Após efetuar o pagamento, clique no botão abaixo");
  const [statusBtn, setStatusBtn] = useState("EFETUEI O PAGAMENTO");

  // Config
  const [sumExpiration, setSumExpiration] = useState(false);

  // Criar plano
  const [planTitle, setPlanTitle] = useState("");
  const [billingType, setBillingType] = useState("daily");
  const [cycles, setCycles] = useState("0");
  const [planPrice, setPlanPrice] = useState("");
  const [ctaButton, setCtaButton] = useState("");
  const [approvedMsg, setApprovedMsg] = useState("");
  const [upsellText, setUpsellText] = useState("");
  const [bumpName, setBumpName] = useState("");
  const [bumpText, setBumpText] = useState("");
  const [bumpAccept, setBumpAccept] = useState("");
  const [bumpReject, setBumpReject] = useState("");

  const filtered = plans.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  function savePix() {
    toast.success("Mensagens do PIX configuradas!");
    setOpenPix(false);
  }
  function saveConfig() {
    toast.success("Configuração salva!");
    setOpenConfig(false);
  }
  async function createPlan() {
    if (!planTitle.trim()) {
      toast.error("Informe o título do plano");
      return;
    }
    if (!productId) {
      toast.error("Não foi possível preparar o catálogo de planos");
      return;
    }
    const priceNum = parseFloat(
      (planPrice || "0").replace(/\./g, "").replace(",", "."),
    );
    const payload = {
      name: planTitle.trim(),
      price: isFinite(priceNum) ? priceNum : 0,
      billing_cycle: billingType,
      description: ctaButton || null,
    };
    if (editingId) {
      const { error } = await supabase
        .from("gateway_plans" as any)
        .update(payload)
        .eq("id", editingId);
      if (error) {
        console.error(error);
        toast.error("Erro ao atualizar plano");
        return;
      }
      toast.success("Plano atualizado!");
    } else {
      const { error } = await supabase
        .from("gateway_plans" as any)
        .insert({ ...payload, product_id: productId, status: true });
      if (error) {
        console.error(error);
        toast.error("Erro ao criar plano");
        return;
      }
      toast.success("Plano criado com sucesso!");
    }
    await reload(productId);
    setOpenCreate(false);
    setEditingId(null);
    setPlanTitle("");
    setPlanPrice("");
    setCtaButton("");
  }

  async function openEdit(planId: string) {
    const { data } = await supabase
      .from("gateway_plans" as any)
      .select("id, name, price, billing_cycle, description")
      .eq("id", planId)
      .maybeSingle();
    if (!data) {
      toast.error("Plano não encontrado");
      return;
    }
    const p = data as any;
    setEditingId(p.id);
    setPlanTitle(p.name || "");
    setPlanPrice(
      Number(p.price || 0).toFixed(2).replace(".", ","),
    );
    setBillingType(p.billing_cycle || "daily");
    setCtaButton(p.description || "");
    setOpenCreate(true);
  }

  async function deletePlan(planId: string) {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase
      .from("gateway_plans" as any)
      .delete()
      .eq("id", planId);
    if (error) {
      console.error(error);
      toast.error("Erro ao excluir plano");
      return;
    }
    if (productId) await reload(productId);
    toast.success("Plano excluído");
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Planos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie, gerencie e organize seus planos de pagamento de forma rápida, simples e eficiente
        </p>
      </div>

      {/* Banner */}
      <div className="rounded-2xl overflow-hidden border border-border bg-gradient-to-r from-primary/30 via-primary/15 to-primary/5 p-8 relative">
        <div className="grid md:grid-cols-2 gap-6 items-center relative z-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
              Seu lugar já está <span className="text-primary">reservado</span>
              <br />
              na nossa <span className="bg-primary/30 px-2 py-0.5 rounded">comunidade</span>
            </h2>
          </div>
          <div className="text-right">
            <h3 className="text-xl md:text-2xl font-semibold text-foreground">
              Faça parte da nossa
              <br />
              <span className="text-primary">comunidade de Networking</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Gestão */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">Gestão de Planos</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenPix(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar Mensagem PIX
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpenConfig(true)}>
            <Settings2 className="w-3.5 h-3.5 mr-1.5" /> Configuração de Planos
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null);
              setPlanTitle("");
              setPlanPrice("");
              setCtaButton("");
              setBillingType("daily");
              setOpenCreate(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Criar Novo Plano
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Ganhos nos últimos 7 dias com planos
            </span>
            <span className="w-7 h-7 rounded-full bg-muted/40 flex items-center justify-center text-xs text-foreground/80">
              7
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-semibold text-foreground">R$ 0</span>
            <span className="text-xs text-muted-foreground mb-1">23 ABR – 30 ABR</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Ganhos mensais com planos
            </span>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-semibold text-foreground">R$ 0</span>
            <span className="text-xs text-muted-foreground mb-1">ABR 2026</span>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Planos de pagamento ativos</h3>
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center">
                {plans.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Visualize todos os planos de pagamento atualmente ativos, com informações sobre
              valores, período de vigência, status e condições de cada plano.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showSearch ? (
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setShowSearch(false)}
                placeholder="Buscar..."
                className="h-8 w-48"
              />
            ) : (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowSearch(true)}>
                <Search className="w-4 h-4" />
              </Button>
            )}
            <button className="h-8 px-3 rounded-md border border-border bg-muted/40 text-xs text-foreground/90 inline-flex items-center gap-1.5 hover:bg-muted">
              <Globe className="w-3.5 h-3.5" /> Português <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Título</th>
                <th className="px-5 py-3 font-medium">Preço</th>
                <th className="px-5 py-3 font-medium">Cobrança</th>
                <th className="px-5 py-3 font-medium">Ciclo</th>
                <th className="px-5 py-3 font-medium">Mensagem</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Nenhum plano encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-5 py-3 text-foreground">{p.title}</td>
                    <td className="px-5 py-3 text-foreground/90">{p.price}</td>
                    <td className="px-5 py-3 text-foreground/90">{p.charge}</td>
                    <td className="px-5 py-3 text-foreground/90">{p.cycle}</td>
                    <td className="px-5 py-3 text-foreground/90">{p.message}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p.id)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deletePlan(p.id)}
                      >
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === Modal: Mensagem do PIX === */}
      <Dialog open={openPix} onOpenChange={setOpenPix}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mensagem do PIX</DialogTitle>
            <DialogDescription>
              Configure as mensagens personalizadas para o processo de pagamento PIX do bot
            </DialogDescription>
          </DialogHeader>

          <button className="w-full rounded-md bg-primary/20 border border-primary/30 text-primary text-sm font-medium py-2.5 inline-flex items-center justify-center gap-2 hover:bg-primary/30 transition">
            <Link2 className="w-4 h-4" /> Ir para o link gerado
          </button>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">
                Pré-mensagem de criação do PIX<span className="text-primary">*</span>
              </Label>
              <Textarea value={preMsg} onChange={(e) => setPreMsg(e.target.value)} rows={2} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm">
                Mensagem de instrução para o pagamento do PIX<span className="text-primary">*</span>
              </Label>
              <Textarea value={pixMsg} onChange={(e) => setPixMsg(e.target.value)} rows={2} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm">
                Mensagem de como verificar o status de pagamento<span className="text-primary">*</span>
              </Label>
              <Textarea value={statusMsg} onChange={(e) => setStatusMsg(e.target.value)} rows={2} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm">
                Texto do botão para verificar status do pagamento<span className="text-primary">*</span>
              </Label>
              <Input value={statusBtn} onChange={(e) => setStatusBtn(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenPix(false)}>Cancelar</Button>
            <Button onClick={savePix}>Configurar mensagem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal: Configuração de Planos === */}
      <Dialog open={openConfig} onOpenChange={setOpenConfig}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuração de Planos</DialogTitle>
            <DialogDescription>
              Configure o comportamento das assinaturas quando o cliente realiza uma compra pelo bot
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-foreground text-sm font-medium">Soma da data de expiração em assinaturas ativas</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Quando habilitado, se um cliente realizar uma compra pelo bot e já possuir uma assinatura ativa, a data
                de expiração será somada à nova compra. Quando desabilitado, a data de expiração será calculada a partir
                do dia da aprovação.
              </p>
            </div>
            <Switch checked={sumExpiration} onCheckedChange={setSumExpiration} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenConfig(false)}>Cancelar</Button>
            <Button onClick={saveConfig}>Salvar configuração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal: Criar Plano === */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Plano</DialogTitle>
            <DialogDescription>
              Configure os detalhes do plano de pagamento para seu bot e atraia mais assinantes
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none p-0 h-auto">
              <TabsTrigger
                value="basic"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2"
              >
                Configurações básicas
              </TabsTrigger>
              <TabsTrigger
                value="upsell"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2"
              >
                Upsell
              </TabsTrigger>
              <TabsTrigger
                value="bump"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-4 py-2"
              >
                Order Bump
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">NOVO</span>
              </TabsTrigger>
            </TabsList>

            {/* Básicas */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div>
                <Label className="text-sm">
                  Título<span className="text-primary">*</span>
                </Label>
                <Input
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Insira o título do plano"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm">
                    Tipo de cobrança<span className="text-primary">*</span>
                  </Label>
                  <Select value={billingType} onValueChange={setBillingType}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                      <SelectItem value="lifetime">Vitalício</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">
                    Ciclos<span className="text-primary">*</span>
                  </Label>
                  <Input value={cycles} onChange={(e) => setCycles(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-sm">
                    Preço<span className="text-primary">*</span>
                  </Label>
                  <Input value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} placeholder="0,00" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label className="text-sm">
                  Botão CTA<span className="text-primary">*</span>
                </Label>
                <Textarea
                  value={ctaButton}
                  onChange={(e) => setCtaButton(e.target.value)}
                  placeholder="Digite aqui o título do botão de CTA"
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </TabsContent>

            {/* Upsell */}
            <TabsContent value="upsell" className="space-y-4 mt-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-foreground">Uso de templates</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use templates como <code className="text-primary">%price</code> e{" "}
                    <code className="text-primary">%firstname</code> para personalizar sua mensagem!
                    Eles serão substituídos pelos dados correspondentes.
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm">
                  Mensagem de pagamento aprovado<span className="text-primary">*</span>
                </Label>
                <Textarea
                  value={approvedMsg}
                  onChange={(e) => setApprovedMsg(e.target.value)}
                  placeholder="Escreva aqui a mensagem do bot"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">
                  Upsell<span className="text-primary">*</span>
                </Label>
                <Textarea
                  value={upsellText}
                  onChange={(e) => setUpsellText(e.target.value)}
                  placeholder="Inserir texto upsell"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Link de acesso</h4>
                <button className="w-full border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-1.5">
                  Adicionar novo link <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </TabsContent>

            {/* Order Bump */}
            <TabsContent value="bump" className="space-y-4 mt-4">
              <div>
                <Label className="text-sm">
                  Nome do Order Bump<span className="text-primary">*</span>
                </Label>
                <Input value={bumpName} onChange={(e) => setBumpName(e.target.value)} placeholder="Nome do Order Bump" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-sm">
                  Texto aplicativo do Order Bump<span className="text-primary">*</span>
                </Label>
                <Textarea
                  value={bumpText}
                  onChange={(e) => setBumpText(e.target.value)}
                  placeholder="Escreva aqui o texto aplicativo do Order Bump"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Texto Botão Aceitar</Label>
                  <Input value={bumpAccept} onChange={(e) => setBumpAccept(e.target.value)} placeholder="Botão aceitar" className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-sm">Texto Botão Recusar</Label>
                  <Input value={bumpReject} onChange={(e) => setBumpReject(e.target.value)} placeholder="Botão recusar" className="mt-1.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Mídia Order Bump</Label>
                  <button className="mt-1.5 w-full border border-dashed border-border rounded-lg py-6 text-sm text-muted-foreground hover:bg-muted/40 flex flex-col items-center justify-center gap-1.5">
                    <ImageIcon className="w-5 h-5" />
                    <span>Clique para carregar uma imagem ou vídeo</span>
                    <span className="text-[10px] text-muted-foreground/70">JPEG, PNG e MP4, até 50 MB</span>
                  </button>
                </div>
                <div>
                  <Label className="text-sm">Áudio Order Bump</Label>
                  <button className="mt-1.5 w-full border border-dashed border-border rounded-lg py-6 text-sm text-muted-foreground hover:bg-muted/40 flex flex-col items-center justify-center gap-1.5">
                    <AudioLines className="w-5 h-5" />
                    <span>Clique para carregar um áudio</span>
                    <span className="text-[10px] text-muted-foreground/70">WAV, AIFF, PCM, MP3</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm">
                    Tipo de cobrança a ser somada<span className="text-primary">*</span>
                  </Label>
                  <Select defaultValue="daily">
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">
                    Ciclo a ser somado<span className="text-primary">*</span>
                  </Label>
                  <Input defaultValue="0" className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-sm">
                    Preço<span className="text-primary">*</span>
                  </Label>
                  <Input placeholder="0,00" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label className="text-sm">Entregáveis</Label>
                <Textarea placeholder="Escreva aqui o texto da upsell" rows={3} className="mt-1.5" />
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Link de acesso</h4>
                <button className="w-full border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-1.5">
                  Adicionar novo link <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={createPlan}>Criar plano</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
