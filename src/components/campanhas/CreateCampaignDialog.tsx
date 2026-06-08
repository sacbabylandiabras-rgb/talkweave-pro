import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useContacts } from "@/hooks/useContacts";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { ROTATE_ALL } from "@/components/envio/InstanceSelector";
import { setZapiInstanceOverride, setZapiRotateMode } from "@/hooks/useZapi";
import { Users, Loader2, Search, MessageSquare, Clock, Calendar, FileDown, Plus } from "lucide-react";
import { ImportContactsDialog } from "./ImportContactsDialog";


interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const { toast } = useToast();
  const { createCampaign, sendCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();
  const { contacts, loading: loadingContacts } = useContacts({ enabled: open });
  const { instances: allInstances } = useZapiInstances();

  const instances = useMemo(() => allInstances.filter(i => {
    const provider = (i.api_provider || 'zapi').toLowerCase();
    const name = (i.instance_name || '').toLowerCase();
    if (name.includes('aquecimento') || name.includes('warmup')) return false;
    // O usuário solicitou que UAZAPI também apareça nas campanhas
    return provider === 'zapi' || provider === 'uazapi';
  }), [allInstances]);


  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    delay_seconds: 2,
    schedule_type: "immediate" as "immediate" | "scheduled",
    scheduled_at: "",
  });
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [manualContacts, setManualContacts] = useState<Array<{ phone: string; name?: string }>>([]);


  const selectedTemplate = templates.find(t => t.id === formData.template_id);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const all = [...manualContacts, ...contacts];
    
    // Remover duplicados (preferir manualContacts)
    const unique = all.filter((c, index, self) => 
      self.findIndex(t => t.phone === c.phone) === index
    );

    return unique.filter(c =>
      (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)
    );
  }, [contacts, manualContacts, searchQuery]);


  const togglePhone = (phone: string) => {
    setSelectedPhones(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]);
  };

  const selectAll = () => {
    if (selectedPhones.length === filteredContacts.length) {
      setSelectedPhones([]);
    } else {
      setSelectedPhones(filteredContacts.map(c => c.phone));
    }
  };

  const handleImportedContacts = (newContacts: Array<{ phone: string; name?: string }>) => {
    setManualContacts(prev => {
      const all = [...newContacts, ...prev];
      return all.filter((c, index, self) => 
        self.findIndex(t => t.phone === c.phone) === index
      );
    });
    
    // Selecionar automaticamente os novos contatos
    setSelectedPhones(prev => {
      const newPhones = newContacts.map(c => c.phone);
      return Array.from(new Set([...prev, ...newPhones]));
    });

    toast({
      title: "Contatos adicionados",
      description: `${newContacts.length} contatos foram adicionados à lista.`,
    });
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
    if (selectedPhones.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um contato", variant: "destructive" });
      return;
    }
    if (formData.schedule_type === 'scheduled' && !formData.scheduled_at) {
      toast({ title: "Erro", description: "Selecione data e hora do agendamento", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const contactList = selectedPhones.map(phone => {
        const c = [...manualContacts, ...contacts].find(x => x.phone === phone);
        return { phone, name: c?.name || "" };
      });

      const campaign = await createCampaign({
        name: formData.name,
        description: formData.description || `Campanha para ${selectedPhones.length} contato(s)`,
        template_id: formData.template_id,
        target_audience: { type: "contacts", contacts: contactList },
        delay_seconds: formData.delay_seconds,
        schedule_type: formData.schedule_type,
        scheduled_at: formData.schedule_type === 'scheduled' ? formData.scheduled_at : undefined,
      });

      if (formData.schedule_type === 'immediate') {
        let instanceToUse: string | null = null;
        if (selectedInstanceId === ROTATE_ALL) {
          setZapiRotateMode(instances);
        } else if (selectedInstanceId) {
          const inst = instances.find(i => i.id === selectedInstanceId);
          if (inst) {
            setZapiInstanceOverride(inst);
            instanceToUse = selectedInstanceId;
          }
        }
        await sendCampaign(campaign.id, contactList, instanceToUse);
      }

      toast({
        title: "Campanha criada",
        description: formData.schedule_type === 'scheduled'
          ? `Campanha "${formData.name}" agendada para ${new Date(formData.scheduled_at).toLocaleString('pt-BR')}`
          : `Campanha "${formData.name}" iniciada para ${selectedPhones.length} contato(s)`,
      });
      onOpenChange(false);
      setFormData({ name: "", description: "", template_id: "", delay_seconds: 2, schedule_type: "immediate", scheduled_at: "" });
      setSelectedPhones([]);
      setManualContacts([]);

    } catch (error) {
      console.error("Error creating contact campaign:", error);
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
            Nova Campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da Campanha</Label>
            <Input
              placeholder="Ex: Promoção"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

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

            <div>
              <Label>Instância de Envio</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância (ou rodízio)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROTATE_ALL}>Rodízio (Todas as instâncias)</SelectItem>
                  {instances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTemplate && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Prévia:</p>
              <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
            </div>
          )}

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
                <RadioGroupItem value="immediate" id="cc-now" />
                <Label htmlFor="cc-now" className="cursor-pointer text-sm">Enviar agora</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="cc-later" />
                <Label htmlFor="cc-later" className="cursor-pointer text-sm">Agendar horário</Label>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Selecionar Contatos ({selectedPhones.length})</Label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowImportDialog(true)}
                  className="text-xs h-7 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Importar Planilha/Manual
                </Button>
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                  {selectedPhones.length === filteredContacts.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contato..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>


            {loadingContacts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando contatos...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Nenhum contato encontrado</div>
            ) : (
              <ScrollArea className="h-[280px] border border-border/50 rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredContacts.map(c => (
                    <label
                      key={c.phone}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedPhones.includes(c.phone)}
                        onCheckedChange={() => togglePhone(c.phone)}
                      />
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Campanha
            </Button>
          </div>
        </div>
        
        <ImportContactsDialog 
          open={showImportDialog} 
          onOpenChange={setShowImportDialog}
          onImport={handleImportedContacts}
        />
      </DialogContent>

    </Dialog>
  );
}
