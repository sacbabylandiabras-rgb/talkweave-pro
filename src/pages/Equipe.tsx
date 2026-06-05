import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trash2, Mail, RefreshCw, UserPlus, Plus } from "lucide-react";
import { useTeam, PERMISSION_KEYS, PermissionKey } from "@/contexts/TeamContext";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { useNavigate } from "react-router-dom";

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  chat: "Chat / Mensagens",
  campanhas: "Campanhas",
  contatos: "Contatos",
  etiquetas: "Etiquetas",
  modelos: "Modelos",
  fluxos: "Fluxos visuais",
  grupos: "Grupos",
  canais: "Canais",
  comunidades: "Comunidades",
  agente_ia: "Agente IA",
  relatorios: "Relatórios",
  aquecimento: "Aquecimento",
  disparo: "Disparo",
  extrair_membros: "Extrair membros",
};

export default function Equipe() {
  const team = useTeam();
  const navigate = useNavigate();
  const { instances } = useZapiInstances();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string>("");
  const [inviteInstances, setInviteInstances] = useState<string[]>([]);

  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleName, setRoleName] = useState("");
  const [rolePerms, setRolePerms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (team.loading) return;
    if (team.isEmployee) {
      navigate("/dashboard");
      return;
    }
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.loading, team.isEmployee]);

  async function bootstrap() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let { data: t } = await supabase.from("teams").select("*").eq("owner_id", user.id).maybeSingle();
    if (!t) {
      const { data: created } = await supabase.from("teams").insert({ owner_id: user.id, name: "Minha equipe" }).select().single();
      t = created;
    }
    setTeamId(t.id);
    await loadMembers(t.id);
    setLoading(false);
  }

  async function loadMembers(tid: string) {
    const { data } = await supabase.from("team_members").select("*").eq("team_id", tid).order("created_at");
    if (!data) { setMembers([]); return; }
    const ids = data.map((m: any) => m.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setMembers(data.map((m: any) => ({ ...m, profile: map.get(m.user_id) })));
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) { toast({ title: "Informe o email" }); return; }
    const { data, error } = await supabase.functions.invoke("team-invite-send", {
      body: { email: inviteEmail.trim().toLowerCase(), roleId: inviteRoleId || null, allowedInstanceIds: inviteInstances },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Erro ao enviar convite", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Convite enviado!", description: `Link: ${(data as any).inviteUrl}` });
    setInviteOpen(false); setInviteEmail(""); setInviteRoleId(""); setInviteInstances([]);
    // if (teamId) loadInvites(teamId);
  }

  async function cancelInvite(id: string) {
    await (supabase as any).from("team_invites").delete().eq("id", id);
    // if (teamId) loadInvites(teamId);
  }

  async function resendInvite(inv: any) {
    const url = `${window.location.origin}/aceitar-convite?token=${inv.token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: url });
  }

  async function removeMember(id: string) {
    if (!confirm("Remover funcionário?")) return;
    await supabase.from("team_members").delete().eq("id", id);
    if (teamId) loadMembers(teamId);
  }

  async function toggleMemberStatus(m: any) {
    const next = m.status === "active" ? "suspended" : "active";
    await supabase.from("team_members").update({ status: next }).eq("id", m.id);
    if (teamId) loadMembers(teamId);
  }

  async function updateMemberRole(id: string, role: string) {
    await supabase.from("team_members").update({ role }).eq("id", id);
    if (teamId) loadMembers(teamId);
  }

  function openNewRole() {
    setEditingRole(null); setRoleName("");
    setRolePerms(Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])));
    setRoleOpen(true);
  }
  function openEditRole(r: any) {
    setEditingRole(r); setRoleName(r.name); setRolePerms(r.permissions || {}); setRoleOpen(true);
  }
  async function saveRole() {
    if (!roleName.trim() || !teamId) return;
    if (editingRole) {
      // await supabase.from("team_roles").update({ name: roleName, permissions: rolePerms }).eq("id", editingRole.id);
    } else {
      // await supabase.from("team_roles").insert({ team_id: teamId, name: roleName, permissions: rolePerms });
    }
    setRoleOpen(false);
    // if (teamId) loadRoles(teamId);
  }
  async function deleteRole(id: string) {
    if (!confirm("Excluir cargo?")) return;
    // await supabase.from("team_roles").delete().eq("id", id);
    // if (teamId) loadRoles(teamId);
  }

  if (team.loading || (loading && !teamId)) return <div className="p-8">Carregando...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-sm text-muted-foreground">Convide funcionários e gerencie permissões.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}><UserPlus className="w-4 h-4 mr-2" />Convidar funcionário</Button>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Funcionários ({members.length})</TabsTrigger>
          <TabsTrigger value="invites">Convites pendentes</TabsTrigger>
          <TabsTrigger value="roles">Cargos</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-3">
          {members.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funcionário ainda.</p>}
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{m.profile?.full_name || m.profile?.email || m.invited_email}</div>
                  <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                </div>
                <div className="text-sm font-medium border rounded px-2 py-1">{m.role || "Sem cargo"}</div>
                <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status === "active" ? "Ativo" : "Suspenso"}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleMemberStatus(m)}>{m.status === "active" ? "Suspender" : "Ativar"}</Button>
                <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}><Trash2 className="w-4 h-4" /></Button>
              </CardContent>
              <CardContent className="px-4 pb-4 pt-0">
                <Label className="text-xs">Permissões: {Object.entries(m.permissions || {}).filter(([, v]) => v).map(([k]) => PERMISSION_LABELS[k as PermissionKey] || k).join(", ") || "Nenhuma"}</Label>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="invites" className="space-y-3">
          <p className="text-sm text-muted-foreground">O sistema de convites está em manutenção.</p>
        </TabsContent>

        <TabsContent value="roles" className="space-y-3">
          <p className="text-sm text-muted-foreground">O gerenciamento de cargos está em manutenção.</p>
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar funcionário</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O sistema de convites está em manutenção temporária.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}