import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { supabase } from "@/integrations/supabase/client";
import { Users, Loader2, Search, MessageSquare, Link2 } from "lucide-react";

interface CreateGroupCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupCampaignDialog({ open, onOpenChange }: CreateGroupCampaignDialogProps) {
  const { toast } = useToast();
  const { createCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();
  const { groups, loading: loadingGroups } = useWhatsAppGroups();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    delay_seconds: 2,
  });

  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedTemplate = templates.find(t => t.id === formData.template_id);

  const filteredGroups = groups.filter(g =>
    g.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    if (selectedGroups.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um grupo", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const groupContacts = selectedGroups.map(groupId => {
        const group = groups.find(g => g.id === groupId);
        return {
          phone: groupId.includes("@g.us") ? groupId : `${groupId}@g.us`,
          name: group?.nome || "Grupo",
        };
      });

      await createCampaign({
        name: formData.name,
        description: formData.description || `Campanha em ${selectedGroups.length} grupo(s)`,
        template_id: formData.template_id,
        target_audience: {
          type: "groups",
          contacts: groupContacts,
          groupIds: selectedGroups,
        },
        delay_seconds: formData.delay_seconds,
      });

      toast({ title: "Campanha criada", description: `Campanha "${formData.name}" criada com ${selectedGroups.length} grupo(s)` });
      onOpenChange(false);
      setFormData({ name: "", description: "", template_id: "", delay_seconds: 2 });
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

          {/* Preview do template */}
          {selectedTemplate && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Prévia:</p>
              <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
            </div>
          )}

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

            {loadingGroups ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando grupos...</span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhum grupo encontrado
              </div>
            ) : (
              <ScrollArea className="h-[240px] border border-border/50 rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredGroups.map(group => (
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
                          <p className="text-[10px] text-muted-foreground">{group.membros} membros</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Criar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
