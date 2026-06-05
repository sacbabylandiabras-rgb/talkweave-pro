import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trash2, UserPlus, Copy, RefreshCw, Check, X } from "lucide-react";
import { useTeam } from "@/contexts/TeamContext";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";

export default function Equipe() {
  const team = useTeam();
  const navigate = useNavigate();
  const { instances } = useZapiInstances();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);

  // Dialogs
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteInstances, setInviteInstances] = useState<string[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);

  // Verificar se é o proprietário
  const isOwner = team.selfUserId === team.ownerId;

  useEffect(() => {
    if (team.loading) return;
    if (team.isEmployee && team.ownerId !== team.selfUserId) {
      navigate("/dashboard");
      return;
    }
    void bootstrap();
  }, [team.loading, team.isEmployee]);

  async function bootstrap() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data: t } = await (supabase as any).from("teams").select("*").eq("owner_id", user.id).maybeSingle();
      
      if (!t) {
        const { data: created, error } = await (supabase as any).from("teams").insert({ 
          owner_id: user.id, 
          name: "Minha equipe" 
        }).select().single();
        
        if (error) {
          console.error("Erro ao criar equipe:", error);
          setLoading(false);
          return;
        }
        t = created;
      }
      
      setTeamId(t.id);
      await Promise.all([
        loadMembers(t.id),
        loadInvites(t.id)
      ]);
    } catch (error) {
      console.error("Erro ao carregar equipe:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(tid: string) {
    try {
      const { data, error } = await (supabase as any).from("team_members").select(`
        *,
        profiles!user_id (
          id,
          email,
          full_name
        )
      `).eq("team_id", tid).order("created_at");

      if (error) {
        console.error("Erro ao carregar membros:", error);
        return;
      }
      setMembers(data || []);
    } catch (err) {
      console.error("Erro ao buscar membros:", err);
    }
  }

  async function loadInvites(tid: string) {
    try {
      const { data, error } = await (supabase as any).from("team_invites")
        .select("*")
        .eq("team_id", tid)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar convites:", error);
        return;
      }
      setInvites(data || []);
    } catch (err) {
      console.error("Erro ao buscar convites:", err);
    }
  }

  async function sendInvite() {
    if (!team.selfUserId) {
      toast({ title: "Erro", description: "Sessão inválida", variant: "destructive" });
      return;
    }

    try {
      // Obter o limite do plano do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("max_team_members")
        .eq("id", team.selfUserId)
        .single();
      
      const max = Number((profile as any)?.max_team_members ?? 1);

      if (members.length + invites.length >= max) {
        toast({ 
          title: "Limite atingido", 
          description: `Sua conta permite no máximo ${max} funcionários (incluindo convites pendentes).`,
          variant: "destructive"
        });
        return;
      }

      const email = inviteEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email) {
        toast({ title: "Atenção", description: "Informe o email do funcionário", variant: "destructive" });
        return;
      }

      if (!emailRegex.test(email)) {
        toast({ title: "Atenção", description: "O email informado é inválido", variant: "destructive" });
        return;
      }

      setSendingInvite(true);
      const { data, error } = await supabase.functions.invoke("team-invite-send", {
        body: { 
          email: email,
          allowedInstanceIds: inviteInstances
        }
      });

      if (error || (data as any)?.error) {
        toast({ 
          title: "Erro ao enviar convite", 
          description: (data as any)?.error || error?.message, 
          variant: "destructive" 
        });
        return;
      }

      toast({ 
        title: (data as any)?.message ? "Convite registrado!" : "Convite enviado!", 
        description: (data as any)?.message || "O funcionário receberá um email com as instruções." 
      });

      setInviteOpen(false);
      setInviteEmail("");
      setInviteInstances([]);
      if (teamId) await loadInvites(teamId);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha na comunicação com o servidor", variant: "destructive" });
    } finally {
      setSendingInvite(false);
    }
  }

  async function cancelInvite(id: string) {
    if (!confirm("Deseja realmente cancelar este convite?")) return;

    setOperationLoading(id);
    try {
      const { error } = await (supabase as any).from("team_invites").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Convite cancelado" });
      if (teamId) await loadInvites(teamId);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível cancelar o convite", variant: "destructive" });
    } finally {
      setOperationLoading(null);
    }
  }

  async function copyInviteLink(inv: any) {
    try {
      const origin = "https://zaplynx.com"; // Ajustado para o domínio do sistema
      const url = `${origin}/aceitar-convite?token=${inv.token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "Envie este link para o funcionário." });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível copiar o link", variant: "destructive" });
    }
  }

  async function removeMember(id: string) {
    if (!isOwner) {
      toast({ title: "Erro", description: "Apenas o proprietário pode remover membros", variant: "destructive" });
      return;
    }

    if (!confirm("Deseja remover este funcionário da sua equipe? Ele perderá acesso imediatamente.")) return;

    setOperationLoading(id);
    try {
      const { error } = await (supabase as any).from("team_members").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Funcionário removido" });
      if (teamId) await loadMembers(teamId);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível remover o funcionário", variant: "destructive" });
    } finally {
      setOperationLoading(null);
    }
  }

  async function toggleMemberStatus(m: any) {
    if (!isOwner) {
      toast({ title: "Erro", description: "Apenas o proprietário pode alterar status", variant: "destructive" });
      return;
    }

    const next = m.status === "active" ? "suspended" : "active";
    setOperationLoading(m.id);

    try {
      const { error } = await (supabase as any).from("team_members").update({ status: next }).eq("id", m.id);

      if (error) throw error;

      toast({ title: "Sucesso", description: `Funcionário ${next === "active" ? "ativado" : "suspenso"}` });
      if (teamId) await loadMembers(teamId);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível alterar o status", variant: "destructive" });
    } finally {
      setOperationLoading(null);
    }
  }

  if (team.loading || (loading && !teamId)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando equipe...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Equipe</h1>
          <p className="text-sm text-muted-foreground">Adicione funcionários e controle o acesso deles.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} disabled={!isOwner}>
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Funcionário
        </Button>
      </div>

      <Tabs defaultValue="members">
        <TabsList className="mb-4">
          <TabsTrigger value="members">Funcionários ({members.length})</TabsTrigger>
          <TabsTrigger value="invites">Convites Pendentes ({invites.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {members.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">Nenhum funcionário ativo</h3>
                  <p className="text-sm text-muted-foreground">Convide sua equipe para começar a colaborar.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setInviteOpen(true)}
                  disabled={!isOwner}
                >
                  Enviar convite
                </Button>
              </CardContent>
            </Card>
          ) : (
            members.map(m => (
              <Card key={m.id} className="overflow-hidden">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">
                      {m.profiles?.full_name || "Sem nome"}
                      <Badge variant={m.status === "active" ? "default" : "destructive"}>
                        {m.status === "active" ? "Ativo" : "Suspenso"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {m.profiles?.email || m.invited_email}
                    </div>
                  </div>

                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => toggleMemberStatus(m)}
                        disabled={operationLoading === m.id}
                      >
                        {operationLoading === m.id ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : m.status === "active" ? (
                          <X className="w-4 h-4 mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {m.status === "active" ? "Suspender" : "Reativar"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeMember(m.id)}
                        disabled={operationLoading === m.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
                {m.allowed_instance_ids?.length > 0 && (
                  <div className="px-4 py-2 bg-muted/30 border-t text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    Acesso às instâncias: {m.allowed_instance_ids.length}
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="invites" className="space-y-4">
          {invites.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Nenhum convite pendente.
              </CardContent>
            </Card>
          ) : (
            invites.map(inv => (
              <Card key={inv.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Enviado em {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyInviteLink(inv)}
                        disabled={operationLoading === inv.id}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Link
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive"
                        onClick={() => cancelInvite(inv.id)}
                        disabled={operationLoading === inv.id}
                      >
                        {operationLoading === inv.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do funcionário</Label>
              <Input 
                id="email" 
                placeholder="exemplo@email.com" 
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={sendingInvite}
              />
              <p className="text-[10px] text-muted-foreground">
                O funcionário deverá criar uma conta com este mesmo email.
              </p>
            </div>

            {instances.length > 0 && (
              <div className="space-y-3">
                <Label>Instâncias permitidas</Label>
                <div className="grid grid-cols-1 gap-2 border rounded-md p-3 max-h-[150px] overflow-y-auto">
                  {instances.map(inst => (
                    <div key={inst.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`inst-${inst.id}`} 
                        checked={inviteInstances.includes(inst.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setInviteInstances([...inviteInstances, inst.id]);
                          } else {
                            setInviteInstances(inviteInstances.filter(id => id !== inst.id));
                          }
                        }}
                        disabled={sendingInvite}
                      />
                      <label
                        htmlFor={`inst-${inst.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {inst.instance_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={sendingInvite}>
              Cancelar
            </Button>
            <Button onClick={sendInvite} disabled={sendingInvite || !inviteEmail.trim()}>
              {sendingInvite ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
