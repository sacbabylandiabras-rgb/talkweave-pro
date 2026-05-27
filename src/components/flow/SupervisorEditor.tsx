import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Flag, ChevronRight, Info } from "lucide-react";

type Config = {
  systemPrompt: string;
  model: string;
  maxAttempts: number;
};

const DEFAULT: Config = {
  systemPrompt: "",
  model: "gpt-4-1-mini",
  maxAttempts: 1,
};

const MODELS = [
  { id: "gpt-4-1-mini", name: "Modelo Rápido" },
  { id: "gpt-4-1", name: "Modelo Avançado" },
  { id: "gemini-flash", name: "Modelo Econômico" },
];

function parse(data: any): Config {
  try {
    const raw =
      typeof data?.actionConfig === "string"
        ? JSON.parse(data.actionConfig)
        : data?.actionConfig || {};
    return {
      systemPrompt: raw.systemPrompt ?? "",
      model: raw.model ?? DEFAULT.model,
      maxAttempts: Math.min(50, Math.max(1, Number(raw.maxAttempts) || 1)),
    };
  } catch {
    return DEFAULT;
  }
}

function countTokens(text: string) {
  // estimativa simples: ~4 chars por token
  return Math.ceil((text || "").length / 4);
}

interface Props {
  data: any;
  onChange: (patch: any) => void;
}

export function SupervisorEditor({ data, onChange }: Props) {
  const cfg = useMemo(() => parse(data), [data]);
  const [promptOpen, setPromptOpen] = useState(false);
  const [draft, setDraft] = useState(cfg.systemPrompt);

  const update = (next: Config) =>
    onChange({
      actionType: "supervisor",
      actionConfig: JSON.stringify(next),
    });

  const tokens = countTokens(cfg.systemPrompt);

  return (
    <div className="space-y-4">
      <div className="text-xs font-medium text-muted-foreground">
        Configuração do Supervisor
      </div>

      <button
        type="button"
        onClick={() => {
          setDraft(cfg.systemPrompt);
          setPromptOpen(true);
        }}
        className="w-full flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        <Flag className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Missão/System Prompt</div>
          <div className="text-xs text-muted-foreground truncate">
            {cfg.systemPrompt ? "Configurado" : "Clique para configurar..."}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{tokens} tokens</div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="space-y-2">
        <Label className="text-sm">Modelo de IA</Label>
        <Select
          value={cfg.model}
          onValueChange={(v) => update({ ...cfg, model: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Custo estimado por uso. O modelo escolhido afeta qualidade e
            velocidade da resposta.
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">
          Máximo de tentativas: {cfg.maxAttempts}
        </Label>
        <Slider
          value={[cfg.maxAttempts]}
          min={1}
          max={50}
          step={1}
          onValueChange={([v]) => update({ ...cfg, maxAttempts: v })}
        />
        <p className="text-xs text-muted-foreground">
          Número máximo de tentativas que o agente pode executar para realizar
          o atendimento.
        </p>
      </div>

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Missão / System Prompt</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Descreva a missão e o comportamento do supervisor..."
            className="min-h-[280px] font-mono text-xs"
          />
          <div className="text-xs text-muted-foreground">
            {countTokens(draft)} tokens estimados
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPromptOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                update({ ...cfg, systemPrompt: draft });
                setPromptOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}