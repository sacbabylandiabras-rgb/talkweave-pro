import { Handle, Position } from "reactflow";
import { Zap } from "lucide-react";

export function BlocoAcaoNode({ data }: any) {
  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] glass-card">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-primary/90 text-white rounded-md">
        Ação
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-primary" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-primary" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
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
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-primary" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-primary" />
    </div>
  );
}
