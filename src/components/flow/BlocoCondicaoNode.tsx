import { Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";

export function BlocoCondicaoNode({ data }: any) {
  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] glass-card">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-primary/90 text-white rounded-md">
        Condição
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg" style={{ left: -10 }} />
      <Handle type="target" position={Position.Top} id="target-top" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg" style={{ top: -10 }} />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <GitBranch className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          {data.condition && (
            <div className="text-xs text-muted-foreground mt-1">
              {data.condition}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="a" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg" style={{ top: "35%", right: -10 }} />
      <Handle type="source" position={Position.Right} id="b" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg" style={{ top: "65%", right: -10 }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-4 h-4 !bg-primary !border-2 !border-background shadow-lg" style={{ bottom: -10 }} />
    </div>
  );
}
