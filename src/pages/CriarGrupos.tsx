import { useState } from "react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Link2, Users, Trash2, Copy, Check, ExternalLink, RefreshCw,
  UserPlus, UserMinus, Shield, Loader2, Search, Image, FileText, Settings,
  MessageSquare, ShieldCheck, ShieldOff, Pencil
} from "lucide-react";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { useRedirectLinks } from "@/hooks/useRedirectLinks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CriarGrupos = () => {
  const [activeTab, setActiveTab] = useState("criar");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciar Grupos</h1>
        <p className="text-muted-foreground text-sm mt-1">Crie grupos, gerencie participantes e links rotativos</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="criar">Criar Grupo</TabsTrigger>
          <TabsTrigger value="gerenciar">Gerenciar</TabsTrigger>
          <TabsTrigger value="links">Links Rotativos</TabsTrigger>
          <TabsTrigger value="participantes">Participantes</TabsTrigger>
        </TabsList>

        <TabsContent value="criar" className="mt-4">
          <CriarGrupoTab />
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <LinksRotativosTab />
        </TabsContent>

        <TabsContent value="participantes" className="mt-4">
          <ParticipantesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ============= TAB: Criar Grupo ============= */
function CriarGrupoTab() {
  const [groupName, setGroupName] = useState("");
  const [phones, setPhones] = useState("");
  const [creating, setCreating] = useState(false);
  const { instances, activeInstance, selectInstance } = useZapiInstances();

  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error("Nome do grupo é obrigatório");
      return;
    }
    if (!activeInstance) {
      toast.error("Selecione uma instância conectada");
      return;
    }
    setCreating(true);
    try {
      const phoneList = phones
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter(Boolean);

      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: {
          action: "create-group",
          groupName: groupName.trim(),
          phones: phoneList,
          instanceId: activeInstance.zapi_instance_id,
          instanceToken: activeInstance.zapi_token,
          instanceClientToken: activeInstance.zapi_client_token,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error("Erro Z-API: " + data.error);
        return;
      }
      toast.success("Grupo criado com sucesso!");
      setGroupName("");
      setPhones("");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar grupo: " + (err.message || ""));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Criar Novo Grupo
        </CardTitle>
        <CardDescription>Crie um grupo WhatsApp diretamente pela plataforma</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground">Instância</label>
          <Select value={activeInstance?.id || ""} onValueChange={selectInstance}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione a instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.instance_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Nome do Grupo</label>
          <Input
            placeholder="Ex: Comunidade VIP"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">
            Participantes iniciais <span className="text-muted-foreground">(opcional)</span>
          </label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] placeholder:text-muted-foreground"
            placeholder={"5511999999999\n5511888888888\nOu separados por vírgula"}
            value={phones}
            onChange={(e) => setPhones(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Insira os números com DDD e DDI, um por linha ou separados por vírgula
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating} className="w-full">
          {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Criar Grupo
        </Button>
      </CardContent>
    </Card>
  );
}

