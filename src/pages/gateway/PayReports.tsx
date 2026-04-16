import { useState, useEffect, useMemo } from "react";
import { Download, DollarSign, CheckCircle, XCircle, Clock, RotateCcw, TrendingUp, Loader2, FileText, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["#FF4D2E", "#22C55E", "#F59E0B", "#60A5FA"];

interface Transaction {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number;
  fee: number;
  net: number;
  payment_method: string;
  status: string;
  created_at: string;
  product_id: string | null;
  checkout_id: string | null;
  external_id: string | null;
  metadata: any;
}

export default function PayReports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [checkouts, setCheckouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [resolvedReceiptUrl, setResolvedReceiptUrl] = useState<string | null>(null);
  const [receiptLoadError, setReceiptLoadError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [txRes, ckRes] = await Promise.all([
        supabase.from("gateway_transactions" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("gateway_checkouts" as any).select("*").order("created_at", { ascending: false }),
      ]);
      setTransactions((txRes.data || []) as unknown as Transaction[]);
      setCheckouts((ckRes.data || []) as any[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const resolveReceiptUrl = async () => {
      if (!receiptUrl) {
        setResolvedReceiptUrl(null);
        return;
      }

      const parseStoragePath = (value: string) => {
        const normalizedValue = value.replace(/^payment-receipts\//i, "").replace(/^\/+/, "");
        if (!/^https?:\/\//i.test(value)) {
          return normalizedValue;
        }

        try {
          const url = new URL(value);
          const storageMarkers = [
            "/storage/v1/object/public/payment-receipts/",
            "/storage/v1/object/sign/payment-receipts/",
            "/storage/v1/object/authenticated/payment-receipts/",
            "/storage/v1/object/payment-receipts/",
          ];

          for (const marker of storageMarkers) {
            const index = url.pathname.indexOf(marker);
            if (index >= 0) {
              return decodeURIComponent(url.pathname.slice(index + marker.length));
            }
          }
        } catch {
          return null;
        }

        return null;
      };

      const storagePath = parseStoragePath(receiptUrl);
      if (!storagePath) {
        setResolvedReceiptUrl(receiptUrl);
        return;
      }

      const { data, error } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(storagePath, 60 * 60);

      if (!error && data?.signedUrl) {
        setResolvedReceiptUrl(data.signedUrl);
        return;
      }

      setResolvedReceiptUrl(
        /^https?:\/\//i.test(receiptUrl)
          ? receiptUrl
          : supabase.storage.from("payment-receipts").getPublicUrl(storagePath).data.publicUrl
      );
    };

    void resolveReceiptUrl();
  }, [receiptUrl]);

  const receiptType = useMemo(() => {
    const sourceUrl = resolvedReceiptUrl || receiptUrl;
    if (!sourceUrl) return null;
    const cleanUrl = sourceUrl.split("?")[0].toLowerCase();

    if (cleanUrl.endsWith(".pdf")) return "pdf";
    return "image";
  }, [resolvedReceiptUrl, receiptUrl]);

  const filtered = useMemo(() => {
    if (!selectedDate) return transactions;
    return transactions.filter(t => new Date(t.created_at).toDateString() === selectedDate.toDateString());
  }, [transactions, selectedDate]);

  const approved = filtered.filter(t => t.status === "approved");
  const declined = filtered.filter(t => t.status === "declined");
  const pending = filtered.filter(t => t.status === "pending");
  const refunded = filtered.filter(t => t.status === "refunded");
  const totalRevenue = approved.reduce((a, t) => a + t.net, 0);
  const avgTicket = approved.length > 0 ? Math.round(totalRevenue / approved.length) : 0;

  const methodGroups = approved.reduce((acc, tx) => {
    const label = getMethodLabel(tx.payment_method);
    acc[label] = (acc[label] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);
  const methodData = Object.entries(methodGroups).map(([name, value]) => ({ name, value: value / 100 }));

  // Chart: last 30 days — separate lines for paid and pending
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dayAll = filtered.filter(tx => new Date(tx.created_at).toDateString() === d.toDateString());
    const paidVol = dayAll.filter(t => t.status === "approved" || t.status === "paid").reduce((a, t) => a + t.amount, 0) / 100;
    const pendingVol = dayAll.filter(t => t.status === "pending").reduce((a, t) => a + t.amount, 0) / 100;
    return { date: key, pagas: paidVol, pendentes: pendingVol };
  });

  const summaryCards = [
    { label: "Receita Total", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-[#FF4D2E]" },
    { label: "Aprovadas", value: String(approved.length), icon: CheckCircle, color: "text-emerald-400" },
    { label: "Recusadas", value: String(declined.length), icon: XCircle, color: "text-red-400" },
    { label: "Aguardando", value: String(pending.length), icon: Clock, color: "text-amber-400" },
    { label: "Estornos", value: String(refunded.length), icon: RotateCcw, color: "text-blue-400" },
    { label: "Ticket Médio", value: avgTicket > 0 ? formatCurrency(avgTicket) : "—", icon: TrendingUp, color: "text-purple-400" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análise detalhada das suas vendas ({filtered.length} transações{selectedDate ? ` em ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}` : ""})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-full">
                <CalendarIcon className="w-4 h-4" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Filtrar por dia"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }}
                locale={ptBR}
                initialFocus
                className="p-3 pointer-events-auto"
              />
              {selectedDate && (
                <div className="p-2 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setSelectedDate(undefined); setCalendarOpen(false); }}>
                    Limpar filtro
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button variant="outline" className="rounded-full"><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="resumo">Resumo Financeiro</TabsTrigger>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="conversao">Conversão</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryCards.map(c => (
              <Card key={c.label} className="border-[#2A2A2A]">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 mb-2">
                    <c.icon className={`w-4 h-4 ${c.color}`} />
                    <span className="text-[10px] text-muted-foreground uppercase">{c.label}</span>
                  </div>
                  <p className="text-lg font-bold">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-[#2A2A2A]">
              <CardHeader><CardTitle className="text-sm">Volume por Dia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gPagas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22C55E" stopOpacity={0.15}/><stop offset="95%" stopColor="#22C55E" stopOpacity={0}/></linearGradient>
                      <linearGradient id="gPendentes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15}/><stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                    <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v === 'pagas' ? 'Pagas' : 'Pendentes'}</span>} />
                    <Area type="monotone" dataKey="pagas" stroke="#22C55E" fill="url(#gPagas)" strokeWidth={2} name="pagas" />
                    <Area type="monotone" dataKey="pendentes" stroke="#F59E0B" fill="url(#gPendentes)" strokeWidth={2} name="pendentes" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-[#2A2A2A]">
              <CardHeader><CardTitle className="text-sm">Por Método de Pagamento</CardTitle></CardHeader>
              <CardContent>
                {methodData.length === 0 ? (
                  <div className="flex items-center justify-center h-[220px]">
                    <p className="text-sm text-muted-foreground">Sem dados de transações</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={methodData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                      <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transacoes" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">{selectedDate ? "Nenhuma transação neste dia." : "Nenhuma transação registrada."}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A]">
                      <TableHead>ID</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Checkout</TableHead>
                      <TableHead>Código PIX</TableHead>
                      <TableHead>Comprovante</TableHead>
                      <TableHead>Bruto</TableHead>
                      <TableHead>Taxa</TableHead>
                      <TableHead>Líquido</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(tx => {
                      const badge = getStatusBadge(tx.status);
                      const checkout = checkouts.find((ck: any) => ck.id === tx.checkout_id);
                      return (
                        <TableRow key={tx.id} className="border-[#2A2A2A]">
                          <TableCell className="font-mono text-xs">{tx.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(tx.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{tx.customer_name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{(tx as any).metadata?.document || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tx.customer_phone && <div>{tx.customer_phone}</div>}
                            {tx.customer_email && <div>{tx.customer_email}</div>}
                            {!tx.customer_phone && !tx.customer_email && "—"}
                          </TableCell>
                          <TableCell className="text-xs">{checkout?.name || "—"}</TableCell>
                          <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[200px]">
                            {(tx as any).metadata?.brCode ? (
                              <button
                                className="text-left truncate max-w-[200px] hover:text-foreground transition-colors"
                                title="Clique para copiar o código PIX completo"
                                onClick={() => {
                                  navigator.clipboard.writeText((tx as any).metadata.brCode);
                                  import('sonner').then(m => m.toast.success('Código PIX copiado!'));
                                }}
                              >
                                {(tx as any).metadata.brCode.slice(0, 30)}…
                              </button>
                            ) : tx.external_id || "—"}
                          </TableCell>
                          <TableCell>
                            {(tx as any).metadata?.receipt_url ? (
                              <button
                                onClick={() => {
                                  setReceiptLoadError(false);
                                  setReceiptUrl((tx as any).metadata.receipt_url);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80 bg-emerald-500/10 text-emerald-500"
                              >
                                <FileText className="w-3 h-3" />
                                Ver
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(tx.amount)}</TableCell>
                          <TableCell className="text-red-400 text-sm">{formatCurrency(tx.fee)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(tx.net)}</TableCell>
                          <TableCell className="text-sm">{getMethodLabel(tx.payment_method)}</TableCell>
                          <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversao" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="p-0">
              {checkouts.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">Nenhum checkout criado ainda.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A]">
                      <TableHead>Nome</TableHead><TableHead>Formato</TableHead><TableHead>Visitas</TableHead><TableHead>Iniciaram</TableHead><TableHead>Aprovados</TableHead><TableHead>Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkouts.map((ck: any) => {
                      const visits = ck.visits ?? 0;
                      const initiated = ck.initiated ?? 0;
                      const approved = ck.approved ?? 0;
                      const conversion = visits > 0 ? ((approved / visits) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={ck.id} className="border-[#2A2A2A]">
                          <TableCell className="font-medium">{ck.name}</TableCell>
                          <TableCell>{ck.format ?? "—"}</TableCell>
                          <TableCell>{visits.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{initiated.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{approved.toLocaleString('pt-BR')}</TableCell>
                          <TableCell><span className={`font-bold ${parseFloat(conversion) > 40 ? 'text-emerald-400' : 'text-amber-400'}`}>{conversion}%</span></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {receiptUrl && resolvedReceiptUrl && (
        <Dialog open={true} onOpenChange={() => {
          setReceiptUrl(null);
          setReceiptLoadError(false);
        }}>
          <DialogContent className="max-w-3xl z-[100]">
            <DialogHeader>
              <DialogTitle>Comprovante</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-center min-h-[240px] rounded-lg border border-border bg-muted/20 overflow-hidden">
              {!resolvedReceiptUrl ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : receiptType === "pdf" ? (
                <iframe
                  key={resolvedReceiptUrl}
                  src={resolvedReceiptUrl}
                  title="Comprovante em PDF"
                  className="h-[70vh] w-full"
                  onError={() => setReceiptLoadError(true)}
                />
              ) : (
                <img
                  key={resolvedReceiptUrl}
                  src={resolvedReceiptUrl}
                  alt="Comprovante"
                  className="w-full rounded-lg object-contain max-h-[70vh]"
                  onError={() => setReceiptLoadError(true)}
                />
              )}
            </div>

            {receiptLoadError && (
              <p className="text-sm text-muted-foreground">
                Não foi possível pré-visualizar este comprovante no dialog.
              </p>
            )}

            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <a href={resolvedReceiptUrl || receiptUrl || undefined} target="_blank" rel="noreferrer">
                  Abrir arquivo
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}