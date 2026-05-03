import { Handle, Position } from "reactflow";
import { MessageCircle, Image } from "lucide-react";

export function IGGatilhoNode({ data }: any) {
  // Extract Instagram post ID from URL for embed
  const getPostShortcode = (url: string) => {
    if (!url) return null;
    const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const shortcode = getPostShortcode(data.postUrl || "");

  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] max-w-[280px]">
      <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-orange-500/90 text-white rounded-md">
        Gatilho
      </span>
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-orange-500/10">
          <MessageCircle className="h-4 w-4 text-orange-500" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">
            {data.label || "Gatilho"}
          </div>
        </div>
      </div>

      {/* Post preview */}
      {shortcode ? (
        <div className="mt-2 rounded overflow-hidden border border-border bg-black/5">
          <iframe
            src={`https://www.instagram.com/p/${shortcode}/embed/`}
            width="100%"
            height="240"
            frameBorder="0"
            scrolling="no"
            allowTransparency
            className="pointer-events-none"
            style={{ border: "none" }}
          />
        </div>
      ) : data.postUrl ? (
        <div className="mt-2 p-2 bg-muted/40 rounded text-xs text-muted-foreground truncate flex items-center gap-1">
          <Image className="w-3 h-3 shrink-0" />
          {data.postUrl}
        </div>
      ) : null}

      {data.keywords ? (
        <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/40 rounded whitespace-pre-wrap break-words">
          🔑 {data.keywords}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/50 mt-2 p-2 bg-muted/20 rounded italic">
          Qualquer comentário
        </div>
      )}
      <Handle type="source" position={Position.Right} id="source-right" className="w-3 h-3 !bg-orange-500" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-3 h-3 !bg-orange-500" />
    </div>
  );
}