/* ============= TAB: Links Rotativos ============= */
function LinksRotativosTab() {
  const { links, loading, createLink, deleteLink, toggleLink, addGroupToLink, removeGroupFromLink } = useRedirectLinks();
  const { groups } = useWhatsAppGroups();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newMax, setNewMax] = useState("250");
  const [copied, setCopied] = useState<string | null>(null);
  const [addingGroupTo, setAddingGroupTo] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [gettingInvite, setGettingInvite] = useState(false);

  const baseRedirectUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redirect-link?slug=`;

  const handleCreateLink = async () => {
    if (!newName.trim() || !newSlug.trim()) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    try {
      await createLink(newName.trim(), newSlug.trim(), parseInt(newMax) || 250);
      toast.success("Link rotativo criado!");
      setShowCreate(false);
      setNewName("");
      setNewSlug("");
      setNewMax("250");
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Slug já em uso"));
    }
  };

  const handleAddGroup = async (linkId: string) => {
    if (!selectedGroup) return;
    const group = groups.find((g) => g.id === selectedGroup);
    if (!group) return;

    setGettingInvite(true);
    try {
      // Try to get invite link
      let inviteLink: string | null = null;
      try {
        const { data } = await supabase.functions.invoke("manage-groups", {
          body: {
            action: "get-invite-link",
            groupId: group.id,
            instanceId: group.sourceInstanceId,
          },
        });
        inviteLink = data?.inviteLink || data?.invitationLink || data?.link || null;
      } catch {
        console.log("Could not get invite link, proceeding without");
      }

      await addGroupToLink(linkId, group.id, group.nome, inviteLink, group.sourceInstanceId || null, group.membros);
      toast.success("Grupo adicionado ao link!");
      setAddingGroupTo(null);
      setSelectedGroup("");
    } catch (err: any) {
      toast.error("Erro ao adicionar grupo");
    } finally {
      setGettingInvite(false);
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${baseRedirectUrl}${slug}`);
    setCopied(slug);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Links de Redirecionamento Rotativo</h3>
          <p className="text-sm text-muted-foreground">Quando um grupo enche, o próximo da fila recebe os membros</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Link Rotativo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input placeholder="Ex: Grupo VIP" value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Slug (URL)</label>
                <Input
                  placeholder="ex: grupo-vip"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL: {baseRedirectUrl}{newSlug || "slug"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Máx. membros por grupo</label>
                <Input type="number" value={newMax} onChange={(e) => setNewMax(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={handleCreateLink} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : links.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Link2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Nenhum link rotativo criado ainda</p>
          </CardContent>
        </Card>
      ) : (
        links.map((link) => (
          <Card key={link.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <CardTitle className="text-base">{link.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{baseRedirectUrl}{link.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={link.active ? "default" : "secondary"}>
                    {link.active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Switch checked={link.active} onCheckedChange={(v) => toggleLink(link.id, v)} />
                  <Button variant="ghost" size="icon" onClick={() => copyLink(link.slug)}>
                    {copied === link.slug ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteLink(link.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                Grupos na fila ({link.groups?.length || 0}) • Máx. {link.max_members_per_group} membros
              </div>

              {link.groups && link.groups.length > 0 ? (
                <div className="space-y-2">
                  {link.groups.map((g, i) => (
                    <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                        <span className="text-sm font-medium">{g.group_name || g.group_id}</span>
                        <Badge variant={g.is_full ? "destructive" : "secondary"} className="text-[10px]">
                          {g.current_members} membros {g.is_full && "• CHEIO"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {g.invite_link && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={g.invite_link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeGroupFromLink(g.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {addingGroupTo === link.id ? (
                <div className="flex items-center gap-2">
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups
                        .filter((g) => !link.groups?.some((lg) => lg.group_id === g.id))
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.nome} ({g.membros} membros)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleAddGroup(link.id)} disabled={gettingInvite}>
                    {gettingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingGroupTo(null); setSelectedGroup(""); }}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setAddingGroupTo(link.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Grupo
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

/* ============= TAB: Participantes ============= */
function ParticipantesTab() {
  const { groups, loading, refetch } = useWhatsAppGroups();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [busca, setBusca] = useState("");
  const [phoneToAdd, setPhoneToAdd] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const handleAction = async (action: string, phone: string) => {
    if (!selectedGroup) return;
    setActionLoading(`${action}-${phone}`);
    try {
      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: {
          action,
          groupId: selectedGroup.id,
          phone,
          instanceId: selectedGroup.sourceInstanceId,
        },
      });
      if (error) throw error;
      toast.success(
        action === "add-participant" ? "Participante adicionado!" :
        action === "remove-participant" ? "Participante removido!" :
        action === "promote-participant" ? "Promovido a admin!" :
        "Rebaixado!"
      );
      refetch();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha na operação"));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredParticipants = selectedGroup?.participantes?.filter((p: any) => {
    const phone = p.phone || p.id || "";
    return phone.includes(busca);
  }) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gerenciar Participantes
          </CardTitle>
          <CardDescription>Adicione, remova ou promova membros dos seus grupos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome} ({g.membros} membros)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {selectedGroup && (
            <>
              {/* Add participant */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Número com DDI (ex: 5511999999999)"
                  value={phoneToAdd}
                  onChange={(e) => setPhoneToAdd(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (phoneToAdd.trim()) {
                      handleAction("add-participant", phoneToAdd.trim());
                      setPhoneToAdd("");
                    }
                  }}
                  disabled={!!actionLoading}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar participante..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Participants list */}
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filteredParticipants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {selectedGroup.participantes?.length === 0
                      ? "Nenhum participante encontrado. Os dados de participantes podem não estar disponíveis para este grupo."
                      : "Nenhum resultado para a busca"}
                  </p>
                ) : (
                  filteredParticipants.map((p: any, i: number) => {
                    const phone = p.phone || p.id?.replace("@c.us", "") || `participante-${i}`;
                    const isAdmin = p.admin === "admin" || p.isAdmin;
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {phone.slice(-2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-sm font-medium">{phone}</span>
                            {isAdmin && <Badge variant="secondary" className="ml-2 text-[10px]">Admin</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleAction("promote-participant", phone)}
                              disabled={actionLoading === `promote-participant-${phone}`}
                              title="Promover a admin"
                            >
                              {actionLoading === `promote-participant-${phone}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Shield className="w-3.5 h-3.5 text-primary" />
                              )}
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleAction("demote-participant", phone)}
                              disabled={actionLoading === `demote-participant-${phone}`}
                              title="Remover admin"
                            >
                              {actionLoading === `demote-participant-${phone}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleAction("remove-participant", phone)}
                            disabled={actionLoading === `remove-participant-${phone}`}
                            title="Remover participante"
                          >
                            {actionLoading === `remove-participant-${phone}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="w-3.5 h-3.5 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CriarGrupos;
