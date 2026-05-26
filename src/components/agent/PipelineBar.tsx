import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, Check } from "lucide-react";
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

      const { data, error } = await supabase
        .from('profiles')
        .select('pipeline_stages')
        .eq('id', user.id)
        .single();

      if (!error && data?.pipeline_stages) {
        const customStages = data.pipeline_stages as typeof DEFAULT_PIPELINE_STAGES;
        setStages(customStages);
        PIPELINE_STAGES = customStages;
        if (onStagesChange) onStagesChange(customStages);
      } else {
        setStages(DEFAULT_PIPELINE_STAGES);
        PIPELINE_STAGES = DEFAULT_PIPELINE_STAGES;
      }
    };

    fetchStages();
  }, [onStagesChange]);

  const saveStages = async (newStages: typeof DEFAULT_PIPELINE_STAGES) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ pipeline_stages: newStages as any })
      .eq('id', user.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setStages(newStages);
      PIPELINE_STAGES = newStages;
      if (onStagesChange) onStagesChange(newStages);
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

  return (
    <div className="w-full bg-card border-b border-border py-2 px-4 shadow-sm">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {PIPELINE_STAGES.map((stage) => (
            <button
              key={stage.id}
              onClick={() => onStageSelect(stage.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
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
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
};
