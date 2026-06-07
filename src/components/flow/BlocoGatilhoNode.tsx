import { Handle, Position } from "reactflow";
import { Key, Webhook } from "lucide-react";

export function BlocoGatilhoNode({ data }: any) {
  const isWebhook = !!data.isWebhook;

  // Normalizar keywords (pode vir como string ou array)
  const keywords = Array.isArray(data.keywords) ? data.keywords : data.keyword ? [data.keyword] : [];

  const matchType = data.matchType || "contains"; // "exact" ou "contains"

  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] glass-card !overflow-visible z-50">
      <span
        className={`absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal ${isWebhook ? "bg-indigo-600" : data.isTelegram ? "bg-blue-600" : "bg-primary/90"} text-white rounded-md flex items-center gap-1`}
      >
        {isWebhook && <Webhook className="w-3 h-3" />}
        {isWebhook ? "Gatilho Webhook" : data.isTelegram ? "Gatilho Telegram" : "Gatilho"}
      </span>

      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
        style={{ left: -8 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
        style={{ top: -8 }}
      />

      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded ${isWebhook ? "bg-indigo-100 dark:bg-indigo-900/30" : "bg-primary/10"}`}>
          {isWebhook ? (
            <Webhook className={`h-4 w-4 ${isWebhook ? "text-indigo-600 dark:text-indigo-400" : "text-primary"}`} />
          ) : (
            <Key className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">{data.label}</div>

          {/* ✅ NOVO: Mostrar keywords com tipo de matching */}
          {keywords.length > 0 && (
            <div className="mt-1.5 space-y-1">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {matchType === "exact" ? "🎯 Palavra exata:" : "🔍 Contém:"}
              </div>
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 bg-primary/15 dark:bg-primary/20 border border-primary/30 rounded-md text-[10px] font-semibold text-primary whitespace-nowrap"
                  >
                    "{kw}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fallback para descrição se não houver keywords */}
          {keywords.length === 0 && data.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{data.description}</div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
        style={{ right: -8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
        style={{ bottom: -8 }}
      />
    </div>
  );
}
