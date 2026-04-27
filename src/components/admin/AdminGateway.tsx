import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, UserProfile } from "@/hooks/useAdminUsers";
import { useAdminKycQueue } from "@/hooks/useGatewayKyc";
import { Loader2, Users, DollarSign, ShoppingCart, TrendingUp, RefreshCw, Eye, Shield, ShieldOff, UserCheck, UserX, Pencil, Trash2, Building2, CreditCard, BarChart3, Wallet, Clock, CheckCircle, XCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  pix_key_type: string;
  pix_key: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const getWithdrawalStatusBadge = (status: string) => {
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

const getKycStatusBadge = (status: string) => {
  switch (status) {
    case "approved": return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Aprovado</Badge>;
    case "rejected": return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Reprovado</Badge>;
    case "submitted": return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Pendente</Badge>;
    case "pending": return <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Não enviado</Badge>;
    default: return null;
  }
};

const AdminGateway = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const { users, loading: usersLoading, toggleUserStatus, toggleAdminRole, deleteUser, refetch } = useAdminUsers();
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [checkoutCount, setCheckoutCount] = useState(0);
  const [platformRevenue, setPlatformRevenue] = useState(0);

  // KYC
  const { queue: kycQueue, loading: kycLoading, approveKyc, rejectKyc, refetch: refetchKyc } = useAdminKycQueue();
  const [rejectReason, setRejectReason] = useState("");
  const [kycProcessing, setKycProcessing] = useState(false);
  const [selectedKycId, setSelectedKycId] = useState<string | null>(null);

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [wProfiles, setWProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [wLoading, setWLoading] = useState(true);
  const [wTab, setWTab] = useState("pending");
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; withdrawal: Withdrawal | null; action: "approved" | "rejected" }>({ open: false, withdrawal: null, action: "approved" });
  const [adminNotes, setAdminNotes] = useState("");
  const [wSubmitting, setWSubmitting] = useState(false);

  const fetchWithdrawals = async () => {
    setWLoading(true);
    const { data: wData } = await supabase.from("gateway_withdrawals" as any).select("*").order("created_at", { ascending: false });
    const list = (wData || []) as unknown as Withdrawal[];
    setWithdrawals(list);
    const userIds = [...new Set(list.map(w => w.user_id))];
    if (userIds.length > 0) {
      const { data: pData } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (pData || []).forEach(p => { map[p.id] = p; });
      setWProfiles(map);
    }
    setWLoading(false);
  };

  const handleWithdrawalReview = async () => {
    if (!reviewDialog.withdrawal) return;
    if (reviewDialog.action === "rejected" && !adminNotes.trim()) { toast.error("Informe o motivo da rejeição"); return; }
    setWSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-withdrawal", {
        body: { withdrawalId: reviewDialog.withdrawal.id, action: reviewDialog.action, adminNotes: adminNotes.trim() || null },
      });
      if (error || data?.error) { toast.error(data?.error || "Erro ao processar saque"); }
      else { toast.success(reviewDialog.action === "approved" ? "Saque aprovado e PIX enviado!" : "Saque rejeitado"); setReviewDialog({ open: false, withdrawal: null, action: "approved" }); setAdminNotes(""); fetchWithdrawals(); }
    } catch (err: any) { toast.error(err?.message || "Erro inesperado"); }
    setWSubmitting(false);
  };

  const handleKycApprove = async (id: string) => {
    setKycProcessing(true);
    await approveKyc(id);
    setKycProcessing(false);
  };

  const handleKycReject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error("Informe o motivo da reprovação"); return; }
    setKycProcessing(true);
    await rejectKyc(id, rejectReason);
    setRejectReason("");
    setSelectedKycId(null);
    setKycProcessing(false);
  };

  useEffect(() => { fetchWithdrawals(); }, []);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);
    };
    getCurrentUser();

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-stats");
        if (!error && data) {
          setTransactionCount(data.totalTransactions || 0);
          setTotalVolume(data.volumeTotal || 0);
          setPlatformRevenue(data.revenueTotal || 0);
        }
      } catch (e) {
        console.error("Error fetching admin stats:", e);
      }

      const { count: ckCount } = await supabase.from("gateway_checkouts").select("*", { count: "exact", head: true });
      setCheckoutCount(ckCount || 0);
    };
    fetchStats();
  }, []);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.subscription_status === 'active').length,
  }), [users]);

  if (usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#a78bfa]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Gestão de lojistas, transações e plataforma</p>
        </div>
        <Button onClick={refetch} variant="outline" size="sm" className="border-[#2A2A2A]">
          <RefreshCw className="w-4 h-4 mr-2" />Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Lojistas", value: stats.total, icon: Users, color: "text-blue-400" },
          { label: "Lojistas Ativos", value: stats.active, icon: Building2, color: "text-emerald-400" },
          { label: "Transações", value: transactionCount, icon: CreditCard, color: "text-amber-400" },
          { label: "Volume Total", value: `R$ ${(totalVolume / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-[#a78bfa]" },
        ].map(c => (
          <Card key={c.label} className="border-[#2A2A2A]">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase">{c.label}</span>
              </div>
              <p className="text-xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-[#2A2A2A]">
          <CardContent className="pt-4 pb-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Checkouts Criados</p>
              <p className="text-lg font-bold">{checkoutCount}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-muted-foreground/20" />
          </CardContent>
        </Card>
        <Card className="border-[#2A2A2A]">
          <CardContent className="pt-4 pb-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Taxa Média</p>
              <p className="text-lg font-bold">4.99%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-muted-foreground/20" />
          </CardContent>
        </Card>
        <Card className="border-[#2A2A2A]">
          <CardContent className="pt-4 pb-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Receita da Plataforma</p>
              <p className="text-lg font-bold text-[#a78bfa]">R$ {(platformRevenue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <DollarSign className="w-8 h-8 text-muted-foreground/20" />
          </CardContent>
        </Card>
      </div>

      {/* === SEÇÃO KYC === */}
      <Card className="border-[#2A2A2A]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Aprovação de Contas (KYC)</CardTitle>
            <CardDescription>Analise e aprove documentos de verificação dos lojistas</CardDescription>
          </div>
          <Button onClick={refetchKyc} variant="outline" size="sm" className="border-[#2A2A2A]"><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Card className="border-[#2A2A2A]"><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Aguardando</span></div><p className="text-xl font-bold text-amber-500">{kycQueue.filter(k => k.status === "submitted").length}</p></CardContent></Card>
            <Card className="border-[#2A2A2A]"><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Aprovados</span></div><p className="text-xl font-bold text-emerald-500">{kycQueue.filter(k => k.status === "approved").length}</p></CardContent></Card>
            <Card className="border-[#2A2A2A]"><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><XCircle className="w-4 h-4 text-destructive" /><span className="text-xs text-muted-foreground">Reprovados</span></div><p className="text-xl font-bold text-destructive">{kycQueue.filter(k => k.status === "rejected").length}</p></CardContent></Card>
          </div>
          {kycLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="border-[#2A2A2A]"><TableHead>Lojista</TableHead><TableHead>Data Envio</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {kycQueue.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum registro de KYC</TableCell></TableRow>}
                {kycQueue.map(k => (
                  <TableRow key={k.id} className="border-[#2A2A2A]">
                    <TableCell><div className="flex flex-col"><span className="font-medium text-sm">{k.full_name || "Sem nome"}</span><span className="text-xs text-muted-foreground">{k.email}</span></div></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.submitted_at ? format(new Date(k.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell>{getKycStatusBadge(k.status)}</TableCell>
                    <TableCell className="text-right">
                      {k.status === "submitted" ? (
                        <div className="flex gap-1 justify-end">
                          {selectedKycId === k.id ? (
                            <div className="flex items-center gap-2">
                              <input className="border rounded px-2 py-1 text-xs w-48 bg-background" placeholder="Motivo da reprovação..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                              <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={kycProcessing} onClick={() => handleKycReject(k.id)}><ThumbsDown className="w-3 h-3 mr-1" />Reprovar</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedKycId(null); setRejectReason(""); }}>Cancelar</Button>
                            </div>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs" disabled={kycProcessing} onClick={() => handleKycApprove(k.id)}><ThumbsUp className="w-3 h-3 mr-1" />Aprovar</Button>
                              <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-7 text-xs" onClick={() => setSelectedKycId(k.id)}><ThumbsDown className="w-3 h-3 mr-1" />Reprovar</Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{k.reject_reason || "—"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* === SEÇÃO SAQUES === */}
      <Card className="border-[#2A2A2A]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm">Gerenciar Saques</CardTitle>
            <CardDescription>Aprove ou rejeite solicitações de saque dos lojistas</CardDescription>
          </div>
          <Button onClick={fetchWithdrawals} variant="outline" size="sm" className="border-[#2A2A2A]"><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Card className="border-[#2A2A2A]"><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Pendentes</span></div><p className="text-xl font-bold text-amber-500">{withdrawals.filter(w => w.status === "pending" || w.status === "processing").length}</p></CardContent></Card>
            <Card className="border-[#2A2A2A]"><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Valor Pendente</span></div><p className="text-xl font-bold text-amber-500">{formatCurrency(withdrawals.filter(w => w.status === "pending" || w.status === "processing").reduce((s, w) => s + w.amount, 0))}</p></CardContent></Card>
            <Card className="border-[#2A2A2A]"><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Total Aprovado</span></div><p className="text-xl font-bold text-emerald-500">{formatCurrency(withdrawals.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0))}</p></CardContent></Card>
          </div>
          {wLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs value={wTab} onValueChange={setWTab}>
              <TabsList><TabsTrigger value="pending">Pendentes</TabsTrigger><TabsTrigger value="approved">Aprovados</TabsTrigger><TabsTrigger value="rejected">Rejeitados</TabsTrigger><TabsTrigger value="all">Todos</TabsTrigger></TabsList>
              <TabsContent value={wTab} className="mt-4">
                {(() => {
                  const filtered = withdrawals.filter(w => {
                    if (wTab === "pending") return w.status === "pending" || w.status === "processing";
                    if (wTab === "approved") return w.status === "approved";
                    if (wTab === "rejected") return w.status === "rejected";
                    return true;
                  });
                  return filtered.length === 0 ? (
                    <div className="flex items-center justify-center py-8"><p className="text-muted-foreground text-sm">Nenhuma solicitação nesta categoria.</p></div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow className="border-[#2A2A2A]"><TableHead>Data</TableHead><TableHead>Lojista</TableHead><TableHead>Valor</TableHead><TableHead>Chave PIX</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filtered.map(w => {
                          const profile = wProfiles[w.user_id];
                          return (
                            <TableRow key={w.id} className="border-[#2A2A2A]">
                              <TableCell className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</TableCell>
                              <TableCell><div><p className="text-sm font-medium">{profile?.full_name || "—"}</p><p className="text-xs text-muted-foreground">{profile?.email || ""}</p></div></TableCell>
                              <TableCell className="font-medium">{formatCurrency(w.amount)}</TableCell>
                              <TableCell className="text-xs font-mono">{w.pix_key_type.toUpperCase()}: {w.pix_key}</TableCell>
                              <TableCell>{getWithdrawalStatusBadge(w.status)}</TableCell>
                              <TableCell className="text-right">
                                {(w.status === "pending" || w.status === "processing") ? (
                                  <div className="flex gap-1 justify-end">
                                    <Button size="sm" variant="outline" className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs" onClick={() => { setReviewDialog({ open: true, withdrawal: w, action: "approved" }); setAdminNotes(""); }}><CheckCircle className="w-3 h-3 mr-1" />Aprovar</Button>
                                    <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-7 text-xs" onClick={() => { setReviewDialog({ open: true, withdrawal: w, action: "rejected" }); setAdminNotes(""); }}><XCircle className="w-3 h-3 mr-1" />Rejeitar</Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{w.admin_notes || "—"}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  );
                })()}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(o) => { if (!o) setReviewDialog({ open: false, withdrawal: null, action: "approved" }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{reviewDialog.action === "approved" ? "Aprovar Saque" : "Rejeitar Saque"}</DialogTitle></DialogHeader>
          {reviewDialog.withdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground text-xs">Valor</p><p className="font-bold text-lg">{formatCurrency(reviewDialog.withdrawal.amount)}</p></div>
                <div><p className="text-muted-foreground text-xs">Líquido (após taxa R$10)</p><p className="font-bold text-lg text-emerald-500">{formatCurrency(reviewDialog.withdrawal.amount - 1000)}</p></div>
              </div>
              <div className="text-sm"><p className="text-muted-foreground text-xs">Chave PIX</p><p className="font-mono">{reviewDialog.withdrawal.pix_key_type.toUpperCase()}: {reviewDialog.withdrawal.pix_key}</p></div>
              <div><Label className="text-xs">Observações {reviewDialog.action === "rejected" && "(obrigatório)"}</Label><Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder={reviewDialog.action === "rejected" ? "Motivo da rejeição..." : "Observações opcionais..."} className="mt-1" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, withdrawal: null, action: "approved" })}>Cancelar</Button>
            <Button variant={reviewDialog.action === "approved" ? "default" : "destructive"} onClick={handleWithdrawalReview} disabled={wSubmitting}>
              {wSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {reviewDialog.action === "approved" ? "Aprovar e Enviar PIX" : "Rejeitar Saque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabela de Lojistas */}
      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-sm">Lojistas Cadastrados</CardTitle>
          <CardDescription>Gerencie os lojistas da plataforma</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Lojista</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="border-[#2A2A2A]">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{user.full_name || user.email}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                      {user.id === currentUserId && <Badge variant="outline" className="w-fit text-[10px] mt-1">Você</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.subscription_status === "active" ? "default" : "secondary"} className={user.subscription_status === "active" ? "bg-emerald-500/10 text-emerald-400 border-0" : ""}>
                      {user.subscription_status === "active" ? "Ativo" : user.subscription_status === "pending" ? "Pendente" : user.subscription_status === "expired" ? "Expirado" : user.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.subscription_expires_at ? (
                      <div className="flex flex-col">
                        <span className="text-xs">{format(new Date(user.subscription_expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(user.subscription_expires_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${user.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className="text-xs">{user.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {user.roles.includes("admin") ? "Admin" : "Lojista"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleAdminRole(user.id, user.roles)} disabled={user.id === currentUserId} title={user.roles.includes("admin") ? "Remover Admin" : "Tornar Admin"}>
                        {user.roles.includes("admin") ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleUserStatus(user.id, user.is_active)} disabled={user.id === currentUserId}>
                        {user.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeletingUser(user)} disabled={user.id === currentUserId}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhum lojista cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lojista</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover <strong>{deletingUser?.email}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deletingUser) { deleteUser(deletingUser.id); setDeletingUser(null); } }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminGateway;
