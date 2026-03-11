import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, ArrowLeft, Loader2, UserPlus, Pencil, Camera, Megaphone, Bot, Send, SendHorizonal } from "lucide-react";
import { useMessageLogs, type Conversation, type UnifiedMessage } from "@/hooks/useMessageLogs";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const formatPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    return `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (clean.length >= 10) return `+${clean}`;
  return phone;
};

const formatTimestamp = (ts: string) => {
  const date = new Date(ts);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

const formatMessageTime = (ts: string) => format(new Date(ts), "HH:mm");

const formatDateSeparator = (ts: string) => {
  const date = new Date(ts);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

const getInitials = (name: string | null, phone: string) => {
  if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return phone.replace(/\D/g, '').slice(-2);
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'campaign': return <Megaphone className="w-3 h-3" />;
    case 'flow': return <Bot className="w-3 h-3" />;
    case 'manual': return <Send className="w-3 h-3" />;
    default: return null;
  }
};

const getSourceLabel = (source: string, keyword?: string | null) => {
  switch (source) {
    case 'campaign': return '📢 Campanha';
    case 'flow': return keyword ? `🤖 ${keyword}` : '🤖 Fluxo';
    case 'manual': return '✉️ Envio manual';
    default: return '';
  }
};

// Save contact dialog
const SaveContactDialog = ({
  open, onOpenChange, phone, currentName, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; phone: string; currentName: string; onSave: (name: string) => void;
}) => {
  const [name, setName] = useState(currentName);
  useEffect(() => { setName(currentName); }, [currentName, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{currentName ? "Editar Contato" : "Salvar Contato"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Número</label>
            <p className="text-foreground font-medium">{formatPhone(phone)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nome</label>
            <Input placeholder="Digite o nome do contato..." value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(name); onOpenChange(false); }} disabled={!name.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Conversation list
const ConversationList = ({
  conversations, selectedPhone, onSelect, searchTerm, onSearchChange,
}: {
  conversations: Conversation[]; selectedPhone: string | null; onSelect: (phone: string) => void; searchTerm: string; onSearchChange: (v: string) => void;
}) => (
  <div className="flex flex-col h-full bg-card border-r border-border">
    <div className="p-3 border-b border-border bg-muted/30">
      <h2 className="text-lg font-semibold text-foreground mb-3">Conversas</h2>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input placeholder="Buscar por nome ou número..." className="pl-9 h-9 text-sm bg-background" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
      </div>
    </div>
    <ScrollArea className="flex-1">
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm">Nenhuma conversa</p>
        </div>
      ) : (
        conversations.map((conv) => (
          <button
            key={conv.phone}
            onClick={() => onSelect(conv.phone)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50",
              selectedPhone === conv.phone && "bg-muted"
            )}
          >
            <Avatar className="h-11 w-11 shrink-0">
              {conv.profilePictureUrl && <AvatarImage src={conv.profilePictureUrl} />}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getInitials(conv.contactName, conv.phone)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground truncate">
                  {conv.contactName || formatPhone(conv.phone)}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                  {formatTimestamp(conv.lastTimestamp)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {conv.lastMessage.length > 60 ? conv.lastMessage.slice(0, 60) + '...' : conv.lastMessage}
              </p>
            </div>
            {conv.messages.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {conv.messages.length}
              </Badge>
            )}
          </button>
        ))
      )}
    </ScrollArea>
  </div>
);

// Chat view
const ChatView = ({
  conversation, onBack, isMobile, onSaveContact, onFetchPhoto, loadingPhoto, onSendMessage,
}: {
  conversation: Conversation | null; onBack: () => void; isMobile: boolean;
  onSaveContact: (phone: string, currentName: string) => void; onFetchPhoto: (phone: string) => void; loadingPhoto: boolean;
  onSendMessage: (phone: string, message: string) => Promise<void>;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation || sending) return;
    setSending(true);
    try {
      await onSendMessage(conversation.phone, newMessage.trim());
      setNewMessage("");
    } catch (e) {
      // error handled by parent
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
        <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
        <h3 className="text-lg font-medium">Selecione uma conversa</h3>
        <p className="text-sm mt-1">Escolha uma conversa para ver as mensagens</p>
      </div>
    );
  }

  const messagesByDate = new Map<string, UnifiedMessage[]>();
  conversation.messages.forEach((msg) => {
    const dateKey = format(new Date(msg.timestamp), "yyyy-MM-dd");
    const existing = messagesByDate.get(dateKey) || [];
    existing.push(msg);
    messagesByDate.set(dateKey, existing);
  });

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          {conversation.profilePictureUrl && <AvatarImage src={conversation.profilePictureUrl} />}
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {getInitials(conversation.contactName, conversation.phone)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">
            {conversation.contactName || formatPhone(conversation.phone)}
          </h3>
          <p className="text-xs text-muted-foreground">
            {conversation.contactName ? formatPhone(conversation.phone) : `${conversation.messages.length} mensagens`}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Buscar foto" onClick={() => onFetchPhoto(conversation.phone)} disabled={loadingPhoto}>
            {loadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={conversation.contactName ? "Editar contato" : "Salvar contato"} onClick={() => onSaveContact(conversation.phone, conversation.contactName || '')}>
            {conversation.contactName ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-1">
          {Array.from(messagesByDate.entries()).map(([dateKey, msgs]) => (
            <div key={dateKey}>
              <div className="flex justify-center my-3">
                <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {formatDateSeparator(msgs[0].timestamp)}
                </span>
              </div>
              {msgs.map((msg) => (
                <div key={msg.id} className="mb-2">
                  {msg.type === 'received' ? (
                    <div className="flex justify-start">
                      <div className="max-w-[75%] bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] text-muted-foreground text-right mt-1">
                          {formatMessageTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          {msg.source !== 'message_log' && (
                            <span className="text-[9px] opacity-70 flex items-center gap-0.5">
                              {getSourceIcon(msg.source)}
                              {getSourceLabel(msg.source, msg.keyword_matched)}
                            </span>
                          )}
                          <span className="text-[10px] opacity-80">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <Textarea
            placeholder="Digite uma mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            className="shrink-0 h-10 w-10"
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

const MensagensRecebidas = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogPhone, setSaveDialogPhone] = useState("");
  const [saveDialogName, setSaveDialogName] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const { conversations, loading, saveContact, fetchProfilePicture, sendMessage } = useMessageLogs();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return conv.phone.includes(term) || conv.lastMessage.toLowerCase().includes(term) || (conv.contactName && conv.contactName.toLowerCase().includes(term));
  });

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone) || null;

  const handleSaveContact = (phone: string, currentName: string) => {
    setSaveDialogPhone(phone);
    setSaveDialogName(currentName);
    setSaveDialogOpen(true);
  };

  const handleDoSave = async (name: string) => {
    await saveContact(saveDialogPhone, name);
    toast({ title: "Contato salvo", description: `${name} foi salvo com sucesso.` });
  };

  const handleFetchPhoto = async (phone: string) => {
    setLoadingPhoto(true);
    const url = await fetchProfilePicture(phone);
    setLoadingPhoto(false);
    if (url) {
      toast({ title: "Foto atualizada", description: "Foto de perfil carregada com sucesso." });
    } else {
      toast({ title: "Sem foto", description: "Não foi possível obter a foto de perfil.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const showList = !isMobile || !selectedPhone;
  const showChat = !isMobile || !!selectedPhone;

  return (
    <>
      <div className="h-[calc(100vh-120px)] flex rounded-lg border border-border overflow-hidden bg-background shadow-sm">
        {showList && (
          <div className={cn("flex-shrink-0", isMobile ? "w-full" : "w-[340px]")}>
            <ConversationList conversations={filteredConversations} selectedPhone={selectedPhone} onSelect={setSelectedPhone} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
          </div>
        )}
        {showChat && (
          <ChatView conversation={selectedConversation} onBack={() => setSelectedPhone(null)} isMobile={isMobile} onSaveContact={handleSaveContact} onFetchPhoto={handleFetchPhoto} loadingPhoto={loadingPhoto} />
        )}
      </div>
      <SaveContactDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} phone={saveDialogPhone} currentName={saveDialogName} onSave={handleDoSave} />
    </>
  );
};

export default MensagensRecebidas;
