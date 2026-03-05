import { Handle, Position } from "reactflow";
import { MessageSquare, Image, Video, Mic, FileText } from "lucide-react";

const typeIcons: Record<string, any> = {
  text: MessageSquare,
  image: Image,
  video: Video,
  audio: Mic,
  document: FileText,
};

const typeLabels: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  document: "Documento",
};

const buttonTypeLabels: Record<string, string> = {
  url: "🔗",
  reply: "💬",
  call: "📞",
  flow: "➡️",
};

export function BlocoConteudoNode({ data }: any) {
  const contentType = data.contentType || "text";
  const Icon = typeIcons[contentType] || MessageSquare;
  const buttons = data.buttons || [];
  const flowButtons = buttons.filter((b: any) => b.type === "flow" || b.type === "reply");

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-blue-500 bg-card min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500"
      />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {typeLabels[contentType]}
          </div>
          {data.content && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {data.content}
            </div>
          )}
          {buttons.length > 0 && (
            <div className="mt-2 space-y-1">
              {buttons.map((btn: any, idx: number) => (
                <div
                  key={btn.id || idx}
                  className="text-[10px] text-primary flex items-center gap-1"
                >
                  {buttonTypeLabels[btn.type] || "🔗"} {btn.text || `Botão ${idx + 1}`}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Default source handle (when no flow buttons) */}
      {flowButtons.length === 0 && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-blue-500"
        />
      )}

      {/* Per-button source handles */}
      {flowButtons.length > 0 && (
        <div className="mt-2 relative" style={{ height: flowButtons.length * 20 + 8 }}>
          {flowButtons.map((btn: any, idx: number) => {
            const btnIndex = buttons.indexOf(btn);
            return (
              <div key={btn.id || idx} className="flex items-center justify-end pr-4" style={{ height: 20 }}>
                <span className="text-[9px] text-muted-foreground mr-1">
                  {btn.text || `Botão ${btnIndex + 1}`}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`button-${btnIndex}`}
                  className="w-2.5 h-2.5 !bg-primary"
                  style={{ top: "auto", position: "relative" }}
                />
              </div>
            );
          })}
          {/* Keep a default bottom handle for the main flow */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="default"
            className="w-3 h-3 !bg-blue-500"
          />
        </div>
      )}
    </div>
  );
}
