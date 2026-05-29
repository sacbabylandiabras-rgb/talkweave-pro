import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Send,
  Instagram,
  Loader2,
  ArrowLeft,
  FileText,
  X,
  Image as ImageIcon,
  MessageSquare,
  Heart,
  Share2,
  Smile,
  Paperclip,
  CheckCheck,
  Check,
  RefreshCw,
} from "lucide-react";
import { useInstagramMessages } from "@/hooks/useInstagramMessages";
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

const formatMessageTime = (ts: string) => format(new Date(ts), "HH:mm");

const formatDateSeparator = (ts: string) => {
  const date = new Date(ts);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

const getEventTypeLabel = (type: string) => {
  switch (type) {
    case "story_reply":
      return "📖 Respondeu ao story";
    case "comment":
      return "💬 Comentário";
    case "follow":
      return "👤 Novo seguidor";
    default:
      return null;
  }
};

const InstagramAvatar = ({
  src,
  username,
  size = "md",
}: {
  src?: string | null;
  username: string;
  size?: "sm" | "md" | "lg";
}) => {
  const sizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  return (
    <Avatar className={cn(sizeClass, "border border-border/50 shrink-0")}>
      {src && (
        <AvatarImage
          src={src}
          alt={username}
          className="object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <AvatarFallback
        className={cn("bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold", textSize)}
      >
        {username.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
};

export default function InstagramMessages() {
  const [selectedIgId, setSelectedIgId] = useState<string | null>(null);
  const { conversations, selectedConversation, isLoading } = useInstagramMessages(selectedIgId);
  const { templates } = useMessageTemplates();
  const [searchTerm, setSearchTerm] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showChat, setShowChat] = useState(false);

  const filteredConversations = useMemo(
    () =>
      conversations.filter(
        (c) => c.username.toLowerCase().includes(searchTerm.toLowerCase()) || c.ig_user_id.includes(searchTerm),
      ),
    [conversations, searchTerm],
  );

  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
          t.content.toLowerCase().includes(templateSearch.toLowerCase()),
      ),
    [templates, templateSearch],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  const handleSelect = (igId: string) => {
    setSelectedIgId(igId);
    if (isMobile) setShowChat(true);
  };

  const handleBack = () => {
    setShowChat(false);
    setSelectedIgId(null);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedIgId || sending) return;
    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { error } = await supabase.functions.invoke("webhook-instagram", {
        body: { action: "send_manual_message", recipientId: selectedIgId, message: newMessage, userId: user.id },
      });
      if (error) throw error;
      setNewMessage("");
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const messagesByDate = useMemo(() => {
    if (!selectedConversation) return new Map();
    const map = new Map<string, typeof selectedConversation.messages>();
    selectedConversation.messages.forEach((msg) => {
      const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
      const existing = map.get(dateKey) || [];
      existing.push(msg);
      map.set(dateKey, existing);
    });
    return map;
  }, [selectedConversation?.messages]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const showList = !isMobile || !showChat;
  const showChatArea = !isMobile || showChat;

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden border border-border rounded-xl bg-card shadow-sm">
      {/* ─── Lista de Conversas ─── */}
      {showList && (
        <div className={cn("flex flex-col border-r border-border bg-card", isMobile ? "w-full" : "w-[380px] shrink-0")}>
          {/* Header */}
          <div className="p-4 border-b border-border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Instagram className="w-5 h-5 text-pink-500" aria-hidden="true" />
                DMs Instagram
              </h2>
              <Badge variant="secondary" className="text-[10px]">
                {conversations.length}
              </Badge>
            </div>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar por nome ou ID..."
                className="pl-9 h-9 text-sm bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Conversation list */}
          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Instagram className="w-10 h-10 mb-2 opacity-30" aria-hidden="true" />
                <p className="text-sm font-medium">Nenhuma conversa</p>
                <p className="text-xs mt-1 opacity-70">As DMs aparecerão aqui</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.ig_user_id}
                  onClick={() => handleSelect(conv.ig_user_id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50",
                    selectedIgId === conv.ig_user_id && !isMobile && "bg-muted",
                  )}
                >
                  <div className="relative shrink-0">
                    <InstagramAvatar src={conv.profile_pic_url} username={conv.username} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-background flex items-center justify-center">
                      <Instagram className="w-2 h-2 text-white" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-medium text-sm text-foreground truncate">@{conv.username}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatTimestamp(conv.lastTimestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage || "Sem mensagens"}</p>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>
      )}

      {/* ─── Área de Chat ─── */}
      {showChatArea && (
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
                {isMobile && (
                  <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <InstagramAvatar src={selectedConversation.profile_pic_url} username={selectedConversation.username} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground truncate">@{selectedConversation.username}</h3>
                  <p className="text-[11px] text-muted-foreground">{selectedConversation.messages.length} mensagens</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`https://www.instagram.com/${selectedConversation.username}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-pink-500 hover:underline hidden sm:block"
                  >
                    ver perfil
                  </a>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-3 bg-background">
                <div className="max-w-3xl mx-auto space-y-1">
                  {Array.from(messagesByDate.entries()).map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      {/* Date separator */}
                      <div className="flex justify-center my-3">
                        <span className="text-[12px] px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border shadow-sm">
                          {formatDateSeparator(msgs[0].created_at)}
                        </span>
                      </div>

                      {msgs.map((msg) => {
                        const isSent = msg.event_type === "dm_sent";
                        const isStoryReply = msg.event_type === "story_reply";
                        const isComment = msg.event_type === "comment";
                        const isSystem = msg.event_type === "follow";
                        const mediaUrl =
                          msg.payload?.media_url ||
                          msg.payload?.image_url ||
                          msg.payload?.message?.reply_to?.story?.url;
                        const eventLabel = getEventTypeLabel(msg.event_type);

                        // System events (follow, etc)
                        if (isSystem) {
                          return (
                            <div key={msg.id} className="flex justify-center my-2">
                              <span className="text-[11px] px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                                {eventLabel || msg.comment_text}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.id}
                            className={cn("flex mb-2", isSent ? "justify-end" : "justify-start items-end gap-2")}
                          >
                            {/* Avatar for received messages */}
                            {!isSent && (
                              <InstagramAvatar
                                src={selectedConversation.profile_pic_url}
                                username={selectedConversation.username}
                                size="sm"
                              />
                            )}

                            <div className={cn("max-w-[75%] flex flex-col", isSent ? "items-end" : "items-start")}>
                              {/* Story reply badge */}
                              {(isStoryReply || isComment) && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1 px-1">
                                  {isStoryReply ? <Share2 className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
                                  {isStoryReply ? "Respondeu ao story" : "Comentário"}
                                </div>
                              )}

                              <div
                                className={cn(
                                  "rounded-2xl px-3 py-2 shadow-sm",
                                  isSent
                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                    : "bg-card border border-border text-card-foreground rounded-tl-none",
                                  (isStoryReply || isComment) && !isSent && "border-l-4 border-l-pink-500",
                                )}
                              >
                                {/* Story/media preview */}
                                {mediaUrl && (
                                  <div className="mb-2 rounded-lg overflow-hidden border border-border/20 max-w-[200px]">
                                    <img
                                      src={mediaUrl}
                                      alt="Mídia"
                                      className="w-full h-auto object-cover max-h-48"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Message text */}
                                {msg.comment_text ? (
                                  <p className="text-sm whitespace-pre-wrap">{msg.comment_text}</p>
                                ) : mediaUrl ? null : (
                                  <p className="text-sm opacity-60 italic">[Mensagem sem texto]</p>
                                )}

                                {/* Timestamp + status */}
                                <div
                                  className={cn(
                                    "flex items-center gap-1 mt-1",
                                    isSent ? "justify-end" : "justify-start",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "text-[10px]",
                                      isSent ? "text-primary-foreground/70" : "text-muted-foreground",
                                    )}
                                  >
                                    {formatMessageTime(msg.created_at)}
                                  </span>
                                  {isSent && (
                                    <CheckCheck className="w-3 h-3 text-primary-foreground/70" aria-hidden="true" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t border-border bg-background px-4 py-3 shrink-0">
                <div className="max-w-3xl mx-auto flex items-end gap-2">
                  {/* Template picker */}
                  <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" title="Modelos de mensagem">
                        <FileText className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start" side="top">
                      <div className="p-3 border-b border-border">
                        <h4 className="text-sm font-semibold mb-2">Modelos de Mensagem</h4>
                        <Input
                          placeholder="Buscar modelo..."
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <ScrollArea className="max-h-[300px]">
                        {filteredTemplates.length === 0 ? (
                          <p className="text-xs text-center py-6 text-muted-foreground">Nenhum modelo encontrado</p>
                        ) : (
                          <div className="py-1">
                            {filteredTemplates.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setNewMessage(t.content);
                                  setTemplatePopoverOpen(false);
                                  setTemplateSearch("");
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                              >
                                <p className="text-sm font-medium truncate">{t.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.content}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  {/* Text input */}
                  <Textarea
                    placeholder="Escreva uma mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[40px] max-h-[120px] resize-none text-sm flex-1 bg-white text-black placeholder:text-black/60 border-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg shadow-sm"
                    rows={1}
                  />

                  {/* Clear */}
                  {newMessage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-10 w-10"
                      onClick={() => setNewMessage("")}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  )}

                  {/* Send */}
                  <Button
                    size="icon"
                    className="shrink-0 h-10 w-10"
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    title="Enviar mensagem"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="w-4 h-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/10">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-border flex items-center justify-center mb-4">
                <Instagram className="w-10 h-10 opacity-30" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Suas Mensagens</h3>
              <p className="text-sm text-center max-w-xs mt-2 leading-relaxed">
                Selecione uma conversa ao lado para começar a responder seus directs do Instagram.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
