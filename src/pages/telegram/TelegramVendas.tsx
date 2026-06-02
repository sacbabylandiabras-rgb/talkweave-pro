import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Clock, XCircle, RotateCcw, Search, Calendar, Inbox, ChevronLeft, ChevronRight,
} from "lucide-react";

type TelegramSale = Record<string, any> & {
  bot_name?: string;
  chat_id?: number | string | null;
  customer_name?: string | null;
};

const getStatusLabel = (status?: string) => {
  const normalized = String(status || "").toLowerCase();
  if (["approved", "paid", "completed", "success"].includes(normalized)) return "PAGO";
  if (["pending", "waiting_payment", "processing"].includes(normalized)) return "PENDENTE";
  if (["refunded", "refund", "chargeback"].includes(normalized)) return "REEMBOLSADO";
  return "FALHOU";
};

const getMetadata = (sale: any) => (sale?.metadata && typeof sale.metadata === "object" ? sale.metadata : {});

export default function TelegramVendas() {
  const [sales, setSales] = useState<TelegramSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState("");
  const [clientId, setClientId] = useState("");
  const [txId, setTxId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [acquirer, setAcquirer] = useState("all");
  const [perPage, setPerPage] = useState("10");

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSales([]); setLoading(false); return; }

    const { data: bots } = await supabase
      .from("telegram_bots")
      .select("id, first_name, username")
      .eq("user_id", user.id);
    const botNameById = new Map((bots ?? []).map((b: any) => [b.id, b.first_name || b.username || "Bot Telegram"]));

    const { data: sessions } = await supabase
      .from("telegram_flow_sessions" as any)
      .select("bot_id, chat_id, variables, updated_at")
      .eq("user_id", user.id)
      .not("variables->payment->>externalId", "is", null);

    const flowSessions = (sessions ?? []) as any[];
    const externalIds = new Set(
      flowSessions
        .map((s: any) => String(s?.variables?.payment?.externalId || ""))
        .filter(Boolean),
    );

    const { data: transactions } = await supabase
      .from("gateway_transactions" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const telegramSales = (transactions ?? []).filter((tx: any) => {
      const meta = getMetadata(tx);
      const description = String(meta.description || "").toLowerCase();
      const legacyTelegramFlow = meta.source === "flow_visual" && String(tx.external_id || "").startsWith(`flow_${user.id.slice(0, 8)}_`) && !tx.customer_phone && !tx.customer_email;
      return meta.source === "telegram" || meta.channel === "telegram" || externalIds.has(String(tx.external_id || "")) || description.includes("telegram") || legacyTelegramFlow;
    }).map((tx: any) => {
      const meta = getMetadata(tx);
      const session = flowSessions.find((s: any) => String(s?.variables?.payment?.externalId || "") === String(tx.external_id || ""));
      const telegramInfo = meta.telegram || {};
      const botId = telegramInfo.bot_id || session?.bot_id || null;
      const tgUser = session?.variables?.user || {};
      return {
        ...tx,
        bot_name: botNameById.get(botId) || "Bot Telegram",
        chat_id: telegramInfo.chat_id || session?.chat_id || null,
        customer_name: tx.customer_name || tgUser.first_name || "Cliente Telegram",
      };
    });

    setSales(telegramSales);
    setLoading(false);
  };

   useEffect(() => {
     loadData();

     const channel = supabase
       .channel("telegram-sales-realtime")
       .on("postgres_changes", { event: "*", schema: "public", table: "gateway_transactions" }, () => {
         loadData();
       })
       .subscribe();

     return () => { supabase.removeChannel(channel); };
   }, []);

  const filtered = useMemo(() => sales.filter((s) => {
    const status = getStatusLabel(s.status);
    const meta = getMetadata(s);
    const haystack = [
      s.id,
      s.external_id,
      s.customer_name,
      s.customer_email,
      s.customer_phone,
      s.chat_id,
      meta.brCode,
      meta.description,
    ].map((v) => String(v || "").toLowerCase()).join(" ");
    const provider = String(meta.provider || "").toLowerCase();
    return (
      (statusFilter === "all" || status === statusFilter) &&
      (acquirer === "all" || provider === acquirer.toLowerCase()) &&
      (!orderId.trim() || haystack.includes(orderId.trim().toLowerCase())) &&
      (!clientId.trim() || haystack.includes(clientId.trim().toLowerCase())) &&
      (!txId.trim() || haystack.includes(txId.trim().toLowerCase()))
    );
  }), [sales, statusFilter, acquirer, orderId, clientId, txId]);

  const fmt = (v: number) => (Number(v || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const ACQUIRER_OPTIONS = useMemo(() => ([
    { value: "openpix", label: "Adquirente 1" },
    { value: "hubpague", label: "Adquirente 2" },
    { value: "cartwave", label: "Adquirente 3" },
    { value: "pix", label: "Pix Padrão" },
    { value: "credit_card", label: "Cartão de Crédito" },
    { value: "boleto", label: "Boleto" },
  ]), []);

  const stats = useMemo(() => {
    const sumBy = (label: string) => sales
      .filter((s) => getStatusLabel(s.status) === label)
      .reduce((a, s) => a + Number(s.amount || 0), 0);
    const countBy = (label: string) => sales.filter((s) => getStatusLabel(s.status) === label).length;

    return {
      pago: { value: sumBy("PAGO"), count: countBy("PAGO") },
      pendente: { value: sumBy("PENDENTE"), count: countBy("PENDENTE") },
      falhou: { value: sumBy("FALHOU"), count: countBy("FALHOU") },
      reembolsado: { value: sumBy("REEMBOLSADO"), count: countBy("REEMBOLSADO") },
    };
  }, [sales]);

   const total = sales.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitore todas as suas vendas de maneira simples e organizada, com acesso rápido aos principais dados para acompanhar resultados e desempenho.
          </p>
        </div>
      </div>

      {/* Card principal */}
      <Card className="overflow-hidden">
        <div className="flex">
          <div className="w-1 bg-primary shrink-0" />
          <div className="flex-1 p-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Gestão de Vendas</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">Ver todos os bots</Button>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-1.5" /> Filtrar por período
              </Button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-6">
          {/* Definir Visualização */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-semibold">Definir Visualização</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ID do Pedido</Label>
                <Input placeholder="Digite o ID do pedido" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ID do cliente</Label>
                <Input placeholder="Digite o ID do cliente" value={clientId} onChange={(e) => setClientId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ID da transação/End2End/Copia e cola</Label>
                <Input placeholder="Digite o ID da transação" value={txId} onChange={(e) => setTxId(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="PAGO">Pago</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="FALHOU">Falhou</SelectItem>
                    <SelectItem value="REEMBOLSADO">Reembolsado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Adquirente</Label>
                <div className="flex gap-2">
                  <Select value={acquirer} onValueChange={setAcquirer}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Todos os adquirentes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os adquirentes</SelectItem>
                       {acquirers.map((name) => (
                         <SelectItem key={name} value={name}>{name}</SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon"><Search className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatusCard label="PAGO" value={fmt(stats.pago.value)} count={`${stats.pago.count} / ${total}`} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} accent="emerald" />
            <StatusCard label="PENDENTE" value={fmt(stats.pendente.value)} count={`${stats.pendente.count} / ${total}`} icon={<Clock className="w-5 h-5 text-amber-500" />} accent="amber" />
            <StatusCard label="FALHOU" value={fmt(stats.falhou.value)} count={`${stats.falhou.count} / ${total}`} icon={<XCircle className="w-5 h-5 text-destructive" />} accent="destructive" />
            <StatusCard label="REEMBOLSADO" value={fmt(stats.reembolsado.value)} count={`${stats.reembolsado.count} / ${total}`} icon={<RotateCcw className="w-5 h-5 text-blue-500" />} accent="blue" />
          </div>

          {/* Todas as vendas */}
          <div className="rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                Todas as vendas
                <Badge variant="secondary" className="rounded-full">{filtered.length}</Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visualize todos os seus registros de vendas em um só lugar e acompanhe os detalhes de cada transação.
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bot</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Datas</TableHead>
                    <TableHead>Valores</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                        Carregando vendas reais do Telegram...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Inbox className="w-8 h-8" />
                          <p className="text-xs uppercase tracking-wide">Nenhuma venda registrada</p>
                        </div>
                      </TableCell>
                    </TableRow>
                   ) : filtered.map((s) => {
                     const meta = getMetadata(s);
                     const paymentMethod = s.payment_method || "PIX";
                     const date = s.created_at ? new Date(s.created_at).toLocaleString("pt-BR") : "—";
                     const status = getStatusLabel(s.status);
                     return (
                       <TableRow key={s.id}>
                         <TableCell className="font-medium">{s.bot_name || "Bot Telegram"}</TableCell>
                         <TableCell>
                           <div className="font-medium">{s.customer_name || "Cliente Telegram"}</div>
                           {s.chat_id && <div className="text-xs text-muted-foreground">Chat: {String(s.chat_id)}</div>}
                         </TableCell>
                         <TableCell>
                           <div className="uppercase">{paymentMethod}</div>
                           <div className="text-xs text-muted-foreground">{meta.provider || "gateway"}</div>
                         </TableCell>
                         <TableCell className="text-xs">{date}</TableCell>
                         <TableCell>
                           <div className="font-medium">{fmt(s.amount)}</div>
                           <Badge variant="outline" className="mt-1">{status}</Badge>
                         </TableCell>
                         <TableCell className="text-right">
                           <Button variant="ghost" size="sm" title={String(s.external_id || s.id)}>Ver</Button>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between p-4 border-t flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Select value={perPage} onValueChange={setPerPage}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / página</SelectItem>
                    <SelectItem value="25">25 / página</SelectItem>
                    <SelectItem value="50">50 / página</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Página 1 de 1</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" disabled><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-xs text-muted-foreground px-2">1/1</span>
                <Button variant="ghost" size="icon" disabled><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatusCard({
  label, value, count, icon, accent,
}: { label: string; value: string; count: string; icon: React.ReactNode; accent: "emerald" | "amber" | "destructive" | "blue" }) {
  const accentMap: Record<string, string> = {
    emerald: "border-l-emerald-500",
    amber: "border-l-amber-500",
    destructive: "border-l-destructive",
    blue: "border-l-blue-500",
  };
  return (
    <Card className={`p-4 border-l-4 ${accentMap[accent]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</p>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{count}</p>
      </div>
    </Card>
  );
}
