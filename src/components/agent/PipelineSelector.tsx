import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, LayoutGrid, Plus, ChevronRight, Loader2, Trash2, Pencil, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePipelines, type Pipeline } from "@/hooks/usePipelines";
import { PipelineEditDialog } from "@/components/agent/PipelineEditDialog";
import { PipelineShareDialog } from "@/components/agent/PipelineShareDialog";

const LS_ACTIVE_KEY = "pipeline_active_id";

interface PipelineSelectorProps {
  onSelect: (id: string) => void;
}

export const PipelineSelector = ({ onSelect }: PipelineSelectorProps) => {
  const { toast } = useToast();
  const { pipelines, loading, create, update, remove } = usePipelines();
  const [editing, setEditing] = useState<Pipeline | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sharing, setSharing] = useState<Pipeline | null>(null);

  const handlePick = (id: string) => {
    localStorage.setItem(LS_ACTIVE_KEY, id);
    onSelect(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const pipe = pipelines.find(p => p.id === id);
    if (!pipe) return;
    if (!window.confirm(`Apagar o funil "${pipe.name}"?`)) return;
    try {
      await remove(id);
      toast({ title: "Funil excluído" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Falha ao excluir.", variant: "destructive" });
    }
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
          <Button onClick={() => setIsCreating(true)} className="gap-2">
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
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Criar primeiro funil
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelines.map((p) => {
              const stageCount = p.stages.filter(s => s.id !== "all").length;
              return (
                <div
                  key={p.id}
                  onClick={() => handlePick(p.id)}
                  className={cn(
                    "group text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative"
                  )}
                >
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {p.is_owner && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                          className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSharing(p); }}
                          className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted"
                          title="Compartilhar"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(p.id, e)}
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-muted"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="font-semibold text-base mb-1 truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {p.department || "Sem departamento"} · {p.currency || "BRL"}
                    {!p.is_owner && (
                      <Badge variant="outline" className="ml-2 text-[9px] py-0">
                        compartilhado · {p.role}
                      </Badge>
                    )}
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PipelineEditDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        pipeline={null}
        onSave={async (input) => {
          const created = await create(input);
          if (created?.id) handlePick(created.id);
        }}
      />
      <PipelineEditDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        pipeline={editing}
        onSave={async (input) => {
          if (editing) await update(editing.id, input);
        }}
      />
      <PipelineShareDialog
        open={!!sharing}
        onOpenChange={(v) => !v && setSharing(null)}
        pipeline={sharing}
      />
    </div>
  );
};