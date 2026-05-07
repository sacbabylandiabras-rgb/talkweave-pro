import { useState, useEffect } from "react";
import { Wallet, Clock, CheckCircle, XCircle, Loader2, Copy, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Withdrawal {
  id: string;
  amount: number;
  pix_key_type: string;
  pix_key: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
    case "processing":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processando</Badge>;
    default:
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
  }
};

export default function PayWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch transactions to calc balance
    const { data: txData } = await supabase
      .from("gateway_transactions" as any)
      .select("net, status")
      .eq("user_id", user.id)
      .eq("status", "approved");

    const totalNet = ((txData || []) as any[]).reduce((sum: number, t: any) => sum + (t.net ?? 0), 0);

    // Fetch withdrawals
    const { data: wData } = await supabase
      .from("gateway_withdrawals" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const withdrawalsList = (wData || []) as unknown as Withdrawal[];
    setWithdrawals(withdrawalsList);

    const approved = withdrawalsList.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0);
    const pending = withdrawalsList.filter(w => w.status === "pending" || w.status === "processing").reduce((s, w) => s + w.amount, 0);

    setTotalWithdrawn(approved);
    setPendingAmount(pending);
    setBalance(totalNet - approved - pending);
    setLoading(false);
  };

   useEffect(() => {
     fetchData();

     // Real-time subscription for transactions and withdrawals to keep balance updated
     const txSubscription = supabase
       .channel('withdrawals-tx-updates')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'gateway_transactions' }, () => {
         fetchData();
       })
       .subscribe();

     const wdSubscription = supabase
       .channel('withdrawals-wd-updates')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'gateway_withdrawals' }, () => {
         fetchData();
       })
       .subscribe();

     return () => {
       supabase.removeChannel(txSubscription);
       supabase.removeChannel(wdSubscription);
     };
   }, []);

  const MINIMUM_WITHDRAWAL_CENTS = 5000; // R$ 50,00
  const WITHDRAWAL_FEE_CENTS = 1000; // R$ 10,00

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const rawAmount = withdrawAmount.replace(",", ".");
    const amountCents = Math.round(parseFloat(rawAmount) * 100);
    
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (amountCents < MINIMUM_WITHDRAWAL_CENTS) {
      toast.error("O valor mínimo para saque é de R$ 50,00");
      return;
    }
    if (amountCents > balance) {
      toast.error("Saldo insuficiente");
      return;
    }
    if (!pixKey.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("gateway_withdrawals" as any).insert({
      user_id: user.id,
      amount: amountCents,
      pix_key_type: pixKeyType,
      pix_key: pixKey.trim(),
    } as any);

    if (error) {
      toast.error("Erro ao solicitar saque");
    } else {
      // Get the withdrawal ID just inserted
      const { data: latestW } = await (supabase as any)
        .from("gateway_withdrawals" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestW?.id) {
        // Auto-process: call process-withdrawal with action 'auto'
        toast.info("Processando saque via PIX...");
        try {
          const { data: autoResult, error: autoErr } = await supabase.functions.invoke("process-withdrawal", {
            body: { withdrawalId: latestW.id, action: "auto" },
          });
          if (autoErr || autoResult?.error) {
            toast.error("Saque solicitado, mas o processamento automático falhou: " + (autoResult?.error || autoResult?.details || autoErr?.message || "Erro desconhecido"));
          } else {
            toast.success("Saque processado! PIX enviado automaticamente.");
          }
        } catch (e: any) {
          toast.error("Saque criado, processamento automático falhou: " + (e.message || ""));
        }
      } else {
        toast.success("Solicitação de saque enviada!");
      }

      setDialogOpen(false);
      setPixKey("");
      setWithdrawAmount("");
      fetchData();
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Saques</h1>
          <p className="text-sm text-muted-foreground">Solicite a transferência do seu saldo via PIX</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#a78bfa] hover:bg-[#a78bfa]/90">
          <ArrowUpRight className="w-4 h-4 mr-2" />
          Solicitar Saque
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Disponível</CardTitle>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">{formatCurrency(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sacado</CardTitle>
            <CheckCircle className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalWithdrawn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{formatCurrency(pendingAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Saques</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{withdrawals.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawals History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Saques</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">Nenhum saque solicitado ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tipo Chave</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(w.amount)}</TableCell>
                      <TableCell className="text-xs uppercase">{w.pix_key_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono truncate max-w-[200px]">{w.pix_key}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(w.pix_key); toast.info("Chave copiada"); }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(w.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {(() => {
                          const note = w.admin_notes || "";
                          // Hide automatic PIX dispatch messages from user view
                          if (/pix enviado|transfer id|correlation|automaticamente/i.test(note)) {
                            return "—";
                          }
                          return note || "—";
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Withdrawal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-muted-foreground">Saldo disponível</p>
              <p className="text-xl font-bold text-emerald-500">{formatCurrency(balance)}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
              <p className="text-xs text-amber-400 font-medium">⚠️ Informações sobre saques</p>
              <p className="text-xs text-muted-foreground">• Valor mínimo: <strong>R$ 50,00</strong></p>
              <p className="text-xs text-muted-foreground">• Taxa por saque: <strong>R$ 10,00</strong> (descontada automaticamente do valor)</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Valor do saque (R$)</Label>
                <Input
                  placeholder="Mínimo R$ 50,00"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  type="text"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de chave PIX</Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIX_KEY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  placeholder="Informe sua chave PIX"
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                />
              </div>
              
              <DialogFooter className="pt-4">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#a78bfa] hover:bg-[#a78bfa]/90"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Solicitar
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
