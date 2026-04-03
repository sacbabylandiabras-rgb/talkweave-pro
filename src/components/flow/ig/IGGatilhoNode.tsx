import { Handle, Position } from "reactflow";
import { MessageCircle } from "lucide-react";

export function IGGatilhoNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-pink-500 bg-card min-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-pink-500/10">
          <MessageCircle className="h-4 w-4 text-pink-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Gatilho"}
          </div>
        </div>
      </div>
      {data.keywords ? (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/40 rounded whitespace-pre-wrap break-words">
          🔑 {data.keywords}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/50 mt-2 p-2 bg-muted/20 rounded italic">
          Qualquer comentário
        </div>
      )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-pink-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-pink-500" />
    </div>
  );
}