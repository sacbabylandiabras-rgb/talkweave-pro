import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { RefreshCw, Plus, Hash, Image, Upload, Loader2, Trash2, Pencil, Settings, UserPlus, UserMinus, Search, Volume2, VolumeX, Heart, HeartOff, UserCheck, Copy } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Newsletter {
  id: string;
  name?: string;
  description?: string;
  photo?: string;
  raw?: Record<string, unknown>;
}

export default function CanaisTab() {
   const { instances, activeInstance, selectInstance } = useZapiInstances({ provider: 'zapi' });
  const [instanceId, setInstanceId] = useState<string>("");
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [metadataOpen, setMetadataOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const editPhotoFileRef = useRef<HTMLInputElement>(null);

  const [reactionMode, setReactionMode] = useState<"ALL" | "BASIC" | "NONE">("ALL");
   const [transferPhone, setTransferPhone] = useState("");
   const [adminPhone, setAdminPhone] = useState("");
   const [addAdminPhone, setAddAdminPhone] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPhotoUrl, setCreatePhotoUrl] = useState("");
  const createPhotoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!instanceId && activeInstance?.id) setInstanceId(activeInstance.id);
  }, [activeInstance, instanceId]);

  const selectedNewsletter = useMemo(
    () => newsletters.find((n) => n.id === selectedId) || null,
    [newsletters, selectedId],
  );

  useEffect(() => {
    if (selectedNewsletter) {
      setEditName(selectedNewsletter.name || "");
      setEditDescription(selectedNewsletter.description || "");
      setEditPhotoUrl(String(selectedNewsletter.raw?.picture || ""));
    }
  }, [selectedNewsletter]);

   const invokeNewsletter = async (action: string, payload: Record<string, unknown> = {}) => {
     const { data, error } = await supabase.functions.invoke("manage-newsletters", {
       body: { action, ...payload },
     });
    if (error) throw new Error(error.message || "Erro ao chamar Z-API");
    if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
      throw new Error(String((data as { error: string }).error));
    }
    return data;
  };

  const loadNewsletters = async () => {
    setLoading(true);
    try {
      let data = await invokeNewsletter("list-newsletters");
      
      // Normalização: a Z-API pode retornar um array direto ou um objeto com a lista
      const rawList = Array.isArray(data) ? data : (data as any)?.newsletters || (data as any)?.list || [];
      
      const list: Newsletter[] = rawList.map((n: any) => {
        const id = String(n.newsletterId || n.id || n.jid || "");
        // A Z-API pode retornar 'picture' ou 'pictureUrl'
        const photo = n.picture || n.pictureUrl || n.preview || "";
        return {
        id,
        name: n.name || n.subject || n.title || "Canal",
        description: n.description || n.desc || "",
        photo,
        raw: { ...n, picture: photo }
      }}).filter((n: any) => n.id);

      setNewsletters(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (err) {
      console.error(err);
      setNewsletters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instanceId) loadNewsletters();
  }, [instanceId]);

  const uploadPhotoFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const fileName = `${user.id}/newsletter-photos/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("template-media").upload(fileName, file, { contentType: file.type });
    if (error) throw new Error("Erro no upload: " + error.message);
    const { data: urlData } = supabase.storage.from("template-media").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadPhotoFile(file);
      setter(url);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return toast.error("Nome obrigatório");
    setActionLoading("create");
    try {
      await invokeNewsletter("create-newsletter", { name: createName, description: createDescription, imageUrl: createPhotoUrl });
      toast.success("Canal criado!");
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreatePhotoUrl("");
      await loadNewsletters();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setActionLoading("search");
    try {
      const data = await invokeNewsletter("search-newsletter", { query: searchQuery.trim() });
      setSearchResults(Array.isArray(data) ? data : []);
      toast.success(`${(Array.isArray(data) ? data : []).length} canais encontrados`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGetMetadata = async () => {
    if (!selectedNewsletter) return;
    setActionLoading("metadata");
    try {
      const data = await invokeNewsletter("newsletter-metadata", { newsletterId: selectedNewsletter.id });
      setMetadata(data);
      setMetadataOpen(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

   const runAction = async (action: string, payload: Record<string, any>, successMsg: string, after?: () => void) => {
     setActionLoading(action);
     try {
       const data = await invokeNewsletter(action, { newsletterId: selectedNewsletter?.id, ...payload });
       toast.success(successMsg);
       if (after) after();
       await loadNewsletters();
       return data;
     } catch (err: any) {
       toast.error(err.message);
       return null;
     } finally {
       setActionLoading(null);
     }
   };
 
   const copyInviteLink = async () => {
     if (!selectedNewsletter) return;
     setActionLoading("copy-link");
     try {
       const data = await invokeNewsletter("newsletter-metadata", { newsletterId: selectedNewsletter.id });
       const link = data?.inviteLink || data?.invitationLink || data?.link;
       if (link) {
         navigator.clipboard.writeText(link);
         toast.success("Link copiado!");
       } else {
         toast.error("Link de convite não encontrado para este canal.");
       }
     } catch (err: any) {
       toast.error(err.message);
     } finally {
       setActionLoading(null);
     }
   };

  return (
    <div className="space-y-6">
       <Card className="border-none shadow-none bg-transparent">
         <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Hash className="w-5 h-5 text-primary" /> Canais
              </CardTitle>
              <CardDescription>Gerencie seus canais (newsletters) do WhatsApp</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={loadNewsletters} disabled={loading || !instanceId}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!instanceId}><Plus className="w-4 h-4 mr-1" /> Novo Canal</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Canal</DialogTitle>
                    <DialogDescription>Preencha os dados do novo canal.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex flex-col items-center gap-4">
                       <div 
                         onClick={() => createPhotoFileRef.current?.click()} 
                         className="relative w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted cursor-pointer hover:border-primary transition-colors"
                         style={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
                       >
                         {createPhotoUrl ? (
                           <img src={createPhotoUrl} className="w-full h-full object-cover" />
                         ) : (
                           <Upload className="w-8 h-8 text-muted-foreground" />
                         )}
                        {uploadingPhoto && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>}
                      </div>
                      <input ref={createPhotoFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoFileChange(e, setCreatePhotoUrl)} />
                      <p className="text-xs text-muted-foreground">Clique para fazer upload da foto</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Canal</Label>
                      <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Ex: Notícias ZapLynx" />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Uma breve descrição..." rows={3} />
                    </div>
                    <Button className="w-full" onClick={handleCreate} disabled={actionLoading === "create"}>
                      {actionLoading === "create" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Criar Canal
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
         <CardContent className="px-0">
           {/* Seletor de Instância */}
           <div className="mb-6 p-4 bg-card border rounded-xl flex items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                 <Settings className="w-5 h-5 text-primary" />
               </div>
               <div>
                 <p className="text-sm font-medium">Instância Ativa</p>
                 <p className="text-xs text-muted-foreground">Selecione a instância para gerenciar canais</p>
               </div>
             </div>
             <select 
               value={instanceId} 
               onChange={(e) => {
                 setInstanceId(e.target.value);
                 selectInstance(e.target.value);
               }}
               className="bg-background border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[200px]"
             >
               {instances.map(inst => (
                 <option key={inst.id} value={inst.id}>{inst.instance_name}</option>
               ))}
             </select>
           </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2 border-r pr-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar canais..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="h-8 text-xs" />
                <Button size="sm" variant="ghost" onClick={handleSearch} disabled={actionLoading === "search"} className="h-8 px-2"><Search className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {newsletters.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhum canal encontrado.</div>
                ) : (
                   newsletters.map((n) => {
                     const isSelected = selectedId === n.id;
                     return (
                       <button 
                         key={n.id} 
                         onClick={() => setSelectedId(n.id)} 
                         className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/50 border-transparent"}`}
                         style={isSelected ? { borderColor: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.1)' } : {}}
                       >
                         <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {n.photo ? (
                            <img src={n.photo} className="w-full h-full object-cover" onError={(e) => {
                              (e.target as HTMLImageElement).src = ""; // Fallback se a URL falhar
                            }} />
                          ) : (
                            <Hash className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                           <div className="min-w-0">
                             <p className="font-medium text-sm truncate">{n.name}</p>
                             <p className="text-xs text-muted-foreground truncate">{n.description || "Sem descrição"}</p>
                           </div>
                         </div>
                       </button>
                     );
                   })
                )}
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              {!selectedNewsletter ? (
                 <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                   <Hash 
                     className="w-12 h-12 mb-4" 
                     style={{ opacity: 0.2 }}
                   />
                  <p>Selecione um canal para gerenciar</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                       <div 
                         className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 border-2"
                         style={{ borderColor: 'hsl(var(--primary) / 0.2)' }}
                       >
                        {selectedNewsletter.photo ? (
                          <img src={selectedNewsletter.photo} className="w-full h-full object-cover" />
                        ) : (
                          <Hash className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{selectedNewsletter.name}</h3>
                        <p className="text-sm text-muted-foreground">{selectedNewsletter.id}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] uppercase">{(selectedNewsletter.raw as any)?.role || "membro"}</Badge>
                        </div>
                      </div>
                    </div>
                     <div className="flex gap-2">
                       <Button variant="outline" size="sm" onClick={copyInviteLink} disabled={actionLoading === "copy-link"}>
                         {actionLoading === "copy-link" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                         Copiar Link
                       </Button>
                       <Button variant="outline" size="sm" onClick={handleGetMetadata} disabled={actionLoading === "metadata"}>
                         {actionLoading === "metadata" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5 mr-1" />}
                         Metadados
                       </Button>
                     </div>
                  </div>

                  <Tabs defaultValue="settings">
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="settings">Configurações</TabsTrigger>
                      <TabsTrigger value="actions">Ações</TabsTrigger>
                      <TabsTrigger value="admins">Administração</TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings" className="space-y-4 mt-4">
                      <div className="grid gap-4 border rounded-lg p-4">
                        <div className="space-y-2">
                          <Label>Nome do Canal</Label>
                          <div className="flex gap-2">
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            <Button size="sm" onClick={() => runAction("update-newsletter-name", { name: editName }, "Nome atualizado")} disabled={actionLoading === "update-newsletter-name"}>Salvar</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                          <Button size="sm" onClick={() => runAction("update-newsletter-description", { description: editDescription }, "Descrição atualizada")} disabled={actionLoading === "update-newsletter-description"}>Salvar</Button>
                        </div>
                        <div className="space-y-2">
                          <Label>Foto do Canal</Label>
                          <div className="flex gap-2">
                            <Input value={editPhotoUrl} onChange={(e) => setEditPhotoUrl(e.target.value)} placeholder="URL da foto" />
                            <Button size="sm" variant="outline" onClick={() => editPhotoFileRef.current?.click()}><Upload className="w-4 h-4" /></Button>
                            <Button size="sm" onClick={() => runAction("update-newsletter-picture", { imageUrl: editPhotoUrl }, "Foto atualizada")} disabled={actionLoading === "update-newsletter-picture"}>Aplicar</Button>
                          </div>
                          <input ref={editPhotoFileRef} type="file" className="hidden" onChange={(e) => handlePhotoFileChange(e, setEditPhotoUrl)} />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="actions" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" onClick={() => runAction("follow-newsletter", {}, "Seguindo")} disabled={actionLoading === "follow-newsletter"}><Heart className="w-4 h-4 mr-2" /> Seguir</Button>
                        <Button variant="outline" onClick={() => runAction("unfollow-newsletter", {}, "Deixou de seguir")} disabled={actionLoading === "unfollow-newsletter"}><HeartOff className="w-4 h-4 mr-2" /> Deixar de Seguir</Button>
                        <Button variant="outline" onClick={() => runAction("mute-newsletter", {}, "Silenciado")} disabled={actionLoading === "mute-newsletter"}><VolumeX className="w-4 h-4 mr-2" /> Silenciar</Button>
                        <Button variant="outline" onClick={() => runAction("unmute-newsletter", {}, "Som ativado")} disabled={actionLoading === "unmute-newsletter"}><Volume2 className="w-4 h-4 mr-2" /> Ativar Som</Button>
                      </div>
                       <div 
                         className="border rounded-lg p-4 space-y-4"
                         style={{ backgroundColor: 'hsl(var(--muted) / 0.2)' }}
                       >
                        <Label>Reações</Label>
                        <div className="flex gap-2">
                           <Button variant={reactionMode === "ALL" ? "default" : "outline"} size="sm" onClick={() => { setReactionMode("ALL"); runAction("update-newsletter-config", { reactionCodes: "all" }, "Reações: Todas"); }}>Todas</Button>
                           <Button variant={reactionMode === "BASIC" ? "default" : "outline"} size="sm" onClick={() => { setReactionMode("BASIC"); runAction("update-newsletter-config", { reactionCodes: "basic" }, "Reações: Básicas"); }}>Básicas</Button>
                           <Button variant={reactionMode === "NONE" ? "default" : "outline"} size="sm" onClick={() => { setReactionMode("NONE"); runAction("update-newsletter-config", { reactionCodes: "none" }, "Reações: Nenhuma"); }}>Nenhuma</Button>
                        </div>
                      </div>
                       <Button 
                         variant="destructive" 
                         className="w-full" 
                         onClick={() => {
                           if (window.confirm("Tem certeza que deseja excluir permanentemente este canal? Esta ação não pode ser desfeita.")) {
                             runAction("delete-newsletter", {}, "Canal excluído", () => { 
                               setSelectedId(""); 
                               loadNewsletters(); 
                             });
                           }
                         }} 
                         disabled={actionLoading === "delete-newsletter"}
                       >
                         <Trash2 className="w-4 h-4 mr-2" /> Excluir Canal
                       </Button>
                    </TabsContent>

                    <TabsContent value="admins" className="space-y-4 mt-4">
                      <div className="border rounded-lg p-4 space-y-4">
                        <div className="space-y-2">
                          <Label>Transferir Propriedade</Label>
                          <div className="flex gap-2">
                            <Input placeholder="Telefone (DDI+DDD+Número)" value={transferPhone} onChange={(e) => setTransferPhone(e.target.value)} />
                            <Button size="sm" variant="destructive" onClick={() => runAction("transfer-newsletter-ownership", { phone: transferPhone }, "Propriedade transferida")} disabled={actionLoading === "transfer-newsletter-ownership"}><UserPlus className="w-4 h-4 mr-2" /> Transferir</Button>
                          </div>
                        </div>
                         <div className="space-y-2">
                           <Label>Administração</Label>
                           <div className="space-y-4">
                             <div className="flex gap-2">
                               <Input placeholder="Telefone para Adicionar" value={addAdminPhone} onChange={(e) => setAddAdminPhone(e.target.value)} />
                               <Button size="sm" variant="default" onClick={() => runAction("newsletter-add-admin", { phone: addAdminPhone }, "Administrador convidado", () => setAddAdminPhone(""))} disabled={actionLoading === "newsletter-add-admin"}>
                                 <UserPlus className="w-4 h-4 mr-2" /> Adicionar
                               </Button>
                             </div>
                             <div className="flex gap-2">
                               <Input placeholder="Telefone para Remover" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
                               <Button size="sm" variant="outline" onClick={() => runAction("newsletter-remove-admin", { phone: adminPhone }, "Admin removido", () => setAdminPhone(""))} disabled={actionLoading === "newsletter-remove-admin"}>
                                 <UserMinus className="w-4 h-4 mr-2" /> Remover
                               </Button>
                             </div>
                             <Button size="sm" variant="outline" className="w-full" onClick={() => runAction("accept-newsletter-admin-invite", {}, "Convite aceito")} disabled={actionLoading === "accept-newsletter-admin-invite"}>
                               <UserCheck className="w-4 h-4 mr-2" /> Aceitar Convite de Admin
                             </Button>
                           </div>
                         </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Metadados do Canal</DialogTitle>
            <DialogDescription>Dados técnicos do canal no WhatsApp.</DialogDescription>
          </DialogHeader>
          <pre className="p-4 rounded-lg bg-muted text-[10px] overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
