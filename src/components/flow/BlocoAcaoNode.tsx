import { Handle, Position } from "reactflow";
import { Zap } from "lucide-react";

export function BlocoAcaoNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-emerald-400 bg-slate-800 min-w-[200px]">
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-emerald-400" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-emerald-400" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-emerald-400/20">
          <Zap className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {data.label}
          </div>
          {data.actionType && (
            <div className="text-xs text-blue-300/70 mt-1">
              {data.actionType}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-emerald-400" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-emerald-400" />
    </div>
  );
}
