import { Handle, Position } from "reactflow";
import { Webhook } from "lucide-react";

export function BlocoGatewayTriggerNode({ data }: any) {
  return (
    <div className="relative px-4 py-3 pt-5 shadow-lg rounded-lg border-2 border-orange-500 bg-card min-w-[200px]">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white rounded">
        Gateway
      </span>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-orange-500/10">
          <Webhook className="h-4 w-4 text-orange-500" />
        </div>
        <div>
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {data.description || "Webhook recebido"}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 !bg-orange-500" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 !bg-orange-500" />
    </div>
  );
}
