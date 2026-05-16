 import { LayoutTemplate, ArrowLeft, Target, Zap, Rocket, Users, MessageCircle, Heart, Share2, PlayCircle, Star, Phone, Mail } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { useNavigate } from "react-router-dom";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Input } from "@/components/ui/input";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 
  const modelos = [
    {
      id: "saudacao-novo-seguidor",
      title: "Saudação para novos seguidores",
      description: "Dê as boas-vindas automaticamente por DM assim que alguém começar a te seguir",
      category: "gatilho",
      tag: "Boas-vindas",
      trigger: "Seguidor",
      pro: true,
    },
   {
     id: "venda-comentarios-reels",
     title: "Venda pelos comentários de Reels",
     description: "Um reel tá gerando conversas? Entre nas DMs com uma boa oferta",
     category: "objetivo",
     tag: "Vendas",
     trigger: "Comentário",
     pro: false,
   },
   {
     id: "enviar-links-dm",
     title: "Envio automático de links por DM",
     description: "Automatize suas DMs para direcionar seus seguidores à sua página da web",
     category: "objetivo",
     tag: "Tráfego",
     trigger: "Comentário",
     pro: false,
   },
   {
     id: "crescer-lista-email",
     title: "Cresça sua lista de e-mails",
     description: "Capture dados de clientes com o Imã de Leads",
     category: "objetivo",
     tag: "Leads",
     trigger: "DM",
     pro: true,
   },
   {
     id: "cupons-stories",
     title: "Envie cupons nos stories",
     description: "Alguém viu seu story? Dê um tratamento VIP com um cupom secreto via DM",
     category: "gatilho",
     tag: "Engajamento",
     trigger: "Story",
     pro: false,
   },
   {
     id: "concurso-comentarios",
     title: "Faça um concurso",
     description: "Faça um concurso para aumentar seus seguidores do Instagram.",
     category: "gatilho",
     tag: "Seguidores",
     trigger: "Comentário",
     pro: true,
   },
   {
     id: "live-dm",
     title: "Converta na Live",
     description: "Dispare DMs durante Lives do IG para aumentar vendas",
     category: "gatilho",
     tag: "Live",
     trigger: "Live",
     pro: false,
   },
   {
     id: "faq-stories",
     title: "Perguntas frequentes de Stories",
     description: "Responda o mais rápido possível às perguntas dos seus seguidores",
     category: "gatilho",
     tag: "Suporte",
     trigger: "Story",
     pro: false,
   },
   {
     id: "leads-whatsapp",
     title: "Leads do Instagram para o WhatsApp",
     description: "Leve os seguidores do Instagram diretamente para o seu WhatsApp",
     category: "objetivo",
     tag: "Conversão",
     trigger: "DM",
     pro: false,
   },
 ];
 
 export default function ModelosInstagram() {
   const navigate = useNavigate();
 
   return (
     <div className="space-y-6 w-full animate-in fade-in duration-500">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
             <ArrowLeft className="w-5 h-5" />
           </Button>
           <div>
             <h1 className="text-xl font-bold text-foreground tracking-tight">Modelos de Automação</h1>
             <p className="text-sm text-muted-foreground mt-0.5">Escolha um modelo pronto ou comece do zero</p>
           </div>
         </div>
         <Button onClick={() => navigate("/instagram/automacao")} className="bg-primary hover:bg-primary/90">
           Começar do Zero
         </Button>
       </div>
 
       <div className="relative">
         <Input 
           placeholder="Buscar modelos do Instagram..." 
           className="pl-10 h-11 bg-card/50 border-border/40 focus:ring-primary/20"
         />
         <LayoutTemplate className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
       </div>
 
       <Tabs defaultValue="todos" className="w-full">
         <TabsList className="bg-card/50 border border-border/40 p-1 h-auto flex-wrap justify-start">
           <TabsTrigger value="todos" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-4 rounded-md">Todos os Modelos</TabsTrigger>
           <TabsTrigger value="seguidores" className="py-2 px-4 rounded-md">Aumente Seguidores</TabsTrigger>
           <TabsTrigger value="engajamento" className="py-2 px-4 rounded-md">Engaje Público</TabsTrigger>
           <TabsTrigger value="trafego" className="py-2 px-4 rounded-md">Direcionar Tráfego</TabsTrigger>
         </TabsList>
 
         <TabsContent value="todos" className="mt-6 space-y-8">
           <section>
             <div className="flex items-center gap-2 mb-4">
               <Target className="w-5 h-5 text-primary" />
               <h2 className="text-lg font-semibold">Por Objetivo</h2>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {modelos.filter(m => m.category === "objetivo").map(modelo => (
                 <ModeloCard key={modelo.id} modelo={modelo} />
               ))}
             </div>
           </section>
 
           <section>
             <div className="flex items-center gap-2 mb-4">
               <Zap className="w-5 h-5 text-orange-500" />
               <h2 className="text-lg font-semibold">Por Gatilho</h2>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {modelos.filter(m => m.category === "gatilho").map(modelo => (
                 <ModeloCard key={modelo.id} modelo={modelo} />
               ))}
             </div>
           </section>
         </TabsContent>
       </Tabs>
     </div>
   );
 }
 
 function ModeloCard({ modelo }: { modelo: any }) {
   const navigate = useNavigate();
   
   const getTriggerIcon = (trigger: string) => {
     switch(trigger) {
       case "Comentário": return <MessageCircle className="w-3.5 h-3.5" />;
       case "DM": return <Heart className="w-3.5 h-3.5" />;
       case "Story": return <Share2 className="w-3.5 h-3.5" />;
       case "Live": return <PlayCircle className="w-3.5 h-3.5" />;
       default: return <Zap className="w-3.5 h-3.5" />;
     }
   };
 
   return (
     <Card className="group hover:border-primary/50 transition-all duration-300 bg-card/40 backdrop-blur-sm border-border/40 flex flex-col h-full overflow-hidden">
       <CardHeader className="p-5 pb-3">
         <div className="flex justify-between items-start mb-2">
           <Badge variant="outline" className="text-[10px] font-medium bg-primary/5 text-primary border-primary/20 uppercase tracking-wider">
             {modelo.tag}
           </Badge>
           {modelo.pro && (
             <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-bold">
               PRO
             </Badge>
           )}
         </div>
         <CardTitle className="text-base font-bold group-hover:text-primary transition-colors leading-snug">
           {modelo.title}
         </CardTitle>
       </CardHeader>
       <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-between">
         <CardDescription className="text-xs line-clamp-2 leading-relaxed mb-4">
           {modelo.description}
         </CardDescription>
         <div className="flex items-center justify-between mt-auto">
           <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium bg-muted/30 px-2 py-1 rounded-md">
             {getTriggerIcon(modelo.trigger)}
             <span>{modelo.trigger}</span>
           </div>
           <Button 
             size="sm" 
             className="h-8 text-xs font-semibold px-4 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
             onClick={() => navigate(`/instagram/automacao?template=${modelo.id}`)}
           >
             Usar Modelo
           </Button>
         </div>
       </CardContent>
     </Card>
   );
 }