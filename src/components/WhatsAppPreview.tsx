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
    <div className={cn("bg-[#0b141a] rounded-xl overflow-hidden shadow-2xl border border-white/5 flex flex-col w-full max-w-[320px] mx-auto", className)}>
      {/* Header do WhatsApp (Simulado) */}
      <div className="bg-[#202c33] px-3 py-2 flex items-center gap-2 border-b border-white/5">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#202c33] flex items-center justify-center">
          <img src={zaplynxAvatar} alt="ZapLynx" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-medium truncate">ZapLynx Preview</div>
          <div className="text-white/40 text-[10px]">online</div>
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="p-3 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-contain flex-1 min-h-[150px]">
        <div className="bg-[#202c33] rounded-lg p-2 relative shadow-sm max-w-[90%]">
          {/* Triângulo do balão */}
          <div className="absolute -left-1.5 top-0 w-0 h-0 border-t-[8px] border-t-[#202c33] border-l-[8px] border-l-transparent"></div>

          {template.header && (
            <div className="text-white/50 text-[11px] font-bold mb-1 uppercase tracking-wider">
              {template.header}
            </div>
          )}
          
          {(template.mediaUrl || (specialData && specialData.mediaUrl)) && (
            <div className="mb-2 rounded overflow-hidden bg-white/5 border border-white/5">
              {template.fileType?.startsWith('image') || (specialData && specialData.type === 'imagem') ? (
                <img src={template.mediaUrl || specialData.mediaUrl} alt="Preview" className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-16 flex items-center gap-3 px-3 bg-[#111b21] text-white/70">
                  <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center text-red-500">
                    <span className="text-[10px]">PDF</span>
                  </div>
                  <div className="flex-1 truncate text-xs">
                    {template.fileName || 'Documento.pdf'}
                  </div>
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
    </div>
  );
};
