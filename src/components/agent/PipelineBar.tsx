import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, Check, LayoutGrid, ChevronDown, MoreHorizontal, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Stage = { id: string; label: string; color: string };
type Pipeline = { id: string; name: string; department?: string; currency?: string; stages: Stage[] };

export const DEFAULT_PIPELINE_STAGES: Stage[] = [
  { id: "all", label: "TODOS", color: "bg-gray-500" },
  { id: "triage", label: "AGUARDANDO", color: "bg-slate-500" },
  { id: "in_service", label: "EM ATENDIMENTO", color: "bg-blue-500" },
  { id: "pending", label: "PENDENTE", color: "bg-yellow-500" },
  { id: "completed", label: "CONCLUÍDO", color: "bg-green-500" },
  { id: "canceled", label: "CANCELADO", color: "bg-red-500" },
  { id: "scheduled", label: "AGENDADO", color: "bg-purple-500" },
  { id: "lost", label: "PERDIDO", color: "bg-slate-800" },
];

export let PIPELINE_STAGES: Stage[] = [...DEFAULT_PIPELINE_STAGES];

const LS_ACTIVE_KEY = "pipeline_active_id";

const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Real Brasileiro (R$)" },
  { value: "USD", label: "Dólar Americano (US$)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "Libra Esterlina (£)" },
  { value: "ARS", label: "Peso Argentino ($)" },
];

const DEPARTMENT_OPTIONS = [
  "Vendas",
  "Pré-Vendas",
  "Pós-Vendas",
  "Suporte",
  "Marketing",
  "Financeiro",
  "Outro",
];

interface PipelineBarProps {
  selectedStage: string;
  onStageSelect: (stageId: string) => void;
  counts: Record<string, number>;
  onStagesChange?: (stages: Stage[]) => void;
}

