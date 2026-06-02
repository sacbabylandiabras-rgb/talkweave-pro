import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Search, Send, Paperclip, Smile, MessageSquare, Settings, ChevronDown, Phone, MoreVertical,
  FileText, Download, MapPin, User, BarChart3, Image as ImageIcon, Video, Music, Mic, Sticker,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type TelegramMediaKind = "photo" | "video" | "animation" | "document" | "audio" | "voice" | "video_note" | "sticker" | "location" | "venue" | "contact" | "poll" | "unknown";

interface ChatMedia {
  kind: TelegramMediaKind;
  label: string;
  url?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  downloadable?: boolean;
  extra?: Record<string, any>;
}

interface ChatButton {
  text: string;
  url?: string;
  callbackData?: string;
}

interface ChatMsg { id: string; from: "me" | "them"; text: string; time: string; media: ChatMedia[]; buttons: ChatButton[][]; }
interface Conversation {
  id: string;
  name: string;
  username: string;
  last_msg: string;
  last_time: string;
  unread: number;
  online: boolean;
  type: "todos" | "suporte";
  messages: ChatMsg[];
  bot_id?: string;
  chat_id?: number;
}

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL || "https://yodgjxdekuraxquxkxhx.supabase.co"}/functions/v1`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function getTelegramMessage(rawUpdate: any) {
  return rawUpdate?.message ?? rawUpdate?.edited_message ?? rawUpdate?.callback_query?.message ?? null;
}

function extractMedia(message: any): ChatMedia[] {
  if (!message) return [];
  const caption = message.caption ? String(message.caption) : "";
  const sourceUrl = message.source_media_url || message.photo_url || message.video_url || message.document_url || message.audio_url;
  if (message.photo?.length) {
    const photo = [...message.photo].sort((a: any, b: any) => (b.file_size || 0) - (a.file_size || 0))[0];
    return [{ kind: "photo", label: caption || "Foto", url: sourceUrl, fileId: photo?.file_id, downloadable: true }];
  }
  if (message.video) return [{ kind: "video", label: caption || "Vídeo", url: sourceUrl, fileId: message.video.file_id, fileName: message.video.file_name, mimeType: message.video.mime_type, downloadable: true }];
  if (message.animation) return [{ kind: "animation", label: caption || "GIF/animação", url: sourceUrl, fileId: message.animation.file_id, fileName: message.animation.file_name, mimeType: message.animation.mime_type, downloadable: true }];
  if (message.document) return [{ kind: "document", label: caption || message.document.file_name || "Documento", url: sourceUrl, fileId: message.document.file_id, fileName: message.document.file_name, mimeType: message.document.mime_type, downloadable: true }];
  if (message.audio) return [{ kind: "audio", label: caption || message.audio.title || message.audio.file_name || "Áudio", url: sourceUrl, fileId: message.audio.file_id, fileName: message.audio.file_name, mimeType: message.audio.mime_type, downloadable: true }];
  if (message.voice) return [{ kind: "voice", label: caption || "Mensagem de voz", url: sourceUrl, fileId: message.voice.file_id, mimeType: message.voice.mime_type, downloadable: true }];
  if (message.video_note) return [{ kind: "video_note", label: caption || "Vídeo circular", url: sourceUrl, fileId: message.video_note.file_id, downloadable: true }];
  if (message.sticker) return [{ kind: "sticker", label: message.sticker.emoji ? `Figurinha ${message.sticker.emoji}` : "Figurinha", url: sourceUrl, fileId: message.sticker.file_id, fileName: message.sticker.file_name, mimeType: message.sticker.mime_type, downloadable: true }];
  if (message.location) return [{ kind: "location", label: "Localização", extra: message.location }];
  if (message.venue) return [{ kind: "venue", label: message.venue.title || "Local", extra: message.venue }];
  if (message.contact) return [{ kind: "contact", label: message.contact.first_name || "Contato", extra: message.contact }];
  if (message.poll) return [{ kind: "poll", label: message.poll.question || "Enquete", extra: message.poll }];
  return [];
}

function extractButtons(message: any): ChatButton[][] {
  const inlineKeyboard = message?.reply_markup?.inline_keyboard;
  if (Array.isArray(inlineKeyboard)) {
    return inlineKeyboard
      .map((row: any[]) => Array.isArray(row) ? row.map((button: any) => ({
        text: String(button?.text || "Botão"),
        url: button?.url || button?.web_app?.url || button?.login_url?.url,
        callbackData: button?.callback_data || button?.switch_inline_query || button?.switch_inline_query_current_chat,
      })) : [])
      .filter((row) => row.length > 0);
  }

  const keyboard = message?.reply_markup?.keyboard;
  if (Array.isArray(keyboard)) {
    return keyboard
      .map((row: any[]) => Array.isArray(row) ? row.map((button: any) => ({
        text: typeof button === "string" ? button : String(button?.text || "Botão"),
      })) : [])
      .filter((row) => row.length > 0);
  }

  return [];
}

function mediaPreview(media: ChatMedia[]) {
  const item = media[0];
  if (!item) return "";
  const labels: Record<TelegramMediaKind, string> = {
    photo: "📷 Foto",
    video: "🎬 Vídeo",
    animation: "🎞️ GIF",
    document: "📎 Documento",
    audio: "🎵 Áudio",
    voice: "🎙️ Voz",
    video_note: "🎥 Vídeo circular",
    sticker: "💟 Figurinha",
    location: "📍 Localização",
    venue: "📍 Local",
    contact: "👤 Contato",
    poll: "📊 Enquete",
    unknown: "📎 Mídia",
  };
  return labels[item.kind] || "📎 Mídia";
}

function mediaIcon(kind: TelegramMediaKind) {
  if (kind === "photo") return <ImageIcon className="h-4 w-4" />;
  if (kind === "video" || kind === "animation" || kind === "video_note") return <Video className="h-4 w-4" />;
  if (kind === "audio") return <Music className="h-4 w-4" />;
  if (kind === "voice") return <Mic className="h-4 w-4" />;
  if (kind === "sticker") return <Sticker className="h-4 w-4" />;
  if (kind === "location" || kind === "venue") return <MapPin className="h-4 w-4" />;
  if (kind === "contact") return <User className="h-4 w-4" />;
  if (kind === "poll") return <BarChart3 className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function TelegramMediaBubble({ media, botId }: { media: ChatMedia; botId?: string }) {
  const [url, setUrl] = useState<string>("");
  const [contentType, setContentType] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    async function loadFile() {
      if (!media.fileId || !botId || media.kind === "location" || media.kind === "venue" || media.kind === "contact" || media.kind === "poll") return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/telegram-media?bot_id=${encodeURIComponent(botId)}&file_id=${encodeURIComponent(media.fileId)}`, {
          headers: {
            ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
        });
        if (!res.ok) throw new Error("Falha ao carregar mídia");
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setContentType(blob.type || media.mimeType || "");
        if (!cancelled) setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setFailed(true);
      }
    }
    loadFile();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media.fileId, media.kind, botId]);

  if (media.kind === "location" || media.kind === "venue") {
    const lat = media.extra?.latitude;
    const lon = media.extra?.longitude;
    return (
      <a className="mt-2 flex items-center gap-2 rounded-xl border bg-muted/40 p-3 text-xs underline-offset-4 hover:underline" href={lat && lon ? `https://maps.google.com/?q=${lat},${lon}` : undefined} target="_blank" rel="noreferrer">
        {mediaIcon(media.kind)} <span>{media.label}</span>
      </a>
    );
  }

  if (media.kind === "contact") {
    return <div className="mt-2 flex items-center gap-2 rounded-xl border bg-muted/40 p-3 text-xs">{mediaIcon(media.kind)}<span>{media.label} {media.extra?.phone_number ? `• ${media.extra.phone_number}` : ""}</span></div>;
  }

  if (media.kind === "poll") {
    return <div className="mt-2 rounded-xl border bg-muted/40 p-3 text-xs"><div className="flex items-center gap-2 font-medium">{mediaIcon(media.kind)}<span>{media.label}</span></div>{media.extra?.options?.map((o: any, i: number) => <div key={i} className="mt-1 text-muted-foreground">• {o.text}</div>)}</div>;
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border bg-muted/40">
      {url && media.kind === "photo" && <img src={url} alt={media.label} className="max-h-80 w-full object-contain" />}
      {url && (media.kind === "video" || media.kind === "animation" || media.kind === "video_note") && <video src={url} controls className="max-h-80 w-full" />}
      {url && (media.kind === "audio" || media.kind === "voice") && <audio src={url} controls className="w-full p-2" />}
      {url && media.kind === "sticker" && contentType.startsWith("image/") && <img src={url} alt={media.label} className="max-h-48 w-full object-contain p-2" />}
      {url && media.kind === "sticker" && contentType.startsWith("video/") && <video src={url} controls className="max-h-48 w-full" />}
      {(media.kind === "document" || !url || (media.kind === "sticker" && !contentType.startsWith("image/") && !contentType.startsWith("video/"))) && (
        <div className="flex items-center gap-2 p-3 text-xs">
          {mediaIcon(media.kind)}
          <span className="min-w-0 flex-1 truncate">{failed ? "Não foi possível carregar a mídia" : (media.fileName || media.label)}</span>
          {url && <a href={url} download={media.fileName || media.label} title="Baixar"><Download className="h-4 w-4" /></a>}
        </div>
      )}
    </div>
  );
}

