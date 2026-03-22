import { Users, ArrowLeft, Camera, Pencil } from "lucide-react";

interface WhatsAppGroupPreviewProps {
  groupName: string;
  description?: string;
  photoUrl?: string;
  membersCount?: number;
}

const WhatsAppGroupPreview = ({
  groupName,
  description,
  photoUrl,
  membersCount = 0,
}: WhatsAppGroupPreviewProps) => {
  const displayName = groupName || "Nome do Grupo";
  const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full max-w-[280px] mx-auto">
      <div className="rounded-2xl overflow-hidden shadow-xl border border-border bg-[#111b21]" style={{ aspectRatio: "9/16", maxHeight: 440 }}>
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 text-[10px] text-[#aebac1]">
          <span>{time}</span>
          <div className="flex items-center gap-1">
            <div className="w-3.5 h-2 border border-[#aebac1] rounded-sm relative">
              <div className="absolute inset-[1px] right-[2px] bg-[#aebac1] rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Header - Group Info page style */}
        <div className="bg-[#202c33] px-3 py-2 flex items-center gap-3">
          <ArrowLeft className="w-4 h-4 text-[#aebac1]" />
          <p className="text-[13px] font-medium text-[#e9edef]">Info. do grupo</p>
        </div>

        {/* Group info content - scrollable area */}
        <div className="bg-[#0b141a] flex-1 overflow-hidden" style={{ height: "calc(100% - 76px)" }}>
          {/* Group photo + name section */}
          <div className="bg-[#202c33] flex flex-col items-center py-4 px-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-[#2a3942] flex items-center justify-center mb-3">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-8 h-8 text-[#aebac1]" />
              )}
              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center">
                <Camera className="w-3 h-3 text-[#111b21]" />
              </div>
            </div>
            <p className="text-[14px] font-semibold text-[#e9edef] text-center truncate max-w-full">{displayName}</p>
            <p className="text-[10px] text-[#8696a0] mt-0.5">
              Grupo · {membersCount || 1} participante{(membersCount || 1) > 1 ? "s" : ""}
            </p>
          </div>

          <div className="h-2 bg-[#0b141a]" />

          {/* Description / Bio section */}
          <div className="bg-[#202c33] px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-[#8696a0]">Descrição do grupo</p>
              <Pencil className="w-3 h-3 text-[#8696a0]" />
            </div>
            <p className="text-[11px] text-[#e9edef] leading-snug line-clamp-4 min-h-[16px]">
              {description || "Adicionar descrição do grupo"}
            </p>
          </div>

          <div className="h-2 bg-[#0b141a]" />

          {/* Mídia, links e docs */}
          <div className="bg-[#202c33] px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[#8696a0]">Mídia, links e docs</p>
              <p className="text-[10px] text-[#00a884]">0 →</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">Preview das informações do grupo</p>
    </div>
  );
};

export default WhatsAppGroupPreview;
