import { Handle, Position } from "reactflow";
import { Reply } from "lucide-react";

export function IGRespostaNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-orange-500 bg-card min-w-[200px] max-w-[260px]">
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-orange-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-orange-500" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-orange-500/10">
          <Reply className="h-4 w-4 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Responder Comentário"}
          </div>
        </div>
      </div>
      {data.message ? (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/40 rounded whitespace-pre-wrap break-words">
          💬 {data.message}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/50 mt-2 p-2 bg-muted/20 rounded italic">
          Clique para editar a mensagem
        </div>
      )}
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-orange-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-orange-500" />
    </div>
  );
}