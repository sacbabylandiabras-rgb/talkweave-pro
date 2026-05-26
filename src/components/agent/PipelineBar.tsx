import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, Check, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const DEFAULT_PIPELINE_STAGES = [
  { id: "all", label: "TODOS", color: "bg-gray-500" },
  { id: "triage", label: "AGUARDANDO", color: "bg-slate-500" },
  { id: "in_service", label: "EM ATENDIMENTO", color: "bg-blue-500" },
  { id: "pending", label: "PENDENTE", color: "bg-yellow-500" },
  { id: "completed", label: "CONCLUÍDO", color: "bg-green-500" },
  { id: "canceled", label: "CANCELADO", color: "bg-red-500" },
  { id: "scheduled", label: "AGENDADO", color: "bg-purple-500" },
  { id: "lost", label: "PERDIDO", color: "bg-slate-800" },
];

export let PIPELINE_STAGES = [...DEFAULT_PIPELINE_STAGES];


interface PipelineBarProps {
  selectedStage: string;
  onStageSelect: (stageId: string) => void;
  counts: Record<string, number>;
  onStagesChange?: (stages: typeof DEFAULT_PIPELINE_STAGES) => void;
}

export const PipelineBar = ({ selectedStage, onStageSelect, counts, onStagesChange }: PipelineBarProps) => {
  const { toast } = useToast();
  const [stages, setStages] = useState<typeof DEFAULT_PIPELINE_STAGES>(PIPELINE_STAGES);
  const [newStageName, setNewStageName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const fetchStages = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('pipeline_stages')
          .eq('id', user.id)
          .single();

        if (!error && data?.pipeline_stages && Array.isArray(data.pipeline_stages) && data.pipeline_stages.length > 0) {
          const customStages = data.pipeline_stages as typeof DEFAULT_PIPELINE_STAGES;
          setStages(customStages);
          PIPELINE_STAGES = customStages;
          if (onStagesChange) onStagesChange(customStages);
        } else {
          // Instead of defaults, we start empty to show the "Create Pipeline" option
          setStages([]);
          PIPELINE_STAGES = [];
          if (onStagesChange) onStagesChange([]);
        }
      } catch (err) {
        console.warn("Could not fetch pipeline_stages from database:", err);
        setStages([]);
        PIPELINE_STAGES = [];
      }
    };

    fetchStages();
  }, [onStagesChange]);

  const saveStages = async (newStages: typeof DEFAULT_PIPELINE_STAGES) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ pipeline_stages: newStages as any })
        .eq('id', user.id);

      if (error) throw error;
      
      setStages(newStages);
      PIPELINE_STAGES = newStages;
      if (onStagesChange) onStagesChange(newStages);
    } catch (err) {
      console.error("Error saving pipeline_stages:", err);
      // Fallback: update local state anyway so it works in the current session
      setStages(newStages);
      PIPELINE_STAGES = newStages;
      if (onStagesChange) onStagesChange(newStages);
      toast({ title: "Aviso", description: "As alterações foram aplicadas localmente mas pode haver um erro no banco de dados." });
    }
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    const newId = newStageName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    
    const newStage = {
      id: newId,
      label: newStageName.toUpperCase(),
      color: "bg-slate-400"
    };

    const updatedStages = [...stages, newStage];
    saveStages(updatedStages);
    setNewStageName("");
    setIsAdding(false);
    toast({ title: "Sucesso", description: "Etapa criada com sucesso" });
  };

  const handleDeleteStage = (id: string) => {
    if (id === 'all') return;
    if (!window.confirm("Deseja realmente apagar esta etapa? Os leads nela não serão apagados, apenas a etapa sumirá do visual.")) return;
    
    const updatedStages = stages.filter(s => s.id !== id);
    saveStages(updatedStages);
    if (selectedStage === id) onStageSelect('all');
    toast({ title: "Sucesso", description: "Etapa excluída com sucesso" });
  };

  const handleCreateDefaultPipeline = () => {
    saveStages(DEFAULT_PIPELINE_STAGES);
    toast({ title: "Pipeline criado!", description: "Funil padrão configurado com sucesso." });
  };

  return (
    <div className="w-full bg-card border-b border-border py-2 px-4 shadow-sm flex items-center gap-4">
      <ScrollArea className="flex-1 whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {stages.length === 0 ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-2 rounded-full bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary animate-pulse"
              onClick={handleCreateDefaultPipeline}
            >
              <LayoutGrid className="w-4 h-4" />
              Criar meu Funil de Vendas
            </Button>
          ) : (
            stages.map((stage) => (
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
            ))
          )}
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

  );
};
