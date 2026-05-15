 import { Plus, Instagram, Trash2, Pencil, Power, MessageSquare, Heart, Share2, PlayCircle, Star, Settings2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useInstagramAutomations } from "@/hooks/useInstagramAutomations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampanhasInstagram() {
  const navigate = useNavigate();
  const { automations, isLoading, updateAutomation, deleteAutomation } = useInstagramAutomations();

  if (isLoading) {
    return (
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Campanhas Instagram</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus fluxos de automação de comentários</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

   return (
     <div className="space-y-8 w-full">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
           <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
             Campanhas Instagram
             <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">Automação</Badge>
           </h1>
           <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus fluxos e configuradores rápidos</p>
         </div>
         <div className="flex gap-2">
           <Button variant="outline" onClick={() => navigate("/instagram/modelos")} className="gap-2 h-9 border-primary/20 hover:bg-primary/5">
             <Star className="w-4 h-4 text-amber-500" />
             Modelos
           </Button>
           <Button onClick={() => navigate("/instagram/automacao")} className="gap-2 h-9">
             <Plus className="w-4 h-4" />
             Novo Fluxo
           </Button>
         </div>
       </div>
 
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <QuickActionCard 
           title="Iniciadores" 
           description="Perguntas frequentes (FAQs) no início do chat" 
           icon={MessageSquare} 
           color="text-blue-500"
           badge="Novo"
         />
         <QuickActionCard 
           title="Story Mentions" 
           description="Responda automaticamente a menções em stories" 
           icon={Share2} 
           color="text-pink-500"
         />
         <QuickActionCard 
           title="Resposta Padrão" 
           description="Mensagem quando nenhuma palavra-chave coincide" 
           icon={Heart} 
           color="text-red-500"
         />
         <QuickActionCard 
           title="Menu Principal" 
           description="Acesso rápido a informações nas DMs" 
           icon={Settings2} 
           color="text-purple-500"
           isPro
         />
       </div>
 
       <div className="pt-2">
         <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
           Minhas Automações
           <Badge className="bg-muted text-muted-foreground text-[10px]">{automations.length}</Badge>
         </h2>
         
         {automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Instagram className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-base font-medium">Nenhum fluxo criado ainda</p>
          <p className="text-sm mt-1">Crie seu primeiro fluxo de automação para começar</p>
          <Button onClick={() => navigate("/instagram/automacao")} className="gap-2 mt-4">
            <Plus className="w-4 h-4" />
            Criar Primeiro Fluxo
          </Button>
        </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {automations.map(auto => (
             <Card key={auto.id} className="border-border hover:border-primary/40 transition-all duration-300 overflow-hidden flex flex-col group">
               <CardContent className="p-0 flex flex-col h-full">
                 <div className="p-4 flex-1">
                   <div className="flex items-center justify-between mb-3">
                     <h3 className="font-bold text-sm truncate max-w-[150px]">{auto.name || "Sem nome"}</h3>
                     <Badge variant={auto.active ? "default" : "secondary"} className="text-[9px] h-5 px-1.5 font-bold uppercase tracking-wider">
                       {auto.active ? "Ativo" : "Pausado"}
                     </Badge>
                   </div>
                   
                   <div className="flex flex-wrap gap-1 mb-4">
                     {auto.keyword.split(",").filter(Boolean).map((kw, i) => (
                       <Badge key={i} variant="outline" className="text-[10px] bg-muted/30 border-border/50">{kw.trim()}</Badge>
                     ))}
                     {auto.keyword === "" && (
                       <Badge variant="outline" className="text-[10px] bg-muted/30 border-border/50 italic text-muted-foreground">Qualquer comentário</Badge>
                     )}
                   </div>
 
                   <div className="space-y-2 mb-2">
                     {auto.reply_comment && (
                       <div className="flex items-start gap-2 text-[11px] text-muted-foreground line-clamp-2">
                         <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-pink-500/70" />
                         <p>{auto.reply_comment}</p>
                       </div>
                     )}
                     {auto.dm_message && (
                       <div className="flex items-start gap-2 text-[11px] text-muted-foreground line-clamp-2">
                         <Send className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500/70" />
                         <p>{auto.dm_message.startsWith('{') ? "Mensagem de fluxo configurada" : auto.dm_message}</p>
                       </div>
                     )}
                   </div>
                 </div>
                 
                 <div className="p-3 bg-muted/20 border-t border-border/50 flex items-center justify-between mt-auto">
                   <div className="flex items-center gap-1">
                     <Switch
                       className="scale-75 origin-left"
                       checked={auto.active}
                       onCheckedChange={(checked) => updateAutomation.mutate({ id: auto.id, active: checked })}
                     />
                     <span className="text-[10px] font-medium text-muted-foreground">{auto.active ? "Ativado" : "Desativado"}</span>
                   </div>
                   
                   <div className="flex items-center gap-1">
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                       onClick={() => navigate(`/instagram/automacao?id=${auto.id}`)}
                     >
                       <Pencil className="w-3.5 h-3.5" />
                     </Button>
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-8 w-8 text-destructive hover:bg-destructive/10 transition-colors"
                       onClick={() => deleteAutomation.mutate(auto.id)}
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                     </Button>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       )}
       </div>
     </div>
   );
 }
 
 function QuickActionCard({ title, description, icon: Icon, color, badge, isPro }: any) {
   return (
     <Card className="border-border hover:border-primary/30 transition-all duration-300 bg-card/40 backdrop-blur-sm cursor-pointer group">
       <CardContent className="p-4 pt-5">
         <div className="flex justify-between items-start mb-3">
           <div className={`p-2 rounded-lg bg-muted/40 group-hover:bg-primary/10 transition-colors`}>
             <Icon className={`w-5 h-5 ${color}`} />
           </div>
           <div className="flex gap-1">
             {badge && <Badge className="text-[8px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1">{badge}</Badge>}
             {isPro && <Badge className="text-[8px] h-4 bg-amber-500/10 text-amber-500 border-amber-500/20 px-1">PRO</Badge>}
           </div>
         </div>
         <h3 className="font-bold text-sm mb-1">{title}</h3>
         <p className="text-[11px] text-muted-foreground leading-relaxed">
           {description}
         </p>
         <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
           CONFIGURAR <Plus className="w-3 h-3" />
         </div>
       </CardContent>
     </Card>
   );
 }
