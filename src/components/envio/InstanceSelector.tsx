import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Smartphone } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";

interface InstanceSelectorProps {
  onInstanceChange?: (instanceId: string) => void;
}

const InstanceSelector = ({ onInstanceChange }: InstanceSelectorProps) => {
  const { instances, activeInstance, selectInstance, loading } = useZapiInstances();

  const handleChange = (value: string) => {
    selectInstance(value);
    onInstanceChange?.(value);
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
      <Select value={activeInstance?.id || ""} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a instância" />
        </SelectTrigger>
        <SelectContent>
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

export default InstanceSelector;
