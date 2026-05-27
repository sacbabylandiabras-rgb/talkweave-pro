import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronRight, FileText, Info, HelpCircle } from "lucide-react";

type ResumoConfig = {
  prompt?: string;
  model?: string;
  previousAttendances?: number;
  currentChatWordLimit?: number;
  recentInteractionsKept?: number;
};

const MODELS: Array<{ value: string; label: string; info: string }> = [
  { value: "gpt-4.1-mini", label: "GPT 4.1 mini", info: "Tokens de entrada: 0,40US$/Milhão · Tokens de saída: 2,40US$/Milhão · Cache: 0,10US$/Milhão" },
  { value: "gpt-4.1", label: "GPT 4.1", info: "Tokens de entrada: 2,00US$/Milhão · Tokens de saída: 8,00US$/Milhão · Cache: 0,50US$/Milhão" },
  { value: "gpt-4o-mini", label: "GPT 4o mini", info: "Tokens de entrada: 0,15US$/Milhão · Tokens de saída: 0,60US$/Milhão · Cache: 0,075US$/Milhão" },
  { value: "gpt-4o", label: "GPT 4o", info: "Tokens de entrada: 2,50US$/Milhão · Tokens de saída: 10,00US$/Milhão · Cache: 1,25US$/Milhão" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", info: "Tokens de entrada: 0,30US$/Milhão · Tokens de saída: 2,50US$/Milhão · Cache: 0,075US$/Milhão" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", info: "Tokens de entrada: 1,25US$/Milhão · Tokens de saída: 10,00US$/Milhão · Cache: 0,30US$/Milhão" },
];

function countTokens(text: string): number {
  if (!text) return 0;
  // Heuristic ≈ 1 token / 4 chars
  return Math.ceil(text.trim().length / 4);
}

