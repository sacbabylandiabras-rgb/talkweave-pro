import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { Loader2, Shield, ShieldOff, UserCheck, UserX, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Admin = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const { isAdmin, loading: roleLoading } = useUserRole(currentUserId);
  const { users, loading: usersLoading, toggleUserStatus, toggleAdminRole, refetch } = useAdminUsers();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(session.user.id);
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin && currentUserId) {
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, currentUserId, navigate]);

  if (roleLoading || usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Painel de Administração</h1>
          <p className="text-muted-foreground mt-1">Gerencie usuários e permissões do sistema</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>
            Total de {users.length} usuário{users.length !== 1 ? "s" : ""} no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.roles.map((role) => (
                          <Badge
                            key={role}
                            variant={role === "admin" ? "default" : "secondary"}
                          >
                            {role === "admin" ? "Administrador" : "Usuário"}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant={user.roles.includes("admin") ? "destructive" : "default"}
                          onClick={() => toggleAdminRole(user.id, user.roles)}
                          disabled={user.id === currentUserId}
                        >
                          {user.roles.includes("admin") ? (
                            <>
                              <ShieldOff className="w-4 h-4 mr-1" />
                              Remover Admin
                            </>
                          ) : (
                            <>
                              <Shield className="w-4 h-4 mr-1" />
                              Tornar Admin
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          disabled={user.id === currentUserId}
                        >
                          {user.is_active ? (
                            <>
                              <UserX className="w-4 h-4 mr-1" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 mr-1" />
                              Ativar
                            </>
                          )}
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
    </div>
  );
};

export default Admin;
