import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, LayoutGrid, Plus, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = { id: string; label: string; color: string };
type Pipeline = { id: string; name: string; department?: string; currency?: string; stages: Stage[] };

const LS_ACTIVE_KEY = "pipeline_active_id";

interface PipelineSelectorProps {
  onSelect: (id: string) => void;
  onCreateRequest: () => void;
}

export const PipelineSelector = ({ onSelect, onCreateRequest }: PipelineSelectorProps) => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("pipeline_stages")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        const raw = data?.pipeline_stages;
        let loaded: Pipeline[] = [];
        if (Array.isArray(raw) && raw.length > 0) {
          if ((raw[0] as any).stages) loaded = raw as Pipeline[];
          else loaded = [{ id: `pipeline_${Date.now()}`, name: "Funil de Vendas", stages: raw as Stage[] }];
        }
        setPipelines(loaded);
      } catch (err) {
        console.warn("Could not load pipelines:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPipelines();
  }, []);

  const handlePick = (id: string) => {
    localStorage.setItem(LS_ACTIVE_KEY, id);
    onSelect(id);
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipelines de Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha um funil para entrar e visualizar suas oportunidades.
            </p>
          </div>
          <Button onClick={onCreateRequest} className="gap-2">
            <Plus className="w-4 h-4" /> Novo funil
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando funis...
          </div>
        ) : pipelines.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum funil ainda</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Crie seu primeiro funil de vendas para organizar suas oportunidades.
            </p>
            <Button onClick={onCreateRequest} className="gap-2">
              <Plus className="w-4 h-4" /> Criar primeiro funil
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelines.map((p) => {
              const stageCount = p.stages.filter(s => s.id !== "all").length;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePick(p.id)}
                  className={cn(
                    "group text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="font-semibold text-base mb-1 truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {p.department || "Sem departamento"} · {p.currency || "BRL"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.stages.filter(s => s.id !== "all").slice(0, 4).map(s => (
                      <Badge key={s.id} variant="secondary" className="gap-1 text-[10px]">
                        <div className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
                        {s.label}
                      </Badge>
                    ))}
                    {stageCount > 4 && (
                      <Badge variant="outline" className="text-[10px]">+{stageCount - 4}</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};