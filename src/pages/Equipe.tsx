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
  const [roles, setRoles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
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
    let { data: t } = await (supabase as any).from("teams").select("*").eq("owner_id", user.id).maybeSingle();
    if (!t) {
      const { data: created } = await (supabase as any).from("teams").insert({ owner_id: user.id, name: "Minha equipe" }).select().single();
      t = created;
    }
    setTeamId(t.id);
    await Promise.all([loadRoles(t.id), loadMembers(t.id), loadInvites(t.id)]);
    setLoading(false);
  }

  async function loadRoles(tid: string) {
    const { data } = await (supabase as any).from("team_roles").select("*").eq("team_id", tid).order("created_at");
    setRoles(data || []);
  }
  async function loadMembers(tid: string) {
    const { data } = await (supabase as any).from("pipeline_members").select("*, role:team_roles(name)").eq("team_id", tid).order("created_at");
    if (!data) { setMembers([]); return; }
    const ids = data.map((m: any) => m.user_id);
    const { data: profs } = await (supabase as any).from("profiles").select("id, email, full_name").in("id", ids);
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setMembers(data.map((m: any) => ({ ...m, profile: map.get(m.user_id) })));
  }
  async function loadInvites(tid: string) {
    const { data } = await (supabase as any).from("team_invites").select("*, role:team_roles(name)").eq("team_id", tid).is("accepted_at", null).order("created_at", { ascending: false });
    setInvites(data || []);
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
    if (teamId) loadInvites(teamId);
  }

  async function cancelInvite(id: string) {
    await (supabase as any).from("team_invites").delete().eq("id", id);
    if (teamId) loadInvites(teamId);
  }

  async function resendInvite(inv: any) {
    const url = `${window.location.origin}/aceitar-convite?token=${inv.token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: url });
  }

  async function removeMember(id: string) {
    if (!confirm("Remover funcionário?")) return;
    await (supabase as any).from("pipeline_members").delete().eq("id", id);
    if (teamId) loadMembers(teamId);
  }

  async function toggleMemberStatus(m: any) {
    const next = m.status === "active" ? "suspended" : "active";
    await (supabase as any).from("pipeline_members").update({ status: next }).eq("id", m.id);
    if (teamId) loadMembers(teamId);
  }

  async function updateMemberInstances(id: string, ids: string[]) {
    await (supabase as any).from("pipeline_members").update({ allowed_instance_ids: ids }).eq("id", id);
    if (teamId) loadMembers(teamId);
  }

  async function updateMemberRole(id: string, roleId: string | null) {
    await (supabase as any).from("pipeline_members").update({ role_id: roleId }).eq("id", id);
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
      await (supabase as any).from("team_roles").update({ name: roleName, permissions: rolePerms }).eq("id", editingRole.id);
    } else {
      await (supabase as any).from("team_roles").insert({ team_id: teamId, name: roleName, permissions: rolePerms });
    }
    setRoleOpen(false);
    if (teamId) loadRoles(teamId);
  }
  async function deleteRole(id: string) {
    if (!confirm("Excluir cargo?")) return;
    await (supabase as any).from("team_roles").delete().eq("id", id);
    if (teamId) loadRoles(teamId);
  }

  if (team.loading || loading) return <div className="p-8">Carregando...</div>;

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
          <TabsTrigger value="invites">Convites pendentes ({invites.length})</TabsTrigger>
          <TabsTrigger value="roles">Cargos ({roles.length})</TabsTrigger>
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
                <Select value={m.role_id || "none"} onValueChange={(v) => updateMemberRole(m.id, v === "none" ? null : v)}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Cargo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem cargo (acesso total)</SelectItem>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status === "active" ? "Ativo" : "Suspenso"}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleMemberStatus(m)}>{m.status === "active" ? "Suspender" : "Ativar"}</Button>
                <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}><Trash2 className="w-4 h-4" /></Button>
              </CardContent>
              <CardContent className="px-4 pb-4 pt-0">
                <Label className="text-xs">Conexões WhatsApp permitidas (vazio = todas)</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {instances.map((i) => {
                    const checked = (m.allowed_instance_ids || []).includes(i.id);
                    return (
                      <label key={i.id} className="flex items-center gap-1 text-xs border rounded px-2 py-1 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          const cur = (m.allowed_instance_ids || []) as string[];
                          const next = v ? [...cur, i.id] : cur.filter((x) => x !== i.id);
                          updateMemberInstances(m.id, next);
                        }} />
                        {i.instance_name}
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="invites" className="space-y-3">
          {invites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>}
          {invites.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">Cargo: {inv.role?.name || "Sem cargo"} · expira em {new Date(inv.expires_at).toLocaleDateString()}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => resendInvite(inv)}><RefreshCw className="w-4 h-4 mr-1" />Copiar link</Button>
                <Button size="sm" variant="ghost" onClick={() => cancelInvite(inv.id)}><Trash2 className="w-4 h-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roles" className="space-y-3">
          <Button size="sm" onClick={openNewRole}><Plus className="w-4 h-4 mr-1" />Novo cargo</Button>
          {roles.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {Object.entries(r.permissions || {}).filter(([, v]) => v).map(([k]) => PERMISSION_LABELS[k as PermissionKey] || k).join(", ") || "Sem permissões"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEditRole(r)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => deleteRole(r.id)}><Trash2 className="w-4 h-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar funcionário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="funcionario@empresa.com" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Select value={inviteRoleId || "none"} onValueChange={(v) => setInviteRoleId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cargo (acesso total)</SelectItem>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conexões permitidas (vazio = todas)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {instances.map((i) => (
                  <label key={i.id} className="flex items-center gap-1 text-xs border rounded px-2 py-1 cursor-pointer">
                    <Checkbox checked={inviteInstances.includes(i.id)} onCheckedChange={(v) => {
                      setInviteInstances((cur) => v ? [...cur, i.id] : cur.filter((x) => x !== i.id));
                    }} />
                    {i.instance_name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={sendInvite}>Enviar convite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role dialog */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRole ? "Editar cargo" : "Novo cargo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Ex: Atendente" />
            </div>
            <div>
              <Label className="text-xs">Permissões</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PERMISSION_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!rolePerms[k]} onCheckedChange={(v) => setRolePerms((p) => ({ ...p, [k]: !!v }))} />
                    {PERMISSION_LABELS[k]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>Cancelar</Button>
            <Button onClick={saveRole}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}