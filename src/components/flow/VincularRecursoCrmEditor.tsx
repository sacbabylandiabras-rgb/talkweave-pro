import { useMemo, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, ArrowDown, User, Hash, Database, BrainCircuit, Box } from "lucide-react";

type ResourceType =
  | "lead"
  | "ticket"
  | "deal"
  | "task"
  | "company"
  | "event"
  | "activity"
  | "transaction"
  | "note";

const RESOURCES: { id: ResourceType; label: string }[] = [
  { id: "lead", label: "Lead" },
  { id: "ticket", label: "Ticket" },
  { id: "deal", label: "Negócio (Deal)" },
  { id: "task", label: "Tarefa" },
  { id: "company", label: "Empresa" },
  { id: "event", label: "Evento / Agenda" },
  { id: "activity", label: "Atividade" },
  { id: "transaction", label: "Transação" },
  { id: "note", label: "Nota" },
];

const VAR_PRESETS = [
  { icon: User, value: "{{lead.id}}", title: "ID do Lead" },
  { icon: Hash, value: "{{node.id}}", title: "ID do node atual" },
  { icon: Database, value: "{{node.id.record.id}}", title: "Último registro criado" },
  { icon: BrainCircuit, value: "{{memory.}}", title: "Variável de memória" },
  { icon: Box, value: "{{node.}}", title: "Saída de outro bloco" },
];

export type LinkCrmConfig = {
  aType: ResourceType | "";
  aId: string;
  bType: ResourceType | "";
  bId: string;
};

const DEFAULT: LinkCrmConfig = { aType: "", aId: "", bType: "", bId: "" };

function VarBar({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {VAR_PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          title={`${p.title} — ${p.value}`}
          onClick={() => onInsert(p.value)}
          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <p.icon className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

function ResourceCard({
  letter,
  value,
  onChange,
  placeholder,
}: {
  letter: "A" | "B";
  value: { type: ResourceType | ""; id: string };
  onChange: (next: { type: ResourceType | ""; id: string }) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const insert = (v: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange({ ...value, id: (value.id || "") + v });
      return;
    }
    const start = el.selectionStart ?? value.id.length;
    const end = el.selectionEnd ?? value.id.length;
    const next = value.id.slice(0, start) + v + value.id.slice(end);
    onChange({ ...value, id: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + v.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">
          {letter}
        </span>
        <span className="text-[12px] font-medium">Recurso {letter}</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11.5px]">Tipo do recurso</Label>
        <Select
          value={value.type || undefined}
          onValueChange={(v) => onChange({ ...value, type: v as ResourceType })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {RESOURCES.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11.5px]">ID do recurso ({letter})</Label>
          <VarBar onInsert={insert} />
        </div>
        <Input
          ref={inputRef}
          value={value.id}
          onChange={(e) => onChange({ ...value, id: e.target.value })}
          placeholder={placeholder}
          className="h-9 text-[12px] font-mono"
        />
        <p className="text-[10.5px] text-muted-foreground">
          ID do recurso. Use variáveis dinâmicas.
        </p>
      </div>
    </div>
  );
}

export function VincularRecursoCrmEditor({
  data,
  onChange,
}: {
  data: any;
  onChange: (patch: any) => void;
}) {
  const cfg: LinkCrmConfig = useMemo(() => {
    try {
      const raw = data?.actionConfig;
      if (raw && typeof raw === "string") {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT, ...parsed };
      }
    } catch {}
    return DEFAULT;
  }, [data?.actionConfig]);

  const update = (patch: Partial<LinkCrmConfig>) => {
    const next = { ...cfg, ...patch };
    onChange({
      actionType: "crm_link_resources",
      actionConfig: JSON.stringify(next),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">Vincular Recurso CRM</span>
      </div>
      <p className="text-[11.5px] text-muted-foreground">
        Para conectar um recurso com outro, informe o tipo e o ID de cada parte.
      </p>

      <ResourceCard
        letter="A"
        value={{ type: cfg.aType, id: cfg.aId }}
        onChange={(v) => update({ aType: v.type, aId: v.id })}
        placeholder="Ex: {{lead.id}}"
      />

      <div className="flex justify-center">
        <div className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ArrowDown className="h-3.5 w-3.5" />
        </div>
      </div>

      <ResourceCard
        letter="B"
        value={{ type: cfg.bType, id: cfg.bId }}
        onChange={(v) => update({ bType: v.type, bId: v.id })}
        placeholder="Ex: {{node.id.record.id}}"
      />
    </div>
  );
}