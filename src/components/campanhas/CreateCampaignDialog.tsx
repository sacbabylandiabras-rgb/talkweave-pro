import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useContacts } from "@/hooks/useContacts";
import { Calendar, Clock, Users, Upload, UserPlus, Eye, Video, Workflow, Tag, Filter } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CarouselPreview } from "./CarouselPreview";
import { supabase } from "@/integrations/supabase/client";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const { toast } = useToast();
  const { createCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();
  const { contacts } = useContacts({ enabled: open });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content_type: "template" as "template" | "flow",
    template_id: "",
    flow_id: "",
    schedule_type: "immediate",
    scheduled_at: "",
    recurrence_pattern: "",
    contact_selection: "all",
    specific_contacts: "",
    delay_seconds: 2,
    tag_id: "",
  });

  const [flows, setFlows] = useState<Array<{ id: string; name: string; keyword: string }>>([]);
  const [importedContacts, setImportedContacts] = useState<Array<{ phone: string; name: string }>>([]);
  const [viewOnce, setViewOnce] = useState(false);
  const [isPtv, setIsPtv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [availableTags, setAvailableTags] = useState<{ id: string, name: string, color: number }[]>([]);
  const [tagColors, setTagColors] = useState<{ id: number; hex: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;

    const loadTagsData = async () => {
      try {
        const { data: tagsRes } = await supabase.functions.invoke("zapi-chat-actions", {
          body: { action: "list-tags" },
        });
        setAvailableTags(Array.isArray(tagsRes?.data) ? tagsRes.data : []);

        const { data: colorsRes } = await supabase.functions.invoke("zapi-chat-actions", {
          body: { action: "tag-colors" },
        });
        setTagColors(Array.isArray(colorsRes?.data) ? colorsRes.data : []);
      } catch (e) {
        console.error('Error loading tags data:', e);
      }
    };
    loadTagsData();

    supabase
      .from('flow_automations')
      .select('id, name, keyword')
      .eq('active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setFlows(data);
      });
  }, [open]);

  const handleSubmit = async () => {
    const isFlow = formData.content_type === "flow";
    if (!formData.name || (!isFlow && !formData.template_id) || (isFlow && !formData.flow_id)) {
      toast({
        title: "Erro",
        description: isFlow ? "Nome da campanha e fluxo são obrigatórios" : "Nome da campanha e modelo são obrigatórios",
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
        targetContacts = contacts.map(c => ({ phone: c.phone, name: c.name || "Cliente" }));
      } else if (formData.contact_selection === "manual") {
        targetContacts = formData.specific_contacts
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .map(raw => {
            // Preserva identificadores @lid (canal WhatsApp Business). Para números normais, mantém apenas dígitos.
            const phone = /@lid$/i.test(raw) ? raw.toLowerCase() : raw.replace(/\D/g, '');
            return { phone, name: "Cliente" };
          })
          .filter(c => c.phone);
      } else if (formData.contact_selection === "import") {
        targetContacts = importedContacts;
      }

      if (targetContacts.length === 0) {
        toast({
          title: "Erro",
          description: "Adicione pelo menos um contato à campanha",
          variant: "destructive",
        });
        return;
      }

      await createCampaign({
        name: formData.name,
        description: formData.description,
        template_id: isFlow ? undefined : formData.template_id,
        schedule_type: formData.schedule_type,
        scheduled_at: formData.scheduled_at || null,
        recurrence_pattern: formData.recurrence_pattern || null,
        target_audience: {
          contacts: targetContacts,
          ...(isFlow ? { flow_id: formData.flow_id, campaign_type: 'flow' } : {}),
          ...(formData.tag_id && formData.tag_id !== "none" ? { tag_id: formData.tag_id } : {}),
          ...(viewOnce ? { viewOnce: true } : {}),
          ...(isPtv ? { isPtv: true } : {}),
        },
        status: formData.schedule_type === "immediate" ? "active" : "draft",
        delay_seconds: formData.delay_seconds,
      } as any);

      toast({
        title: "Sucesso",
        description: "Campanha criada com sucesso!",
      });

      // Reset form
      setFormData({
        name: "",
        description: "",
        content_type: "template",
        template_id: "",
        flow_id: "",
        schedule_type: "immediate",
        scheduled_at: "",
        recurrence_pattern: "",
        contact_selection: "all",
        specific_contacts: "",
        delay_seconds: 2,
        tag_id: "",
      });
      setImportedContacts([]);
      setViewOnce(false);
      setIsPtv(false);
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv' || fileExtension === 'txt') {
      // Parse CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedContacts = results.data.map((row: any) => {
            const raw = String(row.telefone || row.phone || row.numero || row.Telefone || row.Phone || row.Numero || "").trim();
            const phone = /@lid$/i.test(raw) ? raw.toLowerCase() : raw.replace(/\D/g, '');
            return {
              phone,
              name: row.nome || row.name || row.Name || row.Nome || "Cliente",
            };
          }).filter(c => c.phone);

          setImportedContacts(parsedContacts);
          toast({
            title: "Sucesso",
            description: `${parsedContacts.length} contatos importados`,
          });
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          toast({
            title: "Erro",
            description: "Erro ao ler o arquivo CSV",
            variant: "destructive",
          });
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse XLSX/XLS
      file.arrayBuffer().then((buf) => {
        try {
          const wb = XLSX.read(buf, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

          let parsedContacts: { phone: string; name: string }[] = [];

          if (rows.length && typeof rows[0] === "object" && !Array.isArray(rows[0])) {
            // Has header row
            parsedContacts = rows.map((row: any) => {
              const raw = String(
                row.telefone || row.phone || row.numero ||
                row.Telefone || row.Phone || row.Numero ||
                row.TELEFONE || row.PHONE || row.NUMERO ||
                row.celular || row.Celular || row.whatsapp || row.WhatsApp || ""
              ).trim();
              const phone = /@lid$/i.test(raw) ? raw.toLowerCase() : raw.replace(/\D/g, '');
              return {
                phone,
                name: String(row.nome || row.name || row.Name || row.Nome || "Cliente"),
              };
            }).filter((c) => c.phone);
          }

          // Fallback: no headers — read first column as phone
          if (!parsedContacts.length) {
            const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
            parsedContacts = matrix
              .map((row) => {
                const raw = String(row?.[0] ?? "").trim();
                const phone = /@lid$/i.test(raw) ? raw.toLowerCase() : raw.replace(/\D/g, '');
                const name = String(row?.[1] ?? "Cliente");
                return { phone, name };
              })
              .filter((c) => c.phone && c.phone.length >= 8);
          }

          setImportedContacts(parsedContacts);
          toast({
            title: "Sucesso",
            description: `${parsedContacts.length} contatos importados`,
          });
        } catch (err) {
          console.error("Error parsing XLSX:", err);
          toast({
            title: "Erro",
            description: "Não foi possível ler a planilha",
            variant: "destructive",
          });
        }
      });
    } else {
      toast({
        title: "Formato inválido",
        description: "Envie um arquivo CSV, XLSX, XLS ou TXT",
        variant: "destructive",
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
              <Label>Tipo de Conteúdo *</Label>
              <Select
                value={formData.content_type}
                onValueChange={(value: "template" | "flow") => setFormData(prev => ({ ...prev, content_type: value, template_id: "", flow_id: "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">📝 Modelo de Mensagem</SelectItem>
                  <SelectItem value="flow">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4" />
                      Fluxo Visual
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.content_type === "template" && (
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
            )}

            {formData.content_type === "flow" && (
              <div>
                <Label htmlFor="flow">Fluxo Visual *</Label>
                <Select
                  value={formData.flow_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, flow_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um fluxo" />
                  </SelectTrigger>
                  <SelectContent>
                    {flows.map((flow) => (
                      <SelectItem key={flow.id} value={flow.id}>
                        <div className="flex items-center gap-2">
                          <Workflow className="w-3 h-3" />
                          {flow.name} {flow.keyword ? `(${flow.keyword})` : ''}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  O fluxo será executado para cada contato da campanha
                </p>
              </div>
            )}
          </div>

          {/* Preview do Carrossel */}
          {formData.template_id && (() => {
            const selectedTemplate = templates.find(t => t.id === formData.template_id);
            if (selectedTemplate?.type === 'carrossel' && selectedTemplate.carouselCards) {
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Preview do Carrossel</h3>
                  </div>
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <CarouselPreview
                      cards={selectedTemplate.carouselCards}
                      header={selectedTemplate.header}
                      footer={selectedTemplate.footer}
                      content={selectedTemplate.content}
                    />
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Opções de Vídeo */}
          {formData.template_id && (() => {
            const selectedTemplate = templates.find(t => t.id === formData.template_id);
            const isVideoTemplate = selectedTemplate?.type === 'video' || selectedTemplate?.type === 'video_botoes';
            if (!isVideoTemplate) return null;
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Opções de Vídeo</h3>
                </div>
                <div className="flex items-center justify-between p-2 bg-accent/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👁</span>
                    <div>
                      <Label className="text-sm font-medium">Visualização Única</Label>
                      <p className="text-[10px] text-muted-foreground">Vídeo que só pode ser visto uma vez</p>
                    </div>
                  </div>
                  <Switch checked={viewOnce} onCheckedChange={(v) => { setViewOnce(v); if (v) setIsPtv(false); }} />
                </div>
                <div className="flex items-center justify-between p-2 bg-accent/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" />
                    <div>
                      <Label className="text-sm font-medium">Vídeo Instantâneo (PTV)</Label>
                      <p className="text-[10px] text-muted-foreground">Vídeo circular instantâneo</p>
                    </div>
                  </div>
                  <Switch checked={isPtv} onCheckedChange={(v) => { setIsPtv(v); if (v) setViewOnce(false); }} />
                </div>
              </div>
            );
          })()}

          {/* Etiquetas da Campanha */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Configurações Extra</h3>
            </div>
            
            <div>
              <Label htmlFor="tag_id">Adicionar etiqueta na campanha</Label>
              <Select
                value={formData.tag_id}
                onValueChange={(val) => setFormData(prev => ({ ...prev, tag_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma etiqueta selecionada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem etiqueta</SelectItem>
                  {availableTags.map((tag) => {
                    const colorHex = tagColors.find(c => c.id === tag.color)?.hex || '#94a3b8';
                    return (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorHex }} />
                          {tag.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Esta etiqueta será aplicada aos contatos que receberem a campanha (WhatsApp Business).
              </p>
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
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, contact_selection: value }));
                  if (value !== "import") {
                    setImportedContacts([]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Todos os Contatos ({contacts.length})
                    </div>
                  </SelectItem>
                  <SelectItem value="manual">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Adicionar Manualmente
                    </div>
                  </SelectItem>
                  <SelectItem value="import">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Importar Planilha (CSV/XLSX)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.contact_selection === "manual" && (
              <div>
                <Label htmlFor="specific_contacts">Lista de Números</Label>
                <Textarea
                  id="specific_contacts"
                  value={formData.specific_contacts}
                  onChange={(e) => setFormData(prev => ({ ...prev, specific_contacts: e.target.value }))}
                  placeholder="Digite os números (um por linha)&#10;5511999999999&#10;123456789@lid"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Um número por linha. Aceita formato normal (5511999999999) ou identificador @lid (123456789@lid).
                </p>
              </div>
            )}

            {formData.contact_selection === "import" && (
              <div className="space-y-3">
                <div>
                  <Label>Importar Planilha</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileUpload}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Escolher
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aceita CSV, XLSX, XLS ou TXT. Colunas: telefone, nome (opcional)
                  </p>
                </div>

                {importedContacts.length > 0 && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {importedContacts.length} contatos importados
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setImportedContacts([])}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {importedContacts.slice(0, 5).map((contact, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-mono">{contact.phone}</span>
                          <span>-</span>
                          <span>{contact.name}</span>
                        </div>
                      ))}
                      {importedContacts.length > 5 && (
                        <p className="text-xs text-muted-foreground italic">
                          e mais {importedContacts.length - 5} contatos...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-200 font-medium mb-1">
                    💡 Formato do arquivo CSV:
                  </p>
                  <pre className="text-xs text-blue-700 dark:text-blue-300 font-mono">
{`telefone,nome
5511999999999,João Silva
5511888888888,Maria Santos`}
                  </pre>
                </div>
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
