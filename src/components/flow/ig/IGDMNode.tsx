import { Handle, Position } from "reactflow";
import { Send, Link2, MessageCircle, Plus, Phone, Mail, User } from "lucide-react";

export function IGDMNode({ data }: any) {
  const buttons = data.buttons || [];
  const collectWhatsapp = data.collectWhatsapp || false;
  const collectEmail = data.collectEmail || false;
  const collectName = data.collectName || false;

  return (
    <div className="relative px-4 py-3 pt-5 shadow-lg rounded-lg border-2 border-orange-500 bg-card min-w-[220px] max-w-[300px]">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white rounded">
        Enviar DM
      </span>
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

      {/* Collection indicators with handles */}
      {(collectWhatsapp || collectEmail || collectName) && (
        <div className="mt-2 space-y-1.5">
          {collectName && (
            <div className="relative">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-[10px] text-purple-600 font-medium pr-6">
                <User className="w-3 h-3" /> Nome
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id="collect-name"
                className="w-2.5 h-2.5 !bg-purple-500 !border-2 !border-purple-700 !right-[-5px]"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          )}
          {collectWhatsapp && (
            <div className="relative">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] text-emerald-600 font-medium pr-6">
                <Phone className="w-3 h-3" /> WhatsApp
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id="collect-whatsapp"
                className="w-2.5 h-2.5 !bg-emerald-500 !border-2 !border-emerald-700 !right-[-5px]"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          )}
          {collectEmail && (
            <div className="relative">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-600 font-medium pr-6">
                <Mail className="w-3 h-3" /> Email
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id="collect-email"
                className="w-2.5 h-2.5 !bg-blue-500 !border-2 !border-blue-700 !right-[-5px]"
                style={{ top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Buttons with click metrics */}
      <div className="mt-2 space-y-1.5">
        {buttons.length > 0 ? (
          buttons.map((btn: any, idx: number) => {
            const btnTitle = btn.title || `Botão ${idx + 1}`;
            const stats = data.buttonStats || {};
            const totalRecipients = data.totalFlowRecipients || 0;
            const clickCount = stats[btnTitle] || 0;
            const percentage = totalRecipients > 0 ? Math.round((clickCount / totalRecipients) * 100) : 0;

            return (
              <div key={idx} className="relative">
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-md px-2.5 py-1.5 pr-6">
                  <div className="flex items-center gap-1.5">
                    {btn.type === "reply" ? (
                      <MessageCircle className="h-3 w-3 text-orange-500 shrink-0" />
                    ) : (
                      <Link2 className="h-3 w-3 text-orange-500 shrink-0" />
                    )}
                    <span className="text-xs text-card-foreground font-medium truncate">
                      {btnTitle}
                    </span>
                  </div>
                  {btn.type === "url" && btn.url && (
                    <div className="mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full transition-all"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap">
                          {clickCount} ({percentage}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`btn-${idx}`}
                  className="w-2.5 h-2.5 !bg-orange-400 !border-2 !border-orange-600 !right-[-5px]"
                  style={{ top: "50%", transform: "translateY(-50%)" }}
                />
              </div>
            );
          })
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

      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-orange-500" />
    </div>
  );
}