function TelegramButtons({ rows }: { rows: ChatButton[][] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap gap-1.5">
          {row.map((button, buttonIndex) => {
            const className = "rounded-lg border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted";
            if (button.url) {
              return (
                <a key={buttonIndex} href={button.url} target="_blank" rel="noreferrer" className={className}>
                  {button.text}
                </a>
              );
            }
            return (
              <span key={buttonIndex} className={className} title={button.callbackData || button.text}>
                {button.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function TelegramChat() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"todos" | "suporte">("todos");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = convs.find((c) => c.id === activeId);

  async function loadConversations() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await (supabase as any)
      .from("telegram_messages")
      .select("id, bot_id, chat_id, from_username, from_first_name, text, raw_update, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) { console.error(error); setLoading(false); return; }

    // Group by chat_id
    const grouped = new Map<string, Conversation>();
    for (const row of ([...(data ?? [])] as any[]).reverse()) {
      const key = `${row.bot_id}:${row.chat_id}`;
      const telegramMessage = getTelegramMessage(row.raw_update);
      const media = extractMedia(telegramMessage);
      const buttons = extractButtons(telegramMessage);
      const fromBot = telegramMessage?.from?.is_bot === true;
      const time = new Date(row.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const msg: ChatMsg = {
        id: row.id,
        from: fromBot ? "me" : "them",
        text: row.text || telegramMessage?.caption || "",
        time,
        media,
        buttons,
      };
      const previewText = msg.text || mediaPreview(media) || (buttons.length ? "Botões" : "Mensagem");
      const existing = grouped.get(key);
      if (existing) {
        existing.messages.push(msg);
        existing.last_msg = previewText;
        existing.last_time = time;
        if (!fromBot && (row.from_first_name || row.from_username)) {
          existing.name = row.from_first_name || row.from_username;
          existing.username = row.from_username ? `@${row.from_username}` : `#${row.chat_id}`;
        }
      } else {
        const fallbackName = fromBot ? `Chat ${row.chat_id}` : (row.from_first_name || row.from_username || `Chat ${row.chat_id}`);
        grouped.set(key, {
          id: key,
          name: fallbackName,
          username: !fromBot && row.from_username ? `@${row.from_username}` : `#${row.chat_id}`,
          last_msg: previewText,
          last_time: time,
          unread: 0,
          online: false,
          type: "todos",
          messages: [msg],
          bot_id: row.bot_id,
          chat_id: row.chat_id,
        });
      }
    }

    const list = Array.from(grouped.values()).reverse();
    setConvs(list);
    setLoading(false);
  }

  useEffect(() => {
    loadConversations();
    const channel = supabase
      .channel("telegram-chat-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_messages" }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = convs.filter((c) => {
    const matchTab = tab === "todos" || c.type === tab;
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const counts = {
    todos: convs.length,
    suporte: convs.filter((c) => c.type === "suporte").length,
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [activeId, active?.messages.length]);

  async function send() {
    if (!draft.trim() || !active || !active.bot_id || !active.chat_id) return;
    setSending(true);
    try {
      const { data, error } = await (supabase as any).functions.invoke("telegram-send-message", {
        body: { bot_id: active.bot_id, chat_id: active.chat_id, text: draft.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const newMsg: ChatMsg = { id: crypto.randomUUID(), from: "me", text: draft.trim(), time: "Agora", media: [], buttons: [] };
      setConvs((prev) => prev.map((c) => c.id === activeId
        ? { ...c, messages: [...c.messages, newMsg], last_msg: newMsg.text, last_time: "Agora" }
        : c,
      ));
      setDraft("");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] h-[calc(100vh-160px)] min-h-[600px]">
        {/* Painel esquerdo */}
        <div className="border-r flex flex-col">
          {/* Header */}
          <div className="p-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">LynxChat</h1>
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as "todos" | "suporte")} className="px-4">
            <TabsList className="w-full bg-transparent border-b rounded-none p-0 h-auto justify-start gap-6">
              <TabsTrigger
                value="todos"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 gap-2"
              >
                Todos
                <Badge variant="secondary" className="rounded-full text-[10px] h-5 min-w-[20px] px-1.5">{counts.todos}</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="suporte"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 gap-2"
              >
                Suporte
                <Badge variant="secondary" className="rounded-full text-[10px] h-5 min-w-[20px] px-1.5">{counts.suporte}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sub-header mensagens */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="font-semibold">Mensagens</h2>
            <button className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
              Mais recentes <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Busca */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Busque por usuário"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-full bg-muted/30"
              />
            </div>
          </div>

          {/* Lista */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Carregando mensagens...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma conversa.
              </div>
            ) : filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
                  c.id === activeId && "bg-muted",
                )}
              >
                <div className="relative">
                  <Avatar className="w-10 h-10"><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                  {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{c.last_time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">{c.last_msg}</p>
                    {c.unread > 0 && <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-primary">{c.unread}</Badge>}
                  </div>
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Painel direito - Conversa */}
        <div className="flex flex-col min-h-0 min-w-0 overflow-hidden">
          {active ? (
            <>
              <div className="p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9"><AvatarFallback>{active.name.charAt(0)}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-medium text-sm">{active.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {active.online ? "● online" : "offline"} • {active.username}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Abrir no Telegram"
                    onClick={() => {
                      if (active?.username?.startsWith("@")) {
                        window.open(`https://t.me/${active.username.slice(1)}`, "_blank");
                      }
                    }}
                    disabled={!active?.username?.startsWith("@")}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => loadConversations()}>
                        Atualizar conversa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (active) {
                            navigator.clipboard.writeText(String(active.chat_id));
                            toast.success("Chat ID copiado");
                          }
                        }}
                      >
                        Copiar Chat ID
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setActiveId("");
                        }}
                      >
                        Fechar conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {active.messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      m.from === "me" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border rounded-bl-sm",
                    )}>
                      {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                      {m.media.map((media, index) => (
                        <TelegramMediaBubble key={`${m.id}-${index}`} media={media} botId={active.bot_id} />
                      ))}
                      <TelegramButtons rows={m.buttons} />
                      {!m.text && m.media.length === 0 && m.buttons.length === 0 && <p>Mensagem</p>}
                      <p className={cn("text-[10px] mt-1", m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>{m.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t flex items-center gap-2">
                <Button variant="ghost" size="icon"><Paperclip className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon"><Smile className="w-4 h-4" /></Button>
                <Input
                  placeholder="Digite sua mensagem..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <Button onClick={send} disabled={!draft.trim()}><Send className="w-4 h-4" /></Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold">Nenhuma conversa selecionada</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Selecione uma conversa na lista ao lado ou inicie uma nova conversa para começar a interagir.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
