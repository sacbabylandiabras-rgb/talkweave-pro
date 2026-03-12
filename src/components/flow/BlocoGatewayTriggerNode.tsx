import { Handle, Position } from "reactflow";
import { Webhook } from "lucide-react";

export function BlocoGatewayTriggerNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-primary bg-card min-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <Webhook className="h-4 w-4 text-primary" />
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
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 !bg-primary" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 !bg-primary" />
    </div>
  );
}
