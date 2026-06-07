import { Handle, Position } from "reactflow";
import {
  MessageSquare,
  Image,
  Video,
  Mic,
  FileText,
  Link2,
  MessageCircle,
  Phone,
  ArrowRight,
  Mail,
  User,
  Contact,
  MapPin,
  Activity,
  Camera,
  LayoutList,
  Images,
  MapPinned,
  CreditCard,
  QrCode,
  Sticker,
  Zap as ZapIcon,
  HelpCircle,
  ShoppingBag,
  Package,
  List,
  Smile,
  X,
  Reply,
  Forward,
  CheckCircle,
  Trash as TrashIcon,
  Pin,
} from "lucide-react";

const typeIcons: Record<string, any> = {
  text: MessageSquare,
  image: Image,
  video: Video,
  audio: Mic,
  document: FileText,
  contact: User,
  location: MapPin,
  presence: Activity,
  status: Camera,
  interactive: LayoutList,
  "media-carousel": Images,
  "request-location": MapPinned,
  "request-payment": CreditCard,
    pix: QrCode,
  sticker: Sticker,
  gif: ZapIcon,
  link: Link2,
  poll: HelpCircle,
  order: ShoppingBag,
  product: Package,
  catalog: List,
  reaction: Smile,
  "remove-reaction": X,
  reply: Reply,
  forward: Forward,
  read: CheckCircle,
  delete: TrashIcon,
  pin: Pin,
};

const typeLabels: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  video: "Vídeo",
  audio: "Áudio",
  document: "Documento",
  contact: "Contato (vCard)",
  location: "Localização",
  presence: "Presença",
  status: "Status (Stories)",
  interactive: "Menu Interativo",
  "media-carousel": "Carrossel de Mídia",
  "request-location": "Solicitar Localização",
  "request-payment": "Solicitar Pagamento",
    pix: "Botão PIX",
  sticker: "Sticker (Figurinha)",
  gif: "GIF Animado",
  link: "Link com Preview",
  poll: "Enquete / Poll",
  order: "Pedido / Checkout",
  product: "Produto Específico",
  catalog: "Mensagem de Produto",
  reaction: "Reação",
  "remove-reaction": "Remover Reação",
  reply: "Responder Mensagem",
  forward: "Encaminhar",
  read: "Marcar como Lida",
  delete: "Deletar Mensagem",
  pin: "Fixar Mensagem",
};

const buttonTypeIcons: Record<string, any> = {
  url: Link2,
  reply: MessageCircle,
  call: Phone,
  flow: ArrowRight,
};

