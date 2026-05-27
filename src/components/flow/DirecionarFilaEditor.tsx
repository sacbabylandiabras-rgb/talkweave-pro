import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Config = { rule: "always" | "if_no_agent" };

const DEFAULT: Config = { rule: "always" };

function parse(data: any): Config {
  try {
    const raw =
      typeof data?.actionConfig === "string"
        ? JSON.parse(data.actionConfig)
        : data?.actionConfig || {};
    return { rule: raw.rule === "if_no_agent" ? "if_no_agent" : "always" };
  } catch {
    return DEFAULT;
  }
}

interface Props {
  data: any;
  onChange: (patch: any) => void;
}

export function DirecionarFilaEditor({ data, onChange }: Props) {
  const cfg = useMemo(() => parse(data), [data]);

  const setRule = (rule: Config["rule"]) =>
    onChange({
      actionType: "route_to_queue",
      actionConfig: JSON.stringify({ ...cfg, rule }),
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4 text-primary" />
        Direcionar para Fila
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground/90">
        Ao chegar neste bloco, o lead é direcionado para a fila de atendimento
        humano sem nenhuma interação adicional no chat.
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
        <div className="text-xs font-medium">Como funciona:</div>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>O lead é colocado na fila do departamento atual</li>
          <li>Nenhuma mensagem é enviada ao lead</li>
          <li>O próximo atendente disponível assumirá o atendimento</li>
          <li>O fluxo do robô é encerrado neste ponto</li>
        </ul>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Regra de transferência</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRule("always")}
            className={cn(
              "rounded-md border px-3 py-2 text-xs text-left transition-colors",
              cfg.rule === "always"
                ? "border-emerald-500 bg-emerald-500/20 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
            )}
          >
            <div className="font-medium">Sempre transferir</div>
            <div className="text-[10px] opacity-80">PADRÃO</div>
          </button>
          <button
            type="button"
            onClick={() => setRule("if_no_agent")}
            className={cn(
              "rounded-md border px-3 py-2 text-xs text-left transition-colors",
              cfg.rule === "if_no_agent"
                ? "border-emerald-500 bg-emerald-500/20 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
            )}
          >
            <div className="font-medium">
              Somente se não tiver em atendimento humano
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}