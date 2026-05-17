import { Handle, Position } from "reactflow";
import { Key } from "lucide-react";

export function BlocoGatilhoNode({ data }: any) {
  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] glass-card !overflow-visible z-50">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-primary/90 text-white rounded-md">
        Gatilho
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="w-4 h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl" style={{ left: -8, zIndex: 100 }} />
      <Handle type="target" position={Position.Top} id="target-top" className="w-4 h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl" style={{ top: -8, zIndex: 100 }} />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <Key className="h-4 w-4 text-primary" />
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
      <Handle type="source" position={Position.Right} id="source-right" className="w-4 h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl" style={{ right: -8, zIndex: 100 }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-4 h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl" style={{ bottom: -8, zIndex: 100 }} />
    </div>
  );
}
