import { Handle, Position } from "reactflow";
import { Webhook } from "lucide-react";

export function BlocoGatewayTriggerNode({ data }: any) {
  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] glass-card !overflow-visible z-50">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-primary/90 text-white rounded-md">
        Gateway
      </span>
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
      <Handle type="target" position={Position.Left} id="target-left" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ left: -8, top: '40%' }} />
      <Handle type="source" position={Position.Left} id="source-left" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ left: -8, top: '60%' }} />
      <Handle type="target" position={Position.Top} id="target-top" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ top: -8, left: '40%' }} />
      <Handle type="source" position={Position.Top} id="source-top" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ top: -8, left: '60%' }} />
      <Handle type="target" position={Position.Right} id="target-right" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ right: -8, top: '40%' }} />
      <Handle type="source" position={Position.Right} id="right" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ right: -8, top: '60%' }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ bottom: -8, left: '40%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ bottom: -8, left: '60%' }} />
    </div>
  );
}
