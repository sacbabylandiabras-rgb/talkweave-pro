import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, UserProfile } from "@/hooks/useAdminUsers";
import { Loader2, Users, DollarSign, ShoppingCart, TrendingUp, RefreshCw, Eye, Shield, ShieldOff, UserCheck, UserX, Pencil, Trash2, Building2, CreditCard, BarChart3, Wallet } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const AdminGateway = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const { users, loading: usersLoading, toggleUserStatus, toggleAdminRole, deleteUser, refetch } = useAdminUsers();
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [checkoutCount, setCheckoutCount] = useState(0);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);
    };
    getCurrentUser();

    const fetchStats = async () => {
      const { count: txCount } = await supabase.from("gateway_transactions").select("*", { count: "exact", head: true });
      const { count: ckCount } = await supabase.from("gateway_checkouts").select("*", { count: "exact", head: true });
      const { data: txData } = await supabase.from("gateway_transactions").select("amount").eq("status", "paid");
      setTransactionCount(txCount || 0);
      setCheckoutCount(ckCount || 0);
      setTotalVolume(txData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0);
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
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4D2E]" />
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
          { label: "Volume Total", value: `R$ ${(totalVolume / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: "text-[#FF4D2E]" },
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
              <p className="text-lg font-bold text-[#FF4D2E]">R$ 0,00</p>
            </div>
            <DollarSign className="w-8 h-8 text-muted-foreground/20" />
          </CardContent>
        </Card>
      </div>

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
