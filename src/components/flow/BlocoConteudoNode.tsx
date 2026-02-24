import { Handle, Position } from "reactflow";
import { MessageSquare } from "lucide-react";

export function BlocoConteudoNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-blue-500 bg-card min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-blue-500/10">
          <MessageSquare className="h-4 w-4 text-blue-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          {data.content && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {data.content}
            </div>
          )}
          {data.buttonLabel && (
            <div className="text-[10px] text-primary mt-1 flex items-center gap-1">
              🔗 {data.buttonLabel}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500"
      />
    </div>
  );
}
