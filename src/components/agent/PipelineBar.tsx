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

interface PipelineBarProps {
  selectedStage: string;
  onStageSelect: (stageId: string) => void;
  counts: Record<string, number>;
}

export const PipelineBar = ({ selectedStage, onStageSelect, counts }: PipelineBarProps) => {
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
