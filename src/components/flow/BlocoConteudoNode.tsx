import { Handle, Position } from "reactflow";
import { MessageSquare, Image, Video, Mic, FileText, Link2, MessageCircle, Phone, ArrowRight, BarChart3, Mail, User } from "lucide-react";

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

const buttonTypeIcons: Record<string, any> = {
  url: Link2,
  reply: MessageCircle,
  call: Phone,
  flow: ArrowRight,
};

function MediaPreview({ contentType, mediaUrl }: { contentType: string; mediaUrl: string }) {
  if (!mediaUrl) return null;

  if (contentType === "image") {
    return (
      <div className="mt-2 rounded-md overflow-hidden border border-border">
        <img
          src={mediaUrl}
          alt="Preview"
          className="w-full h-24 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  if (contentType === "video") {
    return (
      <div className="mt-2 rounded-md overflow-hidden border border-border">
        <video
          src={mediaUrl}
          className="w-full max-h-32 object-contain bg-black/5"
          controls
          muted
          preload="metadata"
          onError={(e) => {
            (e.target as HTMLVideoElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  if (contentType === "audio") {
    return (
      <div className="mt-2">
        <audio
          src={mediaUrl}
          controls
          className="w-full h-8"
          preload="metadata"
          style={{ maxWidth: "100%" }}
        />
      </div>
    );
  }

  if (contentType === "document") {
    const fileName = mediaUrl.split("/").pop() || "documento";
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2">
        <FileText className="h-5 w-5 text-primary shrink-0" />
        <span className="text-[10px] text-muted-foreground truncate">{decodeURIComponent(fileName)}</span>
      </div>
    );
  }

  return null;
}

export function BlocoConteudoNode({ data }: any) {
  const contentType = data.contentType || "text";
  const Icon = typeIcons[contentType] || MessageSquare;
  const buttons = data.buttons || [];
  const flowButtons = buttons.filter((b: any) => b.type === "flow" || b.type === "reply");
  const collectName = data.collectName || false;
  const collectWhatsapp = data.collectWhatsapp || false;
  const collectEmail = data.collectEmail || false;

  return (
    <div className="relative px-4 py-3 pt-5 shadow-lg rounded-lg border-2 border-orange-500 bg-card min-w-[200px] max-w-[280px]">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white rounded">
        Conteúdo
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="w-3 h-3 !bg-orange-500" />
      <Handle type="target" position={Position.Top} id="target-top" className="w-3 h-3 !bg-orange-500" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-orange-500/10">
          <Icon className="h-4 w-4 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {typeLabels[contentType]}
          </div>
        </div>
      </div>

      {/* Media preview */}
      <MediaPreview contentType={contentType} mediaUrl={data.mediaUrl} />

      {data.content && (
        <div className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap break-words">
          {data.content}
        </div>
      )}

      {(collectName || collectWhatsapp || collectEmail) && (
        <div className="mt-2 space-y-1">
          {collectName && (
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-md text-[10px] text-purple-600 font-medium">
              <User className="w-3 h-3" /> Captura Nome
            </div>
          )}
          {collectWhatsapp && (
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] text-emerald-600 font-medium">
              <Phone className="w-3 h-3" /> Captura WhatsApp
            </div>
          )}
          {collectEmail && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-600 font-medium">
              <Mail className="w-3 h-3" /> Captura Email
            </div>
          )}
        </div>
      )}

      {buttons.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {buttons.map((btn: any, idx: number) => {
            const btnText = btn.text || `Botão ${idx + 1}`;
            const BtnIcon = buttonTypeIcons[btn.type] || Link2;
            const stats = data.buttonStats || {};
            const totalRecipients = data.totalFlowRecipients || 0;
            const clickCount = stats[btnText] || 0;
            const percentage = totalRecipients > 0 ? Math.round((clickCount / totalRecipients) * 100) : 0;

            return (
              <div key={btn.id || idx} className="bg-white dark:bg-card border border-border rounded-md px-2 py-1.5">
                <div className="text-[10px] text-card-foreground flex items-center gap-1 font-medium">
                  <BtnIcon className="h-3 w-3 flex-shrink-0" />
                  {btnText}
                </div>
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
              </div>
            );
          })}
        </div>
      )}

      {/* Default source handles */}
      {flowButtons.length === 0 && (
        <>
          <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-orange-500" />
          <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-orange-500" />
        </>
      )}

      {/* Per-button source handles on the right */}
      {flowButtons.length > 0 && (
        <>
          {flowButtons.map((btn: any, idx: number) => {
            const btnIndex = buttons.indexOf(btn);
            const total = flowButtons.length + 1;
            const pos = ((idx + 1) / total) * 100;
            return (
              <Handle
                key={btn.id || idx}
                type="source"
                position={Position.Right}
                id={`button-${btnIndex}`}
                className="w-2.5 h-2.5 !bg-primary"
                style={{ top: `${pos}%` }}
              />
            );
          })}
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            className="w-3 h-3 !bg-orange-500"
            style={{ top: `${(flowButtons.length / (flowButtons.length + 1)) * 100}%` }}
          />
          <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-orange-500" />
        </>
      )}
    </div>
  );
}
