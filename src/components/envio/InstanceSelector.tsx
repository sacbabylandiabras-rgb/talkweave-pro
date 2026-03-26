import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Smartphone, RefreshCw } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Separator } from "@/components/ui/separator";

interface InstanceSelectorProps {
  onInstanceChange?: (instanceId: string) => void;
}

const ROTATE_ALL = "__rotate_all__";

const InstanceSelector = ({ onInstanceChange }: InstanceSelectorProps) => {
  const { instances, activeInstance, selectInstance, loading } = useZapiInstances();
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [userHasChosen, setUserHasChosen] = useState(false);

  // Set initial value from activeInstance only if user hasn't manually chosen
  useEffect(() => {
    if (!userHasChosen && activeInstance && !selectedValue) {
      setSelectedValue(activeInstance.id);
    }
  }, [activeInstance, userHasChosen, selectedValue]);

  const handleChange = (value: string) => {
    setSelectedValue(value);
    setUserHasChosen(true);
    if (value === ROTATE_ALL) {
      onInstanceChange?.(ROTATE_ALL);
    } else {
      selectInstance(value);
      onInstanceChange?.(value);
    }
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

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Smartphone className="h-4 w-4" />
        Instância de envio
      </Label>
      <Select defaultValue={activeInstance?.id || ""} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a instância" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ROTATE_ALL}>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              <span>Todas (revezamento)</span>
              <span className="text-xs text-muted-foreground">— alterna entre {instances.length} instâncias</span>
            </div>
          </SelectItem>
          <Separator className="my-1" />
          {instances.map((inst) => (
            <SelectItem key={inst.id} value={inst.id}>
              <div className="flex items-center gap-2">
                <span>{inst.instance_name}</span>
                {inst.is_default && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Padrão</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export { ROTATE_ALL };
export default InstanceSelector;
