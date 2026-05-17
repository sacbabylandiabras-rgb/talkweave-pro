import { Handle, Position } from "reactflow";
import { CalendarClock } from "lucide-react";

export function BlocoAgendamentoNode({ data }: any) {
  const scheduleType = data.scheduleType || "once";
  const scheduledAt = data.scheduledAt || "";
  const recurrence = data.recurrencePattern || "";

  const typeLabel = scheduleType === "recurring"
    ? `🔁 ${recurrence || "Recorrente"}`
    : scheduledAt
      ? `📅 ${new Date(scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
      : "Não configurado";

  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] glass-card !overflow-visible">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-primary/90 text-white rounded-md z-[60]">
        Agendamento
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg !z-[70]" style={{ left: -10 }} />
      <Handle type="target" position={Position.Top} id="target-top" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg !z-[70]" style={{ top: -10 }} />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <CalendarClock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Agendamento"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {typeLabel}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="source-right" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg !z-[70]" style={{ right: -10 }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg !z-[70]" style={{ bottom: -10 }} />
    </div>
  );
}
