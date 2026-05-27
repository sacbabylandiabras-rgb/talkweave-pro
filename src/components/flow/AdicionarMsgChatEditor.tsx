import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MessageSquarePlus, User, Phone, Mail, Box, BrainCircuit, Info } from "lucide-react";

const VAR_PRESETS = [
  { icon: User, value: "{{lead.name}}", title: "Nome do lead" },
  { icon: Phone, value: "{{lead.phone}}", title: "Telefone do lead" },
  { icon: Mail, value: "{{lead.email}}", title: "E-mail do lead" },
  { icon: Box, value: "{{node.}}", title: "Saída de outro node" },
  { icon: BrainCircuit, value: "{{memory.}}", title: "Variável de memória" },
];

export function AdicionarMsgChatEditor({
  data,
  onChange,
}: {
  data: any;
  onChange: (patch: any) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const template: string = data?.chatTemplate ?? data?.actionConfig ?? "";

  const update = (next: string) => {
    onChange({
      actionType: "add_chat_message",
      chatTemplate: next,
      actionConfig: next,
    });
  };

  const insert = (v: string) => {
    const el = inputRef.current;
    if (!el) {
      update((template || "") + v);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + v + template.slice(end);
    update(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + v.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">Adicionar Msg ao Chat</span>
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        Crie um template de mensagem usando variáveis dinâmicas. A mensagem formatada será inserida na
        conversa quando o fluxo passar por este bloco.
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[12px]">Template da mensagem</Label>
          <div className="flex items-center gap-0.5">
            {VAR_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={`${p.title} — ${p.value}`}
                onClick={() => insert(p.value)}
                className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <p.icon className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
        <Input
          ref={inputRef}
          value={template}
          onChange={(e) => update(e.target.value)}
          placeholder="Olá {{lead.name}}! Pedido #{{node-2.output.order_id}} confirmado."
          className="h-9 text-[12px] font-mono"
        />
        <p className="text-[10.5px] text-muted-foreground">
          Use variáveis dinâmicas como {"{{node.path}}"} ou {"{{lead.campo}}"}.
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
              O template será processado substituindo as variáveis pelos valores reais. A mensagem
              formatada será salva no array de mensagens do fluxo.
            </p>
            <p className="text-[11.5px] font-medium text-foreground mt-3 mb-1">
              Variáveis disponíveis:
            </p>
            <ul className="space-y-1 text-[11.5px] text-muted-foreground">
              <li>
                <code className="text-foreground">{"{{lead.name}}"}</code> — Nome do lead
              </li>
              <li>
                <code className="text-foreground">{"{{lead.phone}}"}</code> — Telefone do lead
              </li>
              <li>
                <code className="text-foreground">{"{{lead.email}}"}</code> — E-mail do lead
              </li>
              <li>
                <code className="text-foreground">{"{{node-X.output.campo}}"}</code> — Resultado de outro node
              </li>
              <li>
                <code className="text-foreground">{"{{memory.campo}}"}</code> — Dados salvos no momento
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}