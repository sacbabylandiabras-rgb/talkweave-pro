import { useEffect, useMemo, useRef, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2, Plus, RefreshCw, Link2, Unlink, UserPlus, UserMinus, Shield,
  ShieldOff, Settings, Trash2, Pencil, Loader2, Users, Copy, Workflow, Image, Upload
} from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { useRedirectLinks } from "@/hooks/useRedirectLinks";
import { LinkAutomationDialog } from "./LinkAutomationDialog";
import WhatsAppGroupPreview from "./WhatsAppGroupPreview";
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
   const { instances, activeInstance } = useZapiInstances({ provider: 'zapi' });
  const { groups, loading: loadingGroups, refetch: refetchGroups } = useWhatsAppGroups();
  const { links, createLink, updateLink, refetch: refetchLinks } = useRedirectLinks();

  const [instanceId, setInstanceId] = useState<string>("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPhotoUrl, setCreatePhotoUrl] = useState("");
  const [createGroupIds, setCreateGroupIds] = useState<string[]>([]);

  const [linkGroupIds, setLinkGroupIds] = useState<string[]>([]);
  const [unlinkGroupIds, setUnlinkGroupIds] = useState<string[]>([]);

  const [participantPhones, setParticipantPhones] = useState("");
  const [adminPhones, setAdminPhones] = useState("");

  const [whoCanAddNewGroups, setWhoCanAddNewGroups] = useState<"admins" | "everyone">("admins");

  const [editDescOpen, setEditDescOpen] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  const [editPhotoOpen, setEditPhotoOpen] = useState(false);
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const createPhotoFileRef = useRef<HTMLInputElement>(null);
  const editPhotoFileRef = useRef<HTMLInputElement>(null);

  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const [inviteLinkOpen, setInviteLinkOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string>("");

  // Redirect link automation
  const [automationDialogLink, setAutomationDialogLink] = useState<any | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([]);
  const [flows, setFlows] = useState<{ id: string; name: string; keyword: string }[]>([]);
  const [savingAutomation, setSavingAutomation] = useState<string | null>(null);

  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);

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
      console.warn("[ComunidadesTab] list-communities falhou:", err);
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instanceId) loadCommunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  useEffect(() => {
    const loadOptions = async () => {
      const [tplRes, flowRes] = await Promise.all([
        supabase.from('message_templates').select('id, name, category').eq('active', true).order('name'),
        supabase.from('flow_automations').select('id, name, keyword').eq('active', true).order('name'),
      ]);
      if (tplRes.data) setTemplates(tplRes.data);
      if (flowRes.data) setFlows(flowRes.data);
    };
    loadOptions();
  }, []);

  const handleSaveAutomation = async (linkId: string, updates: Record<string, any>) => {
    setSavingAutomation(linkId);
    try {
      await updateLink(linkId, updates);
      setAutomationDialogLink((prev: any) => prev ? { ...prev, ...updates } : null);
      toast.success("Automação atualizada!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSavingAutomation(null);
    }
  };

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
    if (Array.isArray(data)) {
      for (const item of data) {
        const found = extractInviteLink(item);
        if (found) return found;
      }
      return "";
    }
    if (typeof data === "object") {
      const obj = data as Record<string, unknown>;
      // Direct candidates
      for (const key of [
        "invitationLink", "invitation_link", "inviteLink", "invite_link",
        "invitation", "link", "url", "shortUrl", "short_url",
      ]) {
        const v = obj[key];
        if (typeof v === "string" && v.includes("http")) return v;
      }
      // Code-only: build full URL
      for (const key of ["invitationCode", "invitation_code", "inviteCode", "invite_code", "code"]) {
        const v = obj[key];
        if (typeof v === "string" && v && !v.includes("http")) {
          return `https://chat.whatsapp.com/${v}`;
        }
      }
      // Recurse into nested objects
      for (const v of Object.values(obj)) {
        if (v && typeof v === "object") {
          const found = extractInviteLink(v);
          if (found) return found;
        }
      }
    }
    return "";
  };

  const handleGetInviteLink = async () => {
    if (!selectedCommunity) return;
    setActionLoading("get-invite");
    try {
      const data = await invokeCommunity("community-invitation-link", {
        communityId: selectedCommunity.id,
      });
      console.log("[invite-link] response:", data);
      const link = extractInviteLink(data);
      if (!link) {
        throw new Error(
          `Link não encontrado. Resposta: ${JSON.stringify(data).slice(0, 200)}`,
        );
      }
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

  const handleGetMetadata = async () => {
    if (!selectedCommunity) return;
    setActionLoading("metadata");
    try {
      const data = await invokeCommunity("community-metadata", {
        communityId: selectedCommunity.id,
      });
      setMetadata(data);
      setMetadataOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao obter metadados");
    } finally {
      setActionLoading(null);
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
      { 
        name: createName.trim(), 
        description: createDescription.trim(), 
        groupIds: createGroupIds,
        imageUrl: createPhotoUrl.trim() || undefined
      },
      "Comunidade criada com sucesso",
      async () => {
        setCreateOpen(false);
        setCreateName("");
        setCreateDescription("");
        setCreateGroupIds([]);
        setCreatePhotoUrl("");
        await loadCommunities();
      },
    );
  };

  const toggleCreateGroup = (gid: string) => {
    setCreateGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid],
    );
  };

  const uploadPhotoFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    const fileName = `${user.id}/community-photos/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("template-media")
      .upload(fileName, file, { contentType: file.type });
    if (error) throw new Error("Erro no upload: " + error.message);
    const { data: urlData } = supabase.storage.from("template-media").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadPhotoFile(file);
      setter(url);
      toast.success("Foto enviada!");
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
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
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Comunidade</DialogTitle>
                  <DialogDescription>
                    Defina nome, descrição e grupos iniciais.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs flex items-center gap-1.5 mb-2">
                        <Image className="w-3.5 h-3.5" />
                        Foto da Comunidade (URL)
                      </Label>
                      <div className="flex items-center gap-2">
                        <div
                          className="relative w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted/40 shrink-0"
                          onClick={() => createPhotoFileRef.current?.click()}
                        >
                          {createPhotoUrl ? (
                            <img src={createPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <Input
                          value={createPhotoUrl}
                          onChange={(e) => setCreatePhotoUrl(e.target.value)}
                          placeholder="URL ou faça upload"
                          className="flex-1 h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => createPhotoFileRef.current?.click()}
                          disabled={uploadingPhoto}
                        >
                          {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        </Button>
                        <input
                          ref={createPhotoFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePhotoFileChange(e, setCreatePhotoUrl)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Nome da Comunidade</Label>
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
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Vincular grupos (opcional)</Label>
                      <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/20">
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

                  <div className="flex flex-col items-center justify-center p-4 bg-muted/10 rounded-xl border border-dashed">
                    <WhatsAppGroupPreview
                      groupName={createName}
                      description={createDescription}
                      photoUrl={createPhotoUrl}
                      membersCount={createGroupIds.length + 1}
                    />
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
            <Select
              value={selectedId ?? undefined}
              onValueChange={(value) => {
                setSelectedId(value);
                const c = communities.find((x) => x.id === value);
                setEditDesc(c?.description || "");
              }}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione uma comunidade" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <Dialog open={editPhotoOpen} onOpenChange={setEditPhotoOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Image className="w-4 h-4 mr-1" />
                        Alterar Foto
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Alterar Foto da Comunidade</DialogTitle>
                        <DialogDescription>Cole a nova URL da imagem da comunidade.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label className="text-xs">URL da Imagem</Label>
                          <div className="flex items-center gap-2">
                            <div
                              className="relative w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted/40 shrink-0"
                              onClick={() => editPhotoFileRef.current?.click()}
                            >
                              {editPhotoUrl ? (
                                <img src={editPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <Upload className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <Input
                              value={editPhotoUrl}
                              onChange={(e) => setEditPhotoUrl(e.target.value)}
                              placeholder="URL ou faça upload"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => editPhotoFileRef.current?.click()}
                              disabled={uploadingPhoto}
                            >
                              {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            </Button>
                            <input
                              ref={editPhotoFileRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handlePhotoFileChange(e, setEditPhotoUrl)}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditPhotoOpen(false)}>Cancelar</Button>
                        <Button
                          onClick={() => {
                            if (!editPhotoUrl.trim()) return toast.error("Informe a URL");
                            runAction(
                              "photo",
                              "update-group-photo",
                              { communityId: selectedCommunity.id, imageUrl: editPhotoUrl.trim() },
                              "Foto atualizada com sucesso",
                              () => {
                                setEditPhotoOpen(false);
                                setEditPhotoUrl("");
                              }
                            );
                          }}
                          disabled={actionLoading === "photo"}
                        >
                          {actionLoading === "photo" && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" size="sm" onClick={handleGetMetadata} disabled={actionLoading === "metadata"}>
                    {actionLoading === "metadata" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Building2 className="w-4 h-4 mr-1" />}
                    Ver Dados
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setActionLoading("auto-link");
                      try {
                        // Create a redirect link for this community if it doesn't exist
                        const linkName = `Comunidade: ${selectedCommunity.name}`;
                        const slug = `comm-${selectedCommunity.id.split('@')[0]}-${Math.random().toString(36).slice(2, 5)}`;
                        let existing = links.find(l => l.name === linkName);
                        
                        if (!existing) {
                          await createLink(linkName, slug, 5000);
                          await refetchLinks();
                          const { data: freshLinks } = await (supabase as any).from("redirect_links").select("*").eq("name", linkName).limit(1);
                          existing = freshLinks?.[0];
                        }

                        if (existing) {
                          setAutomationDialogLink(existing);
                        } else {
                          toast.error("Erro ao preparar automação");
                        }
                      } catch (err) {
                        toast.error("Erro ao configurar automação");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === "auto-link"}
                  >
                    {actionLoading === "auto-link" ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Workflow className="w-4 h-4 mr-1" />
                    )}
                    Automação
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
                      <p className="text-sm font-medium">Quem pode adicionar novos grupos</p>
                      <p className="text-xs text-muted-foreground">
                        Define se apenas administradores ou qualquer pessoa pode vincular grupos à comunidade.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{whoCanAddNewGroups === "admins" ? "Admins" : "Todos"}</span>
                      <Switch
                        checked={whoCanAddNewGroups === "everyone"}
                        onCheckedChange={(checked) => setWhoCanAddNewGroups(checked ? "everyone" : "admins")}
                      />
                    </div>
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
                          whoCanAddNewGroups,
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

        <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Metadados da Comunidade</DialogTitle>
              <DialogDescription>
                Informações técnicas detalhadas da comunidade.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted p-4 rounded-md overflow-x-auto">
              <pre className="text-[10px] text-muted-foreground">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMetadataOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <LinkAutomationDialog
          link={automationDialogLink}
          open={!!automationDialogLink}
          onOpenChange={(open) => !open && setAutomationDialogLink(null)}
          onSave={handleSaveAutomation}
          templates={templates}
          flows={flows}
          instances={instances.map(i => ({ id: i.zapi_instance_id, instance_name: i.instance_name }))}
          saving={savingAutomation === automationDialogLink?.id}
        />
      </CardContent>
    </Card>
  );
}