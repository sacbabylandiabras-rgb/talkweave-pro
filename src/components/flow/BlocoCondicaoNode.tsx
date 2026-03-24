import { Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";

export function BlocoCondicaoNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-amber-400 bg-slate-800 min-w-[200px]">
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-amber-400" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-amber-400" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-amber-400/20">
          <GitBranch className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">
            {data.label}
          </div>
          {data.condition && (
            <div className="text-xs text-blue-300/70 mt-1">
              {data.condition}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="a" className="w-3 h-3 !bg-amber-400" style={{ top: "35%" }} />
      <Handle type="source" position={Position.Right} id="b" className="w-3 h-3 !bg-amber-400" style={{ top: "65%" }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-amber-400" />
    </div>
  );
}
