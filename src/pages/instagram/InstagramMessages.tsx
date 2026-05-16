 import { useState, useRef, useEffect, useMemo } from "react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { Search, Send, Instagram, Loader2, ArrowLeft } from "lucide-react";
 import { useInstagramMessages, InstagramConversation } from "@/hooks/useInstagramMessages";
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
                   return (
                     <div 
                       key={msg.id} 
                       className={cn(
                         "flex",
                         isSent ? "justify-end" : "justify-start"
                       )}
                     >
                       <div className={cn(
                         "max-w-[80%] rounded-2xl px-4 py-2.5 space-y-1 shadow-sm",
                         isSent 
                           ? "bg-primary text-primary-foreground rounded-tr-none" 
                           : "bg-card border border-border rounded-tl-none"
                       )}>
                         <p className="text-sm whitespace-pre-wrap">{msg.comment_text}</p>
                         <p className={cn(
                           "text-[9px] text-right",
                           isSent ? "text-primary-foreground/70" : "text-muted-foreground"
                         )}>
                           {format(new Date(msg.created_at), "HH:mm")}
                         </p>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </ScrollArea>
 
             {/* Input Area */}
             <div className="p-4 bg-card border-t border-border">
               <form onSubmit={handleSend} className="flex gap-2">
                 <Input 
                   placeholder="Escreva sua mensagem..." 
                   value={newMessage}
                   onChange={e => setNewMessage(e.target.value)}
                   className="flex-1"
                 />
                 <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                   {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                 </Button>
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