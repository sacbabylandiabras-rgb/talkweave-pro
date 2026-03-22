import { Users, ArrowLeft, Phone, Video, MoreVertical, Camera } from "lucide-react";

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

        {/* WhatsApp header */}
        <div className="bg-[#202c33] px-2 py-2 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4 text-[#aebac1]" />
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2a3942] flex items-center justify-center flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-4 h-4 text-[#aebac1]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#e9edef] truncate">{displayName}</p>
            <p className="text-[10px] text-[#8696a0] truncate">
              {membersCount > 0 ? `${membersCount} participantes` : "toque para mais informações"}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[#aebac1]">
            <Video className="w-4 h-4" />
            <Phone className="w-3.5 h-3.5" />
            <MoreVertical className="w-4 h-4" />
          </div>
        </div>

        {/* Chat background */}
        <div className="bg-[#0b141a] flex-1 relative" style={{ height: "calc(100% - 120px)" }}>
          {/* Wallpaper pattern */}
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          {/* System message */}
          <div className="flex justify-center pt-3">
            <div className="bg-[#182229] rounded-lg px-3 py-1.5 max-w-[200px]">
              <p className="text-[10px] text-[#8696a0] text-center leading-tight">
                Você criou o grupo "{displayName}"
              </p>
            </div>
          </div>

          {/* Group info card with bio/description */}
          <div className="absolute bottom-14 left-0 right-0 px-3">
            <div className="bg-[#202c33] rounded-xl p-3 border border-[#2a3942]">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2a3942] flex items-center justify-center flex-shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-[#aebac1]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#e9edef] truncate">{displayName}</p>
                  <p className="text-[10px] text-[#8696a0] mt-0.5">
                    Grupo · {membersCount || 1} participante{(membersCount || 1) > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              {description && (
                <div className="mt-2.5 pt-2 border-t border-[#2a3942]">
                  <p className="text-[9px] text-[#8696a0] mb-0.5">Descrição do grupo</p>
                  <p className="text-[10px] text-[#e9edef] leading-snug line-clamp-3">{description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Input bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#202c33] px-2 py-2 flex items-center gap-2">
            <div className="flex-1 bg-[#2a3942] rounded-full px-3 py-1.5">
              <p className="text-[11px] text-[#8696a0]">Mensagem</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-[#111b21]" />
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">Preview do grupo no WhatsApp</p>
    </div>
  );
};

export default WhatsAppGroupPreview;
