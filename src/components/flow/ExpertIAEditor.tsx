import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import {
  Briefcase,
  Flag,
  ChevronRight,
  Code2,
  History,
  Info,
  Wrench,
  Plus,
} from "lucide-react";

type Config = {
  jobDescription: string;
  systemPrompt: string;
  outputSchema: string;
  model: string;
  includeTime: boolean;
  includeChatHistory: boolean;
  thirdPersonAnalysis: boolean;
  useToolHistory: boolean;
  restrictToolHistory: boolean;
  skills: string[];
};

const DEFAULT: Config = {
  jobDescription: "",
  systemPrompt: "",
  outputSchema: "{\n  \"ex\": \"string\"\n}",
  model: "gpt-4-1-mini",
  includeTime: true,
  includeChatHistory: true,
  thirdPersonAnalysis: false,
  useToolHistory: true,
  restrictToolHistory: false,
  skills: [],
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
    return { ...DEFAULT, ...raw };
  } catch {
    return DEFAULT;
  }
}

function countTokens(text: string) {
  // Aproximação mais realista: média ~1.3 chars/token para português
  return Math.ceil((text || "").length / 3.5);
}

interface Props {
  data: any;
  onChange: (patch: any) => void;
}

export function ExpertIAEditor({ data, onChange }: Props) {
  const cfg = useMemo(() => parse(data), [data]);
  const [promptOpen, setPromptOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(cfg.systemPrompt);
  const [draftSchema, setDraftSchema] = useState(cfg.outputSchema);

  const update = (next: Config) =>
    onChange({
      actionType: "expert_ia",
      actionConfig: JSON.stringify(next),
    });

  const tokens = countTokens(cfg.systemPrompt);

  return (
    <div className="space-y-5">
      {/* Header histórico de prompts */}
      <div className="flex justify-end">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          <History className="h-3 w-3" />
          Histórico de Prompts
        </button>
      </div>

      {/* Descrição do trabalho */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Briefcase className="h-3.5 w-3.5 text-primary" />
          Descrição do trabalho (para o Leader saber quando usar)
        </div>
        <Input
          value={cfg.jobDescription}
          onChange={(e) => update({ ...cfg, jobDescription: e.target.value })}
          placeholder="Descreva aqui o trabalho que esse Expert realiza"
        />
        <p className="text-[11px] text-muted-foreground">
          Será usado pelo Leader para saber se envia atividades para este Expert
        </p>
      </div>

      {/* Configurações */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          Configurações do Expert
        </div>

        <button
          type="button"
          onClick={() => {
            setDraftPrompt(cfg.systemPrompt);
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

        <button
          type="button"
          onClick={() => {
            setDraftSchema(cfg.outputSchema);
            setSchemaOpen(true);
          }}
          className="w-full flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
        >
          <Code2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">
              Estrutura de Dados de Saída (JSON Schema)
            </div>
            <div className="text-xs text-muted-foreground truncate font-mono">
              {cfg.outputSchema?.replace(/\s+/g, " ").slice(0, 60) || "{ ex: string }"}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Toggles */}
        <div className="space-y-3">
          <ToggleRow
            label="Incluir horário atual no contexto"
            help="Quando ativo, o Expert recebe data/hora atual de execução para incorporar referências temporais como hoje, amanhã e esta semana."
            checked={cfg.includeTime}
            onChange={(v) => update({ ...cfg, includeTime: v })}
          />
          <ToggleRow
            label="Incluir histórico de msg do chat"
            help="Envia as mensagens da conversa como contexto para o Expert. Desativado, usa apenas System Context, Mission e Output Schema."
            checked={cfg.includeChatHistory}
            onChange={(v) => update({ ...cfg, includeChatHistory: v })}
          />
          <ToggleRow
            label="Analisar chat na 3ª pessoa"
            help="Adiciona a conversa no contexto e executa a missão como análise"
            checked={cfg.thirdPersonAnalysis}
            onChange={(v) => update({ ...cfg, thirdPersonAnalysis: v })}
          />
          <ToggleRow
            label="Usa histórico de tools"
            help="Inclui o histórico de execuções anteriores das ferramentas"
            checked={cfg.useToolHistory}
            onChange={(v) => update({ ...cfg, useToolHistory: v })}
          />
          <ToggleRow
            label="Restringir histórico de tools a este Node"
            help="Tool calls não são adicionadas ao histórico principal"
            checked={cfg.restrictToolHistory}
            onChange={(v) => update({ ...cfg, restrictToolHistory: v })}
          />
        </div>

        {/* Modelo + Skills */}
        <div className="space-y-4">
          <div className="space-y-1.5">
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
            <div className="text-[11px] text-muted-foreground">
              Tokens de entrada: 0,600$/Milhão · Tokens de saída: 2,400$/Milhão
              · Cache: 0,150$/Milhão
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Info className="h-3 w-3" />O que são esses valores?
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                Skills
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-primary hover:text-primary"
              >
                <Plus className="h-3 w-3 mr-1" />
                Vincular Skill
              </Button>
            </div>
            {cfg.skills.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma skill vinculada
              </p>
            ) : (
              <ul className="text-xs space-y-1">
                {cfg.skills.map((s, i) => (
                  <li key={i} className="px-2 py-1 rounded bg-muted/40">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Prompt dialog */}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Missão / System Prompt</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            placeholder="Descreva a missão e o comportamento do Expert..."
            className="min-h-[280px] font-mono text-xs"
          />
          <div className="text-xs text-muted-foreground">
            {countTokens(draftPrompt)} tokens estimados
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPromptOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                update({ ...cfg, systemPrompt: draftPrompt });
                setPromptOpen(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schema dialog */}
      <Dialog open={schemaOpen} onOpenChange={setSchemaOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Estrutura de Dados de Saída (JSON Schema)</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draftSchema}
            onChange={(e) => setDraftSchema(e.target.value)}
            placeholder={'{\n  "campo": "string"\n}'}
            className="min-h-[280px] font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSchemaOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                update({ ...cfg, outputSchema: draftSchema });
                setSchemaOpen(false);
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

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-[11px] text-muted-foreground leading-snug">{help}</p>
      </div>
    </div>
  );
}