import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Brain, ChevronRight, Database, Info, Trash2 } from "lucide-react";

export type MemoryField = {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  default: string;
  description: string;
};

const MEMORY_TYPES: { value: MemoryField["type"]; label: string }[] = [
  { value: "string", label: "Texto (string)" },
  { value: "number", label: "Número (number)" },
  { value: "boolean", label: "Booleano (boolean)" },
  { value: "object", label: "Objeto (object)" },
  { value: "array", label: "Array (array)" },
];

function buildMemoryPreview(fields: MemoryField[]) {
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    const key = f.name?.trim() || "campo";
    let val: unknown = "";
    switch (f.type) {
      case "number":
        val = f.default !== "" ? Number(f.default) || 0 : 0;
        break;
      case "boolean":
        val = f.default === "true";
        break;
      case "object":
        val = {};
        break;
      case "array":
        val = [];
        break;
      default:
        val = f.default ?? "";
    }
    obj[key] = val;
  }
  return JSON.stringify(obj, null, 2);
}

type Variant = "atendimento" | "lead" | "projeto";

const LEAD_STANDARD_FIELDS: Array<{ name: string; label: string; description: string }> = [
  { name: "name", label: "name", description: "Nome" },
  { name: "email", label: "email", description: "E-mail" },
  { name: "phone", label: "phone", description: "Telefone" },
  { name: "document", label: "document", description: "CPF/CNPJ" },
  { name: "origin", label: "origin", description: "Origem" },
  { name: "notes", label: "notes", description: "Observações" },
];

const VARIANT_COPY: Record<Variant, { title: string; intro: string; scope: string }> = {
  atendimento: {
    title: "Memória de Atendimento",
    intro:
      "Salva dados na memória do atendimento atual. Estes dados são perdidos quando o atendimento finaliza.",
    scope:
      "Esta estrutura é compartilhada entre todos os leads e atendimentos deste projeto. Cada node Salvar Memória poderá modificar campos específicos desta estrutura.",
  },
  lead: {
    title: "Memória de Lead",
    intro:
      "Salva dados no cadastro do lead. Os valores ficam disponíveis em todos os atendimentos do mesmo contato.",
    scope:
      "Esta estrutura é compartilhada entre todos os leads deste projeto. Cada node poderá modificar campos específicos do lead.",
  },
  projeto: {
    title: "Memória de Projeto",
    intro:
      "Salva dados globais do projeto, visíveis para todos os leads e atendimentos.",
    scope:
      "Esta estrutura é compartilhada por todo o projeto. Cada node poderá modificar campos específicos da memória de projeto.",
  },
};

