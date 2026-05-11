import { useEffect, useState } from "react";
 import { useZapiInstances, isMobileZapiInstance } from "@/hooks/useZapiInstances";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Pencil, Trash2, RefreshCw, Search, Check, AlertCircle } from "lucide-react";

interface WhatsappTag {
  id: string;
  name: string;
  color: number;
}

interface TagColor {
  id: number;
  hex: string;
  label: string;
}

const formatErrorMessage = (value: unknown, fallback = "Não foi possível concluir a operação."): string => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message || fallback;
  return fallback;
};

const Etiquetas = () => {
  const { instances: allInstances, loading: loadingInstances } = useZapiInstances();
   const instances = useMemo(
     () => allInstances.filter((i: any) => (i.api_provider || 'zapi') === 'zapi' && !isMobileZapiInstance(i)),
     [allInstances],
   );
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [tags, setTags] = useState<WhatsappTag[]>([]);
  const [tagColors, setTagColors] = useState<TagColor[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState("");
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<WhatsappTag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagDescription, setNewTagDescription] = useState("");
  const [newTagColor, setNewTagColor] = useState(0);
  const [tagColorError, setTagColorError] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    if (selectedInstanceId) {
      fetchTags(selectedInstanceId);
      fetchTagColors(selectedInstanceId);
    }
  }, [selectedInstanceId]);

  const fetchTagColors = async (instanceId: string) => {
    setTagColorError(null);
    try {
      console.log("[Etiquetas] Buscando cores para instância:", instanceId);
      const { data, error: invokeError } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: "tag-colors", instanceDbId: instanceId },
      });
      
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));

      console.log("[Etiquetas] Resposta cores:", data);
      
      // A API retorna cores em formatos variados: array, {data: [...]} ou objeto {id: hex}
      let rawColors: TagColor[] = [];
      const payload = data?.data ?? data;
      
      if (Array.isArray(payload)) {
        rawColors = payload;
      } else if (payload && typeof payload === "object") {
        rawColors = Object.entries(payload)
          .filter(([k, v]) => !isNaN(Number(k)) && typeof v === "string")
          .map(([k, v]) => ({ id: Number(k), hex: v as string, label: `Cor ${k}` }));
      }
      
      setTagColors(rawColors);
      
      if (rawColors.length === 0) {
        console.warn("[Etiquetas] Nenhuma cor retornada pela API.");
        setTagColorError("Nenhuma cor disponível para esta conta.");
      }
    } catch (err: any) {
      console.error("[Etiquetas] Erro ao buscar cores de etiquetas:", err);
      setTagColorError("Não foi possível carregar as cores do WhatsApp Business.");
    }
  };

  const fetchTags = async (instanceId: string) => {
    setLoadingTags(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: "list-tags", instanceDbId: instanceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(formatErrorMessage(data.error));
      const payload = data?.data ?? data;
      setTags(Array.isArray(payload) ? payload : []);
    } catch (err: any) {
      console.error("Erro ao buscar etiquetas:", err);
      toast({ title: "Erro ao carregar etiquetas", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTags(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setLoadingTags(true);
    
    const targetInstances = applyToAll 
      ? instances 
      : [instances.find(i => i.id === selectedInstanceId)].filter(Boolean);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const inst of targetInstances as any[]) {
        try {
          const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
            body: { 
              action: "create-tag", 
              instanceDbId: inst.id, 
              payload: { name: newTagName, color: newTagColor } 
            },
          });
          if (error || data?.error) {
            console.error(`Erro na instância ${inst.instance_name || inst.id}:`, error || data?.error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Erro na instância ${inst.instance_name || inst.id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({ 
          title: applyToAll ? "Etiquetas criadas" : "Etiqueta criada", 
          description: applyToAll 
            ? `${successCount} etiquetas criadas com sucesso. ${errorCount > 0 ? `${errorCount} falhas.` : ""}`
            : `A etiqueta "${newTagName}" foi criada com sucesso.` 
        });
      } else if (errorCount > 0) {
        throw new Error("Falha ao criar etiqueta. Verifique se a instância está conectada.");
      }

      setNewTagName("");
      setNewTagDescription("");
      setNewTagColor(0);
      setApplyToAll(false);
      setIsCreateTagOpen(false);
      fetchTags(selectedInstanceId);
    } catch (err: any) {
      toast({ title: "Erro ao criar etiqueta", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTags(false);
    }
  };

  const handleEditTag = async () => {
    if (!editingTag || !editingTag.name.trim()) return;
    setLoadingTags(true);
    
    const targetInstances = applyToAll 
      ? instances 
      : [instances.find(i => i.id === selectedInstanceId)].filter(Boolean);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const inst of targetInstances as any[]) {
        try {
          let tagIdToEdit = editingTag.id;
          
          if (inst.id !== selectedInstanceId) {
            const { data: remoteTags } = await supabase.functions.invoke("zapi-chat-actions", {
              body: { action: "list-tags", instanceDbId: inst.id },
            });
            const tagsList = remoteTags?.data ?? remoteTags;
            const matchingTag = Array.isArray(tagsList) 
              ? tagsList.find((t: any) => t.name === editingTag.name)
              : null;
            
            if (matchingTag) {
              tagIdToEdit = matchingTag.id;
            } else {
              continue;
            }
          }

          const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
            body: { 
              action: "edit-tag", 
              instanceDbId: inst.id, 
              payload: { id: tagIdToEdit, name: editingTag.name, color: editingTag.color } 
            },
          });
          
          if (error || data?.error) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      toast({ 
        title: applyToAll ? "Etiquetas atualizadas" : "Etiqueta atualizada",
        description: applyToAll ? `${successCount} instâncias atualizadas.` : undefined
      });
      
      setEditingTag(null);
      setApplyToAll(false);
      fetchTags(selectedInstanceId);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar etiqueta", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTags(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta etiqueta?")) return;
    setLoadingTags(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: "delete-tag", instanceDbId: selectedInstanceId, payload: { id: tagId } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(formatErrorMessage(data.error));
      toast({ title: "Etiqueta excluída" });
      fetchTags(selectedInstanceId);
    } catch (err: any) {
      toast({ title: "Erro ao excluir etiqueta", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTags(false);
    }
  };

  if (loadingInstances) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagSearchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Etiquetas</h1>
          <p className="text-muted-foreground">Organize seus contatos e conversas com etiquetas coloridas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => fetchTags(selectedInstanceId)} 
            disabled={loadingTags || !selectedInstanceId}
          >
            <RefreshCw className={`w-4 h-4 ${loadingTags ? "animate-spin" : ""}`} />
          </Button>
          <div className="flex items-center gap-2 min-w-[200px]">
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.instance_name || inst.zapi_instance_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setIsCreateTagOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Etiqueta
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Suas Etiquetas ({tags.length})
              </CardTitle>
              <CardDescription>Gerencie as etiquetas da sua conta WhatsApp.</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar etiquetas..." 
                className="pl-9 h-9 text-xs"
                value={tagSearchTerm}
                onChange={(e) => setTagSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTags ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTags.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTags.map((tag) => {
                const colorInfo = tagColors.find(c => c.id === tag.color);
                return (
                  <div 
                    key={tag.id} 
                    className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/30 hover:bg-background/50 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full shadow-sm" 
                        style={{ backgroundColor: colorInfo?.hex || '#cbd5e1' }}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{tag.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {colorInfo?.label || `Cor ${tag.color}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => setEditingTag(tag)}
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border/50 rounded-xl">
              <AlertCircle className="w-10 h-10 text-muted-foreground mb-3 opacity-20" />
              <h3 className="text-base font-semibold">Nenhuma etiqueta encontrada</h3>
              <p className="text-xs text-muted-foreground mt-1">Crie sua primeira etiqueta para começar a organizar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs from PerfilEmpresa */}
      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Etiqueta</DialogTitle>
            <DialogDescription>Altere o nome ou a cor da sua etiqueta do WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tagName" className="text-right">Nome</Label>
              <Input 
                id="tagName" 
                value={editingTag?.name || ''} 
                onChange={(e) => setEditingTag(prev => prev ? ({ ...prev, name: e.target.value }) : null)} 
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Cor</Label>
              <div className="col-span-3">
                <div className="grid grid-cols-5 gap-2">
                  {tagColors.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEditingTag(prev => prev ? ({ ...prev, color: c.id }) : null)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {editingTag?.color === c.id && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="editApplyToAll" 
                checked={applyToAll} 
                onCheckedChange={(checked) => setApplyToAll(checked === true)} 
              />
              <Label 
                htmlFor="editApplyToAll" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Aplicar alteração em todas as instâncias (busca pelo mesmo nome)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTag(null)} disabled={loadingTags}>Cancelar</Button>
            <Button onClick={handleEditTag} disabled={loadingTags || !editingTag?.name.trim()}>
              {loadingTags ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nova Etiqueta</DialogTitle>
            <DialogDescription>Crie uma nova etiqueta para organizar seus contatos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newTagName">Nome</Label>
              <Input
                id="newTagName"
                placeholder="Ex: Cliente VIP, Prospect, etc"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Selecione uma cor</Label>
              {tagColorError && (
                <p className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {tagColorError}
                </p>
              )}
              <div className="grid grid-cols-7 gap-2 pt-1">
                {(() => {
                  if (tagColors.length > 0) {
                    return tagColors.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewTagColor(c.id)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${newTagColor === c.id ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : ''}`}
                        style={{ backgroundColor: c.hex || '#cbd5e1' }}
                        title={c.label}
                      >
                        {newTagColor === c.id && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ));
                  }
                  
                  if (loadingTags) {
                    return [0, 1, 2, 3, 4, 5, 6].map(id => (
                      <Skeleton key={id} className="w-9 h-9 rounded-full" />
                    ));
                  }

                  // Fallback para cores padrão do WhatsApp
                  return [
                    { id: 0, hex: "#62ee8d", label: "Verde" },
                    { id: 1, hex: "#52d6f4", label: "Azul claro" },
                    { id: 2, hex: "#3581ef", label: "Azul" },
                    { id: 3, hex: "#fef057", label: "Amarelo" },
                    { id: 4, hex: "#fe8732", label: "Laranja" },
                    { id: 5, hex: "#f96173", label: "Vermelho" },
                    { id: 6, hex: "#bc81e3", label: "Roxo" },
                    { id: 7, hex: "#91a4b0", label: "Cinza" },
                    { id: 8, hex: "#d7dce0", label: "Cinza claro" },
                    { id: 9, hex: "#4c5d67", label: "Cinza escuro" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewTagColor(c.id)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${newTagColor === c.id ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {newTagColor === c.id && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ));
                })()}
              </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="applyToAll" 
                checked={applyToAll} 
                onCheckedChange={(checked) => setApplyToAll(checked === true)} 
              />
              <Label 
                htmlFor="applyToAll" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Criar esta etiqueta em todas as instâncias
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTagOpen(false)} disabled={loadingTags}>Cancelar</Button>
            <Button onClick={handleCreateTag} disabled={loadingTags || !newTagName.trim()}>
              {loadingTags ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Etiquetas;