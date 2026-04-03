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
          {data.keywords && (
            <div className="text-xs text-muted-foreground mt-1">
              🔑 {data.keywords}
            </div>
          )}
          {!data.keywords && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Comentário no post
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-pink-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-pink-500" />
    </div>
  );
}