function MediaPreview({ contentType, mediaUrl, data }: { contentType: string; mediaUrl: string; data?: any }) {
  if (!mediaUrl && contentType !== "link") return null;

      if (contentType === "poll") {
    const opts = data.buttons || [];
    return (
      <div className="mt-2 space-y-1 bg-muted/20 p-2 rounded-md border border-border">
        <div className="text-[10px] font-bold flex items-center gap-1"><HelpCircle className="w-3 h-3"/> Enquete:</div>
        {opts.map((o: any, i: number) => (
          <div key={i} className="text-[9px] px-2 py-1 bg-background border border-border rounded flex items-center gap-2">
            <div className="w-2 h-2 rounded-full border border-primary" /> {o.text || "Opção"}
          </div>
        ))}
      </div>
    );
  }

  if (contentType === "product" || contentType === "order" || contentType === "catalog" || contentType === "contact") {
    return (
      <div className="mt-2 flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 p-2 rounded-md">
        <ShoppingBag className="w-4 h-4 text-blue-500" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold truncate">
            {contentType === "product" ? "Produto" : contentType === "catalog" ? "Mensagem Catálogo" : contentType === "contact" ? "Contato (vCard)" : data.orderTitle || "Pedido"}
          </div>
          <div className="text-[9px] text-muted-foreground truncate">
            {contentType === "product" ? `ID: ${data.productId}` : contentType === "catalog" ? `ID: ${data.productId}` : contentType === "contact" ? (data.contactName || data.phone || "Contato") : `Total: R$ ${data.orderTotal}`}
          </div>
        </div>
      </div>
    );
  }

  if (contentType === "sticker" || contentType === "gif") {
    return (
      <div className="mt-2 rounded-md overflow-hidden border border-border bg-black/5 flex justify-center">
        {contentType === "sticker" ? (
          <img src={mediaUrl} className="w-20 h-20 object-contain" alt="Sticker" />
        ) : (
          <video src={mediaUrl} className="w-full max-h-32 object-contain" autoPlay loop muted playsInline />
        )}
      </div>
    );
  }

  if (contentType === "link" && (mediaUrl || data?.linkUrl)) {
    return (
      <div className="mt-2 rounded-md overflow-hidden border border-border bg-muted/30 p-2">
        {mediaUrl && <img src={mediaUrl} className="w-full h-20 object-cover rounded mb-1" alt="Preview" />}
        <div className="text-[10px] text-primary underline truncate">{data?.linkUrl || mediaUrl}</div>
      </div>
    );
  }

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

export function BlocoConteudoNode({ id: nodeId, data }: any) {
  const contentType = data.contentType || "text";
  const Icon = typeIcons[contentType] || MessageSquare;
  const buttons = data.buttons || [];
  const flowButtons = buttons.filter((b: any) => b.type === "flow" || b.type === "reply");
  const collectName = data.collectName || false;
  const collectWhatsapp = data.collectWhatsapp || false;
  const collectEmail = data.collectEmail || false;
  const collectCPF = data.collectCPF || false;

  return (
    <div className="relative px-4 py-3 pt-5 shadow-md rounded-2xl border border-border/40 bg-card min-w-[200px] max-w-[280px] glass-card !overflow-visible z-50">
      <span className={`absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal ${data.isTelegram ? 'bg-blue-600' : 'bg-primary/90'} text-white rounded-md z-[60]`}>
        {data.isTelegram ? "Conteúdo Telegram" : "Conteúdo"}
      </span>
      <Handle type="target" position={Position.Left} id="target-left" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ left: -8 }} />
      <Handle type="target" position={Position.Top} id="target-top" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ top: -8 }} />
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
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
      <MediaPreview contentType={contentType} mediaUrl={data.mediaUrl} data={data} />

      {contentType === "audio" && data.audioName && (
        <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
          {data.audioName}
        </div>
      )}

      {data.content && (
        <div className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap break-words">
          {data.content}
        </div>
      )}

      {(collectName || collectWhatsapp || collectEmail) && (
        <div className="mt-2 space-y-1 relative">
          {collectName && (
            <div className="relative flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-md text-[10px] text-purple-600 font-medium">
              <User className="w-3 h-3" /> Captura Nome
              <Handle
                type="source"
                position={Position.Right}
                id={`collect-name-${nodeId}`}
                className="!w-3 !h-3 !bg-purple-500 !border-2 !border-background"
                style={{ right: -22, top: "50%" }}
              />
            </div>
          )}
          {collectWhatsapp && (
            <div className="relative flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] text-emerald-600 font-medium">
              <Phone className="w-3 h-3" /> Captura WhatsApp
              <Handle
                type="source"
                position={Position.Right}
                id={`collect-whatsapp-${nodeId}`}
                className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background"
                style={{ right: -22, top: "50%" }}
              />
            </div>
          )}
          {collectEmail && (
            <div className="relative flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px] text-blue-600 font-medium">
              <Mail className="w-3 h-3" /> Captura Email
              <Handle
                type="source"
                position={Position.Right}
                id={`collect-email-${nodeId}`}
                className="!w-3 !h-3 !bg-blue-500 !border-2 !border-background"
                style={{ right: -22, top: "50%" }}
              />
            </div>
          )}
          {collectCPF && (
            <div className="relative flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md text-[10px] text-red-600 font-medium">
              <FileText className="w-3 h-3" /> Captura CPF
              <Handle
                type="source"
                position={Position.Right}
                id={`collect-cpf-${nodeId}`}
                className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
                style={{ right: -22, top: "50%" }}
              />
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
            const isFlowButton = btn.type === "flow" || btn.type === "reply";

            return (
              <div key={btn.id || idx} className="relative bg-white dark:bg-card border border-border rounded-md px-2 py-1.5 pr-5">
                <div className="text-[10px] text-card-foreground flex items-center gap-1 font-medium">
                  <BtnIcon className="h-3 w-3 flex-shrink-0" />
                  {btnText}
                </div>
                <div className="mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap">
                      {clickCount} ({percentage}%)
                    </span>
                  </div>
                </div>
                {isFlowButton && (
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`button-${idx}`}
                    className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl hover:scale-110 transition-transform cursor-pointer !z-[100] !pointer-events-auto"
                    style={{ right: -12, top: "50%", transform: "translateY(-50%)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Default source handles */}
      {flowButtons.length === 0 && (
        <>
          <Handle type="source" position={Position.Right} id="source-right" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ right: -8 }} />
          <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ bottom: -8 }} />
        </>
      )}

      {/* Default + bottom handles when there are flow buttons */}
      {flowButtons.length > 0 && (
        <>
          <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ bottom: -8 }} />
          <Handle type="source" position={Position.Right} id="default" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ right: -8 }} />
        </>
      )}
    </div>
  );
}
