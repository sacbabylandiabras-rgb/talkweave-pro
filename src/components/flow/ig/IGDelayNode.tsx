import { Handle, Position } from "reactflow";
import { Clock } from "lucide-react";

export function IGDelayNode({ data }: any) {
  const value = data.delayValue || 0;
  const unit = data.delayUnit || "seconds";
  const unitLabel = unit === "minutes" ? "min" : unit === "hours" ? "h" : "seg";

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-yellow-500 bg-card min-w-[180px]">
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-yellow-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-yellow-500" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-yellow-500/10">
          <Clock className="h-4 w-4 text-yellow-500" />
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
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-yellow-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-yellow-500" />
    </div>
  );
}