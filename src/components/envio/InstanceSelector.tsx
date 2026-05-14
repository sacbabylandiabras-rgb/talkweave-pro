 import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Smartphone, RefreshCw, Check } from "lucide-react";
import { useZapiInstances, type ZapiInstance } from "@/hooks/useZapiInstances";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";
import { cn } from "@/lib/utils";

interface InstanceSelectorProps {
  onInstanceChange?: (instanceId: string) => void;
  onMultiInstanceChange?: (instanceIds: string[]) => void;
  useSavedSelection?: boolean;
  /** Restrict to instances of a specific api_provider (e.g. "uazapi"). */
  providerFilter?: "zapi" | "meta" | "all";
}

const ROTATE_ALL = "__rotate_all__";

const STORAGE_KEY = "zaplynx_selected_instances";

const InstanceSelector = ({ onInstanceChange, onMultiInstanceChange, useSavedSelection = true, providerFilter = "all" }: InstanceSelectorProps) => {
  const zapiFilter = providerFilter === "all" ? undefined : providerFilter;
  
  const { instances: allInstances, activeInstance: rawActiveInstance, selectInstance, loading } = useZapiInstances({ 
    provider: zapiFilter,
    includeMeta: true 
  });
   // Mesma regra: ocultar instâncias UAZAPI doadoras (aquecimento).
    const { data: metaCreds } = useMetaCredentials();
    
    const instances = useMemo(() => {
      return allInstances;
    }, [allInstances]);
  const activeInstance = providerFilter
    ? (instances.find((i: any) => i.id === rawActiveInstance?.id) || instances.find((i: any) => i.is_default) || instances[0] || null)
    : rawActiveInstance;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Restore saved selection from localStorage, fallback to active/default instance
  useEffect(() => {
    if (!initialized && instances.length > 0) {
      const saved = useSavedSelection ? localStorage.getItem(STORAGE_KEY) : null;
      let idsToSelect: string[];
      const fallbackId = activeInstance?.id || instances.find(i => i.is_default)?.id || instances[0]?.id;

      if (saved) {
        try {
          const parsed: string[] = JSON.parse(saved);
          // Filter to only valid instance IDs that still exist
          const visibleIds = new Set(instances.map((i) => i.id));
          const valid = parsed.filter(id => visibleIds.has(id));
          idsToSelect = valid.length > 0 ? valid : (fallbackId ? [fallbackId] : []);
        } catch {
          idsToSelect = fallbackId ? [fallbackId] : [];
        }
      } else {
        idsToSelect = fallbackId ? [fallbackId] : [];
      }

      setSelectedIds(new Set(idsToSelect));
      setInitialized(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(idsToSelect));

      if (idsToSelect.length > 1) {
        onInstanceChange?.(ROTATE_ALL);
        onMultiInstanceChange?.(idsToSelect);
      } else if (idsToSelect.length === 1) {
        selectInstance(idsToSelect[0]);
        onInstanceChange?.(idsToSelect[0]);
        onMultiInstanceChange?.(idsToSelect);
      }
    }
  }, [instances, initialized, useSavedSelection, activeInstance]);

  const toggleInstance = (id: string) => {
    // Toggle multi-seleção: adiciona/remove do conjunto selecionado.
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    // Garante pelo menos uma instância selecionada
    if (next.size === 0) {
      next.add(id);
    }
    setSelectedIds(next);
    const ids = Array.from(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    if (ids.length === 1) {
      selectInstance(ids[0]);
      onInstanceChange?.(ids[0]);
    } else {
      onInstanceChange?.(ROTATE_ALL);
    }
    onMultiInstanceChange?.(ids);
  };

  const selectAll = () => {
    const allIds = new Set(instances.map(i => i.id));
    setSelectedIds(allIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(allIds)));
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
