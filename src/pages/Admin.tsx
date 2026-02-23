import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUsers, UserProfile } from "@/hooks/useAdminUsers";
import { Loader2, Shield, ShieldOff, UserCheck, UserX, RefreshCw, Pencil, Users, DollarSign, Key, AlertCircle, Trash2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Admin = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const { users, loading: usersLoading, toggleUserStatus, toggleAdminRole, deleteUser, refetch } = useAdminUsers();
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  // Estatísticas dos usuários
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.subscription_status === 'active').length;
    const pending = users.filter(u => u.subscription_status === 'pending').length;
    const withZapi = users.filter(u => u.zapi_instance_id).length;
    const expired = users.filter(u => u.subscription_status === 'expired').length;

    return { total, active, pending, withZapi, expired };
  }, [users]);

  const getSubscriptionBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      pending: "secondary",
      expired: "destructive",
      cancelled: "outline",
    };
    const labels: Record<string, string> = {
      active: "Pago",
      pending: "Pendente",
      expired: "Expirado",
      cancelled: "Cancelado",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      }
    };
    getCurrentUser();
  }, []);

  if (usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Painel de Administração</h1>
          <p className="text-muted-foreground mt-1">Gerencie usuários, assinaturas e chaves Z-API</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">
            Voltar ao Dashboard
          </Button>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Assinaturas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Aguardando pagamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">Assinaturas vencidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Z-API Configurados</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withZapi}</div>
            <p className="text-xs text-muted-foreground">Chaves configuradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>
            Gerencie status de pagamento, permissões e configurações Z-API de todos os usuários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Z-API</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{user.email}</span>
                        {user.id === currentUserId && (
                          <Badge variant="outline" className="w-fit text-xs mt-1">Você</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.roles.includes("admin") ? "default" : "secondary"}>
                        {user.roles.includes("admin") ? "Administrador" : "Usuário"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getSubscriptionBadge(user.subscription_status)}</TableCell>
                    <TableCell>
                      {user.subscription_expires_at ? (
                        <div className="flex flex-col text-sm">
                          <span>{format(new Date(user.subscription_expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(user.subscription_expires_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.zapi_instance_id ? (
                        <div className="flex flex-col">
                          <Badge variant="outline" className="font-mono text-xs w-fit">
                            {user.zapi_instance_id}
                          </Badge>
                          {user.zapi_token && (
                            <span className="text-xs text-green-600 mt-1">✓ Configurado</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não configurado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={user.roles.includes("admin") ? "destructive" : "default"}
                          onClick={() => toggleAdminRole(user.id, user.roles)}
                          disabled={user.id === currentUserId}
                          title={user.roles.includes("admin") ? "Remover Admin" : "Tornar Admin"}
                        >
                          {user.roles.includes("admin") ? (
                            <ShieldOff className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          disabled={user.id === currentUserId}
                          title={user.is_active ? "Desativar" : "Ativar"}
                        >
                          {user.is_active ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeletingUser(user)}
                          disabled={user.id === currentUserId}
                          title="Remover usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditUserDialog
        user={editingUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={refetch}
      />

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o usuário <strong>{deletingUser?.email}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingUser) {
                  deleteUser(deletingUser.id);
                  setDeletingUser(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
