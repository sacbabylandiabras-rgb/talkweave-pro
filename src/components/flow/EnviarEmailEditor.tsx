import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Mail, Plus, Inbox, User, Phone, Box, BrainCircuit, Info } from "lucide-react";

const VAR_PRESETS = [
  { icon: User, value: "{{lead.name}}", title: "Nome do lead" },
  { icon: Phone, value: "{{lead.phone}}", title: "Telefone do lead" },
  { icon: Mail, value: "{{lead.email}}", title: "E-mail do lead" },
  { icon: Box, value: "{{node.}}", title: "Saída de outro node" },
  { icon: BrainCircuit, value: "{{memory.}}", title: "Variável de memória" },
];

export type EmailConfig = {
  mailbox?: string;
  to: string;
  subject: string;
  body: string;
};

function VarToolbar({ onInsert }: { onInsert: (v: string) => void }) {
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

export function EnviarEmailEditor({
  data,
  onChange,
  mailboxes = [],
  onCreateMailbox,
}: {
  data: any;
  onChange: (patch: any) => void;
  mailboxes?: { id: string; label: string }[];
  onCreateMailbox?: () => void;
}) {
  const cfg: EmailConfig = (() => {
    try {
      const raw = data?.actionConfig;
      if (raw && typeof raw === "string") {
        const parsed = JSON.parse(raw);
        return { mailbox: "", to: "", subject: "", body: "", ...parsed };
      }
    } catch {}
    return { mailbox: "", to: "", subject: "", body: "" };
  })();

  const toRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const update = (patch: Partial<EmailConfig>) => {
    const next = { ...cfg, ...patch };
    onChange({
      actionType: "send_email",
      actionConfig: JSON.stringify(next),
    });
  };

  const insertInto = (
    field: "to" | "subject" | "body",
    el: HTMLInputElement | HTMLTextAreaElement | null,
    value: string,
  ) => {
    const current = (cfg[field] as string) || "";
    if (!el) {
      update({ [field]: current + value } as any);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + value + current.slice(end);
    update({ [field]: next } as any);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + value.length;
      (el as any).setSelectionRange?.(pos, pos);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">Enviar Email</span>
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        Configure a caixa postal de envio, destinatário, assunto e corpo do email. Use variáveis
        dinâmicas nos campos de texto.
      </p>

      <div className="space-y-1.5">
        <Label className="text-[12px]">Caixa postal de envio</Label>
        {mailboxes.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
              <Inbox className="h-3.5 w-3.5" />
              Nenhuma caixa postal disponível. Crie um domínio para enviar e-mails.
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCreateMailbox}
              className="h-8 text-[12px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Criar Caixa Postal
            </Button>
          </div>
        ) : (
          <Select value={cfg.mailbox || undefined} onValueChange={(v) => update({ mailbox: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione a caixa postal" />
            </SelectTrigger>
            <SelectContent>
              {mailboxes.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[12px]">Email de destino</Label>
          <VarToolbar onInsert={(v) => insertInto("to", toRef.current, v)} />
        </div>
        <Input
          ref={toRef}
          value={cfg.to}
          onChange={(e) => update({ to: e.target.value })}
          placeholder="{{lead.email}}"
          className="h-9 text-[12px] font-mono"
        />
        <p className="text-[10.5px] text-muted-foreground">
          Email do destinatário. Pode usar variáveis dinâmicas.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[12px]">Assunto do email</Label>
          <VarToolbar onInsert={(v) => insertInto("subject", subjectRef.current, v)} />
        </div>
        <Input
          ref={subjectRef}
          value={cfg.subject}
          onChange={(e) => update({ subject: e.target.value })}
          placeholder="Olá {{lead.name}}, sobre seu pedido #{{node-2.output.order_id}}"
          className="h-9 text-[12px] font-mono"
        />
        <p className="text-[10.5px] text-muted-foreground">
          Assunto do email com variáveis dinâmicas.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[12px]">Corpo do email</Label>
          <VarToolbar onInsert={(v) => insertInto("body", bodyRef.current, v)} />
        </div>
        <Textarea
          ref={bodyRef}
          value={cfg.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Olá {{lead.name}}, Segue o resumo do seu pedido..."
          className="min-h-[120px] text-[12px] font-mono"
        />
        <p className="text-[10.5px] text-muted-foreground">
          Se a variável retornar HTML, ele será respeitado. Se for texto plano, a formatação será
          mantida e convertida em HTML automaticamente.
        </p>
      </div>

      <Accordion type="single" collapsible defaultValue="info">
        <AccordionItem value="info" className="border border-border rounded-md bg-muted/20">
          <AccordionTrigger className="px-3 py-2 hover:no-underline">
            <div className="flex items-center gap-2 text-[12px] font-medium">
              <Info className="h-3.5 w-3.5 text-primary" />
              Como funciona
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Este operador monta o email substituindo as variáveis pelos valores reais e grava no
              banco de dados. O envio é feito automaticamente pelo microserviço de emails.
            </p>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-2">
              Se o corpo for texto simples (sem HTML), ele será encapsulado em HTML automaticamente
              antes do envio.
            </p>
            <p className="text-[11.5px] font-medium text-foreground mt-3 mb-1">
              Variáveis disponíveis:
            </p>
            <ul className="space-y-1 text-[11.5px] text-muted-foreground">
              <li>
                <code className="text-foreground">{"{{lead.name}}"}</code> — Nome do lead
              </li>
              <li>
                <code className="text-foreground">{"{{lead.email}}"}</code> — Email do lead
              </li>
              <li>
                <code className="text-foreground">{"{{lead.phone}}"}</code> — Telefone do lead
              </li>
              <li>
                <code className="text-foreground">{"{{node-X.output.campo}}"}</code> — Resultado de
                outro node
              </li>
              <li>
                <code className="text-foreground">{"{{memory.campo}}"}</code> — Dados salvos na
                memória
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}