export function MemoriaAtendimentoEditor({
  data,
  onChange,
  variant = "atendimento",
}: {
  data: any;
  onChange: (patch: Record<string, unknown>) => void;
  variant?: Variant;
}) {
  const copy = VARIANT_COPY[variant];
  const stored: MemoryField[] = Array.isArray(data?.memoryStructure)
    ? data.memoryStructure
    : [];
  const fieldsToModify: Array<{ name: string; value: string }> = Array.isArray(
    data?.memoryFieldsToModify,
  )
    ? data.memoryFieldsToModify
    : [];

  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<MemoryField[]>(stored);

  useEffect(() => {
    if (open) {
      setDraft(
        stored.length > 0
          ? stored
          : [{ name: "campo_1", type: "string", default: "", description: "" }],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateField = (idx: number, patch: Partial<MemoryField>) =>
    setDraft((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const removeField = (idx: number) =>
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  const addField = () =>
    setDraft((prev) => [
      ...prev,
      {
        name: `campo_${prev.length + 1}`,
        type: "string",
        default: "",
        description: "",
      },
    ]);

  const saveStructure = () => {
    // Drop any fields-to-modify that no longer exist in the structure
    const allowed = new Set(draft.map((f) => f.name).filter(Boolean));
    const pruned = fieldsToModify.filter((m) => allowed.has(m.name));
    onChange({ memoryStructure: draft, memoryFieldsToModify: pruned });
    setOpen(false);
  };

  const available = stored.filter(
    (f) => f.name && !fieldsToModify.some((m) => m.name === f.name),
  );

  const toggleField = (name: string) => {
    const def = stored.find((f) => f.name === name)?.default ?? "";
    onChange({
      memoryFieldsToModify: [...fieldsToModify, { name, value: def }],
    });
  };

  const updateModifyValue = (name: string, value: string) =>
    onChange({
      memoryFieldsToModify: fieldsToModify.map((m) =>
        m.name === name ? { ...m, value } : m,
      ),
    });

  const removeModify = (name: string) =>
    onChange({
      memoryFieldsToModify: fieldsToModify.filter((m) => m.name !== name),
    });

  // ---- Variant: Memória de Lead ----
  if (variant === "lead") {
    return (
      <LeadMemoryEditor
        fieldsToModify={fieldsToModify}
        onAdd={(name) => {
          if (!name || fieldsToModify.some((m) => m.name === name)) return;
          onChange({
            memoryFieldsToModify: [...fieldsToModify, { name, value: "" }],
          });
        }}
        onUpdate={updateModifyValue}
        onRemove={removeModify}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-[12px]">
        {copy.intro}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Estrutura da Memória</Label>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Brain className="h-4 w-4 mr-2" /> Editor Estrutura da {copy.title}
          </Button>
        </div>

        {stored.length === 0 ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[12px]">
            <div className="font-medium text-amber-200">Estrutura não definida</div>
            <div className="text-amber-100/80">
              Clique em "Editor Estrutura" para definir os campos da memória.
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] text-muted-foreground mb-2">
              Preview da estrutura
            </div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap text-foreground">
              {buildMemoryPreview(stored)}
            </pre>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Campos a Modificar</Label>
          <Button
            variant="outline"
            size="sm"
            disabled={stored.length === 0 || available.length === 0}
            onClick={() => setAddOpen(true)}
          >
            + Adicionar Campo
          </Button>
        </div>

        {fieldsToModify.length === 0 ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-[12px]">
            Nenhum campo selecionado. Use o botão "Adicionar Campo" para selecionar
            campos.
          </div>
        ) : (
          <ul className="space-y-2">
            {fieldsToModify.map((m) => {
              const meta = stored.find((f) => f.name === m.name);
              return (
                <li
                  key={m.name}
                  className="rounded-md border border-border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]">
                      <code className="font-mono">{m.name}</code>{" "}
                      <span className="text-muted-foreground">
                        ({meta?.type ?? "string"})
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeModify(m.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={m.value}
                    onChange={(e) => updateModifyValue(m.name, e.target.value)}
                    placeholder="Valor ou variável dinâmica"
                  />
                  {meta?.description && (
                    <p className="text-[11px] text-muted-foreground">
                      {meta.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="how">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Como funciona
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-[12px] space-y-2">
              <p>{copy.scope}</p>
              <div>
                <div className="font-medium">Acessando a memória</div>
                <p className="text-muted-foreground">
                  Use <code>{"{{memory.nome_do_campo}}"}</code> em outros nodes
                  para acessar os valores salvos.
                </p>
              </div>
              <div>
                <div className="font-medium">Variáveis dinâmicas nos valores</div>
                <ul className="list-disc pl-4 text-muted-foreground">
                  <li>
                    <code>{"{{lead.name}}"}</code> — Nome do lead
                  </li>
                  <li>
                    <code>{"{{node-X.output.campo}}"}</code> — Resultado de outro
                    node
                  </li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Add field selector */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Campo</DialogTitle>
          </DialogHeader>
          {available.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
              Todos os campos da estrutura já foram adicionados.
            </div>
          ) : (
            <ul className="space-y-1 max-h-[40vh] overflow-y-auto">
              {available.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    onClick={() => {
                      toggleField(f.name);
                      setAddOpen(false);
                    }}
                    className="w-full flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 hover:bg-muted/40 text-left"
                  >
                    <span className="text-[12px]">
                      <code className="font-mono">{f.name}</code>{" "}
                      <span className="text-muted-foreground">({f.type})</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Structure editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Estrutura da {copy.title}</DialogTitle>
          </DialogHeader>

          <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-[12px]">
            {copy.scope}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              <span className="font-medium">Estrutura de Dados (JSON Schema)</span>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {draft.map((f, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] gap-2 items-center"
                >
                  <Input
                    value={f.name}
                    onChange={(e) => updateField(idx, { name: e.target.value })}
                    placeholder="campo"
                    className="h-9"
                  />
                  <Select
                    value={f.type}
                    onValueChange={(v) =>
                      updateField(idx, { type: v as MemoryField["type"] })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={f.default}
                    onChange={(e) => updateField(idx, { default: e.target.value })}
                    placeholder="Valor padrão"
                    className="h-9"
                  />
                  <Input
                    value={f.description}
                    onChange={(e) =>
                      updateField(idx, { description: e.target.value })
                    }
                    placeholder="Descrição"
                    className="h-9"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeField(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addField}
              className="w-full rounded-md border border-dashed border-border py-2 text-[12px] text-muted-foreground hover:bg-muted/30 flex items-center justify-center gap-2"
            >
              <span className="text-base leading-none">+</span> Clique aqui para
              adicionar um campo na estrutura da memória
            </button>

            <div className="space-y-2">
              <div className="text-[12px] font-medium">Preview da estrutura:</div>
              <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap">
                {buildMemoryPreview(draft)}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              CANCELAR
            </Button>
            <Button onClick={saveStructure}>SALVAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}