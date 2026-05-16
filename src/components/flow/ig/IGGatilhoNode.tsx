import { Handle, Position } from "reactflow";
  import { MessageCircle, Image, Share2, Heart, PlayCircle, Star, Zap, UserPlus } from "lucide-react";
 import { Badge } from "@/components/ui/badge";

export function IGGatilhoNode({ data }: any) {
  // Extract Instagram post ID from URL for embed
  const getPostShortcode = (url: string) => {
    if (!url) return null;
    const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const shortcode = getPostShortcode(data.postUrl || "");

   const getTriggerInfo = () => {
     const type = data.triggerType || "comment";
     switch (type) {
       case "story_reply": return { label: "Resposta ao Story", color: "bg-pink-500", icon: Share2 };
       case "dm": return { label: "Mensagem Direta", color: "bg-blue-500", icon: Heart };
       case "share": return { label: "Compartilhamento", color: "bg-purple-500", icon: Zap };
       case "live": return { label: "Live Comment", color: "bg-red-500", icon: PlayCircle };
        case "ads": return { label: "Anúncios", color: "bg-emerald-500", icon: Star };
        case "follow": return { label: "Novo Seguidor", color: "bg-indigo-500", icon: UserPlus };
       default: return { label: "Comentário", color: "bg-orange-500", icon: MessageCircle };
     }
   };
 
   const { label, color, icon: Icon } = getTriggerInfo();
 
   return (
     <div className="relative px-4 py-3 pt-5 shadow-lg rounded-2xl border border-border/40 bg-card min-w-[200px] max-w-[280px] hover:shadow-xl transition-shadow duration-300">
       <span className={`absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${color} text-white rounded-md shadow-sm`}>
         {label}
       </span>
       <div className="flex items-center gap-2">
         <div className={`p-1.5 rounded-lg ${color}/10`}>
           <Icon className={`h-4 w-4 ${color.replace('bg-', 'text-')}`} />
         </div>
         <div className="flex-1">
           <div className="text-sm font-bold text-card-foreground">
             {data.label || label}
           </div>
         </div>
       </div>
 
       {/* Post preview - only for comments or specific posts */}
       {shortcode ? (
         <div className="mt-3 rounded-xl overflow-hidden border border-border bg-black/5 shadow-inner">
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
         <div className="mt-3 p-2 bg-muted/40 rounded-lg text-[10px] text-muted-foreground truncate flex items-center gap-1.5 border border-border/30">
           <Image className="w-3 h-3 shrink-0" />
           {data.postUrl}
         </div>
       ) : null}
 
       {data.triggerType === "story_reply" && (
         <div className="mt-3 p-2.5 bg-pink-500/5 rounded-xl border border-pink-500/10 text-[11px]">
           <p className="text-muted-foreground font-medium mb-1">Responder:</p>
           <div className="flex flex-wrap gap-1">
             <Badge variant="outline" className="text-[9px] bg-white/5 border-pink-500/20 text-pink-500 font-bold">
               {data.storyScope === "all" ? "Todos os Stories" : "Stories Específicos"}
             </Badge>
           </div>
         </div>
       )}
 
       <div className="mt-3 p-2.5 bg-muted/30 rounded-xl border border-border/30">
         <div className="text-[10px] uppercase font-bold text-muted-foreground/60 mb-1 tracking-tight">Regra de Ativação</div>
         {data.keywords ? (
           <div className="text-xs text-card-foreground font-medium whitespace-pre-wrap break-words leading-relaxed">
             {data.matchType === "exact" ? "Palavra exata: " : "Contém: "} 
             <span className="text-primary font-bold">{data.keywords}</span>
           </div>
         ) : (
           <div className="text-xs text-muted-foreground/60 italic font-medium">
             Qualquer {data.triggerType === "story_reply" ? "resposta ou reação" : "comentário"}
           </div>
         )}
       </div>
 
       <Handle type="source" position={Position.Right} id="source-right" className={`w-3 h-3 !border-2 !border-background ${color}`} />
       <Handle type="source" position={Position.Bottom} id="source-bottom" className={`w-3 h-3 !border-2 !border-background ${color}`} />
     </div>
   );
}
