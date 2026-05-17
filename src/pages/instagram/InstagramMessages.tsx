 import { useState, useRef, useEffect, useMemo } from "react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { Search, Send, Instagram, Loader2, ArrowLeft, FileText, X, Image as ImageIcon, MessageSquare } from "lucide-react";
 import { useInstagramMessages, InstagramConversation } from "@/hooks/useInstagramMessages";
 import { useMessageTemplates } from "@/hooks/useMessageTemplates";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { format, isToday, isYesterday } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 import { useIsMobile } from "@/hooks/use-mobile";
 
 const formatTimestamp = (ts: string) => {
   const date = new Date(ts);
   if (isToday(date)) return format(date, "HH:mm");
   if (isYesterday(date)) return "Ontem";
   return format(date, "dd/MM/yyyy", { locale: ptBR });
 };
 
 export default function InstagramMessages() {
   const { conversations, isLoading } = useInstagramMessages();
   const { templates } = useMessageTemplates();
   const [selectedIgId, setSelectedIgId] = useState<string | null>(null);
   const [searchTerm, setSearchTerm] = useState("");
   const [newMessage, setNewMessage] = useState("");
   const [sending, setSending] = useState(false);
   const scrollRef = useRef<HTMLDivElement>(null);
   const { toast } = useToast();
   const isMobile = useIsMobile();
   const [showList, setShowList] = useState(true);
 
   const filteredConversations = useMemo(() => {
     return conversations.filter(c => 
       c.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
       c.ig_user_id.includes(searchTerm)
     );
   }, [conversations, searchTerm]);
 
   const selectedConversation = useMemo(() => {
     return conversations.find(c => c.ig_user_id === selectedIgId) || null;
   }, [conversations, selectedIgId]);
 
   useEffect(() => {
     if (scrollRef.current) {
       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
   }, [selectedConversation?.messages]);
 
   const handleSelect = (igId: string) => {
     setSelectedIgId(igId);
     if (isMobile) setShowList(false);
   };
 
   const handleApplyTemplate = (content: string) => {
     setNewMessage(content);
   };

   const handleSend = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!newMessage.trim() || !selectedIgId || sending) return;
 
     setSending(true);
     try {
       const { error } = await supabase.functions.invoke("send-message", {
         body: {
           phone: selectedIgId,
           message: newMessage,
           isInstagram: true
         }
       });
 
       if (error) throw error;
       setNewMessage("");
     } catch (err: any) {
       toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
     } finally {
       setSending(false);
     }
   };
 
   if (isLoading) {
     return (
       <div className="flex h-[calc(100vh-120px)] items-center justify-center">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="flex h-[calc(100vh-120px)] overflow-hidden border border-border rounded-xl bg-card">
       {/* Conversation List */}
       <div className={cn(
         "w-full md:w-[350px] border-r border-border flex flex-col",
         isMobile && !showList && "hidden"
       )}>
         <div className="p-4 border-b border-border space-y-4">
           <div className="flex items-center justify-between">
             <h2 className="text-lg font-bold flex items-center gap-2">
               <Instagram className="w-5 h-5 text-pink-500" />
               DMs Instagram
             </h2>
           </div>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input 
               placeholder="Buscar conversa..." 
               className="pl-9 h-9"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
         </div>
         <ScrollArea className="flex-1">
           {filteredConversations.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
               <p className="text-sm">Nenhuma conversa encontrada</p>
             </div>
           ) : (
             <div className="divide-y divide-border">
               {filteredConversations.map((conv) => (
                 <button
                   key={conv.ig_user_id}
                   onClick={() => handleSelect(conv.ig_user_id)}
                   className={cn(
                     "w-full p-4 flex items-center gap-3 transition-colors text-left",
                     selectedIgId === conv.ig_user_id ? "bg-primary/10" : "hover:bg-muted/50"
                   )}
                 >
                   <Avatar className="h-10 w-10 border border-border">
                      {conv.profile_pic_url && (
                        <AvatarImage src={conv.profile_pic_url} alt={conv.username} />
                      )}
                     <AvatarFallback className="text-xs uppercase">
                       {conv.username.slice(0, 2)}
                     </AvatarFallback>
                   </Avatar>
                   <div className="flex-1 overflow-hidden">
                     <div className="flex items-center justify-between mb-0.5">
                       <span className="font-semibold text-sm truncate">@{conv.username}</span>
                       <span className="text-[10px] text-muted-foreground">
                         {formatTimestamp(conv.lastTimestamp)}
                       </span>
                     </div>
                     <p className="text-xs text-muted-foreground truncate italic">
                       {conv.lastMessage}
                     </p>
                   </div>
                 </button>
               ))}
             </div>
           )}
         </ScrollArea>
       </div>
 
       {/* Chat Area */}
       <div className={cn(
         "flex-1 flex flex-col bg-muted/5",
         isMobile && showList && "hidden"
       )}>
         {selectedConversation ? (
           <>
             {/* Chat Header */}
             <div className="p-3 border-b border-border bg-card flex items-center gap-3">
               {isMobile && (
                 <Button variant="ghost" size="icon" onClick={() => setShowList(true)}>
                   <ArrowLeft className="w-5 h-5" />
                 </Button>
               )}
               <Avatar className="h-9 w-9 border border-border">
                  {selectedConversation.profile_pic_url && (
                    <AvatarImage src={selectedConversation.profile_pic_url} alt={selectedConversation.username} />
                  )}
                 <AvatarFallback className="text-xs uppercase">
                   {selectedConversation.username.slice(0, 2)}
                 </AvatarFallback>
               </Avatar>
               <div className="flex-1">
                 <h3 className="font-bold text-sm">@{selectedConversation.username}</h3>
                 <p className="text-[10px] text-muted-foreground">ID: {selectedConversation.ig_user_id}</p>
               </div>
             </div>
 
             {/* Messages */}
             <ScrollArea className="flex-1 p-4" ref={scrollRef}>
               <div className="space-y-4">
                 {selectedConversation.messages.map((msg) => {
                   const isSent = msg.event_type === "dm_sent";
                   const isStoryReply = msg.event_type === "story_reply";
                   const mediaUrl = msg.payload?.media_url || msg.payload?.image_url;

                   return (
                     <div 
                       key={msg.id} 
                       className={cn(
                         "flex flex-col",
                         isSent ? "items-end" : "items-start"
                       )}
                     >
                       {isStoryReply && (
                         <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1 px-1">
                           <ImageIcon className="w-3 h-3" />
                           Respondeu ao seu story
                         </div>
                       )}
                       <div className={cn(
                         "max-w-[80%] rounded-2xl px-4 py-2.5 space-y-1 shadow-sm relative overflow-hidden",
                         isSent 
                           ? "bg-primary text-primary-foreground rounded-tr-none" 
                           : "bg-card border border-border rounded-tl-none",
                         isStoryReply && "border-l-4 border-l-pink-500"
                       )}>
                         {mediaUrl && (
                           <div className="mb-2 rounded-lg overflow-hidden border border-border/20">
                             <img src={mediaUrl} alt="Media" className="max-w-full h-auto object-cover max-h-60" />
                           </div>
                         )}
                         <p className="text-sm whitespace-pre-wrap">
                           {msg.comment_text || (mediaUrl ? "[Imagem]" : "[Mensagem sem texto]")}
                         </p>
                         <div className="flex items-center justify-end gap-1.5 mt-1">
                           <p className={cn(
                             "text-[9px]",
                             isSent ? "text-primary-foreground/70" : "text-muted-foreground"
                           )}>
                             {format(new Date(msg.created_at), "HH:mm")}
                           </p>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </ScrollArea>
 
               {/* Input Area */}
               <div className="p-4 bg-card border-t border-border">
                 <form onSubmit={handleSend} className="flex flex-col gap-2">
                   <div className="flex gap-2 items-center">
                     <Popover>
                       <PopoverTrigger asChild>
                         <Button type="button" variant="outline" size="icon" className="shrink-0" title="Modelos de mensagem">
                           <FileText className="w-4 h-4" />
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-80 p-0" align="start">
                         <div className="p-3 border-b border-border bg-muted/50">
                           <h4 className="font-semibold text-sm">Modelos de Mensagem</h4>
                         </div>
                         <ScrollArea className="h-72">
                           <div className="p-2 space-y-1">
                             {templates.length === 0 ? (
                               <p className="text-xs text-center py-4 text-muted-foreground">Nenhum modelo encontrado</p>
                             ) : (
                               templates.map((t) => (
                                 <button
                                   key={t.id}
                                   type="button"
                                   onClick={() => handleApplyTemplate(t.content)}
                                   className="w-full text-left p-2 hover:bg-muted rounded-md transition-colors border border-transparent hover:border-border group"
                                 >
                                   <p className="text-xs font-medium truncate">{t.name}</p>
                                   <p className="text-[10px] text-muted-foreground truncate line-clamp-1">{t.content}</p>
                                 </button>
                               ))
                             )}
                           </div>
                         </ScrollArea>
                       </PopoverContent>
                     </Popover>

                     <div className="relative flex-1">
                       <Input 
                         placeholder="Escreva sua mensagem..." 
                         value={newMessage}
                         onChange={e => setNewMessage(e.target.value)}
                         className="pr-10"
                       />
                       {newMessage && (
                         <button 
                           type="button"
                           onClick={() => setNewMessage("")}
                           className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                         >
                           <X className="w-4 h-4" />
                         </button>
                       )}
                     </div>

                     <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                       {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                     </Button>
                   </div>
                 </form>
               </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
             <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
               <Instagram className="w-8 h-8 opacity-20" />
             </div>
             <h3 className="font-semibold text-lg">Suas Mensagens</h3>
             <p className="text-sm text-center max-w-xs mt-1">
               Selecione uma conversa ao lado para começar a responder seus directs do Instagram em tempo real.
             </p>
           </div>
         )}
       </div>
     </div>
   );
 }