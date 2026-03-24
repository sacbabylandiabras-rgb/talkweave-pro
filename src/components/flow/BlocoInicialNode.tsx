import { Handle, Position } from "reactflow";
import { PlayCircle } from "lucide-react";

export function BlocoInicialNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-cyan-400 bg-slate-800 min-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-cyan-400/20">
          <PlayCircle className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">
            {data.label}
          </div>
          <div className="text-xs text-blue-300/70 mt-0.5">
            {data.description}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 !bg-cyan-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 !bg-cyan-400" />
    </div>
  );
}
