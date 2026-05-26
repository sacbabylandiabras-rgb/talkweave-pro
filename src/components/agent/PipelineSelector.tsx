import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DollarSign, LayoutGrid, Plus, ChevronRight, Loader2, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_PIPELINE_STAGES } from "@/components/agent/PipelineBar";

type Stage = { id: string; label: string; color: string };
type Pipeline = { id: string; name: string; department?: string; currency?: string; stages: Stage[] };

const LS_ACTIVE_KEY = "pipeline_active_id";

const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Real Brasileiro (R$)" },
  { value: "USD", label: "Dólar Americano (US$)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "Libra Esterlina (£)" },
  { value: "ARS", label: "Peso Argentino ($)" },
];

const DEPARTMENT_OPTIONS = ["Vendas", "Pré-Vendas", "Pós-Vendas", "Suporte", "Marketing", "Financeiro", "Outro"];

interface PipelineSelectorProps {
  onSelect: (id: string) => void;
}

export const PipelineSelector = ({ onSelect }: PipelineSelectorProps) => {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDepartment, setFormDepartment] = useState("Vendas");
  const [formCurrency, setFormCurrency] = useState("BRL");
  const [formStages, setFormStages] = useState<Stage[]>([...DEFAULT_PIPELINE_STAGES]);
  const [formNewStage, setFormNewStage] = useState("");

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

  const openCreate = () => {
    setFormName("");
    setFormDepartment("Vendas");
    setFormCurrency("BRL");
    setFormStages([...DEFAULT_PIPELINE_STAGES]);
    setFormNewStage("");
    setIsCreating(true);
  };

  const addFormStage = () => {
    const label = formNewStage.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    setFormStages(prev => [...prev, { id, label: label.toUpperCase(), color: "bg-slate-400" }]);
    setFormNewStage("");
  };

  const removeFormStage = (id: string) => {
    if (id === "all") return;
    setFormStages(prev => prev.filter(s => s.id !== id));
  };

  const handleCreate = async () => {
    const name = formName.trim();
    if (!name) {
      toast({ title: "Atenção", description: "Digite um nome para o funil.", variant: "destructive" });
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
    setPipelines(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any)
          .from("profiles")
          .update({ pipeline_stages: next as any })
          .eq("id", user.id);
      }
    } catch (err) {
      console.error("Error saving pipeline:", err);
    }
    setIsCreating(false);
    toast({ title: "Funil criado!", description: `"${name}" pronto para uso.` });
    handlePick(newPipe.id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const pipe = pipelines.find(p => p.id === id);
    if (!pipe) return;
    if (!window.confirm(`Apagar o funil "${pipe.name}"?`)) return;
    const next = pipelines.filter(p => p.id !== id);
    setPipelines(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any)
          .from("profiles")
          .update({ pipeline_stages: next as any })
          .eq("id", user.id);
      }
    } catch (err) {
      console.error(err);
    }
    toast({ title: "Funil excluído" });
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
          <Button onClick={openCreate} className="gap-2">
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
            <Button onClick={openCreate} className="gap-2">
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
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
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
              <Input placeholder="Ex: Vendas Diretas" value={formName} onChange={(e) => setFormName(e.target.value)} className="h-9" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Departamento</Label>
                <Select value={formDepartment} onValueChange={setFormDepartment}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Moeda</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
                    {s.id !== "all" && (
                      <button onClick={() => removeFormStage(s.id)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5">
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
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFormStage(); } }}
                />
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={addFormStage}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar Pipeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};