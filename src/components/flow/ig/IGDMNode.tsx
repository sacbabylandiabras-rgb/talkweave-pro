import { Handle, Position } from "reactflow";
import { Send, Link2, MessageCircle, Plus } from "lucide-react";

export function IGDMNode({ data }: any) {
  const buttons = data.buttons || [];

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-orange-500 bg-card min-w-[220px] max-w-[300px]">
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-orange-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-orange-500" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-orange-500/10">
          <Send className="h-4 w-4 text-orange-500" />
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

      {/* Buttons with individual output handles */}
      <div className="mt-2 space-y-1.5">
        {buttons.length > 0 ? (
          buttons.map((btn: any, idx: number) => (
            <div key={idx} className="relative">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-md px-2.5 py-1.5 pr-6 flex items-center gap-1.5">
                {btn.type === "reply" ? (
                  <MessageCircle className="h-3 w-3 text-orange-500 shrink-0" />
                ) : (
                  <Link2 className="h-3 w-3 text-orange-500 shrink-0" />
                )}
                <span className="text-xs text-card-foreground font-medium truncate">
                  {btn.title || `Botão ${idx + 1}`}
                </span>
              </div>
              {/* Individual handle for each button */}
              <Handle
                type="source"
                position={Position.Right}
                id={`btn-${idx}`}
                className="w-2.5 h-2.5 !bg-orange-400 !border-2 !border-orange-600 !right-[-5px]"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          ))
        ) : (
          <div className="border border-dashed border-orange-500/30 rounded-md px-2.5 py-2 flex items-center justify-center gap-1.5">
            <Plus className="h-3 w-3 text-orange-500/50" />
            <span className="text-[10px] text-orange-500/50 font-medium">
              Clique para adicionar botões
            </span>
          </div>
        )}
        {buttons.length > 0 && buttons.length < 3 && (
          <div className="text-[9px] text-muted-foreground text-center">
            {buttons.length}/3 botões
          </div>
        )}
      </div>

      {/* Default output handle (for flow without button branching) */}
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-orange-500" />
    </div>
  );
}
