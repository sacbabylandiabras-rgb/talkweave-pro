import { Handle, Position } from "reactflow";
import { PlayCircle } from "lucide-react";

export function BlocoInicialNode({ data }: any) {
  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-primary bg-card min-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <PlayCircle className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {data.description}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-primary"
      />
    </div>
  );
}
