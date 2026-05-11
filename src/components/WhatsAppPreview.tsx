import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import zaplynxAvatar from "@/assets/zaplynx-avatar.png";

interface WhatsAppPreviewProps {
  template: any;
  className?: string;
}

export const WhatsAppPreview = ({ template, className }: WhatsAppPreviewProps) => {
  if (!template) return null;

  const SPECIAL_TEMPLATE_PREFIX = "__SPECIAL_TEMPLATE__:";
  const isSpecial = typeof template.content === 'string' && template.content.startsWith(SPECIAL_TEMPLATE_PREFIX);
  
  let content = template.content || "";
  let type = template.type || "texto";
  let specialData: any = null;

  if (isSpecial) {
    try {
      specialData = JSON.parse(template.content.slice(SPECIAL_TEMPLATE_PREFIX.length));
      content = specialData.description || specialData.title || "";
      type = specialData.type;
    } catch (e) {
      content = "Erro ao processar template especial";
    }
  }

  // Se for copia_cola, o conteúdo pode estar em outro lugar
  if (type === 'copia_cola' && specialData) {
    content = specialData.description || template.name || "Mensagem com botão de copiar";
  }

  return (
    <div className={cn("bg-[#0b141a] rounded-[2rem] overflow-hidden shadow-2xl border-[8px] border-black flex flex-col w-full max-w-[340px] mx-auto relative", className)}>
      {/* Status Bar (iOS-like) */}
      <div className="bg-[#1f2c34] px-5 py-1 flex items-center justify-between text-white text-[10px] font-semibold">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M2 22h4v-8H2v8zm6 0h4V10H8v12zm6 0h4V6h-4v16zm6 0h4V2h-4v20z"/></svg>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 3C7 3 2.7 4.8 0 7.6L12 21 24 7.6C21.3 4.8 17 3 12 3z"/></svg>
          <span className="ml-1 px-1 border border-white/60 rounded-sm leading-none py-0.5 text-[8px]">100</span>
        </div>
      </div>

      {/* Header do WhatsApp */}
      <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2 border-b border-black/40 shadow-sm">
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-white/80"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#2a3942] flex items-center justify-center ring-1 ring-white/5">
          <img src={zaplynxAvatar} alt="ZapLynx" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-[13px] font-medium truncate leading-tight">ZapLynx Preview</div>
          <div className="text-white/50 text-[10px] leading-tight">online</div>
        </div>
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-white/80"><path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-white/80"><path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-white/80"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
      </div>

      {/* Área de Mensagens */}
      <div
        className="px-3 py-3 flex-1 min-h-[200px]"
        style={{
          backgroundColor: '#0b141a',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='%23182229' fill-opacity='0.6'><circle cx='10' cy='10' r='1'/><circle cx='40' cy='25' r='1'/><circle cx='70' cy='15' r='1'/><circle cx='20' cy='50' r='1'/><circle cx='55' cy='60' r='1'/><circle cx='30' cy='75' r='1'/><path d='M5 35 Q15 30 25 35 T45 35' stroke='%23182229' stroke-opacity='0.4' fill='none'/></g></svg>")`,
        }}
      >
        {/* Date separator */}
        <div className="flex justify-center mb-3">
          <span className="bg-[#1f2c34] text-[#8696a0] text-[10px] px-2 py-0.5 rounded-md shadow-sm">HOJE</span>
        </div>

        <div className="bg-[#202c33] rounded-lg rounded-tl-none p-2 relative shadow-md max-w-[90%]">
          {/* Triângulo do balão */}
          <div className="absolute -left-2 top-0 w-0 h-0 border-t-[10px] border-t-[#202c33] border-l-[8px] border-l-transparent"></div>

          {template.header && (
            <div className="text-white/50 text-[11px] font-bold mb-1 uppercase tracking-wider">
              {template.header}
            </div>
          )}
          
           {(template.mediaUrl || (specialData && specialData.mediaUrl)) && (
             <div className="mb-2 rounded overflow-hidden bg-white/5 border border-white/5">
               {type.includes('imagem') || type.includes('image') || type === 'sticker' || type === 'gif' || template.fileType?.startsWith('image') ? (
                 <img src={template.mediaUrl || specialData.mediaUrl} alt="Preview" className="w-full h-48 object-cover" />
                ) : type.includes('vídeo') || type.includes('video') || template.fileType?.startsWith('video') ? (
                 <div className="relative aspect-video bg-black">
                   <video 
                     src={template.mediaUrl || specialData.mediaUrl} 
                     className="w-full h-full object-contain"
                     muted
                     loop
                     autoPlay
                     playsInline
                   />
                   <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                     <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                       <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M8 5v14l11-7z"/></svg>
                     </div>
                   </div>
                 </div>
                ) : type.includes('áudio') || type.includes('audio') || template.fileType?.startsWith('audio') ? (
                 <div className="w-full py-3 px-4 bg-[#111b21] flex items-center gap-3">
                   <div className="relative w-10 h-10 rounded-full bg-[#202c33] flex items-center justify-center overflow-hidden">
                     <img src={zaplynxAvatar} alt="Avatar" className="w-full h-full object-cover" />
                     <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#111b21]"></div>
                   </div>
                   <div className="flex-1 space-y-1">
                     <div className="flex items-center gap-1">
                       <svg viewBox="0 0 24 24" width="16" height="16" className="text-[#8696a0]"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                       <div className="h-0.5 flex-1 bg-[#8696a0]/30 rounded-full overflow-hidden">
                         <div className="h-full w-1/3 bg-[#53bdeb]"></div>
                       </div>
                     </div>
                     <div className="flex justify-between items-center text-[10px] text-[#8696a0]">
                       <span>0:00 / 0:15</span>
                       <span>2x</span>
                     </div>
                   </div>
                   <div className="w-6 h-6 rounded-full bg-[#202c33] flex items-center justify-center text-[#8696a0]">
                     <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                   </div>
                 </div>
               ) : (
                 <div className="w-full h-16 flex items-center gap-3 px-3 bg-[#111b21] text-white/70">
                   <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center text-red-500">
                     <span className="text-[10px] font-bold">DOC</span>
                   </div>
                   <div className="flex-1 truncate text-xs">
                     {template.fileName || 'Documento.pdf'}
                   </div>
                   <svg viewBox="0 0 24 24" width="16" height="16" className="text-[#8696a0]"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                 </div>
               )}
             </div>
           )}

          <div className="text-[#e9edef] text-[13.5px] whitespace-pre-wrap break-words leading-snug">
            {content}
          </div>

          {template.footer && (
            <div className="text-[#8696a0] text-[11px] mt-1 italic">
              {template.footer}
            </div>
          )}

          <div className="flex justify-end items-center gap-1 mt-0.5">
            <span className="text-[10px] text-[#8696a0]">12:00</span>
            <div className="flex items-center -space-x-1">
               <svg viewBox="0 0 16 15" width="14" height="14" className="text-[#53bdeb]"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879 5.817 7.7a.374.374 0 0 0-.519.058l-.425.479a.35.35 0 0 0 .06.491l3.412 2.602a.37.37 0 0 0 .524-.061L15.073 3.8a.35.35 0 0 0-.063-.484zm-3.57 1.32l-.474-.371a.365.365 0 0 0-.51.063L5.341 10.8l-3.21-2.445a.373.373 0 0 0-.518.06l-.425.48a.35.35 0 0 0 .061.491l4.017 3.064a.37.37 0 0 0 .525-.06l5.707-7.36a.35.35 0 0 0-.06-.483z"></path></svg>
            </div>
          </div>
        </div>

        {/* Botões Separados do Balão (Padrão WhatsApp Business) */}
        {template.buttons && template.buttons.length > 0 && (
          <div className="mt-1 space-y-1 w-[90%]">
            {template.buttons.map((btn: any, idx: number) => (
              <div 
                key={idx} 
                className="bg-[#202c33] hover:bg-[#2a3942] transition-colors py-2 px-4 rounded-lg text-[#3eb2f9] text-[13px] font-medium text-center shadow-sm flex items-center justify-center gap-2 border border-white/5 cursor-default"
              >
                {btn.type === 'url' && (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                )}
                {btn.type === 'call' && (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                )}
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="bg-[#1f2c34] px-2 py-1.5 flex items-center gap-1.5 border-t border-black/40">
        <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5 flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="16" height="16" className="text-[#8696a0]"><path fill="currentColor" d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z"/></svg>
          <span className="flex-1 text-[#8696a0] text-[12px]">Mensagem</span>
          <svg viewBox="0 0 24 24" width="16" height="16" className="text-[#8696a0]"><path fill="currentColor" d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.852-.063l-5.506 5.506c-.443.444-1.197.336-1.616-.084-.45-.45-.55-1.18-.137-1.593l7.915-7.915c.812-.812 2.255-.698 3.218.265.5.501.78 1.078.823 1.638.038.483-.156.93-.555 1.329l-9.546 9.547a3.97 3.97 0 0 1-2.829 1.171 3.975 3.975 0 0 1-2.83-1.173 3.973 3.973 0 0 1-1.172-2.828c0-1.071.415-2.076 1.172-2.83l7.209-7.211c.157-.157.264-.579.028-.814L11.5 4.36a.572.572 0 0 0-.834.018l-7.205 7.207a5.577 5.577 0 0 0-1.645 3.971z"/></svg>
          <svg viewBox="0 0 24 24" width="16" height="16" className="text-[#8696a0]"><path fill="currentColor" d="M9.5 13.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S8 11.17 8 12s.67 1.5 1.5 1.5zm5 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-2.5 4.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
        </div>
      </div>
    </div>
  );
};
