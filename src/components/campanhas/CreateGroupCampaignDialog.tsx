 import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
 import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
 import { useZapiInstances } from "@/hooks/useZapiInstances";
 import { ROTATE_ALL } from "@/components/envio/InstanceSelector";
 import { setZapiInstanceOverride, setZapiRotateMode } from "@/hooks/useZapi";
import { useGroupMemberCount } from "@/hooks/useGroupMemberCount";
import { supabase } from "@/integrations/supabase/client";
import { Users, Loader2, Search, MessageSquare, Link2, Clock, Calendar } from "lucide-react";

interface CreateGroupCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupCampaignDialog({ open, onOpenChange }: CreateGroupCampaignDialogProps) {
  const { toast } = useToast();
  const { createCampaign, sendCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();
   const { groups, loading: loadingGroups, refetch: refetchGroups } = useWhatsAppGroups({
     provider: 'zapi_no_warmup_meta'
   });
   const { instances: allInstances, activeInstance } = useZapiInstances();
   
   const instances = useMemo(() => allInstances.filter(i => {
     const provider = (i.api_provider || 'zapi').toLowerCase();
      const name = (i.instance_name || '').toLowerCase();
     if (name.includes('aquecimento') || name.includes('warmup')) return false;
     return provider !== 'uazapi' && provider !== 'meta';
   }), [allInstances]);
 
   const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const { fetchMemberCount, getMemberCount, isLoading: isMemberCountLoading } = useGroupMemberCount();

  // Fetch rotative links with their groups
  const [rotativeLinks, setRotativeLinks] = useState<Array<{ id: string; name: string; slug: string; groups: Array<{ group_id: string; group_name: string; instance_id?: string | null }> }>>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchLinks = async () => {
      setLoadingLinks(true);
      try {
        const { data: links } = await supabase.from('redirect_links').select('id, name, slug');
        if (!links) { setLoadingLinks(false); return; }
        const { data: linkGroups } = await supabase.from('redirect_link_groups').select('redirect_link_id, group_id, group_name, instance_id');
        const mapped = links.map(l => ({
          id: l.id,
          name: l.name,
          slug: l.slug,
          groups: (linkGroups || []).filter(g => g.redirect_link_id === l.id).map(g => ({ group_id: g.group_id, group_name: g.group_name, instance_id: g.instance_id })),
        })).filter(l => l.groups.length > 0);
        setRotativeLinks(mapped);
      } catch (e) {
        console.error('Error fetching rotative links:', e);
      } finally {
        setLoadingLinks(false);
      }
    };
    fetchLinks();
  }, [open]);

  useEffect(() => {
    if (!open || loadingGroups || groups.length === 0) return;

    if (groups.length > 0) {
      groups
        .filter(group => group.membros <= 0)
        .forEach(group => {
          void fetchMemberCount(group.id, group.sourceInstanceId || null, group.participantes || []);
        });
    }
  }, [open, loadingGroups, groups]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    delay_seconds: 2,
    schedule_type: "immediate" as "immediate" | "scheduled",
    scheduled_at: "",
  });

  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const normalizeGroupTargetPhone = (groupId: string) => {
    const trimmed = groupId.trim();
    if (!trimmed) return trimmed;
    if (trimmed.includes('@')) return trimmed; // Já tem sufixo (@g.us, @newsletter, @lid)
    if (trimmed.includes('-group') || trimmed.includes('-community')) return trimmed; // Já tem formato Z-API

    if (trimmed.includes("-group@g.us")) return trimmed.replace("-group@g.us", "@g.us");
    if (trimmed.endsWith("-group")) return trimmed.replace(/-group$/i, "@g.us");
    if (trimmed.includes("@g.us")) return trimmed;
    return `${trimmed}@g.us`;
  };

  const selectedTemplate = templates.find(t => t.id === formData.template_id);

   const filteredGroups = useMemo(() => {
     let filtered = groups;
     
     // Se uma instância específica for selecionada, filtrar grupos dela
     if (selectedInstanceId && selectedInstanceId !== ROTATE_ALL) {
       filtered = filtered.filter(g => g.sourceInstanceId === selectedInstanceId);
     }
     
     return filtered.filter(g =>
       g.nome.toLowerCase().includes(searchQuery.toLowerCase())
     );
   }, [groups, selectedInstanceId, searchQuery]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const selectAll = () => {
    if (selectedGroups.length === filteredGroups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(filteredGroups.map(g => g.id));
    }
  };

   const handleSubmit = async () => {
    if (!formData.name) {
      toast({ title: "Erro", description: "Nome da campanha é obrigatório", variant: "destructive" });
      return;
    }
    if (!formData.template_id) {
      toast({ title: "Erro", description: "Selecione um modelo de mensagem", variant: "destructive" });
      return;
    }
    // Get all groups that should be included in the campaign
    // This includes directly selected groups and groups from rotative links
    const rotativeLinkGroups = rotativeLinks.flatMap(link => link.groups.map(g => g.group_id));
    const allTargetGroupIds = Array.from(new Set([...selectedGroups, ...rotativeLinkGroups]));

    if (allTargetGroupIds.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um grupo", variant: "destructive" });
      return;
    }
    if (formData.schedule_type === 'scheduled' && !formData.scheduled_at) {
      toast({ title: "Erro", description: "Selecione data e hora do agendamento", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const groupContacts = allTargetGroupIds.map(groupId => {
        const group = groups.find(g => g.id === groupId);
        const linkGroup = rotativeLinks.flatMap(link => link.groups).find(g => g.group_id === groupId);
        return {
          phone: normalizeGroupTargetPhone(groupId),
          name: group?.nome || linkGroup?.group_name || "Grupo",
          sourceInstanceId: group?.sourceInstanceId || linkGroup?.instance_id || null,
          sourceInstanceName: group?.sourceInstanceName || null,
        };
      });

      const campaign = await createCampaign({
        name: formData.name,
        description: formData.description || `Campanha em ${allTargetGroupIds.length} grupo(s)`,
        template_id: formData.template_id,
        target_audience: {
          type: "groups",
          contacts: groupContacts,
          groupIds: allTargetGroupIds,
        },
        delay_seconds: formData.delay_seconds,
        schedule_type: formData.schedule_type,
        scheduled_at: formData.schedule_type === 'scheduled' ? formData.scheduled_at : undefined,
      });

       if (formData.schedule_type === 'immediate') {
         console.log(`🚀 Executing immediate campaign send for ${campaign.id}`);
         
         // Determinar instância de envio
         let instanceToUse = null;
         if (selectedInstanceId === ROTATE_ALL) {
           setZapiRotateMode(instances);
         } else if (selectedInstanceId) {
           const inst = instances.find(i => i.id === selectedInstanceId);
           if (inst) {
             setZapiInstanceOverride(inst);
             instanceToUse = selectedInstanceId;
           }
         }
         
         await sendCampaign(campaign.id, groupContacts, instanceToUse);
       }

      toast({ title: "Campanha criada", description: formData.schedule_type === 'scheduled' 
        ? `Campanha "${formData.name}" agendada para ${new Date(formData.scheduled_at).toLocaleString('pt-BR')}`
        : `Campanha "${formData.name}" criada com ${allTargetGroupIds.length} grupo(s)` });
      onOpenChange(false);
      setFormData({ name: "", description: "", template_id: "", delay_seconds: 2, schedule_type: "immediate", scheduled_at: "" });
      setSelectedGroups([]);
    } catch (error) {
      console.error("Error creating group campaign:", error);
      toast({ title: "Erro", description: "Erro ao criar campanha", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Nova Campanha em Grupo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <Label>Nome da Campanha</Label>
            <Input
              placeholder="Ex: Promoção nos grupos"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Modelo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Modelo de Mensagem</Label>
              <Select
                value={formData.template_id}
                onValueChange={val => setFormData(prev => ({ ...prev, template_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.active).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Instância */}
            <div>
              <Label>Instância de Envio</Label>
              <Select
                value={selectedInstanceId}
                onValueChange={setSelectedInstanceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância (ou rodízio)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROTATE_ALL}>Rodízio (Todas as instâncias)</SelectItem>
                  {instances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview do template */}
          {selectedTemplate && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Prévia:</p>
              <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
            </div>
          )}

          {/* Agendamento */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Tipo de Envio</Label>
            </div>
            <RadioGroup
              value={formData.schedule_type}
              onValueChange={(val: "immediate" | "scheduled") => setFormData(prev => ({ ...prev, schedule_type: val }))}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="schedule-now" />
                <Label htmlFor="schedule-now" className="cursor-pointer text-sm">Enviar agora</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="schedule-later" />
                <Label htmlFor="schedule-later" className="cursor-pointer text-sm">Agendar horário</Label>
              </div>
            </RadioGroup>

            {formData.schedule_type === "scheduled" && (
              <div className="flex items-center gap-2 pl-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={e => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className="flex-1"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}
          </div>

          {/* Delay */}
          <div>
            <Label>Intervalo entre envios (segundos)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={formData.delay_seconds}
              onChange={e => setFormData(prev => ({ ...prev, delay_seconds: parseInt(e.target.value) || 2 }))}
            />
          </div>

          {/* Seleção de grupos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Selecionar Grupos ({selectedGroups.length} selecionado{selectedGroups.length !== 1 ? "s" : ""})</Label>
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                {selectedGroups.length === filteredGroups.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {(loadingGroups || loadingLinks) ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando grupos...</span>
              </div>
            ) : (filteredGroups.length === 0 && rotativeLinks.length === 0) ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhum grupo encontrado
              </div>
            ) : (
              <ScrollArea className="h-[280px] border border-border/50 rounded-lg">
                <div className="p-2 space-y-1">
                  {/* Rotative Links sections */}
                  {rotativeLinks.map(link => {
                    const linkFilteredGroups = link.groups.filter(g =>
                      g.group_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      link.name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    if (linkFilteredGroups.length === 0) return null;
                    return (
                      <div key={link.id} className="mb-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-md mb-1">
                          <Link2 className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-primary">{link.name}</span>
                          <span className="text-[10px] text-muted-foreground">/{link.slug}</span>
                        </div>
                        {linkFilteredGroups.map(g => (
                          <label
                            key={`${link.id}-${g.group_id}`}
                            className="flex items-center gap-3 p-2 pl-6 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedGroups.includes(g.group_id)}
                              onCheckedChange={() => toggleGroup(g.group_id)}
                            />
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{g.group_name}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })}

                  {/* WhatsApp Groups (not in rotative links) */}
                  {filteredGroups.length > 0 && (
                    <div className="mb-2">
                      {rotativeLinks.length > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-md mb-1">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground">Grupos WhatsApp</span>
                        </div>
                      )}
                      {filteredGroups.map(group => (
                        (() => {
                          const memberCount = getMemberCount(group.id, group.membros);
                          const isCountingMembers = isMemberCountLoading(group.id);

                          return (
                        <label
                          key={group.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedGroups.includes(group.id)}
                            onCheckedChange={() => toggleGroup(group.id)}
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {group.foto ? (
                              <img src={group.foto} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Users className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{group.nome}</p>
                               <div className="flex items-center gap-1 mt-0.5">
                                 {group.typeLabel && (
                                   <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-primary/5">
                                     {group.typeLabel}
                                   </Badge>
                                 )}
                                 <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                   {isCountingMembers ? (
                                     <>
                                       <Loader2 className="w-3 h-3 animate-spin" />
                                       verificando membros...
                                     </>
                                   ) : memberCount > 0 ? (
                                     <>{memberCount} membros</>
                                   ) : (
                                     <>membros indisponíveis</>
                                   )}
                                 </p>
                               </div>
                            </div>
                          </div>
                        </label>
                          );
                        })()
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : formData.schedule_type === 'scheduled' ? <Clock className="w-4 h-4 mr-1" /> : null}
            {formData.schedule_type === 'scheduled' ? 'Agendar Campanha' : 'Criar Campanha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