export function ResumoConversaEditor({
  data,
  onChange,
}: {
  data: any;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const config: ResumoConfig = data?.resumoConfig || {};
  const prompt = config.prompt || "";
  const model = config.model || "gpt-4.1-mini";
  const previous = Number(config.previousAttendances ?? 3);
  const wordLimit = Number(config.currentChatWordLimit ?? 20000);
  const recent = Number(config.recentInteractionsKept ?? 10);

  const [promptOpen, setPromptOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(prompt);

  const update = (patch: Partial<ResumoConfig>) =>
    onChange({
      actionType: "conversation_summary",
      resumoConfig: { prompt, model, previousAttendances: previous, currentChatWordLimit: wordLimit, recentInteractionsKept: recent, ...patch },
    });

  const modelMeta = MODELS.find((m) => m.value === model) || MODELS[0];
  const promptTokens = countTokens(prompt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-[12px]">
        Cria resumos dos atendimentos anteriores do lead e compacta o chat atual quando ultrapassa o limite de palavras. Os resumos são gerados somente quando necessário — se um atendimento já possui resumo salvo, ele é reutilizado automaticamente.
      </div>

      {/* Prompt configuration */}
      <div className="space-y-2">
        <Label>Configuração do Resumo</Label>
        <button
          type="button"
          onClick={() => {
            setDraftPrompt(prompt);
            setPromptOpen(true);
          }}
          className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 hover:bg-muted/40 text-left"
        >
          <div className="flex items-start gap-3 min-w-0">
            <FileText className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium">Prompt de Resumo</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {prompt ? prompt.slice(0, 80) : "Clique para configurar..."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground">{promptTokens} tokens</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </div>

      {/* Model selector */}
      <div className="space-y-2">
        <Label>Modelo de IA</Label>
        <Select value={model} onValueChange={(v) => update({ model: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{modelMeta.info}</span>
          <HelpCircle className="h-3 w-3 text-primary shrink-0" />
          <span className="text-primary">O que são esses valores?</span>
        </div>
      </div>

      {/* Previous attendances slider */}
      <div className="space-y-2">
        <Label>Atendimentos anteriores no resumo: {previous}</Label>
        <Slider
          min={0}
          max={10}
          step={1}
          value={[previous]}
          onValueChange={(v) => update({ previousAttendances: v[0] })}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Quantidade máxima de atendimentos anteriores cujos resumos serão incluídos no contexto. Se o atendimento anterior já possui resumo salvo, ele é reutilizado. Caso contrário, o resumo é gerado na hora e salvo para uso futuro.
        </p>
      </div>

      {/* Word limit slider */}
      <div className="space-y-2">
        <Label>Limite de palavras do chat atual: {wordLimit.toLocaleString("pt-BR")}</Label>
        <Slider
          min={3000}
          max={60000}
          step={1000}
          value={[wordLimit]}
          onValueChange={(v) => update({ currentChatWordLimit: v[0] })}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>3.000</span>
          <span>31.000</span>
          <span>60.000</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Quando o chat atual ultrapassa esse limite, as mensagens mais antigas são resumidas automaticamente para reduzir o contexto. A cada vez que o acumulado a partir do último resumo atinge o limite, um novo resumo é gerado.
        </p>
      </div>

      {/* Recent interactions slider */}
      <div className="space-y-2">
        <Label>Interações recentes mantidas na íntegra: {recent}</Label>
        <Slider
          min={5}
          max={50}
          step={1}
          value={[recent]}
          onValueChange={(v) => update({ recentInteractionsKept: v[0] })}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>5</span>
          <span>25</span>
          <span>50</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Quantidade de mensagens recentes que ficam na íntegra após o resumo, mantendo a conversa natural para a IA. O sistema garante que pelo menos 30% das mensagens sejam de cada participante (usuário e assistente), ajustando automaticamente se necessário para preservar o contexto do diálogo.
        </p>
      </div>

      {/* How it works */}
      <Accordion type="single" collapsible>
        <AccordionItem value="how">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Como funciona
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-[12px] space-y-3">
              <div>
                <div className="font-medium">Resumo inteligente — só executa quando necessário</div>
                <p className="text-muted-foreground">
                  O node não gera resumos em toda interação. Ele avalia o estado atual e decide se precisa agir.
                </p>
              </div>
              <div>
                <div className="font-medium">1. Atendimentos anteriores</div>
                <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                  <li>Busca os últimos N atendimentos do lead (configurável pelo slider).</li>
                  <li>Se o atendimento já possui resumo salvo, ele é reutilizado diretamente — sem custo de IA.</li>
                  <li>Se o atendimento não possui resumo, a IA gera um na hora e salva no atendimento para uso futuro.</li>
                </ul>
              </div>
              <div>
                <div className="font-medium">2. Chat atual (compactação de contexto)</div>
                <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                  <li>Monitora a quantidade de palavras acumuladas no chat atual.</li>
                  <li>Quando o acumulado ultrapassa o limite de palavras, as mensagens mais antigas são resumidas.</li>
                  <li>A cada vez que o novo acumulado (após o último resumo) atinge novamente o limite, um novo resumo é gerado, substituindo o anterior.</li>
                  <li>As últimas N interações (configurável) são sempre mantidas na íntegra após o resumo, garantindo que a IA tenha contexto natural do diálogo mais recente.</li>
                  <li>O sistema garante que pelo menos 30% das mensagens mantidas sejam de cada participante (usuário e assistente), ajustando o offset automaticamente para preservar o contexto do diálogo.</li>
                </ul>
              </div>
              <div>
                <div className="font-medium">Variáveis dinâmicas no prompt</div>
                <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                  <li><code>{"{{lead.name}}"}</code> — Nome do lead</li>
                  <li><code>{"{{memory.campo}}"}</code> — Valor da memória de atendimento</li>
                  <li><code>{"{{node-X.output.campo}}"}</code> — Resultado de outro node</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Prompt editor dialog */}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prompt de Resumo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              placeholder={"Resuma a conversa entre o assistente e o lead, destacando intenções, dúvidas e próximos passos..."}
              rows={12}
              className="font-mono text-[12px]"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Você pode usar variáveis como {"{{lead.name}}"}, {"{{memory.campo}}"}</span>
              <span>{countTokens(draftPrompt)} tokens</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptOpen(false)}>CANCELAR</Button>
            <Button onClick={() => { update({ prompt: draftPrompt }); setPromptOpen(false); }}>SALVAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}