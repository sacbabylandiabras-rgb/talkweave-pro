import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_STAGES, type Pipeline, type PipelineStage } from "@/hooks/usePipelines";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Real (R$)" },
  { value: "USD", label: "Dólar (US$)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "Libra (£)" },
  { value: "ARS", label: "Peso ($)" },
];

const DEPARTMENT_OPTIONS = ["Vendas", "Pré-Vendas", "Pós-Vendas", "Suporte", "Marketing", "Financeiro", "Outro"];

const STAGE_COLORS = [
  "bg-slate-500", "bg-blue-500", "bg-yellow-500", "bg-green-500",
  "bg-red-500", "bg-purple-500", "bg-pink-500", "bg-orange-500",
  "bg-teal-500", "bg-indigo-500",
];

function SortableStageRow({ stage, onLabelChange, onColorChange, onRemove }: {
  stage: PipelineStage;
  onLabelChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const isAll = stage.id === "all";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md border border-border bg-card"
    >
      <button
        type="button"
        className={cn("touch-none p-1 text-muted-foreground hover:text-foreground", isAll && "opacity-30 cursor-not-allowed")}
        {...(isAll ? {} : attributes)}
        {...(isAll ? {} : listeners)}
        aria-label="Arrastar"
        disabled={isAll}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Select value={stage.color} onValueChange={onColorChange} disabled={isAll}>
        <SelectTrigger className="h-8 w-12 px-2">
          <div className={cn("w-3 h-3 rounded-full", stage.color)} />
        </SelectTrigger>
        <SelectContent>
          {STAGE_COLORS.map((c) => (
            <SelectItem key={c} value={c}>
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", c)} />
                <span className="text-xs">{c.replace("bg-", "").replace("-500", "")}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={stage.label}
        onChange={(e) => onLabelChange(e.target.value.toUpperCase())}
        className="h-8 text-xs flex-1"
        disabled={isAll}
      />
      {!isAll && (
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

interface PipelineEditDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipeline?: Pipeline | null; // null/undefined = create mode
  onSave: (input: { name: string; department?: string; currency?: string; stages: PipelineStage[] }) => Promise<void>;
}

export const PipelineEditDialog = ({ open, onOpenChange, pipeline, onSave }: PipelineEditDialogProps) => {
  const { toast } = useToast();
  const isEditing = !!pipeline;
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Vendas");
  const [currency, setCurrency] = useState("BRL");
  const [stages, setStages] = useState<PipelineStage[]>([...DEFAULT_STAGES]);
  const [newStage, setNewStage] = useState("");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (open) {
      if (pipeline) {
        setName(pipeline.name);
        setDepartment(pipeline.department || "Vendas");
        setCurrency(pipeline.currency || "BRL");
        setStages(Array.isArray(pipeline.stages) && pipeline.stages.length > 0 ? pipeline.stages : [...DEFAULT_STAGES]);
      } else {
        setName("");
        setDepartment("Vendas");
        setCurrency("BRL");
        setStages([...DEFAULT_STAGES]);
      }
      setNewStage("");
    }
  }, [open, pipeline]);

  const addStage = () => {
    const label = newStage.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    setStages((prev) => [...prev, { id, label: label.toUpperCase(), color: "bg-slate-400" }]);
    setNewStage("");
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setStages((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      // Keep the special "all" stage pinned to the top if it exists
      const reordered = arrayMove(prev, oldIndex, newIndex);
      const allIdx = reordered.findIndex((s) => s.id === "all");
      if (allIdx > 0) {
        const [allItem] = reordered.splice(allIdx, 1);
        reordered.unshift(allItem);
      }
      return reordered;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Atenção", description: "Digite um nome para o funil.", variant: "destructive" });
      return;
    }
    const nonAll = stages.filter((s) => s.id !== "all");
    if (nonAll.length === 0) {
      toast({ title: "Atenção", description: "Adicione ao menos uma etapa.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), department, currency, stages });
      onOpenChange(false);
      toast({ title: isEditing ? "Funil atualizado!" : "Funil criado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar funil" : "Criar funil"}</DialogTitle>
          <DialogDescription className="text-xs">
            Configure as informações básicas e arraste as etapas para reordenar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Departamento</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Moeda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Etapas</Label>
              <Badge variant="outline" className="text-[10px]">arraste para reordenar</Badge>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {stages.map((s) => (
                    <SortableStageRow
                      key={s.id}
                      stage={s}
                      onLabelChange={(label) =>
                        setStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, label } : x)))
                      }
                      onColorChange={(color) =>
                        setStages((prev) => prev.map((x) => (x.id === s.id ? { ...x, color } : x)))
                      }
                      onRemove={() => setStages((prev) => prev.filter((x) => x.id !== s.id))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Nome do estágio"
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="h-8 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(); } }}
              />
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={addStage}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{isEditing ? "Salvar" : "Criar funil"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};