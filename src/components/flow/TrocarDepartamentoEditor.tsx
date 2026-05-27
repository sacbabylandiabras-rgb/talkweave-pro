import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Lock, Plus, X, Search } from "lucide-react";

type Dept = { id: string; name: string };

type Config = {
  random: boolean;
  departments: Dept[];
};

const DEFAULT: Config = { random: true, departments: [] };

// Departamentos disponíveis (mock — substituir por fetch real quando integrar)
const AVAILABLE: Dept[] = [
  { id: "fdead", name: "fdead" },
  { id: "default", name: "default" },
];

function parse(data: any): Config {
  try {
    const raw =
      typeof data?.actionConfig === "string"
        ? JSON.parse(data.actionConfig)
        : data?.actionConfig || {};
    return {
      random: raw.random ?? true,
      departments: Array.isArray(raw.departments) ? raw.departments : [],
    };
  } catch {
    return DEFAULT;
  }
}

interface Props {
  data: any;
  onChange: (patch: any) => void;
}

export function TrocarDepartamentoEditor({ data, onChange }: Props) {
  const cfg = useMemo(() => parse(data), [data]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const update = (next: Config) => {
    onChange({
      actionType: "switch_department",
      actionConfig: JSON.stringify(next),
    });
  };

  const addDept = (d: Dept) => {
    if (cfg.departments.some((x) => x.id === d.id)) return;
    update({ ...cfg, departments: [...cfg.departments, d] });
    setOpen(false);
    setQuery("");
  };

  const removeDept = (id: string) => {
    update({ ...cfg, departments: cfg.departments.filter((d) => d.id !== id) });
  };

  const filtered = AVAILABLE.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
        <Switch
          checked={cfg.random}
          onCheckedChange={(v) => update({ ...cfg, random: v })}
        />
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Modo Random</Label>
          <p className="text-xs text-muted-foreground">
            Alterna entre departamentos aleatoriamente
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            Departamentos {cfg.random ? "(modo aleatório)" : ""}
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <div className="space-y-2">
                <div className="text-sm font-medium px-1">
                  Selecionar departamento
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
                      Nenhum departamento encontrado
                    </div>
                  ) : (
                    filtered.map((d) => {
                      const already = cfg.departments.some((x) => x.id === d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={already}
                          onClick={() => addDept(d)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-left"
                        >
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          {d.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          {cfg.departments.length === 0 ? (
            <div className="text-xs text-muted-foreground px-3 py-4 text-center border border-dashed border-border rounded-md">
              Nenhum departamento adicionado
            </div>
          ) : (
            cfg.departments.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  {d.name}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => removeDept(d.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}