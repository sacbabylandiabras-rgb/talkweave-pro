import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GitBranch, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Strategy = { id: string; name: string };
type Config = {
  strategy: Strategy | null;
  rule: "always" | "if_no_agent";
};

const DEFAULT: Config = { strategy: null, rule: "always" };

// Estratégias disponíveis (mock — substituir por fetch real quando integrar)
const AVAILABLE: Strategy[] = [
  { id: "default", name: "Estratégia Padrão" },
  { id: "vendas", name: "Estratégia de Vendas" },
  { id: "suporte", name: "Estratégia de Suporte" },
];

function parse(data: any): Config {
  try {
    const raw =
      typeof data?.actionConfig === "string"
        ? JSON.parse(data.actionConfig)
        : data?.actionConfig || {};
    return {
      strategy: raw.strategy ?? null,
      rule: raw.rule === "if_no_agent" ? "if_no_agent" : "always",
    };
  } catch {
    return DEFAULT;
  }
}

interface Props {
  data: any;
  onChange: (patch: any) => void;
}

export function TrocarEstrategiaEditor({ data, onChange }: Props) {
  const cfg = useMemo(() => parse(data), [data]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const update = (next: Config) =>
    onChange({
      actionType: "switch_strategy",
      actionConfig: JSON.stringify(next),
    });

  const setStrategy = (s: Strategy) => {
    update({ ...cfg, strategy: s });
    setOpen(false);
    setQuery("");
  };

  const filtered = AVAILABLE.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <GitBranch className="h-4 w-4 text-primary" />
            Estratégia de destino (Agente IA)
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Selecionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="space-y-2">
                <div className="text-sm font-medium px-1">
                  Selecionar estratégia
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="pl-7 h-8"
                  />
                </div>
                <div className="max-h-56 overflow-auto space-y-1">
                  {filtered.length === 0 ? (
                    <div className="text-xs text-muted-foreground px-2 py-3 text-center">
                      Nenhuma estratégia encontrada
                    </div>
                  ) : (
                    filtered.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setStrategy(s)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left",
                          cfg.strategy?.id === s.id && "bg-accent",
                        )}
                      >
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        {s.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {cfg.strategy?.name ?? "Nenhuma estratégia definida"}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Regra de transferência</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => update({ ...cfg, rule: "always" })}
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
            onClick={() => update({ ...cfg, rule: "if_no_agent" })}
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