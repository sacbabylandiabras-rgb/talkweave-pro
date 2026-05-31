import { Handle, Position } from "reactflow";
import { Bot, Sparkles, MessageSquare } from "lucide-react";

export function BlocoAgenteIANode({ data }: any) {
  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[220px] max-w-[300px] glass-card !overflow-visible z-50">
      <span className={`absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal ${data.isTelegram ? 'bg-blue-600' : 'bg-primary/90'} text-white rounded-md flex items-center gap-1`}>
        <Bot className="w-3 h-3" /> {data.isTelegram ? "Agente IA Telegram" : "Agente IA"}
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ left: -8 }} />
      <Handle type="target" position={Position.Top} id="target-top" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ top: -8 }} />
      
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Agente Inteligente"}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {data.model?.includes(':') ? 'Managed Agent' : 'Processamento via IA'}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-[9px] text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          {data.model || "claude-3-5-sonnet-latest"}
        </span>
      </div>

      {data.prompt && (
        <div className="mt-2 p-2 rounded bg-muted/30 border border-border/50">
          <div className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mb-1">
            <MessageSquare className="w-3 h-3" /> Prompt:
          </div>
          <div className="text-[10px] text-muted-foreground line-clamp-3 italic">
            "{data.prompt}"
          </div>
        </div>
      )}
      
      <div className="mt-3 text-[10px] text-muted-foreground bg-purple-50 dark:bg-purple-900/10 p-2 rounded border border-purple-100 dark:border-purple-900/30">
        Este bloco usará IA para responder ao usuário com base no contexto da conversa.
      </div>

      <Handle type="source" position={Position.Right} id="source-right" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ right: -8 }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ bottom: -8 }} />
    </div>
  );
}
