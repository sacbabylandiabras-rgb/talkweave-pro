import { Handle, Position } from "reactflow";
import { Bot, Sparkles, MessageSquare } from "lucide-react";

export function BlocoAgenteIANode({ data }: any) {
  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] max-w-[280px] glass-card">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-purple-500 text-white rounded-md flex items-center gap-1">
        <Bot className="w-3 h-3" /> Agente IA
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-purple-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-purple-500" />
      
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-purple-500/10">
          <Sparkles className="h-4 w-4 text-purple-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Agente Inteligente"}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            Processamento via IA
          </div>
        </div>
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

      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-purple-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-purple-500" />
    </div>
  );
}