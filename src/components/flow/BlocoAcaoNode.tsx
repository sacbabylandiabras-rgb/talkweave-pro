import { Handle, Position } from "reactflow";
import { Zap } from "lucide-react";

export function BlocoAcaoNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-green-500 bg-card min-w-[200px]">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-green-500"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-green-500/10">
          <Zap className="h-4 w-4 text-green-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          {data.actionType && (
            <div className="text-xs text-muted-foreground mt-1">
              {data.actionType}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-green-500"
      />
    </div>
  );
}
