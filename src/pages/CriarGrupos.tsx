import { useState, useRef, useMemo } from "react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Link2, Users, Trash2, Copy, Check, ExternalLink, RefreshCw,
  UserPlus, UserMinus, Shield, Loader2, Search, Image, FileText, Settings,
  MessageSquare, ShieldCheck, ShieldOff, Pencil, Upload, Phone, MousePointerClick
} from "lucide-react";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { useGroupMemberCount } from "@/hooks/useGroupMemberCount";
import { useRedirectLinks } from "@/hooks/useRedirectLinks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import WhatsAppGroupPreview from "@/components/grupos/WhatsAppGroupPreview";

const CriarGrupos = () => {
  const [activeTab, setActiveTab] = useState("gerenciar");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciar Grupos</h1>
        <p className="text-muted-foreground text-sm mt-1">Crie grupos, gerencie participantes e links rotativos</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="gerenciar">Gerenciar</TabsTrigger>
          <TabsTrigger value="links">Links Rotativos</TabsTrigger>
          <TabsTrigger value="participantes">Participantes</TabsTrigger>
        </TabsList>

        <TabsContent value="gerenciar" className="mt-4">
          <GerenciarGrupoTab />
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

/* ============= TAB: Gerenciar Grupo ============= */
function GerenciarGrupoTab() {
  const { groups, loading, refetch } = useWhatsAppGroups();
  const { instances, activeInstance, selectInstance } = useZapiInstances();
  const { fetchMemberCount, getMemberCount, isLoading: isMemberLoading } = useGroupMemberCount();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState("");
  const [savedGroupData, setSavedGroupData] = useState<Record<string, { description?: string; photo?: string }>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem("group-preview-cache");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const persistGroupPreviewData = (groupId: string, updates: { description?: string; photo?: string }) => {
    setSavedGroupData((prev) => {
      const next = {
        ...prev,
        [groupId]: {
          ...prev[groupId],
          ...updates,
        },
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("group-preview-cache", JSON.stringify(next));
      }
      return next;
    });
  };
  const manageFileInputRef = useRef<HTMLInputElement>(null);
  // Create group dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPhotoUrl, setCreatePhotoUrl] = useState("");
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState("");
  const [phones, setPhones] = useState("");
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const getInstanceCredentials = (group: any) => {
    const inst = instances.find((i) => i.zapi_instance_id === group?.sourceInstanceId);
    if (inst) {
      return {
        instanceId: inst.zapi_instance_id,
        instanceToken: inst.zapi_token,
        instanceClientToken: inst.zapi_client_token,
      };
    }
    return {};
  };

  const handleGroupAction = async (action: string, extraBody: Record<string, any> = {}) => {
    if (!selectedGroup) return;
    setActionLoading(action);
    try {
      const credentials = getInstanceCredentials(selectedGroup);
      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: { action, groupId: selectedGroup.id, ...credentials, ...extraBody },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error("Erro Z-API: " + data.error);
        return;
      }
      toast.success(
        action === "update-group-name" ? "Nome atualizado!" :
        action === "update-group-description" ? "Descrição atualizada!" :
        action === "update-group-photo" ? "Foto atualizada!" :
        action === "admin-only-messages" ? "Configuração atualizada!" :
        "Operação realizada!"
      );
      if (action === "update-group-name") setNewName("");
      if (action === "update-group-description") {
        persistGroupPreviewData(selectedGroup.id, { description: newDescription.trim() });
        setNewDescription("");
      }
      if (action === "update-group-photo") { setNewPhotoUrl(""); setNewPhotoFile(null); setNewPhotoPreview(""); }
      refetch();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha na operação"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCreatePhotoFile(file);
    setCreatePhotoUrl("");
    const reader = new FileReader();
    reader.onload = () => setCreatePhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleManageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewPhotoFile(file);
    setNewPhotoUrl("");
    const reader = new FileReader();
    reader.onload = () => setNewPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `group-photos/${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("template-media")
      .upload(fileName, file, { contentType: file.type });
    if (error) throw new Error("Erro ao fazer upload da foto: " + error.message);
    const { data: urlData } = supabase.storage.from("template-media").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (createPhotoUrl.trim()) return createPhotoUrl.trim();
    if (!createPhotoFile) return null;
    return uploadFileToStorage(createPhotoFile);
  };

  const handleUpdatePhoto = async () => {
    if (!selectedGroup) return;
    setActionLoading("update-group-photo");
    try {
      let imageUrl = newPhotoUrl.trim();
      if (!imageUrl && newPhotoFile) {
        imageUrl = await uploadFileToStorage(newPhotoFile);
      }
      if (!imageUrl) { toast.error("Selecione uma foto ou cole uma URL"); return; }
      const credentials = getInstanceCredentials(selectedGroup);
      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: { action: "update-group-photo", groupId: selectedGroup.id, ...credentials, imageUrl },
      });
      if (error) throw error;
      if (data?.error) { toast.error("Erro Z-API: " + data.error); return; }
      toast.success("Foto atualizada!");
      persistGroupPreviewData(selectedGroup.id, { photo: imageUrl });
      setNewPhotoPreview("");
      setNewPhotoUrl("");
      setNewPhotoFile(null);
      refetch();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha na operação"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { toast.error("Nome do grupo é obrigatório"); return; }
    if (!activeInstance) { toast.error("Selecione uma instância conectada"); return; }
    setCreating(true);
    try {
      const phoneList = phones.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
      const baseBody = {
        instanceId: activeInstance.zapi_instance_id,
        instanceToken: activeInstance.zapi_token,
        instanceClientToken: activeInstance.zapi_client_token,
      };
      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: { ...baseBody, action: "create-group", groupName: groupName.trim(), phones: phoneList },
      });
      if (error) throw error;
      if (data?.error) { toast.error("Erro Z-API: " + data.error); return; }

      const groupId = data?.phone || data?.groupId || data?.id;
      if (groupId && createDescription.trim()) {
        await supabase.functions.invoke("manage-groups", {
          body: { ...baseBody, action: "update-group-description", groupId, description: createDescription.trim() },
        });
      }
      const finalPhotoUrl = await uploadPhoto();
      if (groupId && finalPhotoUrl) {
        await supabase.functions.invoke("manage-groups", {
          body: { ...baseBody, action: "update-group-photo", groupId, imageUrl: finalPhotoUrl },
        });
      }
      toast.success("Grupo criado com sucesso!");
      setGroupName(""); setCreateDescription(""); setCreatePhotoUrl(""); setCreatePhotoFile(null); setCreatePhotoPreview(""); setPhones("");
      setCreateOpen(false);
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar grupo: " + (err.message || ""));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Gerenciar Grupo
              </CardTitle>
              <CardDescription>Altere nome, descrição, foto e configurações do grupo</CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Grupo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Novo Grupo WhatsApp
                  </DialogTitle>
                  <DialogDescription>Preencha os dados para criar o grupo</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">Instância</label>
                    <Select value={activeInstance?.id || ""} onValueChange={selectInstance}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a instância" />
                      </SelectTrigger>
                      <SelectContent>
                        {instances.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5" />
                      Foto do Grupo <span className="text-muted-foreground">(opcional)</span>
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <div
                        className="relative w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted/40"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {createPhotoPreview || createPhotoUrl ? (
                          <img src={createPhotoPreview || createPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Upload
                        </Button>
                        <Input
                          placeholder="Ou cole a URL da imagem"
                          value={createPhotoUrl}
                          onChange={(e) => { setCreatePhotoUrl(e.target.value); setCreatePhotoFile(null); setCreatePhotoPreview(""); }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Nome do Grupo *</label>
                    <Input placeholder="Ex: Comunidade VIP" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Descrição <span className="text-muted-foreground">(opcional)</span>
                    </label>
                    <Textarea className="mt-1 min-h-[80px]" placeholder="Descrição do grupo..." value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Participantes iniciais <span className="text-muted-foreground">(opcional)</span>
                    </label>
                    <Textarea className="mt-1 min-h-[80px]" placeholder={"5511999999999\n5511888888888\nOu separados por vírgula"} value={phones} onChange={(e) => setPhones(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">Insira os números com DDD e DDI</p>
                  </div>
                  <Button onClick={handleCreate} disabled={creating} className="w-full">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Criar Grupo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Select value={selectedGroupId} onValueChange={(id) => {
              setSelectedGroupId(id);
              const g = groups.find((gr) => gr.id === id);
              if (g) fetchMemberCount(id, g.sourceInstanceId, g.participantes);
            }}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome} ({getMemberCount(g.id, g.membros) || "—"} membros)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {selectedGroup && (
            <div className="flex gap-6 pt-2">
              {/* Left: Form controls */}
              <div className="flex-1 space-y-4 min-w-0">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={selectedGroup.foto || ""} />
                    <AvatarFallback>{selectedGroup.nome?.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{selectedGroup.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {isMemberLoading(selectedGroup.id) ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> carregando membros...</span>
                      ) : (
                        <>{getMemberCount(selectedGroup.id, selectedGroup.membros) || "—"} membros • {selectedGroup.descricao || "Sem descrição"}</>
                      )}
                    </p>
                    {selectedGroup.isAdmin && <Badge variant="default" className="mt-1 text-[10px]">Admin</Badge>}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                    Alterar Nome
                  </label>
                  <div className="flex gap-2">
                    <Input placeholder="Novo nome do grupo" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
                    <Button size="sm" disabled={!newName.trim() || actionLoading === "update-group-name"} onClick={() => handleGroupAction("update-group-name", { groupName: newName.trim() })}>
                      {actionLoading === "update-group-name" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Alterar Descrição
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] placeholder:text-muted-foreground"
                      placeholder="Nova descrição do grupo"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                    <Button size="sm" className="self-end" disabled={!newDescription.trim() || actionLoading === "update-group-description"} onClick={() => handleGroupAction("update-group-description", { description: newDescription.trim() })}>
                      {actionLoading === "update-group-description" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5" />
                    Alterar Foto
                  </label>
                  <div className="flex items-center gap-3">
                    <div
                      className="relative w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted/40"
                      onClick={() => manageFileInputRef.current?.click()}
                    >
                      {newPhotoPreview || newPhotoUrl ? (
                        <img src={newPhotoPreview || newPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Button type="button" variant="outline" size="sm" onClick={() => manageFileInputRef.current?.click()}>
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        Upload
                      </Button>
                      <Input
                        placeholder="Ou cole a URL da imagem"
                        value={newPhotoUrl}
                        onChange={(e) => { setNewPhotoUrl(e.target.value); setNewPhotoFile(null); setNewPhotoPreview(""); }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button size="sm" className="self-end" disabled={(!newPhotoUrl.trim() && !newPhotoFile) || actionLoading === "update-group-photo"} onClick={handleUpdatePhoto}>
                      {actionLoading === "update-group-photo" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                    </Button>
                    <input ref={manageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleManageFileChange} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Link do Grupo
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === "get-invite-link"}
                      onClick={async () => {
                        setActionLoading("get-invite-link");
                        try {
                          const credentials = getInstanceCredentials(selectedGroup);
                          const { data, error } = await supabase.functions.invoke("manage-groups", {
                            body: { action: "get-invite-link", groupId: selectedGroup.id, ...credentials },
                          });
                          if (error) throw error;
                          if (data?.error) { toast.error("Erro Z-API: " + data.error); return; }
                          const link = data?.inviteLink || data?.invitationLink || data?.link || "";
                          if (link) {
                            await navigator.clipboard.writeText(link);
                            toast.success("Link copiado! " + link);
                          } else {
                            toast.error("Não foi possível obter o link do grupo");
                          }
                        } catch (err: any) {
                          toast.error("Erro: " + (err.message || "Falha ao obter link"));
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                    >
                      {actionLoading === "get-invite-link" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      Copiar Link
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Mensagens
                  </label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!!actionLoading} onClick={() => handleGroupAction("admin-only-messages", { value: true })}>
                      {actionLoading === "admin-only-messages" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                      Só admins
                    </Button>
                    <Button variant="outline" size="sm" disabled={!!actionLoading} onClick={() => handleGroupAction("admin-only-messages", { value: false })}>
                      <ShieldOff className="w-4 h-4 mr-1" />
                      Todos podem enviar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right: WhatsApp Preview */}
              <div className="hidden lg:flex flex-col items-center pt-2 w-[300px] flex-shrink-0">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-3">
                  <Phone className="w-3.5 h-3.5" />
                  Preview no WhatsApp
                </label>
                <WhatsAppGroupPreview
                  groupName={newName.trim() || selectedGroup.nome}
                  description={newDescription.trim() || savedGroupData[selectedGroup.id]?.description || selectedGroup.descricao || ""}
                  photoUrl={newPhotoPreview || newPhotoUrl || savedGroupData[selectedGroup.id]?.photo || selectedGroup.foto || ""}
                  membersCount={getMemberCount(selectedGroup.id, selectedGroup.membros)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============= Clicks Sparkline Chart ============= */
function ClicksSparkline({ data }: { data: { date: string; clicks: number }[] }) {
  const max = Math.max(...data.map(d => d.clicks), 1);
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  const total = data.reduce((s, d) => s + d.clicks, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Cliques nos últimos 7 dias</p>
        <p className="text-xs font-semibold text-foreground">{total} total</p>
      </div>
      <div className="flex items-end gap-1 h-12">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex items-end justify-center" style={{ height: 32 }}>
              <div
                className="w-full max-w-[20px] rounded-sm bg-primary/80 hover:bg-primary transition-colors"
                style={{ height: Math.max(2, (d.clicks / max) * 32) }}
                title={`${formatDate(d.date)}: ${d.clicks} cliques`}
              />
            </div>
            <span className="text-[9px] text-muted-foreground leading-none">{formatDate(d.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============= TAB: Links Rotativos ============= */
function LinksRotativosTab() {
  const { links, loading, createLink, deleteLink, toggleLink, addGroupToLink, removeGroupFromLink, updateGroupInLink } = useRedirectLinks();
  const { groups } = useWhatsAppGroups();
  const { getMemberCount } = useGroupMemberCount();
  const { instances } = useZapiInstances();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newMax, setNewMax] = useState("250");
  const [copied, setCopied] = useState<string | null>(null);
  const [addingGroupTo, setAddingGroupTo] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [gettingInvite, setGettingInvite] = useState(false);
  const [refreshingMembers, setRefreshingMembers] = useState<string | null>(null);

  const baseRedirectUrl = `${window.location.origin}/invite/`;

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
      const instance = instances.find((inst) => inst.zapi_instance_id === group.sourceInstanceId);
      let inviteLink: string | null = null;

      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: {
          action: "get-invite-link",
          groupId: group.id,
          instanceId: instance?.zapi_instance_id || group.sourceInstanceId,
          instanceToken: instance?.zapi_token,
          instanceClientToken: instance?.zapi_client_token,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      inviteLink = data?.inviteLink || data?.invitationLink || data?.link || null;

      if (!inviteLink) {
        throw new Error("Não foi possível obter o link de convite do grupo");
      }

      // Fetch real member count
      let realMemberCount = group.membros;
      try {
        const { data: participantsData } = await supabase.functions.invoke("get-group-participants", {
          body: { groupId: group.id, sourceInstanceId: group.sourceInstanceId || null },
        });
        realMemberCount = participantsData?.participants?.length || group.membros;
      } catch {
        // fallback to existing count
      }

      // Get photo from savedGroupData or group.foto
      const groupPhoto = group.foto || null;
      await addGroupToLink(linkId, group.id, group.nome, inviteLink, group.sourceInstanceId || null, realMemberCount, groupPhoto);
      toast.success("Grupo adicionado ao link!");
      setAddingGroupTo(null);
      setSelectedGroup("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao adicionar grupo");
    } finally {
      setGettingInvite(false);
    }
  };

  const handleRefreshMembers = async (link: any) => {
    if (!link.groups || link.groups.length === 0) return;
    setRefreshingMembers(link.id);
    try {
      for (const g of link.groups) {
        const { data } = await supabase.functions.invoke("get-group-participants", {
          body: { groupId: g.group_id, sourceInstanceId: g.instance_id || null },
        });
        const count = data?.participants?.length || 0;
        // Also update photo from WhatsApp groups list
        const whatsGroup = groups.find((wg) => wg.id === g.group_id);
        const updates: any = { current_members: count, is_full: count >= link.max_members_per_group };
        if (whatsGroup?.foto) updates.group_photo = whatsGroup.foto;
        await updateGroupInLink(g.id, updates);
      }
      toast.success("Contagem de membros atualizada!");
    } catch (err: any) {
      toast.error("Erro ao atualizar membros: " + (err.message || ""));
    } finally {
      setRefreshingMembers(null);
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
                  <Badge variant="outline" className="gap-1">
                    <MousePointerClick className="w-3 h-3" />
                    {link.click_count || 0} cliques
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
            {/* Click chart */}
            {link.clicks_by_day && link.clicks_by_day.some(d => d.clicks > 0) && (
              <div className="px-6 pb-2">
                <ClicksSparkline data={link.clicks_by_day} />
              </div>
            )}
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  Grupos na fila ({link.groups?.length || 0}) • Máx. {link.max_members_per_group} membros
                </div>
                {link.groups && link.groups.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefreshMembers(link)}
                    disabled={refreshingMembers === link.id}
                    className="h-7 text-xs"
                  >
                    {refreshingMembers === link.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    )}
                    Atualizar membros
                  </Button>
                )}
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
                            {g.nome} ({getMemberCount(g.id, g.membros) || "—"} membros)
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
  const { instances } = useZapiInstances();
  const { fetchMemberCount, getMemberCount, isLoading: isMemberLoading } = useGroupMemberCount();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [busca, setBusca] = useState("");
  const [phoneToAdd, setPhoneToAdd] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const fetchParticipants = async (group: any) => {
    setLoadingParticipants(true);
    setParticipants([]);
    try {
      const { data, error } = await supabase.functions.invoke("get-group-participants", {
        body: {
          groupId: group.id,
          sourceInstanceId: group.sourceInstanceId || null,
          fallbackParticipants: group.participantes || [],
        },
      });
      if (error) throw error;
      setParticipants(data?.participants || []);
    } catch (err: any) {
      console.error("Erro ao buscar participantes:", err);
      toast.error("Erro ao buscar participantes do grupo");
    } finally {
      setLoadingParticipants(false);
    }
  };

  const getInstanceCredentials = (group: any) => {
    const inst = instances.find((i) => i.zapi_instance_id === group?.sourceInstanceId);
    if (inst) {
      return {
        instanceId: inst.zapi_instance_id,
        instanceToken: inst.zapi_token,
        instanceClientToken: inst.zapi_client_token,
      };
    }
    return { instanceId: group?.sourceInstanceId };
  };

  const handleAction = async (action: string, phone: string) => {
    if (!selectedGroup) return;
    setActionLoading(`${action}-${phone}`);
    try {
      const credentials = getInstanceCredentials(selectedGroup);
      const { data, error } = await supabase.functions.invoke("manage-groups", {
        body: {
          action,
          groupId: selectedGroup.id,
          phone,
          ...credentials,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        action === "add-participant" ? "Participante adicionado!" :
        action === "remove-participant" ? "Participante removido!" :
        action === "promote-participant" ? "Promovido a admin!" :
        "Rebaixado!"
      );
      // Refresh participants list
      fetchParticipants(selectedGroup);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha na operação"));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredParticipants = participants.filter((p: any) => {
    const phone = p.phone || p.id || "";
    const name = p.name || "";
    return phone.includes(busca) || name.toLowerCase().includes(busca.toLowerCase());
  });

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
            <Select value={selectedGroupId} onValueChange={(id) => {
              setSelectedGroupId(id);
              const g = groups.find((gr) => gr.id === id);
              if (g) {
                fetchMemberCount(id, g.sourceInstanceId, g.participantes);
                fetchParticipants(g);
              }
            }}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome} ({getMemberCount(g.id, g.membros) || "—"} membros)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => selectedGroup && fetchParticipants(selectedGroup)} disabled={loadingParticipants || !selectedGroup}>
              <RefreshCw className={`w-4 h-4 ${loadingParticipants ? "animate-spin" : ""}`} />
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
                {loadingParticipants ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Buscando participantes...</span>
                  </div>
                ) : filteredParticipants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {participants.length === 0
                      ? "Nenhum participante encontrado. Selecione um grupo para carregar."
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
