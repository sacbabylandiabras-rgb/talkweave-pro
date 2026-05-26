import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, Link2, Users, Trash2, Copy, Check, ExternalLink, RefreshCw, Shuffle,
  UserPlus, UserMinus, Shield, Loader2, Search, Image, FileText, Settings, Building2,
  MessageSquare, ShieldCheck, ShieldOff, Pencil, Upload, Phone, MousePointerClick, ChevronDown, BarChart3, Workflow, Smartphone,
  AtSign, UserCheck, UserX, Download
} from "lucide-react";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { LinkAutomationDialog } from "@/components/grupos/LinkAutomationDialog";
import { useGroupMemberCount } from "@/hooks/useGroupMemberCount";
import { useRedirectLinks } from "@/hooks/useRedirectLinks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import WhatsAppGroupPreview from "@/components/grupos/WhatsAppGroupPreview";

const formatCommunityLid = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/@lid$/i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 13 ? `${digits}@lid` : raw.replace(/@c\.us$/i, "").replace(/@s\.whatsapp\.net$/i, "");
};

const CriarGrupos = () => {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.hash === "#participantes" && scrollRef.current) {
      const element = document.getElementById("participantes-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location]);

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header Fixo */}
      <div className="px-6 py-4 border-b border-white/10 shrink-0">
         <h1 className="text-2xl font-bold text-white flex items-center gap-2">
           <Link2 className="w-6 h-6 text-primary" />
           Links de redirecionamento
         </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie seus grupos, comunidades e canais da instância conectada</p>
      </div>

      {/* Conteúdo com Scroll Independente */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 pb-20 scrollbar-thin scrollbar-thumb-white/10">
        <section>
          <GerenciarGrupoTab />
        </section>
        
        <section>
          <LinksRotativosTab />
        </section>
        
        <section id="participantes-section">
          <ParticipantesTab />
        </section>
      </div>
    </div>
  );
};