export const PipelineBar = ({ selectedStage, onStageSelect, counts, onStagesChange }: PipelineBarProps) => {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [newStageName, setNewStageName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDepartment, setFormDepartment] = useState("Vendas");
  const [formCurrency, setFormCurrency] = useState("BRL");
  const [formStages, setFormStages] = useState<Stage[]>([...DEFAULT_PIPELINE_STAGES]);
  const [formNewStage, setFormNewStage] = useState("");

  const openCreateDialog = () => {
    setFormName("");
    setFormDepartment("Vendas");
    setFormCurrency("BRL");
    setFormStages([...DEFAULT_PIPELINE_STAGES]);
    setFormNewStage("");
    setIsCreatingPipeline(true);
    setIsPickerOpen(false);
  };

  const addFormStage = () => {
    const label = formNewStage.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    setFormStages(prev => [...prev, { id, label: label.toUpperCase(), color: "bg-slate-400" }]);
    setFormNewStage("");
  };

  const removeFormStage = (id: string) => {
    if (id === 'all') return;
    setFormStages(prev => prev.filter(s => s.id !== id));
  };

  const activePipeline = pipelines.find(p => p.id === activeId) || null;
  const stages = activePipeline?.stages || [];

  // Notify parent whenever the active stages change
  useEffect(() => {
    PIPELINE_STAGES = stages;
    if (onStagesChange) onStagesChange(stages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, pipelines]);

  useEffect(() => {
    const fetchPipelines = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('pipeline_stages')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        const raw = data?.pipeline_stages;

        let loaded: Pipeline[] = [];
        if (Array.isArray(raw) && raw.length > 0) {
          // Detect legacy flat shape [{id,label,color}] vs new [{id,name,stages}]
          if ((raw[0] as any).stages) {
            loaded = raw as Pipeline[];
          } else {
            loaded = [{
              id: `pipeline_${Date.now()}`,
              name: "Funil de Vendas",
              stages: raw as Stage[],
            }];
          }
        }
        setPipelines(loaded);

        const savedActive = localStorage.getItem(LS_ACTIVE_KEY) || "";
        const chosen = loaded.find(p => p.id === savedActive) || loaded[0];
        if (chosen) {
          setActiveId(chosen.id);
          localStorage.setItem(LS_ACTIVE_KEY, chosen.id);
        }
      } catch (err) {
        console.warn("Could not fetch pipelines:", err);
        setPipelines([]);
      }
    };

    fetchPipelines();
  }, []);

  const savePipelines = async (next: Pipeline[]) => {
    setPipelines(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await (supabase as any)
        .from('profiles')
        .update({ pipeline_stages: next as any })
        .eq('id', user.id);
    } catch (err) {
      console.error("Error saving pipelines:", err);
      toast({ title: "Aviso", description: "Alterações aplicadas localmente." });
    }
  };

  const handleSelectPipeline = (id: string) => {
    setActiveId(id);
    localStorage.setItem(LS_ACTIVE_KEY, id);
    onStageSelect('all');
    setIsPickerOpen(false);
  };

  const handleCreatePipeline = () => {
    const name = formName.trim();
    if (!name) {
      toast({ title: "Atenção", description: "Digite um nome para o seu funil.", variant: "destructive" });
      return;
    }
    if (formStages.length === 0) {
      toast({ title: "Atenção", description: "Adicione ao menos uma etapa.", variant: "destructive" });
      return;
    }
    const newPipe: Pipeline = {
      id: `pipeline_${Date.now()}`,
      name,
      department: formDepartment,
      currency: formCurrency,
      stages: formStages,
    };
    const next = [...pipelines, newPipe];
    savePipelines(next);
    setActiveId(newPipe.id);
    localStorage.setItem(LS_ACTIVE_KEY, newPipe.id);
    setIsCreatingPipeline(false);
    onStageSelect('all');
    toast({ title: "Pipeline criado!", description: `Funil "${name}" pronto para uso.` });
  };

  const handleDeletePipeline = (id: string) => {
    const pipe = pipelines.find(p => p.id === id);
    if (!pipe) return;
    if (!window.confirm(`Apagar o funil "${pipe.name}"? Esta ação não pode ser desfeita.`)) return;
    const next = pipelines.filter(p => p.id !== id);
    savePipelines(next);
    if (activeId === id) {
      const fallback = next[0]?.id || "";
      setActiveId(fallback);
      if (fallback) localStorage.setItem(LS_ACTIVE_KEY, fallback);
      else localStorage.removeItem(LS_ACTIVE_KEY);
    }
    toast({ title: "Funil excluído" });
  };

  const updateActiveStages = (newStages: Stage[]) => {
    if (!activePipeline) return;
    const next = pipelines.map(p => p.id === activeId ? { ...p, stages: newStages } : p);
    savePipelines(next);
  };

  const handleAddStage = () => {
    if (!newStageName.trim() || !activePipeline) return;
    const newId = newStageName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const newStage: Stage = { id: newId, label: newStageName.toUpperCase(), color: "bg-slate-400" };
    updateActiveStages([...stages, newStage]);
    setNewStageName("");
    setIsAdding(false);
    toast({ title: "Sucesso", description: "Etapa criada com sucesso" });
  };

  const handleDeleteStage = (id: string) => {
    if (id === 'all') return;
    if (!window.confirm("Deseja realmente apagar esta etapa?")) return;
    updateActiveStages(stages.filter(s => s.id !== id));
    if (selectedStage === id) onStageSelect('all');
    toast({ title: "Etapa excluída" });
  };

  // Empty state: no pipelines yet
  const createDialog = (
    <Dialog open={isCreatingPipeline} onOpenChange={setIsCreatingPipeline}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Pipeline de Vendas</DialogTitle>
          <DialogDescription className="text-xs">
            Configure as informações básicas e as etapas do seu novo funil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              placeholder="Ex: Vendas Diretas"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Departamento</Label>
              <Select value={formDepartment} onValueChange={setFormDepartment}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Moeda</Label>
              <Select value={formCurrency} onValueChange={setFormCurrency}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Estágios</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-md max-h-40 overflow-y-auto bg-muted/30">
              {formStages.length === 0 && (
                <span className="text-[11px] text-muted-foreground">Nenhuma etapa. Adicione abaixo.</span>
              )}
              {formStages.map(s => (
                <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
                  <div className={cn("w-2 h-2 rounded-full", s.color)} />
                  <span className="text-[10px]">{s.label}</span>
                  {s.id !== 'all' && (
                    <button
                      onClick={() => removeFormStage(s.id)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do estágio"
                value={formNewStage}
                onChange={(e) => setFormNewStage(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFormStage();
                  }
                }}
              />
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={addFormStage}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsCreatingPipeline(false)}>Cancelar</Button>
          <Button onClick={handleCreatePipeline}>Criar Pipeline</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (pipelines.length === 0) {
    return (
      <>
        <div className="w-full bg-card border-b border-border py-2 px-4 shadow-sm flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateDialog}
            className="h-8 gap-2 rounded-full bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary animate-pulse"
          >
            <LayoutGrid className="w-4 h-4" />
            Criar meu Funil de Vendas
          </Button>
        </div>
        {createDialog}
      </>
    );
  }

  return (
    <>
    <div className="w-full bg-card border-b border-border py-2 px-4 shadow-sm flex items-center gap-3">
      {/* Pipeline selector */}
      <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2 shrink-0 max-w-[200px]">
            <LayoutGrid className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate text-xs font-semibold">{activePipeline?.name || "Selecionar Funil"}</span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Meus Funis</div>
            {pipelines.map(p => (
              <div key={p.id} className={cn("flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer group", p.id === activeId && "bg-primary/10")}>
                <button className="flex-1 text-left text-xs font-medium truncate" onClick={() => handleSelectPipeline(p.id)}>
                  {p.name}
                </button>
                <button onClick={() => handleDeletePipeline(p.id)} className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-1 transition-all">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="pt-2 border-t border-border mt-2">
              <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={openCreateDialog}>
                <Plus className="w-3 h-3" />
                Novo Funil
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-border shrink-0" />

      <ScrollArea className="flex-1 whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {stages.map((stage) => (
            <div key={stage.id} className="relative group/btn">
                <button
                  onClick={() => onStageSelect(stage.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border group-hover/btn:pr-9",
                    selectedStage === stage.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", stage.color)} />
                  {stage.label}
                  <Badge 
                    variant={selectedStage === stage.id ? "secondary" : "outline"} 
                    className={cn(
                      "ml-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px]",
                      selectedStage === stage.id ? "bg-primary-foreground/20 text-primary-foreground border-none" : "bg-muted-foreground/10"
                    )}
                  >
                    {counts[stage.id] || 0}
                  </Badge>
                </button>
                
                {stage.id !== 'all' && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteStage(stage.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/btn:opacity-100 bg-destructive/10 hover:bg-destructive hover:text-white text-destructive rounded-full transition-all p-1 z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>

      <Popover open={isAdding} onOpenChange={setIsAdding}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 rounded-full border-dashed shrink-0">
            <Plus className="w-4 h-4" />
            Nova Etapa
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="font-medium text-xs">Criar nova etapa</h4>
              <p className="text-[10px] text-muted-foreground">Defina o nome da sua nova coluna do funil.</p>
            </div>
            <div className="flex gap-2">
              <Input 
                placeholder="Ex: Pós-venda" 
                value={newStageName} 
                onChange={(e) => setNewStageName(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
              />
              <Button size="sm" className="h-8 w-8 p-0" onClick={handleAddStage}>
                <Check className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
    {createDialog}
    </>
  );
};
