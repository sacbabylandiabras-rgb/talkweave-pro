import { Handle, Position } from "reactflow";
import { Clock } from "lucide-react";

export function IGDelayNode({ data }: any) {
  const value = data.delayValue || 0;
  const unit = data.delayUnit || "seconds";
  const unitLabel = unit === "minutes" ? "min" : unit === "hours" ? "h" : "seg";

  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[180px]">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-orange-500/90 text-white rounded-md">
        Espera
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-orange-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-orange-500" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-orange-500/10">
          <Clock className="h-4 w-4 text-orange-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Espera"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            ⏱ {value} {unitLabel}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-orange-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-orange-500" />
    </div>
  );
}
