import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Plus, RefreshCw, Link2, Unlink, UserPlus, UserMinus, Shield,
  ShieldOff, Settings, Trash2, Pencil, Loader2, Users, Copy,
} from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Community {
  id: string;
  name?: string;
  description?: string;
  groupCount?: number;
  raw?: Record<string, unknown>;
}

const normalizePhone = (raw: string) => {
  const value = String(raw || "").trim();
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (/@lid$/i.test(value) || digits.length > 13) return `${digits}@lid`;
  // Auto-corrige celular BR sem o 9: 55 + DDD(2) + 8 dígitos = 12 → insere 9
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    // DDDs válidos BR começam com 1-9; insere 9 só se o primeiro dígito do número não for já 9
    if (/^[1-9]\d$/.test(ddd) && rest[0] !== "9") {
      return `55${ddd}9${rest}`;
    }
  }
  return digits;
};

const parsePhones = (input: string): string[] =>
  input
    .split(/[\n,;\s]+/)
    .map((p) => normalizePhone(p))
    .filter((p) => p.length >= 8);

export default function ComunidadesTab() {
  const { instances, activeInstance } = useZapiInstances();
  const { groups, loading: loadingGroups, refetch: refetchGroups } = useWhatsAppGroups();

  const [instanceId, setInstanceId] = useState<string>("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createGroupIds, setCreateGroupIds] = useState<string[]>([]);

  const [linkGroupIds, setLinkGroupIds] = useState<string[]>([]);
  const [unlinkGroupIds, setUnlinkGroupIds] = useState<string[]>([]);

  const [participantPhones, setParticipantPhones] = useState("");
  const [adminPhones, setAdminPhones] = useState("");

  const [adminsOnlyMessage, setAdminsOnlyMessage] = useState(false);
  const [adminsOnlyAddMember, setAdminsOnlyAddMember] = useState(false);

  const [editDescOpen, setEditDescOpen] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string>("");

  useEffect(() => {
    if (!instanceId && activeInstance?.id) setInstanceId(activeInstance.id);
  }, [activeInstance, instanceId]);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedId) || null,
    [communities, selectedId],
  );

  const invokeCommunity = async (action: string, payload: Record<string, unknown> = {}) => {
    const inst = instances.find((i) => i.id === instanceId);
    const { data, error } = await supabase.functions.invoke("manage-communities", {
      body: {
        action,
        instanceId: inst?.zapi_instance_id,
        instanceToken: inst?.zapi_token,
        instanceClientToken: inst?.zapi_client_token,
        ...payload,
      },
    });
    if (error) throw new Error(error.message || "Erro ao chamar Z-API");
    if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
      throw new Error(String((data as { error: string }).error));
    }
    return data;
  };

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const data = await invokeCommunity("list-communities");
      const list: Community[] = Array.isArray(data)
        ? data.map((c: Record<string, unknown>) => ({
            id: String(c.id ?? c.communityId ?? c.phone ?? ""),
            name: (c.name ?? c.subject ?? "Comunidade") as string,
            description: (c.description ?? "") as string,
            groupCount: Array.isArray(c.groups) ? (c.groups as unknown[]).length : undefined,
            raw: c,
          }))
        : [];
      setCommunities(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao listar comunidades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instanceId) loadCommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const runAction = async (
    key: string,
    action: string,
    payload: Record<string, unknown>,
    successMsg: string,
    after?: () => void | Promise<void>,
  ) => {
    setActionLoading(key);
    try {
      await invokeCommunity(action, payload);
      toast.success(successMsg);
      if (after) await after();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na ação");
    } finally {
      setActionLoading(null);
    }
  };

  const extractInviteLink = (data: unknown): string => {
    if (!data) return "";
    if (typeof data === "string") return data;
    if (typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const candidate =
        obj.invitationLink || obj.invitation_link || obj.inviteLink ||
        obj.invite_link || obj.link || obj.url || obj.invitationCode || obj.code;
      if (typeof candidate === "string") return candidate;
      // Some APIs return the code only — build full URL
      if (typeof obj.code === "string") return `https://chat.whatsapp.com/${obj.code}`;
    }
    return "";
  };

  const handleGetInviteLink = async () => {
    if (!selectedCommunity) return;
    setActionLoading("get-invite");
    try {
      // Try dedicated endpoint first; fallback to metadata which usually contains the link
      let link = "";
      try {
        const data = await invokeCommunity("community-invitation-link", {
          communityId: selectedCommunity.id,
        });
        link = extractInviteLink(data);
      } catch {
        // ignore and fallback
      }
      if (!link) {
        const meta = await invokeCommunity("community-metadata", {
          communityId: selectedCommunity.id,
        });
        link = extractInviteLink(meta);
        // Sometimes metadata returns nested community object
        if (!link && meta && typeof meta === "object") {
          const m = meta as Record<string, unknown>;
          link = extractInviteLink(m.community) || extractInviteLink(m.data) || "";
        }
      }
      if (!link) throw new Error("Link não retornado pelo servidor");
      setInviteLink(link);
      setInviteLinkOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao obter link");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error("Informe o nome da comunidade");
      return;
    }
    await runAction(
      "create",
      "create-community",
      { name: createName.trim(), description: createDescription.trim(), groupIds: createGroupIds },
      "Comunidade criada com sucesso",
      async () => {
        setCreateOpen(false);
        setCreateName("");
        setCreateDescription("");
        setCreateGroupIds([]);
        await loadCommunities();
      },
    );
  };

  const toggleCreateGroup = (gid: string) => {
    setCreateGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid],
    );
  };

  const toggleLinkGroup = (gid: string) =>
    setLinkGroupIds((prev) => (prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]));

  const toggleUnlinkGroup = (gid: string) =>
    setUnlinkGroupIds((prev) => (prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Comunidades
            </CardTitle>
            <CardDescription>
              Gerencie comunidades do WhatsApp
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={loadCommunities}
              disabled={loading || !instanceId}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!instanceId}>
                  <Plus className="w-4 h-4 mr-1" />
                  Nova Comunidade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Comunidade</DialogTitle>
                  <DialogDescription>
                    Defina nome, descrição e grupos iniciais.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="Minha Comunidade"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Textarea
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="Descrição (opcional)"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vincular grupos (opcional)</Label>
                    <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                      {loadingGroups ? (
                        <div className="text-xs text-muted-foreground">Carregando...</div>
                      ) : groups.length === 0 ? (
                        <div className="text-xs text-muted-foreground">Nenhum grupo encontrado</div>
                      ) : (
                        groups.map((g) => (
                          <label
                            key={g.id}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={createGroupIds.includes(g.id)}
                              onChange={() => toggleCreateGroup(g.id)}
                            />
                            <span className="truncate">{g.nome}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreate} disabled={actionLoading === "create"}>
                    {actionLoading === "create" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Instância</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {instances.map((inst) => (
              <Button
                key={inst.id}
                variant={instanceId === inst.id ? "default" : "outline"}
                size="sm"
                onClick={() => setInstanceId(inst.id)}
              >
                {inst.instance_name}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Selecione uma comunidade</Label>
          {loading ? (
            <div className="text-xs text-muted-foreground mt-2">Carregando...</div>
          ) : communities.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center border border-dashed rounded-md mt-2">
              Nenhuma comunidade encontrada nesta instância
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              {communities.map((c) => (
                <Button
                  key={c.id}
                  variant={selectedId === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedId(c.id);
                    setEditDesc(c.description || "");
                  }}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {selectedCommunity && (
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">{selectedCommunity.name}</CardTitle>
                  {selectedCommunity.description && (
                    <CardDescription className="mt-1">{selectedCommunity.description}</CardDescription>
                  )}
                  <Badge variant="secondary" className="mt-2 text-[10px]">
                    ID: {selectedCommunity.id}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      runAction(
                        "metadata",
                        "community-metadata",
                        { communityId: selectedCommunity.id },
                        "Metadados atualizados",
                        loadCommunities,
                      )
                    }
                    disabled={actionLoading === "metadata"}
                  >
                    {actionLoading === "metadata" ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Metadados
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGetInviteLink}
                    disabled={actionLoading === "get-invite"}
                  >
                    {actionLoading === "get-invite" ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    Pegar Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      runAction(
                        "invite",
                        "redefine-invitation-link",
                        { communityId: selectedCommunity.id },
                        "Link de convite renovado",
                      )
                    }
                    disabled={actionLoading === "invite"}
                  >
                    {actionLoading === "invite" ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4 mr-1" />
                    )}
                    Renovar Link
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeactivateOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Desativar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="groups" className="w-full">
                <TabsList>
                  <TabsTrigger value="groups">
                    <Users className="w-3.5 h-3.5 mr-1" /> Grupos
                  </TabsTrigger>
                  <TabsTrigger value="participants">
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Participantes
                  </TabsTrigger>
                  <TabsTrigger value="admins">
                    <Shield className="w-3.5 h-3.5 mr-1" /> Admins
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Settings className="w-3.5 h-3.5 mr-1" /> Configurações
                  </TabsTrigger>
                  <TabsTrigger value="description">
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Descrição
                  </TabsTrigger>
                </TabsList>

                {/* Grupos: vincular / desvincular */}
                <TabsContent value="groups" className="space-y-4 pt-3">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" /> Vincular grupos
                      </Label>
                      <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                        {groups.map((g) => (
                          <label
                            key={g.id}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={linkGroupIds.includes(g.id)}
                              onChange={() => toggleLinkGroup(g.id)}
                            />
                            <span className="truncate">{g.nome}</span>
                          </label>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        disabled={!linkGroupIds.length || actionLoading === "link"}
                        onClick={() =>
                          runAction(
                            "link",
                            "link-groups",
                            { communityId: selectedCommunity.id, groupIds: linkGroupIds },
                            "Grupos vinculados",
                            async () => {
                              setLinkGroupIds([]);
                              await refetchGroups();
                            },
                          )
                        }
                      >
                        {actionLoading === "link" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        Vincular {linkGroupIds.length || ""}
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <Unlink className="w-3.5 h-3.5" /> Desvincular grupos
                      </Label>
                      <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                        {groups.map((g) => (
                          <label
                            key={g.id}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={unlinkGroupIds.includes(g.id)}
                              onChange={() => toggleUnlinkGroup(g.id)}
                            />
                            <span className="truncate">{g.nome}</span>
                          </label>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="mt-2 w-full"
                        disabled={!unlinkGroupIds.length || actionLoading === "unlink"}
                        onClick={() =>
                          runAction(
                            "unlink",
                            "unlink-groups",
                            { communityId: selectedCommunity.id, groupIds: unlinkGroupIds },
                            "Grupos desvinculados",
                            async () => {
                              setUnlinkGroupIds([]);
                              await refetchGroups();
                            },
                          )
                        }
                      >
                        {actionLoading === "unlink" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        Desvincular {unlinkGroupIds.length || ""}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Participantes */}
                <TabsContent value="participants" className="space-y-3 pt-3">
                  <Label className="text-xs">
                    Telefones (um por linha, com DDI+DDD)
                  </Label>
                  <Textarea
                    value={participantPhones}
                    onChange={(e) => setParticipantPhones(e.target.value)}
                    placeholder="5511999990001&#10;5511999990002"
                    rows={4}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={actionLoading === "addPart"}
                      onClick={() => {
                        const phones = parsePhones(participantPhones);
                        if (!phones.length) return toast.error("Informe pelo menos um telefone");
                        runAction(
                          "addPart",
                          "add-community-participant",
                          { communityId: selectedCommunity.id, phones },
                          `${phones.length} participante(s) adicionado(s)`,
                          () => setParticipantPhones(""),
                        );
                      }}
                    >
                      {actionLoading === "addPart" ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-1" />
                      )}
                      Adicionar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionLoading === "removePart"}
                      onClick={() => {
                        const phones = parsePhones(participantPhones);
                        if (!phones.length) return toast.error("Informe pelo menos um telefone");
                        runAction(
                          "removePart",
                          "remove-community-participant",
                          { communityId: selectedCommunity.id, phones },
                          `${phones.length} participante(s) removido(s)`,
                          () => setParticipantPhones(""),
                        );
                      }}
                    >
                      {actionLoading === "removePart" ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4 mr-1" />
                      )}
                      Remover
                    </Button>
                  </div>
                </TabsContent>

                {/* Admins */}
                <TabsContent value="admins" className="space-y-3 pt-3">
                  <Label className="text-xs">
                    Telefones (um por linha, com DDI+DDD)
                  </Label>
                  <Textarea
                    value={adminPhones}
                    onChange={(e) => setAdminPhones(e.target.value)}
                    placeholder="5511999990001"
                    rows={4}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={actionLoading === "addAdmin"}
                      onClick={() => {
                        const phones = parsePhones(adminPhones);
                        if (!phones.length) return toast.error("Informe pelo menos um telefone");
                        runAction(
                          "addAdmin",
                          "add-community-admin",
                          { communityId: selectedCommunity.id, phones },
                          `${phones.length} admin(s) promovido(s)`,
                          () => setAdminPhones(""),
                        );
                      }}
                    >
                      {actionLoading === "addAdmin" ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4 mr-1" />
                      )}
                      Promover
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionLoading === "removeAdmin"}
                      onClick={() => {
                        const phones = parsePhones(adminPhones);
                        if (!phones.length) return toast.error("Informe pelo menos um telefone");
                        runAction(
                          "removeAdmin",
                          "remove-community-admin",
                          { communityId: selectedCommunity.id, phones },
                          `${phones.length} admin(s) rebaixado(s)`,
                          () => setAdminPhones(""),
                        );
                      }}
                    >
                      {actionLoading === "removeAdmin" ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <ShieldOff className="w-4 h-4 mr-1" />
                      )}
                      Rebaixar
                    </Button>
                  </div>
                </TabsContent>

                {/* Configurações */}
                <TabsContent value="settings" className="space-y-3 pt-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Apenas admins podem enviar mensagens</p>
                      <p className="text-xs text-muted-foreground">
                        Restringe envio de mensagens ao canal de admins.
                      </p>
                    </div>
                    <Switch
                      checked={adminsOnlyMessage}
                      onCheckedChange={setAdminsOnlyMessage}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Apenas admins podem adicionar membros</p>
                      <p className="text-xs text-muted-foreground">
                        Bloqueia membros comuns de adicionar novos participantes.
                      </p>
                    </div>
                    <Switch
                      checked={adminsOnlyAddMember}
                      onCheckedChange={setAdminsOnlyAddMember}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={actionLoading === "settings"}
                    onClick={() =>
                      runAction(
                        "settings",
                        "community-settings",
                        {
                          communityId: selectedCommunity.id,
                          adminsOnlyMessage,
                          adminsOnlyAddMember,
                        },
                        "Configurações salvas",
                      )
                    }
                  >
                    {actionLoading === "settings" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Salvar configurações
                  </Button>
                </TabsContent>

                {/* Descrição */}
                <TabsContent value="description" className="space-y-3 pt-3">
                  <Label className="text-xs">Descrição da comunidade</Label>
                  <Textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={4}
                    placeholder="Descrição..."
                  />
                  <Button
                    size="sm"
                    disabled={actionLoading === "desc"}
                    onClick={() =>
                      runAction(
                        "desc",
                        "update-community-description",
                        { communityId: selectedCommunity.id, description: editDesc },
                        "Descrição atualizada",
                        loadCommunities,
                      )
                    }
                  >
                    {actionLoading === "desc" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Salvar descrição
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desativar comunidade?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação desativa a comunidade na Z-API. Não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  if (!selectedCommunity) return;
                  await runAction(
                    "deactivate",
                    "deactivate-community",
                    { communityId: selectedCommunity.id },
                    "Comunidade desativada",
                    async () => {
                      setDeactivateOpen(false);
                      setSelectedId("");
                      await loadCommunities();
                    },
                  );
                }}
              >
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={inviteLinkOpen} onOpenChange={setInviteLinkOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link de convite da comunidade</DialogTitle>
              <DialogDescription>
                Compartilhe este link para convidar pessoas para a comunidade.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly onFocus={(e) => e.target.select()} />
              <Button size="sm" onClick={handleCopyInviteLink}>
                <Copy className="w-4 h-4 mr-1" /> Copiar
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteLinkOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}