import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Loader2, Eye, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
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

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

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

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("pending");
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; withdrawal: Withdrawal | null; action: "approved" | "rejected" }>({
    open: false, withdrawal: null, action: "approved"
  });
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: wData } = await supabase
      .from("gateway_withdrawals" as any)
      .select("*")
      .order("created_at", { ascending: false });

    const list = (wData || []) as unknown as Withdrawal[];
    setWithdrawals(list);

    // Fetch profiles for all unique user_ids
    const userIds = [...new Set(list.map(w => w.user_id))];
    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const map: Record<string, Profile> = {};
      (pData || []).forEach(p => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleReview = async () => {
    if (!reviewDialog.withdrawal) return;
    if (reviewDialog.action === "rejected" && !adminNotes.trim()) {
      toast.error("Informe o motivo da rejeição");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("gateway_withdrawals" as any)
      .update({
        status: reviewDialog.action,
        admin_notes: adminNotes.trim() || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", reviewDialog.withdrawal.id);

    if (error) {
      toast.error("Erro ao atualizar saque");
    } else {
      toast.success(reviewDialog.action === "approved" ? "Saque aprovado!" : "Saque rejeitado");
      setReviewDialog({ open: false, withdrawal: null, action: "approved" });
      setAdminNotes("");
      fetchData();
    }
    setSubmitting(false);
  };

  const openReview = (w: Withdrawal, action: "approved" | "rejected") => {
    setReviewDialog({ open: true, withdrawal: w, action });
    setAdminNotes(w.admin_notes || "");
  };

  const filtered = withdrawals.filter(w => {
    if (selectedTab === "pending") return w.status === "pending" || w.status === "processing";
    if (selectedTab === "approved") return w.status === "approved";
    if (selectedTab === "rejected") return w.status === "rejected";
    return true;
  });

  const pendingCount = withdrawals.filter(w => w.status === "pending" || w.status === "processing").length;
  const approvedTotal = withdrawals.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0);
  const pendingTotal = withdrawals.filter(w => w.status === "pending" || w.status === "processing").reduce((s, w) => s + w.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciar Saques</h1>
        <p className="text-sm text-muted-foreground">Aprove ou rejeite solicitações de saque dos lojistas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Solicitações</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{withdrawals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Pendente</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{formatCurrency(pendingTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Aprovado</CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">{formatCurrency(approvedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Table */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="pending">
                Pendentes {pendingCount > 0 && <Badge className="ml-2 bg-amber-500/20 text-amber-400 text-xs">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">Aprovados</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-4">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground text-sm">Nenhuma solicitação nesta categoria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Lojista</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Tipo Chave</TableHead>
                        <TableHead>Chave PIX</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((w) => {
                        const profile = profiles[w.user_id];
                        return (
                          <TableRow key={w.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(w.created_at).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{profile?.full_name || "—"}</p>
                                <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(w.amount)}</TableCell>
                            <TableCell className="text-xs uppercase">{w.pix_key_type}</TableCell>
                            <TableCell className="text-xs font-mono max-w-[180px] truncate">{w.pix_key}</TableCell>
                            <TableCell>{getStatusBadge(w.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {w.admin_notes || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {(w.status === "pending" || w.status === "processing") ? (
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs"
                                    onClick={() => openReview(w, "approved")}
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-7 text-xs"
                                    onClick={() => openReview(w, "rejected")}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Rejeitar
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openReview(w, w.status as any)}>
                                  <Eye className="w-3 h-3 mr-1" /> Ver
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(o) => { if (!o) setReviewDialog({ open: false, withdrawal: null, action: "approved" }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approved" ? "Aprovar Saque" : "Rejeitar Saque"}
            </DialogTitle>
          </DialogHeader>
          {reviewDialog.withdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Lojista</p>
                  <p className="font-medium">{profiles[reviewDialog.withdrawal.user_id]?.full_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-medium text-lg">{formatCurrency(reviewDialog.withdrawal.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo de chave</p>
                  <p className="font-medium uppercase">{reviewDialog.withdrawal.pix_key_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Chave PIX</p>
                  <p className="font-mono text-xs break-all">{reviewDialog.withdrawal.pix_key}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{reviewDialog.action === "rejected" ? "Motivo da rejeição *" : "Observação (opcional)"}</Label>
                <Textarea
                  placeholder={reviewDialog.action === "rejected" ? "Informe o motivo da rejeição..." : "Observação..."}
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, withdrawal: null, action: "approved" })}>
              Cancelar
            </Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              className={reviewDialog.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {reviewDialog.action === "approved" ? "Confirmar Aprovação" : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
