import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns, Campaign } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { Calendar, Clock } from "lucide-react";

interface EditCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
}

export function EditCampaignDialog({ open, onOpenChange, campaign }: EditCampaignDialogProps) {
  const { toast } = useToast();
  const { updateCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    schedule_type: "immediate",
    scheduled_at: "",
    recurrence_pattern: "",
    delay_seconds: 2,
  });

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        description: campaign.description || "",
        template_id: campaign.template_id || "",
        schedule_type: campaign.schedule_type || "immediate",
        scheduled_at: campaign.scheduled_at || "",
        recurrence_pattern: campaign.recurrence_pattern || "",
        delay_seconds: campaign.delay_seconds || 2,
      });
    }
  }, [campaign]);

  const handleSubmit = async () => {
    if (!campaign) return;

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
      await updateCampaign(campaign.id, {
        name: formData.name,
        description: formData.description,
        template_id: formData.template_id,
        schedule_type: formData.schedule_type as any,
        scheduled_at: formData.scheduled_at || undefined,
        recurrence_pattern: formData.recurrence_pattern || undefined,
        delay_seconds: formData.delay_seconds,
      });

      toast({
        title: "Sucesso",
        description: "Campanha atualizada com sucesso!",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar campanha. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Campanha</DialogTitle>
          <DialogDescription>
            Atualize as configurações da sua campanha
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
              <h3 className="text-sm font-semibold">Agendamento e Envio</h3>
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

            <div>
              <Label htmlFor="delay_seconds">Intervalo entre Envios (segundos)</Label>
              <Input
                id="delay_seconds"
                type="number"
                min="1"
                max="60"
                value={formData.delay_seconds}
                onChange={(e) => setFormData(prev => ({ ...prev, delay_seconds: parseInt(e.target.value) || 2 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recomendado: 2-5 segundos. Valores menores podem causar bloqueios.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
