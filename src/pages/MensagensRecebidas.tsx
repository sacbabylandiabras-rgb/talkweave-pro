import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, ArrowLeft, Loader2 } from "lucide-react";
import { useMessageLogs, type Conversation, type MessageLog } from "@/hooks/useMessageLogs";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const formatPhone = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    return `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (clean.length >= 10) {
    return `+${clean}`;
  }
  return phone;
};

const formatTimestamp = (ts: string) => {
  const date = new Date(ts);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

const formatMessageTime = (ts: string) => {
  return format(new Date(ts), "HH:mm");
};

const formatDateSeparator = (ts: string) => {
  const date = new Date(ts);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

const getInitials = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  return clean.slice(-2);
};

// Conversation list sidebar
const ConversationList = ({
  conversations,
  selectedPhone,
  onSelect,
  searchTerm,
  onSearchChange,
}: {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
}) => (
  <div className="flex flex-col h-full bg-card border-r border-border">
    <div className="p-3 border-b border-border bg-muted/30">
      <h2 className="text-lg font-semibold text-foreground mb-3">Conversas</h2>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar conversa..."
          className="pl-9 h-9 text-sm bg-background"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
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
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getInitials(conv.phone)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground truncate">
                  {formatPhone(conv.phone)}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                  {formatTimestamp(conv.lastTimestamp)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {conv.lastMessage}
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

// Chat message bubbles
const ChatView = ({
  conversation,
  onBack,
  isMobile,
}: {
  conversation: Conversation | null;
  onBack: () => void;
  isMobile: boolean;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
        <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
        <h3 className="text-lg font-medium">Selecione uma conversa</h3>
        <p className="text-sm mt-1">Escolha uma conversa para ver as mensagens</p>
      </div>
    );
  }

  // Group messages by date
  const messagesByDate = new Map<string, MessageLog[]>();
  conversation.messages.forEach((msg) => {
    const dateKey = format(new Date(msg.timestamp), "yyyy-MM-dd");
    const existing = messagesByDate.get(dateKey) || [];
    existing.push(msg);
    messagesByDate.set(dateKey, existing);
  });

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {getInitials(conversation.phone)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-medium text-foreground">{formatPhone(conversation.phone)}</h3>
          <p className="text-xs text-muted-foreground">{conversation.messages.length} mensagens</p>
        </div>
      </div>

      {/* Messages area */}
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
                <div key={msg.id} className="space-y-1 mb-2">
                  {/* Received message */}
                  {msg.message_received && (
                    <div className="flex justify-start">
                      <div className="max-w-[75%] bg-card border border-border rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message_received}</p>
                        <p className="text-[10px] text-muted-foreground text-right mt-1">
                          {formatMessageTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Sent response */}
                  {msg.response_sent && (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                        <p className="text-sm whitespace-pre-wrap">{msg.response_sent}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          {msg.keyword_matched && (
                            <span className="text-[9px] opacity-70">🤖 {msg.keyword_matched}</span>
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
    </div>
  );
};

const MensagensRecebidas = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const { conversations, loading } = useMessageLogs();
  const isMobile = useIsMobile();

  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      conv.phone.includes(term) ||
      conv.lastMessage.toLowerCase().includes(term)
    );
  });

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone) || null;

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
    <div className="h-[calc(100vh-120px)] flex rounded-lg border border-border overflow-hidden bg-background shadow-sm">
      {showList && (
        <div className={cn("flex-shrink-0", isMobile ? "w-full" : "w-[340px]")}>
          <ConversationList
            conversations={filteredConversations}
            selectedPhone={selectedPhone}
            onSelect={setSelectedPhone}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        </div>
      )}
      {showChat && (
        <ChatView
          conversation={selectedConversation}
          onBack={() => setSelectedPhone(null)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

export default MensagensRecebidas;