/* ============= TAB: Gerenciar Grupo ============= */
  function GerenciarGrupoTab() {
    const { groups: allGroups, loading, refetch } = useWhatsAppGroups();
    const groups = allGroups.filter((g) => {
      const id = String(g.id || "");
      const isManageableType =
        g.isGroup ||
        g.isCommunity ||
        g.isChannel ||
        id.includes("-group") ||
        id.includes("@g.us") ||
        id.includes("@newsletter");

      return isManageableType && g.isAdmin;
    });
   const { instances: allInstances, activeInstance, selectInstance } = useZapiInstances();
 
   const instances = useMemo(() => {
     return allInstances.filter(inst => inst.api_provider === 'zapi');
   }, [allInstances]);
 
  const { fetchMemberCount, getMemberCount, isLoading: isMemberLoading } = useGroupMemberCount();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [overrideInstanceId, setOverrideInstanceId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState("");
  // Advanced management state
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingList, setPendingList] = useState<Array<{ phone: string; name?: string }>>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renewLinkConfirmOpen, setRenewLinkConfirmOpen] = useState(false);
  const [mentionAllOpen, setMentionAllOpen] = useState(false);
  const [mentionAllMessage, setMentionAllMessage] = useState("📢 Atenção a todos!");
  const [groupSettings, setGroupSettings] = useState({
    adminOnlyMessage: false,
    adminOnlySettings: false,
    requireAdminApproval: false,
    adminOnlyAddMember: false,
  });
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
    // Priority: manual override > group's sourceInstanceId > fallback
    const overrideInst = overrideInstanceId ? instances.find((i) => i.id === overrideInstanceId) : null;
    if (overrideInst) {
      return {
        instanceId: overrideInst.zapi_instance_id,
        instanceToken: overrideInst.zapi_token,
        instanceClientToken: overrideInst.zapi_client_token,
      };
    }
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
        toast.error("Erro: " + data.error);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    const fileName = `${user.id}/group-photos/${Date.now()}.${fileExt}`;
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
      if (data?.error) { toast.error("Erro: " + data.error); return; }
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
      if (data?.error) { toast.error("Erro: " + data.error); return; }
      if (data?.success === false) { toast.error("Erro: " + (data.message || "Falha ao criar grupo")); return; }

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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Selecione grupo, comunidade ou canal</label>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : groups.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center border border-dashed rounded-md">
               {allGroups.length > 0 
                 ? "Nenhum grupo, comunidade ou canal onde você é administrador foi encontrado."
                 : "Nenhum grupo encontrado na instância de dispositivo."}
            </div>
          ) : (
            <Select
              value={selectedGroupId}
              onValueChange={(value) => {
                const group = groups.find((g) => g.id === value);
                setSelectedGroupId(value);
                if (group) fetchMemberCount(group.id, group.sourceInstanceId, group.participantes);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha um item para gerenciar" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.typeLabel || (g.isChannel ? "Canal" : g.isCommunity ? "Comunidade" : "Grupo")} · {g.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
        )}
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Gerenciar itens
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
                       <SelectContent className="max-h-80">
                         {instances
                           .filter(inst => {
                             const provider = (inst.api_provider || 'zapi').toLowerCase();
                             return provider === 'zapi' && !inst.instance_name?.toLowerCase().includes('aquec');
                           })
                           .map((inst) => (
                             <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>
                           ))
                         }
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
           {(() => {
             const zapiInstances = instances.filter(
               (i) => {
                 const provider = (i.api_provider || "zapi").toLowerCase();
                 return provider === "zapi" && !i.instance_name?.toLowerCase().includes('aquec');
               }
             );
             if (zapiInstances.length <= 1) return null;
             return (
             <div className="space-y-1">
               <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                 <Phone className="w-3.5 h-3.5" />
                 Instância
               </label>
               <div className="flex flex-wrap gap-2">
                 <Button
                   variant={!overrideInstanceId ? "default" : "outline"}
                   size="sm"
                   className="h-8"
                   onClick={() => setOverrideInstanceId("")}
                 >
                   Todos
                 </Button>
                 {zapiInstances.map((inst) => (
                   <Button
                     key={inst.id}
                     variant={overrideInstanceId === inst.id ? "default" : "outline"}
                     size="sm"
                     className="h-8"
                     onClick={() => setOverrideInstanceId(inst.id)}
                   >
                     {inst.instance_name} {inst.is_default ? "(Padrão)" : ""}
                   </Button>
                 ))}
               </div>
             </div>
             );
           })()}

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
                          if (data?.error) { toast.error("Erro: " + data.error); return; }
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
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === "redefine-invitation-link"}
                      onClick={() => setRenewLinkConfirmOpen(true)}
                    >
                      {actionLoading === "redefine-invitation-link" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                      Renovar Link
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

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Participantes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === "load-pending"}
                      onClick={async () => {
                        setActionLoading("load-pending");
                        try {
                          const credentials = getInstanceCredentials(selectedGroup);
                          const { data, error } = await supabase.functions.invoke("manage-groups", {
                            body: { action: "metadata-group", groupId: selectedGroup.id, ...credentials },
                          });
                          if (error) throw error;
                          const pend = (data?.pendingParticipants || data?.pending || data?.participantsPending || []) as any[];
                          const list = pend.map((p: any) => ({
                            phone: String(p?.phone || p?.id || p?.jid || "").replace(/\D/g, ""),
                            name: p?.name || p?.pushname || "",
                          })).filter((p) => p.phone);
                          setPendingList(list);
                          setPendingOpen(true);
                          if (list.length === 0) toast.info("Nenhum participante pendente");
                        } catch (err: any) {
                          toast.error("Erro: " + (err.message || "Falha ao carregar pendentes"));
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                    >
                      {actionLoading === "load-pending" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                      Aprovações Pendentes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === "mention-group"}
                      onClick={() => setMentionAllOpen(true)}
                    >
                      {actionLoading === "mention-group" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AtSign className="w-4 h-4 mr-1" />}
                      Marcar Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === "load-settings"}
                      onClick={async () => {
                        setActionLoading("load-settings");
                        try {
                          const credentials = getInstanceCredentials(selectedGroup);
                          const { data, error } = await supabase.functions.invoke("manage-groups", {
                            body: { action: "metadata-group", groupId: selectedGroup.id, ...credentials },
                          });
                          if (error) throw error;
                          setGroupSettings({
                            adminOnlyMessage: Boolean(data?.adminOnlyMessage),
                            adminOnlySettings: Boolean(data?.adminOnlySettings),
                            requireAdminApproval: Boolean(data?.requireAdminApproval),
                            adminOnlyAddMember: Boolean(data?.adminOnlyAddMember),
                          });
                          setSettingsOpen(true);
                        } catch (err: any) {
                          toast.error("Erro: " + (err.message || "Falha ao carregar configurações"));
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                    >
                      {actionLoading === "load-settings" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Settings className="w-4 h-4 mr-1" />}
                      Configurações
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

      {/* Renew invite link confirmation */}
      <AlertDialog open={renewLinkConfirmOpen} onOpenChange={setRenewLinkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar link de convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual será invalidado imediatamente. Quem tiver o link antigo não conseguirá mais entrar no grupo.
              Um novo link será gerado e copiado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!selectedGroup) return;
                setRenewLinkConfirmOpen(false);
                setActionLoading("redefine-invitation-link");
                try {
                  const credentials = getInstanceCredentials(selectedGroup);
                  const { data, error } = await supabase.functions.invoke("manage-groups", {
                    body: { action: "redefine-invitation-link", groupId: selectedGroup.id, ...credentials },
                  });
                  if (error) throw error;
                  if (data?.error) { toast.error("Erro: " + data.error); return; }
                  const link = data?.inviteLink || data?.invitationLink || data?.link || "";
                  if (link) {
                    await navigator.clipboard.writeText(link);
                    toast.success("Link renovado e copiado!");
                  } else {
                    toast.success("Link renovado!");
                  }
                } catch (err: any) {
                  toast.error("Erro: " + (err.message || "Falha ao renovar link"));
                } finally {
                  setActionLoading(null);
                }
              }}
            >
              Sim, renovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mention all dialog */}
      <Dialog open={mentionAllOpen} onOpenChange={setMentionAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar Todos no Grupo</DialogTitle>
            <DialogDescription>
              Digite a mensagem que será enviada marcando todos os participantes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={mentionAllMessage}
            onChange={(e) => setMentionAllMessage(e.target.value)}
            rows={4}
            placeholder="Digite a mensagem..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMentionAllOpen(false)}>Cancelar</Button>
            <Button
              disabled={!mentionAllMessage.trim() || actionLoading === "mention-group"}
              onClick={async () => {
                if (!selectedGroup || !mentionAllMessage.trim()) return;
                setMentionAllOpen(false);
                setActionLoading("mention-group");
                try {
                  const credentials = getInstanceCredentials(selectedGroup);
                  const { data, error } = await supabase.functions.invoke("manage-groups", {
                    body: { action: "mention-group", groupId: selectedGroup.id, message: mentionAllMessage.trim(), ...credentials },
                  });
                  if (error) throw error;
                  if (data?.error) { toast.error("Erro: " + data.error); return; }
                  toast.success("Mensagem enviada marcando todos!");
                } catch (err: any) {
                  toast.error("Erro: " + (err.message || "Falha ao marcar todos"));
                } finally {
                  setActionLoading(null);
                }
              }}
            >
              {actionLoading === "mention-group" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AtSign className="w-4 h-4 mr-1" />}
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending approvals dialog */}
      <Dialog open={pendingOpen} onOpenChange={setPendingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovações Pendentes</DialogTitle>
            <DialogDescription>
              {pendingList.length} participante(s) aguardando aprovação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {pendingList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum participante pendente
              </p>
            )}
            {pendingList.map((p) => (
              <div key={p.phone} className="flex items-center justify-between gap-2 p-2 border rounded-md">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name || p.phone}</p>
                  {p.name && <p className="text-xs text-muted-foreground truncate">{p.phone}</p>}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2"
                    disabled={!!actionLoading}
                    onClick={async () => {
                      if (!selectedGroup) return;
                      setActionLoading("approve-" + p.phone);
                      try {
                        const credentials = getInstanceCredentials(selectedGroup);
                        const { data, error } = await supabase.functions.invoke("manage-groups", {
                          body: { action: "approve-participant", groupId: selectedGroup.id, phones: [p.phone], ...credentials },
                        });
                        if (error) throw error;
                        if (data?.error) { toast.error("Erro: " + data.error); return; }
                        toast.success("Aprovado!");
                        setPendingList((prev) => prev.filter((x) => x.phone !== p.phone));
                      } catch (err: any) {
                        toast.error("Erro: " + (err.message || ""));
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                  >
                    {actionLoading === "approve-" + p.phone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    disabled={!!actionLoading}
                    onClick={async () => {
                      if (!selectedGroup) return;
                      setActionLoading("reject-" + p.phone);
                      try {
                        const credentials = getInstanceCredentials(selectedGroup);
                        const { data, error } = await supabase.functions.invoke("manage-groups", {
                          body: { action: "reject-participant", groupId: selectedGroup.id, phones: [p.phone], ...credentials },
                        });
                        if (error) throw error;
                        if (data?.error) { toast.error("Erro: " + data.error); return; }
                        toast.success("Rejeitado");
                        setPendingList((prev) => prev.filter((x) => x.phone !== p.phone));
                      } catch (err: any) {
                        toast.error("Erro: " + (err.message || ""));
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                  >
                    {actionLoading === "reject-" + p.phone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Group settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações do Grupo</DialogTitle>
            <DialogDescription>Controle permissões e moderação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Somente admins enviam mensagens</p>
                <p className="text-xs text-muted-foreground">Apenas administradores podem postar no grupo</p>
              </div>
              <Switch
                checked={groupSettings.adminOnlyMessage}
                onCheckedChange={(v) => setGroupSettings((s) => ({ ...s, adminOnlyMessage: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Somente admins editam o grupo</p>
                <p className="text-xs text-muted-foreground">Apenas admins alteram nome, foto e descrição</p>
              </div>
              <Switch
                checked={groupSettings.adminOnlySettings}
                onCheckedChange={(v) => setGroupSettings((s) => ({ ...s, adminOnlySettings: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Somente admins adicionam membros</p>
                <p className="text-xs text-muted-foreground">Bloqueia que membros comuns adicionem outros</p>
              </div>
              <Switch
                checked={groupSettings.adminOnlyAddMember}
                onCheckedChange={(v) => setGroupSettings((s) => ({ ...s, adminOnlyAddMember: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Aprovar novos membros</p>
                <p className="text-xs text-muted-foreground">Novos participantes precisam de aprovação de admin</p>
              </div>
              <Switch
                checked={groupSettings.requireAdminApproval}
                onCheckedChange={(v) => setGroupSettings((s) => ({ ...s, requireAdminApproval: v }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
              <Button
                disabled={actionLoading === "update-group-settings"}
                onClick={async () => {
                  if (!selectedGroup) return;
                  setActionLoading("update-group-settings");
                  try {
                    const credentials = getInstanceCredentials(selectedGroup);
                    const { data, error } = await supabase.functions.invoke("manage-groups", {
                      body: { action: "update-group-settings", groupId: selectedGroup.id, ...credentials, ...groupSettings },
                    });
                    if (error) throw error;
                    if (data?.error) { toast.error("Erro: " + data.error); return; }
                    toast.success("Configurações salvas!");
                    setSettingsOpen(false);
                  } catch (err: any) {
                    toast.error("Erro: " + (err.message || ""));
                  } finally {
                    setActionLoading(null);
                  }
                }}
              >
                {actionLoading === "update-group-settings" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

/* ============= Analytics Dialog ============= */
import type { RedirectLink } from "@/hooks/useRedirectLinks";

interface MemberEvent {
  id: string;
  phone: string;
  message_received: string; // group_id
  response_sent: string; // member name
  keyword_matched: string;
  created_at: string;
}

function AnalyticsDialog({ linkId, links, onClose }: { linkId: string | null; links: RedirectLink[]; onClose: () => void }) {
  const [memberEvents, setMemberEvents] = useState<MemberEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const analyticsLink = links.find(l => l.id === linkId);
  const groupIds = analyticsLink?.groups?.map(g => g.group_id) || [];

  useEffect(() => {
    if (!linkId || groupIds.length === 0) {
      setMemberEvents([]);
      return;
    }
    (async () => {
      setLoadingEvents(true);
      try {
        const { data } = await (supabase as any)
          .from("message_logs")
          .select("id, phone, message_received, response_sent, keyword_matched, created_at")
          .in("keyword_matched", ["__group_join__", "__group_leave__"])
          .in("message_received", groupIds)
          .order("created_at", { ascending: false })
          .limit(200);
        setMemberEvents(data || []);
      } catch {
        setMemberEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, [linkId, groupIds.join(",")]);

  const joins = memberEvents.filter(e => e.keyword_matched === "__group_join__");
  const leaves = memberEvents.filter(e => e.keyword_matched === "__group_leave__");

  return (
    <Dialog open={!!linkId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Análises do Link
          </DialogTitle>
          <DialogDescription>
            {analyticsLink?.name || ""}
          </DialogDescription>
        </DialogHeader>
        {analyticsLink && (() => {
          const clicks = analyticsLink.clicks_raw || [];
          const totalClicks = analyticsLink.click_count || 0;

          const groupEntries: Record<string, number> = {};
          clicks.forEach(c => {
            const g = c.group_redirected_to || "Desconhecido";
            groupEntries[g] = (groupEntries[g] || 0) + 1;
          });

          const totalEntries = Object.values(groupEntries).reduce((a, b) => a + b, 0);

          return (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-xl font-bold text-foreground">{totalClicks}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Cliques</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-xl font-bold text-green-600">{totalEntries}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Entraram</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-xl font-bold text-red-500">{leaves.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Saíram</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-xl font-bold text-foreground">{analyticsLink.groups?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Grupos</p>
                </div>
              </div>

              {/* Chart */}
              {analyticsLink.clicks_by_day && analyticsLink.clicks_by_day.some(d => d.clicks > 0) && (
                <div className="p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-medium mb-3">Cliques nos últimos 7 dias</h4>
                  <ClicksSparkline data={analyticsLink.clicks_by_day} />
                </div>
              )}

              {/* Entries per group */}
              {Object.keys(groupEntries).length > 0 && (
                <div className="p-4 rounded-lg border border-border space-y-3">
                  <h4 className="text-sm font-medium">Entradas por Grupo</h4>
                  <div className="space-y-2">
                    {Object.entries(groupEntries)
                      .sort((a, b) => b[1] - a[1])
                      .map(([groupName, count]) => (
                        <div key={groupName} className="flex items-center justify-between p-2 rounded bg-muted/30">
                          <span className="text-sm">{groupName}</span>
                          <Badge variant="secondary">{count} entradas</Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Members who joined */}
              <div className="p-4 rounded-lg border border-border space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-green-600" />
                  Membros que Entraram ({joins.length})
                </h4>
                {loadingEvents ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : joins.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">Nenhum registro ainda</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {joins.slice(0, 100).map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between p-2 rounded bg-green-500/5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserPlus className="w-3.5 h-3.5 text-green-600 shrink-0" />
                          <span className="font-mono">{evt.phone}</span>
                          {evt.response_sent && <span className="text-muted-foreground truncate">({evt.response_sent})</span>}
                        </div>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(evt.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                          {new Date(evt.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Members who left */}
              <div className="p-4 rounded-lg border border-border space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <UserMinus className="w-4 h-4 text-red-500" />
                  Membros que Saíram ({leaves.length})
                </h4>
                {loadingEvents ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : leaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">Nenhum registro ainda</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {leaves.slice(0, 100).map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between p-2 rounded bg-red-500/5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserMinus className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="font-mono">{evt.phone}</span>
                          {evt.response_sent && <span className="text-muted-foreground truncate">({evt.response_sent})</span>}
                        </div>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(evt.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                          {new Date(evt.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent clicks log */}
              <div className="p-4 rounded-lg border border-border space-y-3">
                <h4 className="text-sm font-medium">Histórico de Cliques</h4>
                {clicks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum acesso registrado</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {clicks.slice(0, 50).map((click) => (
                      <div key={click.id} className="flex items-center justify-between p-2 rounded bg-muted/20 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <MousePointerClick className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{click.group_redirected_to || "—"}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                          {click.ip_address && <span className="font-mono">{click.ip_address}</span>}
                          <span>
                            {new Date(click.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                            {new Date(click.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        <div className="flex justify-end mt-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

}

/* ============= TAB: Links Rotativos ============= */
 function LinksRotativosTab() {
   const { links, loading, createLink, deleteLink, toggleLink, addGroupToLink, removeGroupFromLink, updateGroupInLink, updateLink, refetch } = useRedirectLinks();
    const { groups } = useWhatsAppGroups({ provider: 'zapi_no_warmup_meta' });
  const { instances } = useZapiInstances({ provider: 'zapi' });
  const [analyticsLinkId, setAnalyticsLinkId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newMax, setNewMax] = useState("250");
  const [copied, setCopied] = useState<string | null>(null);
  const [addingGroupTo, setAddingGroupTo] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [gettingInvite, setGettingInvite] = useState(false);
  const [refreshingMembers, setRefreshingMembers] = useState<string | null>(null);
  const [creatingNextGroup, setCreatingNextGroup] = useState<string | null>(null);
  const [linkPhotoUrl, setLinkPhotoUrl] = useState<Record<string, string>>({});
  const [linkPhotoFile, setLinkPhotoFile] = useState<Record<string, File | null>>({});
  const [linkPhotoPreview, setLinkPhotoPreview] = useState<Record<string, string>>({});
  const [applyingPhoto, setApplyingPhoto] = useState<string | null>(null);
  const linkPhotoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Automation config state
  const [automationDialogLink, setAutomationDialogLink] = useState<any | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([]);
  const [flows, setFlows] = useState<{ id: string; name: string; keyword: string }[]>([]);
  const [savingAutomation, setSavingAutomation] = useState<string | null>(null);

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
      await updateLink(linkId, updates as any);
      toast.success("Automação salva!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || ""));
    } finally {
      setSavingAutomation(null);
    }
  };

  const [editPageLinkId, setEditPageLinkId] = useState<string | null>(null);
  const [pageConfig, setPageConfig] = useState<Record<string, {
    title?: string;
    description?: string;
    photo?: string;
    buttonColor?: string;
    bgColor?: string;
    textColor?: string;
  }>>(() => {
    try {
      const stored = localStorage.getItem("link-page-config");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const [isSavingPage, setIsSavingPage] = useState(false);

  const handleSavePageConfig = () => {
    if (!editPageLinkId) return;
    // Temporarily saving to localStorage until DB migration is confirmed
    localStorage.setItem("link-page-config", JSON.stringify(pageConfig));
    toast.success("Configurações salvas localmente!");
    setEditPageLinkId(null);
  };

  const updateLocalPageConfig = (linkId: string, config: typeof pageConfig[string]) => {
    const updated = { ...pageConfig, [linkId]: config };
    setPageConfig(updated);
  };

    const baseRedirectUrl = `https://zaplynx.com/invite/`;
  const editingLink = links.find(l => l.id === editPageLinkId);
  const editingConfig = editPageLinkId ? (pageConfig[editPageLinkId] || {}) : {};

  const handleLinkPhotoFileChange = (linkId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLinkPhotoFile((prev) => ({ ...prev, [linkId]: file }));
    setLinkPhotoUrl((prev) => ({ ...prev, [linkId]: "" }));
    const reader = new FileReader();
    reader.onload = () => setLinkPhotoPreview((prev) => ({ ...prev, [linkId]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    const fileName = `${user.id}/group-photos/${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("template-media")
      .upload(fileName, file, { contentType: file.type });
    if (error) throw new Error("Erro ao fazer upload da foto: " + error.message);
    const { data: urlData } = supabase.storage.from("template-media").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleApplyPhotoToAll = async (link: any) => {
    const linkId = link.id;
    let imageUrl = linkPhotoUrl[linkId]?.trim() || "";
    const file = linkPhotoFile[linkId];

    if (!imageUrl && !file) {
      toast.error("Selecione uma foto ou cole uma URL");
      return;
    }

    setApplyingPhoto(linkId);
    try {
      if (!imageUrl && file) {
        imageUrl = await uploadFileToStorage(file);
      }

      const groupsList = link.groups || [];
      if (groupsList.length === 0) {
        toast.error("Nenhum grupo neste link");
        return;
      }

      let successCount = 0;
      for (const g of groupsList) {
        try {
          const inst = instances.find((i) => i.zapi_instance_id === g.instance_id);
          const { data, error } = await supabase.functions.invoke("manage-groups", {
            body: {
              action: "update-group-photo",
              groupId: g.group_id,
              imageUrl,
              instanceId: inst?.zapi_instance_id || g.instance_id,
              instanceToken: inst?.zapi_token,
              instanceClientToken: inst?.zapi_client_token,
            },
          });
          if (!error && !data?.error) {
            successCount++;
            // Update group_photo in DB
            await updateGroupInLink(g.id, { group_photo: imageUrl } as any);
          }
        } catch {
          // continue with next group
        }
      }

      toast.success(`Foto aplicada em ${successCount}/${groupsList.length} grupos!`);
      setLinkPhotoUrl((prev) => ({ ...prev, [linkId]: "" }));
      setLinkPhotoFile((prev) => ({ ...prev, [linkId]: null }));
      setLinkPhotoPreview((prev) => ({ ...prev, [linkId]: "" }));
      await refetch();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Falha ao aplicar foto"));
    } finally {
      setApplyingPhoto(null);
    }
  };

  const normalizePhoneCandidate = (value: unknown) => String(value || "")
    .replace("@c.us", "")
    .replace("@s.whatsapp.net", "")
    .replace(/\D/g, "");

  const inferCountryCode = (value: unknown) => {
    const digits = normalizePhoneCandidate(value);
    if (digits.length >= 12) return digits.slice(0, digits.length - 11);
    return "55";
  };

  const expandPhoneCandidates = (values: unknown[], referencePhone?: unknown) => {
    const countryCode = inferCountryCode(referencePhone);
    const unique = new Set<string>();
    const expanded: string[] = [];

    values.forEach((value) => {
      const digits = normalizePhoneCandidate(value);
      if (digits.length < 8) return;

      const variants = [digits];
      if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith(countryCode)) {
        variants.unshift(`${countryCode}${digits}`);
      }

      variants.forEach((variant) => {
        if (variant.length < 10 || variant.length > 15 || unique.has(variant)) return;
        unique.add(variant);
        expanded.push(variant);
      });
    });

    return expanded;
  };

  const handleForceCreateNextGroup = async (link: any) => {
    if (!link.groups || link.groups.length === 0) {
      toast.error("Adicione pelo menos um grupo modelo primeiro");
      return;
    }
    setCreatingNextGroup(link.id);
    try {
      const templateGroup = link.groups[link.groups.length - 1];
      if (!templateGroup.instance_id) {
        toast.error("Grupo modelo não tem instância associada");
        return;
      }

      // Find instance credentials
      const inst = instances.find((i) => i.zapi_instance_id === templateGroup.instance_id);
      if (!inst) {
        toast.error("Instância não encontrada");
        return;
      }

      const baseUrl = `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Client-Token": inst.zapi_client_token,
      };

      // 1. Get template group metadata
      const groupIdForMeta = templateGroup.group_id.includes("-group")
        ? templateGroup.group_id
        : templateGroup.group_id.replace("@g.us", "-group");

      let groupName = templateGroup.group_name;
      let description = "";
      let photoUrl: string | null = templateGroup.group_photo || null;
      let participantPhones: string[] = [];
      let fallbackParticipantPhones: string[] = [];
      let adminPhones: string[] = [];
      let connectedPhone = "";
      let groupSettings = {
        adminOnlyMessage: true,
        adminOnlySettings: false,
        requireAdminApproval: false,
        adminOnlyAddMember: true,
      };

      try {
        const meRes = await fetch(`${baseUrl}/me`, { method: "GET", headers });
        if (meRes.ok) {
          const meData = await meRes.json();
          connectedPhone = normalizePhoneCandidate(
            meData?.phone || meData?.phoneNumber || meData?.wid?.user || meData?.me?.user || meData?.id || ""
          );
        }
      } catch {}

      try {
        const metaRes = await fetch(`${baseUrl}/group-metadata/${groupIdForMeta}`, { method: "GET", headers });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          description = meta.description || "";
          if (meta.subject) groupName = meta.subject;
          groupSettings = {
            adminOnlyMessage: Boolean(meta?.adminOnlyMessage),
            adminOnlySettings: Boolean(meta?.adminOnlySettings),
            requireAdminApproval: Boolean(meta?.requireAdminApproval),
            adminOnlyAddMember: typeof meta?.adminOnlyAddMember === "boolean" ? meta.adminOnlyAddMember : true,
          };
          const participants = Array.isArray(meta?.participants)
            ? meta.participants
            : Array.isArray(meta?.members)
              ? meta.members
              : [];

          const isAdmin = (p: any) => {
            const role = String(p?.admin || p?.role || "").toLowerCase();
            return Boolean(p?.isAdmin || p?.isSuperAdmin || p?.isSuperadmin || role === "admin" || role === "superadmin");
          };

          adminPhones = participants
            .filter((p: any) => isAdmin(p))
            .map((p: any) => normalizePhoneCandidate(p.phone || p.id || p.participant || p.jid || p.user || p.waId || p.number || ""))
            .filter((phone: string) => phone.length >= 8);

          fallbackParticipantPhones = participants
            .filter((p: any) => !isAdmin(p))
            .map((p: any) => normalizePhoneCandidate(p.phone || p.id || p.participant || p.jid || p.user || p.waId || p.number || ""))
            .filter((phone: string) => phone.length >= 8);

          participantPhones = adminPhones;

          if (!photoUrl && meta.profileThumbnail) photoUrl = meta.profileThumbnail;
          if (!photoUrl && meta.groupPhoto) photoUrl = meta.groupPhoto;
        }
      } catch {}

      if (!photoUrl) {
        const whatsGroup = groups.find((g) => g.id === templateGroup.group_id);
        console.log("📷 WhatsApp groups list match:", whatsGroup?.id, "foto:", whatsGroup?.foto);
        if (whatsGroup?.foto) {
          photoUrl = whatsGroup.foto;
        }
      }

      if (!photoUrl) {
        try {
          console.log("📷 Trying get-profile-picture for:", groupIdForMeta);
          const { data: picData } = await supabase.functions.invoke("get-profile-picture", {
            body: { phone: groupIdForMeta },
          });
          console.log("📷 get-profile-picture response:", JSON.stringify(picData));
          const link = picData?.data?.link || picData?.data?.imgUrl || picData?.data?.profilePictureUrl || picData?.link || null;
          if (link && link !== "null") {
            photoUrl = link;
          }
        } catch {}
      }

      console.log("📷 Final photoUrl for cloning:", photoUrl);

      const numberMatch = groupName.match(/^(.*?)(\s+(\d+))?\s*$/);
      let baseName = groupName;
      let nextNumber = link.groups.length + 1;
      if (numberMatch && numberMatch[3]) {
        baseName = numberMatch[1];
        nextNumber = parseInt(numberMatch[3]) + 1;
      }
      const newGroupName = `${baseName} ${nextNumber}`;

      const TEMP_PARTICIPANT = "5518981939571";
      const validPhones = [TEMP_PARTICIPANT];
      const temporaryParticipantPhone = TEMP_PARTICIPANT;

      const createRes = await fetch(`${baseUrl}/create-group`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          autoInvite: true,
          groupName: newGroupName,
          phones: validPhones,
        }),
      });

      const createData = await createRes.json();

      const newGroupPhone = createData?.phone || createData?.groupId || createData?.id;
      if (!newGroupPhone) {
        toast.error("Falha ao criar grupo: " + JSON.stringify(createData));
        return;
      }

      const newGroupId = newGroupPhone.includes("-group")
        ? newGroupPhone
        : newGroupPhone.replace("@g.us", "-group");

      await new Promise((r) => setTimeout(r, 3000));

      if (description) {
        await supabase.functions.invoke("manage-groups", {
          body: {
            action: "update-group-description",
            instanceId: inst.zapi_instance_id,
            instanceToken: inst.zapi_token,
            instanceClientToken: inst.zapi_client_token,
            groupId: newGroupId,
            description,
          },
        }).catch(() => {});
      }

      if (photoUrl) {
        console.log("📷 Setting photo on new group:", newGroupId, "url:", photoUrl);
        const photoResult = await supabase.functions.invoke("manage-groups", {
          body: {
            action: "update-group-photo",
            instanceId: inst.zapi_instance_id,
            instanceToken: inst.zapi_token,
            instanceClientToken: inst.zapi_client_token,
            groupId: newGroupId,
            imageUrl: photoUrl,
          },
        });
        console.log("📷 update-group-photo result:", JSON.stringify(photoResult));
      } else {
        console.log("📷 No photo URL found to clone!");
      }

      if (adminPhones.length > 0) {
        const expandedAdmins = expandPhoneCandidates(adminPhones, connectedPhone)
          .filter((phone) => phone !== connectedPhone);

        if (expandedAdmins.length > 0) {
          try {
            await fetch(`${baseUrl}/add-admin`, {
              method: "POST",
              headers,
              body: JSON.stringify({ groupId: newGroupId, phones: expandedAdmins }),
            });
          } catch {}
        }
      }

      try {
        await supabase.functions.invoke("manage-groups", {
          body: {
            action: "remove-participant",
            instanceId: inst.zapi_instance_id,
            instanceToken: inst.zapi_token,
            instanceClientToken: inst.zapi_client_token,
            groupId: newGroupId,
            phone: temporaryParticipantPhone,
          },
        });
      } catch {}

      try {
        await supabase.functions.invoke("manage-groups", {
          body: {
            action: "admin-only-messages",
            instanceId: inst.zapi_instance_id,
            instanceToken: inst.zapi_token,
            instanceClientToken: inst.zapi_client_token,
            groupId: newGroupId,
            value: groupSettings.adminOnlyMessage,
            adminOnlySettings: groupSettings.adminOnlySettings,
            requireAdminApproval: groupSettings.requireAdminApproval,
            adminOnlyAddMember: groupSettings.adminOnlyAddMember,
          },
        });
      } catch {}

      // 8. Get invite link
      let inviteLink: string | null = null;
      try {
        const inviteRes = await fetch(`${baseUrl}/group-invitation-link/${newGroupId}`, { method: "GET", headers });
        if (inviteRes.ok) {
          const inviteData = await inviteRes.json();
          inviteLink = inviteData.invitationLink || inviteData.inviteLink || inviteData.link || null;
        }
      } catch {}

      // 7. Save to redirect_link_groups
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      await (supabase as any).from("redirect_link_groups").insert({
        redirect_link_id: link.id,
        user_id: user.id,
        group_id: newGroupId,
        group_name: newGroupName,
        invite_link: inviteLink,
        instance_id: inst.zapi_instance_id,
        sort_order: link.groups.length,
        current_members: 0,
        is_full: false,
        group_photo: photoUrl,
      });

      toast.success(`Grupo "${newGroupName}" criado e adicionado!`);
      await refetch();
    } catch (err: any) {
      console.error("Erro ao criar próximo grupo:", err);
      toast.error("Erro: " + (err.message || "Falha na criação"));
    } finally {
      setCreatingNextGroup(null);
    }
  };

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

      const isCommunity = (group as any).isCommunity;
      const isChannel = (group as any).isChannel;
      const instanceId = instance?.zapi_instance_id || group.sourceInstanceId;
      const instanceToken = instance?.zapi_token;
      const instanceClientToken = instance?.zapi_client_token;

      let data: any = null;
      let error: any = null;

      // Try manage-groups first
      try {
        const res = await supabase.functions.invoke("manage-groups", {
          body: {
            action: "get-invite-link",
            groupId: group.id,
            isCommunity,
            isChannel,
            instanceId,
            instanceToken,
            instanceClientToken,
          },
        });
        data = res.data;
        error = res.error;
      } catch (err: any) {
        console.error("manage-groups get-invite-link failed:", err);
      }

      // Fallback: direct Z-API call if manage-groups failed or didn't return a link
      if (!data?.link && !data?.inviteLink && !data?.invitationLink && instanceId && instanceToken) {
        console.log("Attempting direct Z-API call for invite link...");
        try {
          const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}`;
          const headers: Record<string, string> = { 
            "Content-Type": "application/json"
          };
          if (instanceClientToken) headers["Client-Token"] = instanceClientToken;
          
           let path = "";
           if (isCommunity || String(group.id).includes("@lid")) {
             const cid = group.id.replace("-group", "").replace("@lid", "").replace("@g.us", "");
             // Z-API expõe somente POST /redefine-invitation-link/{communityId}
             const r = await fetch(`${baseUrl}/redefine-invitation-link/${encodeURIComponent(cid)}`, {
               method: "POST",
               headers,
             });
             if (r.ok) {
               const dd = await r.json().catch(() => ({}));
               data = { ...data, ...dd };
             }
             path = "";
           } else {
             path = `/group-invitation-link/${group.id.includes("-group") ? group.id : group.id.replace("@g.us", "-group")}`;
           }

          if (path) {
            const res = await fetch(`${baseUrl}${path}`, { headers });
            if (res.ok) {
              const directData = await res.json();
              data = { ...data, ...directData };
            }
          }
        } catch (err: any) {
          console.error("Direct Z-API invite link call failed:", err);
        }
      }

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      inviteLink = data?.inviteLink || data?.invitationLink || data?.link || null;

      if (!inviteLink) {
        throw new Error("Não foi possível obter o link de convite do grupo");
      }

      // Fetch real member count. Channels return subscriber count in metadata,
      // not a participant list, so prefer memberCount/subscriberCount there.
      let realMemberCount = group.membros || 0;
      try {
        const { data: participantsData } = await supabase.functions.invoke("get-group-participants", {
          body: { groupId: group.id, sourceInstanceId: group.sourceInstanceId || null },
        });
        realMemberCount = (group as any).isChannel
          ? Number(participantsData?.memberCount ?? participantsData?.subscriberCount ?? group.membros ?? 0)
          : (participantsData?.participants?.length || group.membros || 0);
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
        const whatsGroup = groups.find((wg) => wg.id === g.group_id);
        const isChannel = String(g.group_id).includes("@newsletter") || Boolean((whatsGroup as any)?.isChannel);
        const count = isChannel
          ? Number(data?.memberCount ?? data?.subscriberCount ?? whatsGroup?.membros ?? g.current_members ?? 0)
          : (data?.participants?.length || 0);
        const updates: any = {
          current_members: isChannel ? Math.max(count, g.current_members || 0) : count,
          is_full: count >= link.max_members_per_group,
        };
        
        // Update photo from WhatsApp groups list
        if (whatsGroup?.foto) {
          updates.group_photo = whatsGroup.foto;
        } else if (!g.group_photo) {
          // Try fetching photo via get-profile-picture
          try {
            const { data: picData } = await supabase.functions.invoke("get-profile-picture", {
              body: { phone: g.group_id },
            });
            if (picData?.data?.link && picData.data.link !== "null") {
              updates.group_photo = picData.data.link;
            }
          } catch {
            // ignore
          }
        }
        
        await updateGroupInLink(g.id, updates);
      }
      toast.success("Contagem de membros atualizada!");
    } catch (err: any) {
      toast.error("Erro ao atualizar membros: " + (err.message || ""));
    } finally {
      setRefreshingMembers(null);
    }
  };

   const copyLink = async (slug: string) => {
     const link = links.find(l => l.slug === slug);
     const config = link ? pageConfig[link.id] : null;
     const hash = config && Object.keys(config).length > 0 ? `#${encodeURIComponent(JSON.stringify(config))}` : "";
      // Garante que o slug não tenha barras extras e o hash seja concatenado corretamente
      const cleanSlug = slug.startsWith('/') ? slug.substring(1) : slug;
      const urlToCopy = `${baseRedirectUrl}${cleanSlug}${hash}`;
     
     const fallbackCopy = (text: string): boolean => {
       try {
         const textArea = document.createElement("textarea");
         textArea.value = text;
         textArea.setAttribute("readonly", "");
         textArea.style.position = "fixed";
         textArea.style.left = "-999999px";
         textArea.style.top = "-999999px";
         document.body.appendChild(textArea);
         textArea.focus();
         textArea.select();
         const ok = document.execCommand("copy");
         textArea.remove();
         return ok;
       } catch {
         return false;
       }
     };

     let success = false;
     try {
       if (navigator.clipboard && window.isSecureContext) {
         await navigator.clipboard.writeText(urlToCopy);
         success = true;
       }
     } catch {
       success = false;
     }
     if (!success) success = fallbackCopy(urlToCopy);

     if (success) {
       setCopied(slug);
       toast.success("Link copiado!");
       setTimeout(() => setCopied(null), 2000);
     } else {
       window.prompt("Copie o link manualmente:", urlToCopy);
     }
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
            <Shuffle className="w-10 h-10 mx-auto mb-3 opacity-50" />
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
                  <Button variant="ghost" size="icon" onClick={() => setAnalyticsLinkId(link.id)} title="Análises">
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditPageLinkId(link.id)} title="Editar página">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyLink(link.slug);
                    }}
                  >
                    {copied === link.slug ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteLink(link.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
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
                  {link.groups.map((g, i) => {
                    const whatsGroup = groups.find((wg) => wg.id === g.group_id);
                    const isChannel = String(g.group_id).includes("@newsletter") || Boolean((whatsGroup as any)?.isChannel);
                    const displayMembers = isChannel ? (g.current_members || whatsGroup?.membros || 0) : g.current_members;
                    const displayFull = g.is_full;
                    return (
                    <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                        <span className="text-sm font-medium">{g.group_name || g.group_id}</span>
                        <Badge variant={displayFull ? "destructive" : "secondary"} className="text-[10px]">
                          {displayMembers} {isChannel ? "seguidores" : "membros"} {displayFull && "• CHEIO"}
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
                  );})}
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
                            <div className="flex items-center gap-2">
                              {g.isCommunity && <Building2 className="w-4 h-4 text-blue-500" />}
                              {g.isChannel && <Smartphone className="w-4 h-4 text-purple-500" />}
                              {!(g.isCommunity || g.isChannel) && <Users className="w-4 h-4 text-green-500" />}
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{g.nome}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {g.isCommunity ? "Comunidade" : g.isChannel ? "Canal" : "Grupo"}
                                </span>
                              </div>
                            </div>
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

              {link.groups && link.groups.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleForceCreateNextGroup(link)}
                  disabled={creatingNextGroup === link.id}
                  className="ml-2"
                >
                  {creatingNextGroup === link.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Criar Próximo Grupo
                </Button>
                )}

              {/* Automation Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => setAutomationDialogLink(link)}
              >
                <Workflow className="w-4 h-4 mr-2" />
                Automação do Link
                {(link.welcome_type && link.welcome_type !== 'none') && (
                  <Badge variant="secondary" className="text-[10px] ml-2">Privado</Badge>
                )}
                {(link.group_message_type && link.group_message_type !== 'none') && (
                  <Badge variant="secondary" className="text-[10px] ml-1">Grupo</Badge>
                )}
                {link.notify_admin && (
                  <Badge variant="secondary" className="text-[10px] ml-1">Notificação</Badge>
                )}
              </Button>

            </CardContent>
          </Card>
        ))
      )}

      {/* Edit Page Dialog */}
      <Dialog open={!!editPageLinkId} onOpenChange={(open) => !open && setEditPageLinkId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Personalizar Página do Link</DialogTitle>
            <DialogDescription>Configure a aparência da página de convite</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-0">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título da Página</label>
                <Input value={editingConfig.title || ""} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, title: e.target.value })} placeholder={editingLink?.name || "Nome do grupo"} />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea value={editingConfig.description || ""} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, description: e.target.value })} placeholder="Descrição da página de convite" rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" />
                  Foto da Página
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="relative w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden bg-muted/40 shrink-0"
                    onClick={() => editPageLinkId && linkPhotoRefs.current[editPageLinkId]?.click()}
                  >
                    {editingConfig.photo ? (
                      <img src={editingConfig.photo} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <Input
                    value={editingConfig.photo || ""}
                    onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, photo: e.target.value })}
                    placeholder="Cole a URL da imagem ou faça upload"
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8"
                    onClick={() => editPageLinkId && linkPhotoRefs.current[editPageLinkId]?.click()}
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </Button>
                  <input
                    ref={(el) => { if (editPageLinkId) linkPhotoRefs.current[editPageLinkId] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !editPageLinkId) return;
                      try {
                        const url = await uploadFileToStorage(file);
                        updateLocalPageConfig(editPageLinkId, { ...editingConfig, photo: url });
                        toast.success("Foto enviada!");
                      } catch (err: any) {
                        toast.error(err.message || "Erro no upload");
                      }
                    }}
                  />
                </div>
                {editingConfig.photo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 text-xs text-destructive"
                    onClick={() => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, photo: "" })}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Remover foto
                  </Button>
                )}
              </div>
              {/* Apply photo to all WhatsApp groups */}
              {editingConfig.photo && editingLink?.groups && editingLink.groups.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (!editPageLinkId || !editingConfig.photo) return;
                    setLinkPhotoUrl((prev) => ({ ...prev, [editPageLinkId]: editingConfig.photo || "" }));
                    setLinkPhotoFile((prev) => ({ ...prev, [editPageLinkId]: null }));
                    handleApplyPhotoToAll(editingLink);
                  }}
                  disabled={applyingPhoto === editPageLinkId}
                >
                  {applyingPhoto === editPageLinkId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Image className="w-3.5 h-3.5 mr-1" />
                  )}
                  Aplicar foto em todos os grupos
                </Button>
              )}
              <div>
                <label className="text-sm font-medium">Cor do Botão</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editingConfig.buttonColor || "#25D366"} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, buttonColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-border" />
                  <Input value={editingConfig.buttonColor || "#25D366"} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, buttonColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Cor de Fundo</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editingConfig.bgColor || "#f5f5f5"} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, bgColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-border" />
                  <Input value={editingConfig.bgColor || "#f5f5f5"} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, bgColor: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Cor do Texto</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editingConfig.textColor || "#1f2937"} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, textColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border border-border" />
                  <Input value={editingConfig.textColor || "#1f2937"} onChange={(e) => editPageLinkId && updateLocalPageConfig(editPageLinkId, { ...editingConfig, textColor: e.target.value })} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="rounded-lg p-6 flex flex-col items-center justify-center gap-4 border border-border" style={{ backgroundColor: editingConfig.bgColor || "#f5f5f5" }}>
              {editingConfig.photo ? (
                <img src={editingConfig.photo} alt="Preview" className="w-20 h-20 rounded-full object-cover shadow-lg ring-4 ring-white" />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white" style={{ backgroundColor: editingConfig.buttonColor || "#25D366" }}>
                  <Users className="w-10 h-10 text-white" />
                </div>
              )}
              <h3 className="text-lg font-bold text-center" style={{ color: editingConfig.textColor || "#1f2937" }}>
                {editingConfig.title || editingLink?.name || "Nome do Grupo"}
              </h3>
                {editingConfig.description && (
                  <div 
                    className="text-sm text-center max-w-[200px] whitespace-pre-wrap break-words w-full" 
                    style={{ color: editingConfig.textColor || "#1f2937", opacity: 0.7 }}
                  >
                    {editingConfig.description}
                  </div>
                )}
              <div className="w-full max-w-[200px] py-2.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: editingConfig.buttonColor || "#25D366" }}>
                <ExternalLink className="w-4 h-4" />
                Entrar no grupo
              </div>
            </div>
          </div>
        </div>
          <div className="flex items-center justify-end gap-2 p-6 border-t border-border bg-background flex-shrink-0">
            <Button variant="outline" onClick={() => setEditPageLinkId(null)}>Fechar</Button>
            <Button onClick={handleSavePageConfig} disabled={isSavingPage} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSavingPage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <AnalyticsDialog
        linkId={analyticsLinkId}
        links={links}
        onClose={() => setAnalyticsLinkId(null)}
      />
      <LinkAutomationDialog
        link={automationDialogLink ? links.find(l => l.id === automationDialogLink.id) || automationDialogLink : null}
        open={!!automationDialogLink}
        onOpenChange={(open) => !open && setAutomationDialogLink(null)}
        onSave={async (linkId, updates) => {
          await handleSaveAutomation(linkId, updates);
        }}
        templates={templates}
        flows={flows}
        instances={instances}
        saving={savingAutomation === automationDialogLink?.id}
      />
    </div>
  );
}

/* ============= TAB: Participantes ============= */
  function ParticipantesTab() {
    const { groups, loading, refetch } = useWhatsAppGroups({ provider: 'zapi' });
  const { instances } = useZapiInstances({ provider: 'zapi' });
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
          isCommunity: Boolean(group.isCommunity),
        },
      });
      if (error) throw error;
      setParticipants((data?.participants || []).map((p: any) => ({
        ...p,
        phone: group.isCommunity ? formatCommunityLid(p.phone || p.id || "") : formatCommunityLid(p.phone || p.id || ""),
      })));
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Selecione grupo, comunidade ou canal</label>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => selectedGroup && fetchParticipants(selectedGroup)} disabled={loadingParticipants || !selectedGroup}>
            <RefreshCw className={`w-4 h-4 ${loadingParticipants ? "animate-spin" : ""}`} />
          </Button>
        </div>
         {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
         ) : groups.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center border border-dashed rounded-md">
            Nenhum grupo encontrado na instância de dispositivo
          </div>
         ) : (
           <Select
             value={selectedGroupId}
             onValueChange={(value) => {
               const group = groups.find((g) => g.id === value);
               setSelectedGroupId(value);
               if (group) {
                 fetchMemberCount(group.id, group.sourceInstanceId, group.participantes);
                 fetchParticipants(group);
               }
             }}
           >
             <SelectTrigger>
               <SelectValue placeholder="Escolha um item para gerenciar" />
             </SelectTrigger>
             <SelectContent className="max-h-80">
               {groups.map((g) => (
                 <SelectItem key={g.id} value={g.id}>
                   {g.typeLabel || (g.isChannel ? "Canal" : g.isCommunity ? "Comunidade" : "Grupo")} · {g.nome}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
         )}
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Gerenciar Participantes
              </CardTitle>
              <CardDescription>Adicione, remova ou promova membros dos seus grupos</CardDescription>
            </div>
            {selectedGroup && (
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                onClick={() => {
                  const text = filteredParticipants.map(p => p.phone).join('\n');
                  const blob = new Blob([text], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `membros-${selectedGroup.nome.replace(/\s+/g, '-')}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success("Membros extraídos com sucesso!");
                }}
                disabled={filteredParticipants.length === 0}
              >
                <Download className="w-4 h-4" />
                Extrair Membros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    const phone = formatCommunityLid(p.phone || p.id || `participante-${i}`);
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
