import { Handle, Position } from "reactflow";
import { Send, Link2, MessageCircle } from "lucide-react";

export function IGDMNode({ data }: any) {
  const buttons = data.buttons || [];

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-blue-500 bg-card min-w-[200px] max-w-[280px]">
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-blue-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-blue-500" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-blue-500/10">
          <Send className="h-4 w-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Enviar DM"}
          </div>
        </div>
      </div>
      {data.message ? (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/40 rounded whitespace-pre-wrap break-words">
          ✉️ {data.message}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/50 mt-2 p-2 bg-muted/20 rounded italic">
          Clique para editar a mensagem
        </div>
      )}
      {buttons.length > 0 && (
        <div className="mt-2 space-y-1">
          {buttons.map((btn: any, idx: number) => (
            <div key={idx} className="bg-muted/50 rounded-md px-2 py-1">
              <div className="text-[10px] text-primary flex items-center gap-1 font-medium">
                {btn.type === "reply" ? <MessageCircle className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                {btn.title || `Botão ${idx + 1}`}
              </div>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-blue-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-blue-500" />
    </div>
  );
}