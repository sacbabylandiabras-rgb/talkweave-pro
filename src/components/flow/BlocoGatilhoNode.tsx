import { Handle, Position } from "reactflow";
import { Key } from "lucide-react";

export function BlocoGatilhoNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-purple-500 bg-card min-w-[200px]">
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-purple-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-purple-500" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-purple-500/10">
          <Key className="h-4 w-4 text-purple-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          {data.keyword && (
            <div className="text-xs text-muted-foreground mt-1">
              🔑 {data.keyword}
            </div>
          )}
          {data.description && !data.keyword && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {data.description}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-purple-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-purple-500" />
    </div>
  );
}
