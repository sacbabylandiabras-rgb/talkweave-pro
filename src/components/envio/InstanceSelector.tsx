import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Smartphone, RefreshCw, Check } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { cn } from "@/lib/utils";

interface InstanceSelectorProps {
  onInstanceChange?: (instanceId: string) => void;
  onMultiInstanceChange?: (instanceIds: string[]) => void;
}

const ROTATE_ALL = "__rotate_all__";

const STORAGE_KEY = "zaplynx_selected_instances";

const InstanceSelector = ({ onInstanceChange, onMultiInstanceChange }: InstanceSelectorProps) => {
  const { instances, activeInstance, selectInstance, loading } = useZapiInstances();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Restore selection from localStorage or fall back to activeInstance
  useEffect(() => {
    if (!initialized && instances.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed: string[] = JSON.parse(saved);
          const valid = parsed.filter(id => instances.some(i => i.id === id));
          if (valid.length > 0) {
            const restored = new Set(valid);
            setSelectedIds(restored);
            setInitialized(true);
            // Notify parent
            if (valid.length > 1) {
              onInstanceChange?.(ROTATE_ALL);
              onMultiInstanceChange?.(valid);
            } else {
              selectInstance(valid[0]);
              onInstanceChange?.(valid[0]);
              onMultiInstanceChange?.(valid);
            }
            return;
          }
        } catch {}
      }
      if (activeInstance) {
        setSelectedIds(new Set([activeInstance.id]));
        setInitialized(true);
      }
    }
  }, [activeInstance, instances, initialized]);

  const toggleInstance = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Don't allow deselecting the last one
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }

      // Notify parent
      const ids = Array.from(next);
      if (ids.length === instances.length || ids.length > 1) {
        onInstanceChange?.(ROTATE_ALL);
        onMultiInstanceChange?.(ids);
      } else if (ids.length === 1) {
        const inst = instances.find(i => i.id === ids[0]);
        if (inst) {
          selectInstance(ids[0]);
          onInstanceChange?.(ids[0]);
          onMultiInstanceChange?.(ids);
        }
      }

      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set(instances.map(i => i.id));
    setSelectedIds(allIds);
    onInstanceChange?.(ROTATE_ALL);
    onMultiInstanceChange?.(Array.from(allIds));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4 animate-pulse" />
        <span>Carregando instâncias...</span>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4" />
        <span>Nenhuma instância configurada</span>
      </div>
    );
  }

  if (instances.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4 text-primary" />
        <span>Enviando por: <strong className="text-foreground">{instances[0].instance_name}</strong></span>
      </div>
    );
  }

  const allSelected = selectedIds.size === instances.length;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Smartphone className="h-4 w-4" />
        Instância de envio
        {selectedIds.size > 1 && (
          <span className="text-xs text-muted-foreground ml-1">
            ({selectedIds.size} selecionadas — revezamento)
          </span>
        )}
      </Label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectAll}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
            allSelected
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Todas
        </button>
        {instances.map((inst) => {
          const isSelected = selectedIds.has(inst.id);
          return (
            <button
              key={inst.id}
              type="button"
              onClick={() => toggleInstance(inst.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
              {inst.instance_name}
              {inst.is_default && (
                <span className={cn(
                  "text-[10px] px-1 py-0.5 rounded",
                  isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                )}>
                  Padrão
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { ROTATE_ALL };
export default InstanceSelector;
