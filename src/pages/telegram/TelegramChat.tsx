import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Paperclip, Smile, MessageCircle, Phone, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatMsg { id: string; from: "me" | "them"; text: string; time: string; }
interface Conversation {
  id: string;
  name: string;
  username: string;
  last_msg: string;
  last_time: string;
  unread: number;
  online: boolean;
  status: "vip" | "lead";
  messages: ChatMsg[];
}

const MOCK: Conversation[] = [];

export default function TelegramChat() {
  const [convs, setConvs] = useState<Conversation[]>(MOCK);
  const [activeId, setActiveId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = convs.find((c) => c.id === activeId);

  const filtered = convs.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.username.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, active?.messages.length]);

  function send() {
    if (!draft.trim() || !active) return;
    const newMsg: ChatMsg = { id: crypto.randomUUID(), from: "me", text: draft.trim(), time: "Agora" };
    setConvs((prev) => prev.map((c) => c.id === activeId
      ? { ...c, messages: [...c.messages, newMsg], last_msg: newMsg.text, last_time: "Agora" }
      : c,
    ));
    setDraft("");
    toast.success("Mensagem enviada");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Chat ao vivo</h1>
        <p className="text-sm text-muted-foreground mt-1">Atenda seus usuários do Telegram em tempo real</p>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-220px)] min-h-[500px]">
          {/* Lista */}
          <div className="border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar conversa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhuma conversa.
                </div>
              ) : filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 border-b hover:bg-muted/50 transition-colors text-left",
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

          {/* Conversa */}
          <div className="flex flex-col">
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
                <Badge variant="outline" className="ml-2 text-[10px]">{active.status === "vip" ? "VIP" : "Lead"}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon"><Phone className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
              {active.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    m.from === "me" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-background border rounded-bl-sm",
                  )}>
                    <p>{m.text}</p>
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
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/20">
                <MessageCircle className="w-12 h-12 text-muted-foreground opacity-40 mb-3" />
                <p className="text-sm text-muted-foreground">Selecione uma conversa para começar.</p>
                <p className="text-xs text-muted-foreground mt-1">Quando seus usuários enviarem mensagens ao bot, elas aparecerão aqui.</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
