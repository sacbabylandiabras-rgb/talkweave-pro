import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useWhatsAppGroups } from "@/hooks/useWhatsAppGroups";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { setZapiInstanceOverride, setZapiRotateMode, getSelectedCampaignInstanceId } from "@/hooks/useZapi";
import { ROTATE_ALL } from "@/components/envio/InstanceSelector";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Loader2,
  Search,
  MessageSquare,
  Link2,
  Clock,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Check,
  Megaphone,
  Info,
  CheckCircle2,
  Smartphone,
  RefreshCw,
} from "lucide-react";

type RotativeLink = {
  id: string;
  name: string;
  slug: string;
  groups: Array<{ group_id: string; group_name: string; instance_id?: string | null }>;
};

const STEPS = [
  { id: 1, title: "Informações", icon: Info, description: "Nome e descrição da campanha" },
  { id: 2, title: "Modelo", icon: MessageSquare, description: "Escolha a mensagem" },
  { id: 3, title: "Grupos", icon: Users, description: "Selecione os destinos" },
  { id: 4, title: "Configurações", icon: Calendar, description: "Instância e agendamento" },
  { id: 5, title: "Revisão", icon: CheckCircle2, description: "Confira e crie" },
];

export default function CampanhaGrupoFluxo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createCampaign, sendCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();
  const { groups, loading: loadingGroups } = useWhatsAppGroups({ provider: 'zapi' });
  const { instances: allInstances } = useZapiInstances({ provider: 'all' });

  const instances = useMemo(() => allInstances.filter(i => {
    const provider = (i.api_provider || 'zapi').toLowerCase();
    const name = (i.instance_name || '').toLowerCase();
    if (name.includes('aquecimento') || name.includes('warmup')) return false;
    return provider === 'zapi' || provider === 'uazapi';
  }), [allInstances]);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [rotativeLinks, setRotativeLinks] = useState<RotativeLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    delay_seconds: 2,
    schedule_type: "immediate" as "immediate" | "scheduled",
    scheduled_at: "",
    instance_selection_mode: "default" as "default" | "single" | "rotate",
    selected_instance_id: "",
    selected_instance_ids: [] as string[],

  });
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchLinks = async () => {
      setLoadingLinks(true);
      try {
        const { data: links } = await supabase.from("redirect_links").select("id, name, slug");
        if (!links) return;
        const { data: linkGroups } = await supabase
          .from("redirect_link_groups")
          .select("redirect_link_id, group_id, group_name, instance_id");
        const mapped: RotativeLink[] = links
          .map((l) => ({
            id: l.id,
            name: l.name,
            slug: l.slug,
            groups: (linkGroups || [])
              .filter((g) => g.redirect_link_id === l.id)
              .map((g) => ({
                group_id: g.group_id,
                group_name: g.group_name,
                instance_id: g.instance_id,
              })),
          }))
          .filter((l) => l.groups.length > 0);
        setRotativeLinks(mapped);
      } catch (e) {
        console.error("Error fetching rotative links:", e);
      } finally {
        setLoadingLinks(false);
      }
    };
    fetchLinks();
  }, []);

  const selectedTemplate = templates.find((t) => t.id === formData.template_id);

  const filteredGroups = useMemo(
    () => groups.filter((g) => g.nome.toLowerCase().includes(searchQuery.toLowerCase())),
    [groups, searchQuery],
  );

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const selectAll = () => {
    if (selectedGroups.length === filteredGroups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(filteredGroups.map((g) => g.id));
    }
  };

  const normalizeGroupTargetPhone = (groupId: string) => {
    const trimmed = groupId.trim();
    if (!trimmed) return trimmed;
    
    // Se já contém @g.us ou @c.us, mantém como está
    if (trimmed.includes('@g.us') || trimmed.includes('@c.us')) return trimmed;
    
    // Se termina com -group (formato interno), converte para o formato que o Z-API espera no envio direto
    if (trimmed.endsWith('-group')) {
      const numericId = trimmed.replace(/-group$/i, '');
      return `${numericId}-group`;
    }

    // Se for apenas o ID numérico, adiciona -group
    if (/^\d+$/.test(trimmed)) {
      return `${trimmed}-group`;
    }

    return trimmed;
  };

  const canAdvance = () => {
    if (step === 1) return formData.name.trim().length > 0;
    if (step === 2) return Boolean(formData.template_id);
    if (step === 3) return selectedGroups.length > 0;
    if (step === 4) {
      if (formData.schedule_type === "scheduled") return Boolean(formData.scheduled_at);
      return true;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!canAdvance()) return;
    setSubmitting(true);
    try {
      const groupContacts = selectedGroups.map((groupId) => {
        const group = groups.find((g) => g.id === groupId);
        const linkGroup = rotativeLinks.flatMap((l) => l.groups).find((g) => g.group_id === groupId);
        return {
          phone: normalizeGroupTargetPhone(groupId),
          name: group?.nome || linkGroup?.group_name || "Grupo",
          sourceInstanceId: group?.sourceInstanceId || linkGroup?.instance_id || null,
          sourceInstanceName: group?.sourceInstanceName || null,
        };
      });

      const campaign = await createCampaign({
        name: formData.name,
        description: formData.description || `Campanha em ${selectedGroups.length} grupo(s)`,
        template_id: formData.template_id,
        target_audience: {
          type: "groups",
          contacts: groupContacts,
          groupIds: selectedGroups,
        },
        delay_seconds: formData.delay_seconds,
        schedule_type: formData.schedule_type,
        scheduled_at: formData.schedule_type === "scheduled" ? formData.scheduled_at : undefined,
      });

      if (formData.schedule_type === 'immediate') {
        console.log(`🚀 Executing immediate campaign send for ${campaign.id}`);
        
        let instanceToUse = null;
        if (formData.instance_selection_mode === 'rotate') {
          // If we have specific instances selected for rotation, use them
          const rotatePool = (formData.selected_instance_ids && formData.selected_instance_ids.length > 0)
            ? instances.filter(i => formData.selected_instance_ids.includes(i.id))
            : instances;
          setZapiRotateMode(rotatePool);
        } else if (formData.instance_selection_mode === 'single' && formData.selected_instance_id) {
          const inst = instances.find(i => i.id === formData.selected_instance_id);
          if (inst) {
            setZapiInstanceOverride(inst);
            instanceToUse = formData.selected_instance_id;
          }
        }

        
        await sendCampaign(campaign.id, groupContacts, instanceToUse);
      }

      toast({
        title: "Campanha criada",
        description:
          formData.schedule_type === "scheduled"
            ? `Agendada para ${new Date(formData.scheduled_at).toLocaleString("pt-BR")}`
            : `Criada com ${selectedGroups.length} grupo(s)`,
      });
      navigate("/campanhas-grupo");
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Erro ao criar campanha", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate("/campanhas-grupo")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Nova Campanha em Grupo
          </h1>
          <p className="text-sm text-muted-foreground">
            Siga os passos abaixo para criar sua campanha em grupos
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <Progress value={progress} className="h-2 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isDone = s.id < step;
              return (
                <button
                  key={s.id}
                  onClick={() => s.id < step && setStep(s.id)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : isDone
                        ? "border-border/60 bg-muted/30 hover:bg-muted/50 cursor-pointer"
                        : "border-border/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        isDone
                          ? "bg-primary text-primary-foreground"
                          : isActive
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : s.id}
                    </div>
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground hidden md:block">
                    {s.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].title}</CardTitle>
          <CardDescription>{STEPS[step - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <Label>Nome da Campanha *</Label>
                <Input
                  placeholder="Ex: Promoção de Sexta nos grupos"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o objetivo da campanha (opcional)"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div>
                <Label>Intervalo entre envios (segundos)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={formData.delay_seconds}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, delay_seconds: parseInt(e.target.value) || 2 }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recomendamos entre 2 e 10 segundos para evitar bloqueios.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>Modelo de Mensagem *</Label>
                <Select
                  value={formData.template_id}
                  onValueChange={(val) => setFormData((p) => ({ ...p, template_id: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter((t) => t.active)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplate ? (
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Prévia</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecione um modelo para visualizar a prévia.
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center justify-between">
                <Label>
                  Grupos selecionados:{" "}
                  <Badge variant="secondary">{selectedGroups.length}</Badge>
                </Label>
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedGroups.length === filteredGroups.length
                    ? "Desmarcar todos"
                    : "Selecionar todos"}
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar grupo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {loadingGroups || loadingLinks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando grupos...</span>
                </div>
              ) : filteredGroups.length === 0 && rotativeLinks.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhum grupo encontrado
                </div>
              ) : (
                <ScrollArea className="h-[420px] border border-border/50 rounded-lg">
                  <div className="p-2 space-y-1">
                    {rotativeLinks.map((link) => {
                      const linkFiltered = link.groups.filter(
                        (g) =>
                          g.group_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          link.name.toLowerCase().includes(searchQuery.toLowerCase()),
                      );
                      if (linkFiltered.length === 0) return null;
                      return (
                        <div key={link.id} className="mb-2">
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-md mb-1">
                            <Link2 className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">{link.name}</span>
                            <span className="text-[10px] text-muted-foreground">/{link.slug}</span>
                          </div>
                          {linkFiltered.map((g) => (
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
                              <p className="text-sm font-medium truncate flex-1">{g.group_name}</p>
                            </label>
                          ))}
                        </div>
                      );
                    })}

                    {filteredGroups.length > 0 && (
                      <div className="mb-2">
                        {rotativeLinks.length > 0 && (
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-md mb-1">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground">
                              Grupos WhatsApp
                            </span>
                          </div>
                        )}
                        {filteredGroups.map((group) => (
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
                                <img
                                  src={group.foto}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{group.nome}</p>
                                {group.typeLabel && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-primary/5">
                                    {group.typeLabel}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  Instância de Envio
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={formData.instance_selection_mode === 'rotate' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData(p => ({ ...p, instance_selection_mode: 'rotate', selected_instance_id: ROTATE_ALL }))}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Rodízio (Todas)
                  </Button>
                  {instances.map(inst => (
                    <Button
                      key={inst.id}
                      type="button"
                      variant={formData.instance_selection_mode === 'single' && formData.selected_instance_id === inst.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData(p => ({ ...p, instance_selection_mode: 'single', selected_instance_id: inst.id }))}
                    >
                      {inst.instance_name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Quando enviar?
                </Label>
                <RadioGroup
                  value={formData.schedule_type}
                  onValueChange={(val: "immediate" | "scheduled") =>
                    setFormData((p) => ({ ...p, schedule_type: val }))
                  }
                  className="grid md:grid-cols-2 gap-3"
                >
                  <label
                    htmlFor="now"
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.schedule_type === "immediate"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <RadioGroupItem value="immediate" id="now" />
                    <div>
                      <p className="text-sm font-medium">Enviar agora</p>
                      <p className="text-xs text-muted-foreground">
                        A campanha é enviada assim que for criada.
                      </p>
                    </div>
                  </label>
                  <label
                    htmlFor="later"
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.schedule_type === "scheduled"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <RadioGroupItem value="scheduled" id="later" />
                    <div>
                      <p className="text-sm font-medium">Agendar horário</p>
                      <p className="text-xs text-muted-foreground">
                        Defina data e hora para envio automático.
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {formData.schedule_type === "scheduled" && (
                  <div className="pt-2">
                    <Label className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Data e hora *
                    </Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduled_at}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, scheduled_at: e.target.value }))
                      }
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Nome</p>
                  <p className="text-sm font-medium">{formData.name || "—"}</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Modelo</p>
                  <p className="text-sm font-medium">{selectedTemplate?.name || "—"}</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Grupos</p>
                  <p className="text-sm font-medium">{selectedGroups.length} selecionado(s)</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">Intervalo</p>
                  <p className="text-sm font-medium">{formData.delay_seconds}s entre envios</p>
                </div>
                <div className="p-4 rounded-lg border bg-muted/20 md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Envio</p>
                  <p className="text-sm font-medium">
                    {formData.schedule_type === "immediate"
                      ? "Imediato"
                      : `Agendado: ${
                          formData.scheduled_at
                            ? new Date(formData.scheduled_at).toLocaleString("pt-BR")
                            : "—"
                        }`}
                  </p>
                </div>
              </div>
              {selectedTemplate && (
                <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Prévia da mensagem
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || submitting}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        {step < STEPS.length ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
            Próximo <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || !canAdvance()}>
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : formData.schedule_type === "scheduled" ? (
              <Clock className="w-4 h-4 mr-1" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            {formData.schedule_type === "scheduled" ? "Agendar Campanha" : "Criar Campanha"}
          </Button>
        )}
      </div>
    </div>
  );
}