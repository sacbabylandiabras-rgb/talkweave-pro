import { Handle, Position } from "reactflow";
import { Key, Webhook } from "lucide-react";

export function BlocoGatilhoNode({ data }: any) {
  const isWebhook = !!data.isWebhook;
  
  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] glass-card !overflow-visible z-50">
      <span className={`absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal ${isWebhook ? 'bg-indigo-600' : (data.isTelegram ? 'bg-blue-600' : 'bg-primary/90')} text-white rounded-md flex items-center gap-1`}>
        {isWebhook && <Webhook className="w-3 h-3" />}
        {isWebhook ? "Gatilho Webhook" : (data.isTelegram ? "Gatilho Telegram" : "Gatilho")}
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ left: -8 }} />
      <Handle type="target" position={Position.Top} id="target-top" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ top: -8 }} />
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded ${isWebhook ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-primary/10'}`}>
          {isWebhook ? (
            <Webhook className={`h-4 w-4 ${isWebhook ? 'text-indigo-600 dark:text-indigo-400' : 'text-primary'}`} />
          ) : (
            <Key className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          {(() => {
            const raw = data.keywords;
            if (!raw) return null;
            const list = Array.isArray(raw)
              ? raw.filter((k: unknown): k is string => typeof k === "string" && k.trim().length > 0)
              : typeof raw === "string"
                ? raw.split(",").map((k) => k.trim()).filter(Boolean)
                : [];
            if (list.length === 0) return null;
            return (
              <div className="mt-1">
                <div className="text-[10px] text-muted-foreground mb-1">
                  {data.matchType === "exact" ? "🔑 Exato" : "🔑 Contém"}
                </div>
                <div className="flex flex-wrap gap-1">
                  {list.map((kw, idx) => (
                    <span
                      key={`${kw}-${idx}`}
                      className="inline-block px-2 py-0.5 bg-primary/15 text-primary rounded text-xs font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
          {data.description && !data.keywords && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {data.description}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="source-right" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ right: -8 }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ bottom: -8 }} />
    </div>
  );
}
