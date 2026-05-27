import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Briefcase,
  Ticket as TicketIcon,
  CheckSquare,
  StickyNote,
  Plus,
  Info,
} from "lucide-react";

type RecordType = "deal" | "ticket" | "task" | "note";

const TYPES: { id: RecordType; label: string; icon: any }[] = [
  { id: "deal", label: "Negócio", icon: Briefcase },
  { id: "ticket", label: "Ticket", icon: TicketIcon },
  { id: "task", label: "Tarefa", icon: CheckSquare },
  { id: "note", label: "Anotação", icon: StickyNote },
];

const PRIORITIES = [
  { value: "baixa", label: "Baixa", color: "bg-emerald-500" },
  { value: "normal", label: "Normal", color: "bg-amber-400" },
  { value: "media", label: "Média", color: "bg-orange-500" },
  { value: "alta", label: "Alta", color: "bg-red-500" },
  { value: "urgente", label: "Urgente", color: "bg-purple-600" },
];

const TASK_TYPES = [
  { value: "todo", label: "To-do" },
  { value: "call", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "followup", label: "Follow up" },
  { value: "meeting", label: "Reunião" },
];

export type CrmRecordConfig = {
  recordType: RecordType;
  kanbanId?: string;
  kanbanName?: string;
  priority?: string;
  taskType?: string;
  title?: string;
  description?: string;
};

export function CriarRegistroCrmEditor({
  data,
  onChange,
}: {
  data: any;
  onChange: (patch: any) => void;
}) {
  const cfg: CrmRecordConfig = data?.crmRecord || { recordType: "deal" };
  const [kanbanDialog, setKanbanDialog] = useState(false);
  const [newKanban, setNewKanban] = useState("");

  const update = (patch: Partial<CrmRecordConfig>) => {
    const next = { ...cfg, ...patch };
    onChange({
      actionType: "crm_create_record",
      crmRecord: next,
      actionConfig: JSON.stringify(next),
    });
  };

  const insertVar = (target: "title" | "description", v: string) => {
    update({ [target]: ((cfg as any)[target] || "") + v } as any);
  };

  const VarBar = ({ target }: { target: "title" | "description" }) => (
    <div className="flex items-center gap-1">
      {[
        { v: "{{lead.name}}", l: "lead" },
        { v: "{{lead.email}}", l: "email" },
        { v: "{{memory.}}", l: "memória" },
        { v: "{{node.}}", l: "nó" },
      ].map((b) => (
        <button
          key={b.v}
          type="button"
          onClick={() => insertVar(target, b.v)}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted/40"
          title={`Inserir ${b.v}`}
        >
          {b.l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">Criar Registro CRM</span>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Cria um registro no CRM ou uma anotação e vincula automaticamente ao lead do atendimento.
      </p>

      <div>
        <Label className="text-[12px]">Tipo de registro</Label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = cfg.recordType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ recordType: t.id })}
                className={`flex flex-col items-center justify-center gap-1 rounded-md border px-2 py-2.5 text-[11px] transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-muted/40 text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {cfg.recordType === "deal" && (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[12px]">Kanban de negócios</Label>
              <button
                type="button"
                onClick={() => setKanbanDialog((v) => !v)}
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Adicionar kanban
              </button>
            </div>
            {kanbanDialog ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newKanban}
                  onChange={(e) => setNewKanban(e.target.value)}
                  placeholder="Nome do kanban"
                  className="h-8"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const n = newKanban.trim();
                    if (n) {
                      update({ kanbanId: n.toLowerCase().replace(/\s+/g, "_"), kanbanName: n });
                      setNewKanban("");
                      setKanbanDialog(false);
                    }
                  }}
                  disabled={!newKanban.trim()}
                >
                  OK
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {cfg.kanbanName || "Nenhum kanban selecionado"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Prioridade</Label>
            <Select
              value={cfg.priority || ""}
              onValueChange={(v) => update({ priority: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a prioridade..." />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${p.color}`} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {cfg.recordType === "ticket" && (
        <div className="space-y-1.5">
          <Label className="text-[12px]">Prioridade</Label>
          <Select
            value={cfg.priority || ""}
            onValueChange={(v) => update({ priority: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a prioridade..." />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${p.color}`} />
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {cfg.recordType === "task" && (
        <div className="space-y-1.5">
          <Label className="text-[12px]">Tipo de tarefa</Label>
          <Select
            value={cfg.taskType || "todo"}
            onValueChange={(v) => update({ taskType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[12px]">
            {cfg.recordType === "note" ? "Título (opcional)" : "Título"}
          </Label>
          <VarBar target="title" />
        </div>
        <Input
          value={cfg.title || ""}
          onChange={(e) => update({ title: e.target.value })}
          placeholder={
            cfg.recordType === "note"
              ? "Anotação do atendimento de {{lead.name}}"
              : "{{lead.name}} - Novo registro"
          }
        />
        <p className="text-[11px] text-muted-foreground">
          {cfg.recordType === "note"
            ? "Título da anotação (opcional)."
            : "Título do registro. Use variáveis dinâmicas."}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[12px]">
            {cfg.recordType === "note" ? "Conteúdo da nota" : "Descrição"}
          </Label>
          <VarBar target="description" />
        </div>
        <Textarea
          value={cfg.description || ""}
          onChange={(e) => update({ description: e.target.value })}
          placeholder={
            cfg.recordType === "note"
              ? "Resumo do atendimento: {{lead.name}} solicitou..."
              : "Atendimento automático de {{lead.name}}..."
          }
          rows={4}
        />
        <p className="text-[11px] text-muted-foreground">
          {cfg.recordType === "note"
            ? "Conteúdo da anotação vinculada ao lead. Use variáveis dinâmicas."
            : "Descrição do registro. Texto com variáveis dinâmicas."}
        </p>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="how" className="border rounded-md bg-primary/5 border-primary/30">
          <AccordionTrigger className="px-3 py-2 text-[12px] hover:no-underline">
            <span className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-primary" /> Como funciona
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 text-[11px] space-y-2 text-foreground/80">
            <p>
              O registro é criado substituindo variáveis pelos valores reais e vinculado
              automaticamente ao lead do atendimento.
            </p>
            <div>
              <p className="font-medium mb-1">Variáveis disponíveis:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li><code>{"{{lead.name}}"}</code> — Nome do lead</li>
                <li><code>{"{{lead.email}}"}</code> — E-mail do lead</li>
                <li><code>{"{{node.<id>.<campo>}}"}</code> — Resultado de outro nó</li>
                <li><code>{"{{memory.<campo>}}"}</code> — Dados salvos na memória</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}