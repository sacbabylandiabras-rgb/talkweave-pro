import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Building2,
  Ticket as TicketIcon,
  CalendarDays,
  Receipt,
  MessagesSquare,
  Mail,
  StickyNote,
  Database,
  Info,
} from "lucide-react";

type ResourceType =
  | "deals"
  | "companies"
  | "tickets"
  | "agenda"
  | "transactions"
  | "conversations"
  | "emails"
  | "notes";

const RESOURCES: {
  id: ResourceType;
  label: string;
  description: string;
  icon: any;
  singular: string;
  plural: string;
}[] = [
  { id: "deals", label: "Negócios", description: "Cards do pipeline de vendas (kanban)", icon: Briefcase, singular: "Negócio", plural: "Negócios" },
  { id: "companies", label: "Empresas", description: "Empresas vinculadas ao lead", icon: Building2, singular: "Empresa", plural: "Empresas" },
  { id: "tickets", label: "Tickets", description: "Tickets de suporte abertos pelo lead", icon: TicketIcon, singular: "Ticket", plural: "Tickets" },
  { id: "agenda", label: "Eventos da Agenda", description: "Compromissos e agendamentos do lead", icon: CalendarDays, singular: "Evento", plural: "Eventos" },
  { id: "transactions", label: "Transações", description: "Histórico de compras e pagamentos", icon: Receipt, singular: "Transação", plural: "Transações" },
  { id: "conversations", label: "Atendimentos", description: "Histórico de conversas em chat", icon: MessagesSquare, singular: "Atendimento", plural: "Atendimentos" },
  { id: "emails", label: "Emails", description: "Trocas de emails com o lead", icon: Mail, singular: "Email", plural: "Emails" },
  { id: "notes", label: "Notas e Observações", description: "Anotações e observações do lead", icon: StickyNote, singular: "Nota", plural: "Notas" },
];

export type ListCrmConfig = {
  resourceType: ResourceType;
  limit: number;
  order: "desc" | "asc";
};

const DEFAULT: ListCrmConfig = { resourceType: "deals", limit: 10, order: "desc" };

export function ListarDadosCrmEditor({
  data,
  onChange,
}: {
  data: any;
  onChange: (patch: any) => void;
}) {
  const cfg: ListCrmConfig = useMemo(() => {
    try {
      const raw = data?.actionConfig;
      if (raw && typeof raw === "string") {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT, ...parsed };
      }
    } catch {}
    return DEFAULT;
  }, [data?.actionConfig]);

  const current = RESOURCES.find((r) => r.id === cfg.resourceType) || RESOURCES[0];

  const update = (patch: Partial<ListCrmConfig>) => {
    const next: ListCrmConfig = { ...cfg, ...patch };
    onChange({
      actionType: "crm_list_records",
      actionConfig: JSON.stringify(next),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">Listar Dados CRM</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12px]">Tipo de recurso</Label>
        <Select
          value={cfg.resourceType}
          onValueChange={(v) => update({ resourceType: v as ResourceType })}
        >
          <SelectTrigger className="h-auto py-2">
            <SelectValue>
              <div className="flex items-center gap-2 text-left">
                <current.icon className="h-4 w-4 text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[12.5px] font-medium leading-tight">{current.label}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{current.description}</span>
                </div>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RESOURCES.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <div className="flex items-center gap-2">
                  <r.icon className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[12.5px] font-medium leading-tight">{r.label}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight">{r.description}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[12px]">Quantidade</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={cfg.limit}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "" && !/^\d+$/.test(val)) return;
                const n = Math.max(1, Math.min(50, Number(val) || 1));
                update({ limit: n });
              }}
              className="h-7 w-16 text-[12px] text-right"
            />
          </div>
          <Slider
            min={1}
            max={50}
            step={1}
            value={[cfg.limit]}
            onValueChange={(v) => update({ limit: v[0] ?? 10 })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[12px]">Ordenação</Label>
          <Select value={cfg.order} onValueChange={(v) => update({ order: v as "desc" | "asc" })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Mais recentes primeiro</SelectItem>
              <SelectItem value="asc">Mais antigos primeiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-[11.5px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <p className="leading-relaxed">
          Ao executar este bloco vai buscar até{" "}
          <span className="font-semibold text-foreground">{cfg.limit} {current.plural}</span>{" "}
          vinculados ao lead do atendimento, ordenados por{" "}
          <span className="font-semibold text-foreground">
            {cfg.order === "desc" ? "data mais recente" : "data mais antiga"}
          </span>
          . Os dados ficarão disponíveis para os próximos blocos via{" "}
          <code className="px-1 py-0.5 rounded bg-background border border-border text-[10.5px] text-foreground">
            {"{{node.id.lista}}"}
          </code>
          .
        </p>
      </div>
    </div>
  );
}