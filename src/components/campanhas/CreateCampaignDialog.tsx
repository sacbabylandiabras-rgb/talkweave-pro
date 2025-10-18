import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useContacts } from "@/hooks/useContacts";
import { Calendar, Clock, Users } from "lucide-react";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const { toast } = useToast();
  const { createCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();
  const { contacts } = useContacts();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    schedule_type: "immediate",
    scheduled_at: "",
    recurrence_pattern: "",
    contact_selection: "all",
    specific_contacts: "",
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.template_id) {
      toast({
        title: "Erro",
        description: "Nome da campanha e modelo são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (formData.schedule_type === "scheduled" && !formData.scheduled_at) {
      toast({
        title: "Erro",
        description: "Selecione uma data e hora para agendamento",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare contacts based on selection
      let targetContacts = [];
      if (formData.contact_selection === "all") {
        targetContacts = contacts.map(c => ({ phone: c.phone, name: c.name }));
      } else {
        targetContacts = formData.specific_contacts
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .map(phone => ({ phone, name: "Cliente" }));
      }

      await createCampaign({
        name: formData.name,
        description: formData.description,
        template_id: formData.template_id,
        schedule_type: formData.schedule_type,
        scheduled_at: formData.scheduled_at || null,
        recurrence_pattern: formData.recurrence_pattern || null,
        target_audience: { contacts: targetContacts },
      status: formData.schedule_type === "immediate" ? "active" : "draft",
    } as any);

      toast({
        title: "Sucesso",
        description: "Campanha criada com sucesso!",
      });

      // Reset form
      setFormData({
        name: "",
        description: "",
        template_id: "",
        schedule_type: "immediate",
        scheduled_at: "",
        recurrence_pattern: "",
        contact_selection: "all",
        specific_contacts: "",
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar campanha. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Nova Campanha</DialogTitle>
          <DialogDescription>
            Configure sua campanha de mensagens personalizadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Informações Básicas</h3>
            
            <div>
              <Label htmlFor="name">Nome da Campanha *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Promoção Black Friday"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o objetivo da campanha"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="template">Modelo de Mensagem *</Label>
              <Select
                value={formData.template_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, template_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} - {template.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Agendamento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Agendamento</h3>
            </div>
            
            <div>
              <Label htmlFor="schedule_type">Tipo de Envio</Label>
              <Select
                value={formData.schedule_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, schedule_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Enviar Agora</SelectItem>
                  <SelectItem value="scheduled">Agendar</SelectItem>
                  <SelectItem value="recurring">Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.schedule_type === "scheduled" && (
              <div>
                <Label htmlFor="scheduled_at">Data e Hora</Label>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {formData.schedule_type === "recurring" && (
              <div>
                <Label htmlFor="recurrence_pattern">Padrão de Recorrência</Label>
                <Select
                  value={formData.recurrence_pattern}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, recurrence_pattern: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Público-Alvo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Público-Alvo</h3>
            </div>
            
            <div>
              <Label htmlFor="contact_selection">Selecionar Contatos</Label>
              <Select
                value={formData.contact_selection}
                onValueChange={(value) => setFormData(prev => ({ ...prev, contact_selection: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Contatos ({contacts.length})</SelectItem>
                  <SelectItem value="specific">Números Específicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.contact_selection === "specific" && (
              <div>
                <Label htmlFor="specific_contacts">Lista de Números</Label>
                <Textarea
                  id="specific_contacts"
                  value={formData.specific_contacts}
                  onChange={(e) => setFormData(prev => ({ ...prev, specific_contacts: e.target.value }))}
                  placeholder="Digite os números (um por linha)&#10;5511999999999&#10;5511888888888"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite um número por linha no formato: 5511999999999
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Criar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
