import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Shield, ShieldOff, UserCheck, UserX, RefreshCw, Pencil, Users, DollarSign, Key, AlertCircle, Trash2, Wallet, Clock, CheckCircle, XCircle, Eye, FileSearch, ThumbsUp, ThumbsDown, MessageSquare, Save, Search } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { ViewUserAccountDialog } from "@/components/admin/ViewUserAccountDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { isMobileZapiInstance } from "@/hooks/useZapiInstances";

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

const AdminZapLynx = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string>();
   const { users, loading: usersLoading, toggleUserStatus, toggleAdminRole, deleteUser, refetch } = useAdminUsers();
   const [checkingSubscriptions, setCheckingSubscriptions] = useState(false);
   const handleCheckSubscriptions = async () => {
     setCheckingSubscriptions(true);
     try {
       const { data, error } = await supabase.functions.invoke("check-subscriptions");
       if (error) throw error;
       toast.success(`${data.expired_count} assinaturas marcadas como expiradas.`);
       refetch();
     } catch (err: any) {
       console.error("Error checking subscriptions:", err);
       toast.error("Erro ao verificar assinaturas: " + err.message);
     } finally {
       setCheckingSubscriptions(false);
     }
   };

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // KYC
  const { queue: kycQueue, loading: kycLoading, approveKyc, rejectKyc, refetch: refetchKyc } = useAdminKycQueue();

  // Account activation
  const [activationEmail, setActivationEmail] = useState("");
  const [activationUser, setActivationUser] = useState<UserProfile | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationSubmitting, setActivationSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [kycProcessing, setKycProcessing] = useState(false);
  const [selectedKycId, setSelectedKycId] = useState<string | null>(null);

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [wProfiles, setWProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [wLoading, setWLoading] = useState(true);
  const [totalZapiInstances, setTotalZapiInstances] = useState<number>(0);
  const [plansMap, setPlansMap] = useState<Record<string, number>>({});
  const [wTab, setWTab] = useState("pending");
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; withdrawal: Withdrawal | null; action: "approved" | "rejected" }>({ open: false, withdrawal: null, action: "approved" });
  const [adminNotes, setAdminNotes] = useState("");
  const [notePhone, setNotePhone] = useState("");
  const [chatNote, setChatNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteInstanceId, setNoteInstanceId] = useState("");
  const [wSubmitting, setWSubmitting] = useState(false);

  const handleSaveChatNote = async () => {
    const phone = notePhone.replace(/\D/g, "");
    if (!phone || !chatNote.trim() || !noteInstanceId) {
      toast.error("Informe a instância, o telefone e o conteúdo da nota");
      return;
    }
    setIsSavingNote(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: "save-chat-notes", phone, instanceDbId: noteInstanceId, payload: { notes: chatNote.trim() } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Erro na API");
      toast.success("Nota salva com sucesso!");
      setChatNote("");
      setNotePhone("");
    } catch (err: any) {
      console.error("Error saving chat note:", err);
      toast.error("Erro ao salvar nota: " + err.message);
    } finally {
      setIsSavingNote(false);
    }
  };

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

  useEffect(() => { fetchWithdrawals(); }, []);

  useEffect(() => {
    const fetchInstancesCount = async () => {
      const { data } = await (supabase as any)
        .from('zapi_instances')
        .select('id, instance_name, instance_type, api_provider');
      setTotalZapiInstances(((data || []) as any[]).filter((item) => (item.api_provider || 'zapi') === 'zapi' && !isMobileZapiInstance(item)).length);
    };
    fetchInstancesCount();
  }, []);

  useEffect(() => {
    (supabase as any).from('subscription_plans').select('id, price').then(({ data }: any) => {
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.price; });
      setPlansMap(map);
    });
  }, []);

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

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.subscription_status === 'active').length;
    const pending = users.filter(u => u.subscription_status === 'pending').length;
    const withZapi = users.filter(u => u.zapi_instance_id).length;
    const expired = users.filter(u => u.subscription_status === 'expired').length;
    const cancelled = users.filter(u => u.subscription_status === 'cancelled').length;
    // sum real plan prices (in cents) per user status
    const sumByStatus = (status: string) =>
      users
        .filter(u => u.subscription_status === status)
        .reduce((s, u) => {
          const planPrice = u.plan_id ? (plansMap[u.plan_id] || 0) : 0;
          const customPrice = u.custom_plan_value || 0;
          return s + (planPrice || customPrice);
        }, 0) / 100;
    const planosPagosRS = sumByStatus('active');
    const reembolsosRS = sumByStatus('cancelled');
    return { total, active, pending, withZapi, expired, cancelled, planosPagosRS, reembolsosRS };
  }, [users, plansMap]);

  const getSubscriptionBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default", pending: "secondary", expired: "destructive", cancelled: "outline",
    };
    const labels: Record<string, string> = {
      active: "Pago", pending: "Pendente", expired: "Expirado", cancelled: "Cancelado",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);
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
          <p className="text-muted-foreground mt-1">Gerencie usuários, assinaturas e instâncias</p>
        </div>
         <div className="flex gap-2 flex-wrap sm:flex-nowrap">
           <Button 
             onClick={handleCheckSubscriptions} 
             variant="outline" 
             size="sm" 
             disabled={checkingSubscriptions}
             className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
           >
             {checkingSubscriptions ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
             Validar Expirações
           </Button>
           <Button onClick={() => navigate("/dashboard")} variant="outline" size="sm">Voltar ao Dashboard</Button>
           <Button onClick={refetch} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Cadastrados no sistema</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{stats.active}</div><p className="text-xs text-muted-foreground">Assinaturas ativas</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div><p className="text-xs text-muted-foreground">Aguardando pagamento</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.expired}</div><p className="text-xs text-muted-foreground">Assinaturas vencidas</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias Configuradas</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalZapiInstances}</div><p className="text-xs text-muted-foreground">Instâncias Z-API ativas</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Pagos (R$)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.planosPagosRS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground">{stats.active} assinatura(s) ativa(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reembolsos</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.reembolsosRS.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground">{stats.cancelled} cancelamento(s)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>Gerencie status de pagamento, permissões e configurações de todos os usuários</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Instância</TableHead>
                  <TableHead className="min-w-[96px]">Status</TableHead>
                  <TableHead className="sticky right-0 z-10 min-w-[168px] border-l bg-background text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{user.email}</span>
                        {user.id === currentUserId && <Badge variant="outline" className="w-fit text-xs mt-1">Você</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      {user.whatsapp ? (
                        <span className="text-sm font-mono">{user.whatsapp}</span>
                      ) : <span className="text-muted-foreground text-sm">-</span>}
                    </TableCell>
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
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(user.subscription_expires_at), { addSuffix: true, locale: ptBR })}</span>
                        </div>
                      ) : <span className="text-muted-foreground text-sm">-</span>}
                    </TableCell>
                    <TableCell>
                      {user.zapi_instance_id ? (
                        <div className="flex flex-col">
                          <Badge variant="outline" className="font-mono text-xs w-fit">{user.zapi_instance_id}</Badge>
                          {user.zapi_token && <span className="text-xs text-green-600 mt-1">✓ Configurado</span>}
                        </div>
                      ) : <span className="text-muted-foreground text-sm">Não configurado</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>{user.is_active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 border-l bg-background">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setViewingUser(user); setViewDialogOpen(true); }} title="Ver conta completa"><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => handleEditUser(user)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant={user.roles.includes("admin") ? "destructive" : "default"} onClick={() => toggleAdminRole(user.id, user.roles)} disabled={user.id === currentUserId} title={user.roles.includes("admin") ? "Remover Admin" : "Tornar Admin"}>
                          {user.roles.includes("admin") ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleUserStatus(user.id, user.is_active)} disabled={user.id === currentUserId} title={user.is_active ? "Desativar" : "Ativar"}>
                          {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeletingUser(user)} disabled={user.id === currentUserId} title="Remover usuário"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* === SEÇÃO NOTAS DE CHAT === */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <CardTitle>Notas de Chats (WhatsApp Business)</CardTitle>
          </div>
          <CardDescription>Adicione anotações internas a conversas específicas utilizando a API oficial.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Selecione a Instância Z-API</Label>
                <Select value={noteInstanceId} onValueChange={setNoteInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma instância..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.zapi_instance_id).map(u => (
                      <SelectItem key={u.id} value={u.zapi_instance_id!}>
                        {u.full_name || u.email} ({u.zapi_instance_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefone do Cliente (DDI + DDD + Número)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Ex: 5511999999999" 
                    value={notePhone} 
                    onChange={e => setNotePhone(e.target.value)} 
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nota / Anotação Interna</Label>
                <Textarea 
                  placeholder="Digite aqui as observações sobre este chat..." 
                  value={chatNote} 
                  onChange={e => setChatNote(e.target.value)} 
                  rows={4}
                  className="resize-none"
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleSaveChatNote} 
                disabled={isSavingNote || !notePhone || !chatNote.trim() || !noteInstanceId}
              >
                {isSavingNote ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Nota no Chat
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === SEÇÃO KYC === */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Aprovação de Contas (KYC)</CardTitle>
            <CardDescription>Analise e aprove documentos de verificação dos usuários</CardDescription>
          </div>
          <Button onClick={refetchKyc} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Aguardando</span></div>
                <p className="text-xl font-bold text-amber-500">{kycQueue.filter(k => k.status === "submitted").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Aprovados</span></div>
                <p className="text-xl font-bold text-emerald-500">{kycQueue.filter(k => k.status === "approved").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1"><XCircle className="w-4 h-4 text-destructive" /><span className="text-xs text-muted-foreground">Reprovados</span></div>
                <p className="text-xl font-bold text-destructive">{kycQueue.filter(k => k.status === "rejected").length}</p>
              </CardContent>
            </Card>
          </div>

          {kycLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data Envio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kycQueue.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum registro de KYC</TableCell></TableRow>
                  )}
                  {kycQueue.map(k => (
                    <TableRow key={k.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{k.full_name || "Sem nome"}</span>
                          <span className="text-xs text-muted-foreground">{k.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.submitted_at ? format(new Date(k.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell>{getKycStatusBadge(k.status)}</TableCell>
                      <TableCell className="text-right">
                        {k.status === "submitted" ? (
                          <div className="flex gap-1 justify-end">
                            {selectedKycId === k.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  className="border rounded px-2 py-1 text-xs w-48 bg-background"
                                  placeholder="Motivo da reprovação..."
                                  value={rejectReason}
                                  onChange={e => setRejectReason(e.target.value)}
                                />
                                <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={kycProcessing} onClick={() => handleKycReject(k.id)}>
                                  <ThumbsDown className="w-3 h-3 mr-1" />Reprovar
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedKycId(null); setRejectReason(""); }}>Cancelar</Button>
                              </div>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs" disabled={kycProcessing} onClick={() => handleKycApprove(k.id)}>
                                  <ThumbsUp className="w-3 h-3 mr-1" />Aprovar
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-7 text-xs" onClick={() => setSelectedKycId(k.id)}>
                                  <ThumbsDown className="w-3 h-3 mr-1" />Reprovar
                                </Button>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* === SEÇÃO SAQUES === */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gerenciar Saques</CardTitle>
            <CardDescription>Aprove ou rejeite solicitações de saque dos lojistas</CardDescription>
          </div>
          <Button onClick={fetchWithdrawals} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Pendentes</span></div>
                <p className="text-xl font-bold text-amber-500">{withdrawals.filter(w => w.status === "pending" || w.status === "processing").length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1"><Wallet className="w-4 h-4 text-amber-500" /><span className="text-xs text-muted-foreground">Valor Pendente</span></div>
                <p className="text-xl font-bold text-amber-500">{formatCurrency(withdrawals.filter(w => w.status === "pending" || w.status === "processing").reduce((s, w) => s + w.amount, 0))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1"><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Total Aprovado</span></div>
                <p className="text-xl font-bold text-emerald-500">{formatCurrency(withdrawals.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0))}</p>
              </CardContent>
            </Card>
          </div>

          {wLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs value={wTab} onValueChange={setWTab}>
              <TabsList>
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="approved">Aprovados</TabsTrigger>
                <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
                <TabsTrigger value="all">Todos</TabsTrigger>
              </TabsList>
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
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Lojista</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Chave PIX</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map(w => {
                            const profile = wProfiles[w.user_id];
                            return (
                              <TableRow key={w.id}>
                                <TableCell className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</TableCell>
                                <TableCell>
                                  <div><p className="text-sm font-medium">{profile?.full_name || "—"}</p><p className="text-xs text-muted-foreground">{profile?.email || ""}</p></div>
                                </TableCell>
                                <TableCell className="font-medium">{formatCurrency(w.amount)}</TableCell>
                                <TableCell className="text-xs font-mono">{w.pix_key_type.toUpperCase()}: {w.pix_key}</TableCell>
                                <TableCell>{getWithdrawalStatusBadge(w.status)}</TableCell>
                                <TableCell className="text-right">
                                  {(w.status === "pending" || w.status === "processing") ? (
                                    <div className="flex gap-1 justify-end">
                                      <Button size="sm" variant="outline" className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs" onClick={() => { setReviewDialog({ open: true, withdrawal: w, action: "approved" }); setAdminNotes(""); }}>
                                        <CheckCircle className="w-3 h-3 mr-1" />Aprovar
                                      </Button>
                                      <Button size="sm" variant="outline" className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-7 text-xs" onClick={() => { setReviewDialog({ open: true, withdrawal: w, action: "rejected" }); setAdminNotes(""); }}>
                                        <XCircle className="w-3 h-3 mr-1" />Rejeitar
                                      </Button>
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
                    </div>
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
          <DialogHeader>
            <DialogTitle>{reviewDialog.action === "approved" ? "Aprovar Saque" : "Rejeitar Saque"}</DialogTitle>
          </DialogHeader>
          {reviewDialog.withdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Lojista</p><p className="font-medium">{wProfiles[reviewDialog.withdrawal.user_id]?.full_name || "—"}</p></div>
                <div><p className="text-muted-foreground">Valor</p><p className="font-medium text-lg">{formatCurrency(reviewDialog.withdrawal.amount)}</p></div>
                <div><p className="text-muted-foreground">Tipo de chave</p><p className="font-medium uppercase">{reviewDialog.withdrawal.pix_key_type}</p></div>
                <div><p className="text-muted-foreground">Chave PIX</p><p className="font-mono text-xs break-all">{reviewDialog.withdrawal.pix_key}</p></div>
              </div>
              <div className="space-y-2">
                <Label>{reviewDialog.action === "rejected" ? "Motivo da rejeição *" : "Observação (opcional)"}</Label>
                <Textarea placeholder={reviewDialog.action === "rejected" ? "Informe o motivo..." : "Observação..."} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false, withdrawal: null, action: "approved" })}>Cancelar</Button>
            <Button onClick={handleWithdrawalReview} disabled={wSubmitting} className={reviewDialog.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
              {wSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {reviewDialog.action === "approved" ? "Confirmar Aprovação" : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditUserDialog user={editingUser} open={editDialogOpen} onOpenChange={setEditDialogOpen} onSuccess={refetch} />
      <ViewUserAccountDialog user={viewingUser} open={viewDialogOpen} onOpenChange={setViewDialogOpen} />

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover o usuário <strong>{deletingUser?.email}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
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

export default AdminZapLynx;
