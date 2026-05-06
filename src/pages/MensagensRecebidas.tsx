import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, ArrowLeft, Loader2, UserPlus, Pencil, Camera, Megaphone, Bot, Send, SendHorizonal, Paperclip, Mic, Square, X, User, RefreshCw, FileText, Video } from "lucide-react";
import ZapiChatActionsMenu from "@/components/mensagens/ZapiChatActionsMenu";
import ContactProfileDialog from "@/components/contatos/ContactProfileDialog";
import { useMessageTemplates, type MessageTemplate } from "@/hooks/useMessageTemplates";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Contact } from "@/hooks/useContacts";
import { useMessageLogs, type Conversation, type UnifiedMessage } from "@/hooks/useMessageLogs";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { format, isToday, isYesterday, subHours } from "date-fns";
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
import { supabase } from "@/integrations/supabase/client";
import { isGroupPhone } from "@/lib/group-name-resolution";

const normalizeSelectedConversationPhone = (phone: string | null) => {
  if (!phone) return null;
  if (!isGroupPhone(phone)) return phone;
  const numericId = phone.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
  return numericId ? `${numericId}-group` : phone;
};

const formatPhone = (phone?: string | null) => {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13 && clean.startsWith('55')) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    return `+55 ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
  }
  if (clean.length >= 10) return `+${clean}`;
  return phone;
};

const looksLikePhoneOrId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  // Pure digits / phone-like (with +, spaces, parens, dashes)
  return /^[+\d()\-\s]+$/.test(trimmed) && /\d/.test(trimmed);
};

const getConversationDisplayName = (name?: string | null, phone?: string | null) => {
  const isGroup = phone ? isGroupPhone(phone) : false;
  // For groups, ignore "names" that look like phone numbers / IDs (often the
  // last sender's number or the group jid leaked through).
  if (name && !(isGroup && looksLikePhoneOrId(name))) return name;
  if (isGroup) return 'Comunidade';
  return formatPhone(phone);
};

const getSafeDate = (value?: string | null) => {
  const date = value ? new Date(value) : new Date('');
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTimestamp = (ts: string) => {
  const date = getSafeDate(ts);
  if (!date) return '--:--';
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

const formatMessageTime = (ts: string) => {
  const date = getSafeDate(ts);
  return date ? format(date, "HH:mm") : '--:--';
};

const formatDateSeparator = (ts: string) => {
  const date = getSafeDate(ts);
  if (!date) return 'Data inválida';
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
};

const WhatsAppDefaultAvatar = () => (
  <svg viewBox="0 0 212 212" className="w-full h-full text-white">
    <path fill="currentColor" d="M106.251 0.5C164.653 0.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 0.5 164.654 0.5 106.25S47.846 0.5 106.251 0.5Z" />
    <path fill="#ccc" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.623 0 52.661-11058 70.945-28.985v-.398s-.26-.61-.818-1.678a47.572 47.572 0 0 0-1.07-1.926c-.031-.055-.071-.118-.104-.174a56.024 56.024 0 0 0-1.447-2.324Z" />
    <path fill="#ccc" d="M106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-1.215-5.494 36.68 36.68 0 0 0-3.648-8.298 35.923 35.923 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342Z" />
  </svg>
);

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

// Parse buttons from message content like "[Botões: A | B | C]"
const parseMessageWithButtons = (content: string): { text: string; buttons: string[] } => {
  const buttonRegex = /\[Bot[õo]es?:\s*(.+?)\]\s*$/i;
  const match = content.match(buttonRegex);
  if (match) {
    const text = content.replace(buttonRegex, '').trimEnd();
    const buttons = match[1].split('|').map(b => b.trim()).filter(Boolean);
    return { text, buttons };
  }
  return { text: content, buttons: [] };
};

// Parse media tag from message content like "[media:video:https://...]"
const parseMediaFromContent = (content: string): { mediaType: string | null; mediaUrl: string | null; text: string; transcription: string | null } => {
  const mediaRegex = /^\[media:(image|video|audio|document):(.+?)\]\n?/;
  const match = content.match(mediaRegex);
  if (match) {
    const remaining = content.replace(mediaRegex, '').trim();
    // Check for transcription marker 🎙️
    const transcriptionRegex = /^🎙️\s*(.+)/;
    const transcriptionMatch = remaining.match(transcriptionRegex);
    if (transcriptionMatch) {
      return { mediaType: match[1], mediaUrl: match[2], text: '', transcription: transcriptionMatch[1].trim() };
    }
    return { mediaType: match[1], mediaUrl: match[2], text: remaining, transcription: null };
  }
  return { mediaType: null, mediaUrl: null, text: content, transcription: null };
};

// Resolve [modelo:UUID] references to template name
const resolveTemplateRef = (content: string, templates: MessageTemplate[]): string => {
  if (!content) return '';
  return content.replace(/\[modelo:([a-f0-9-]+)\]/gi, (_match, id) => {
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      let resolved = tpl.content || '';
      if (tpl.header) resolved = `*${tpl.header}*\n${resolved}`;
      if (tpl.footer) resolved += `\n_${tpl.footer}_`;
      const buttonLabels = (tpl.buttons || [])
        .map((button) => button?.text?.trim())
        .filter(Boolean);
      if (buttonLabels.length > 0) {
        resolved += `${resolved ? '\n' : ''}[Botões: ${buttonLabels.join(' | ')}]`;
      }
      return resolved;
    }
    return `📋 Modelo enviado`;
  });
};

// Render message content with visual buttons and media
const MessageContent = ({ content, isSent, templates, campaignId, campaignTemplates }: { content: string; isSent: boolean; templates?: MessageTemplate[]; campaignId?: string | null; campaignTemplates?: Map<string, string> }) => {
  // If this message comes from a campaign whose template is a carousel, render its cards.
  const carouselTemplate: MessageTemplate | null = (() => {
    if (!templates) return null;
    const directTemplateId = content.match(/\[modelo:([a-f0-9-]+)\]/i)?.[1];
    const tplId = directTemplateId || (campaignId && campaignTemplates ? campaignTemplates.get(campaignId) : null);
    if (!tplId) return null;
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return null;
    const rawCards = (tpl as any).carouselCards ?? (tpl as any).carousel_cards;
    const cards: any[] = Array.isArray(rawCards) ? rawCards : [];
    if (cards.length === 0) return null;
    return tpl;
  })();

  if (carouselTemplate) {
    const rawCards = (carouselTemplate as any).carouselCards ?? (carouselTemplate as any).carousel_cards;
    const cards: any[] = Array.isArray(rawCards) ? rawCards : [];
    const displayContent = content.match(/\[modelo:[a-f0-9-]+\]/i) ? carouselTemplate.content : content;
    return (
      <div className="w-[260px] max-w-full">
        {displayContent && <p className="text-sm whitespace-pre-wrap mb-2">{displayContent}</p>}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          {cards.map((card: any, idx: number) => (
            <div key={idx} className={cn(
              "shrink-0 w-[220px] snap-start rounded-lg overflow-hidden border",
              isSent ? "bg-primary-foreground/10 border-primary-foreground/20" : "bg-card border-border"
            )}>
              {card.image && (
                <img src={card.image} alt="" className="w-full h-[120px] object-cover" />
              )}
              <div className="p-2 space-y-1">
                {card.title && <p className="text-xs font-semibold leading-tight">{card.title}</p>}
                {card.description && <p className="text-[11px] opacity-80 leading-snug whitespace-pre-wrap">{card.description}</p>}
                {Array.isArray(card.buttons) && card.buttons.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1">
                    {card.buttons.map((btn: any, bIdx: number) => (
                      <div key={bIdx} className={cn(
                        "text-center text-[11px] font-medium py-1 px-2 rounded border truncate",
                        isSent ? "border-primary-foreground/30 text-primary-foreground/90 bg-primary-foreground/10" : "border-border text-primary bg-primary/5"
                      )}>
                        {btn.text || btn.label || 'Abrir'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const resolvedContent = templates ? resolveTemplateRef(content, templates) : content;
  const { mediaType, mediaUrl, text: textAfterMedia, transcription } = parseMediaFromContent(resolvedContent);
  const { text, buttons } = parseMessageWithButtons(textAfterMedia);
  return (
    <>
      {mediaType === 'image' && mediaUrl && (
        <img src={mediaUrl} className="w-full max-h-[200px] object-contain rounded mb-1" alt="" />
      )}
      {mediaType === 'video' && mediaUrl && (
        <video src={mediaUrl} className="w-full max-h-[200px] object-contain rounded mb-1" controls muted playsInline preload="metadata" />
      )}
      {mediaType === 'audio' && mediaUrl && (
        <audio src={mediaUrl} className="w-full mb-1" controls preload="metadata" />
      )}
      {mediaType === 'audio' && transcription && (
        <div className={cn(
          "text-xs italic mt-1 px-2 py-1.5 rounded-md",
          isSent ? "bg-primary-foreground/10 text-primary-foreground/80" : "bg-muted text-muted-foreground"
        )}>
          <span className="not-italic">🎙️</span> {transcription}
        </div>
      )}
      {mediaType === 'document' && mediaUrl && (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 text-xs underline mb-1", isSent ? "text-primary-foreground/90" : "text-primary")}>
          📎 Abrir arquivo
        </a>
      )}
      {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      {buttons.length > 0 && (
        <div className={cn("flex flex-col gap-1 mt-2", buttons.length <= 3 ? "" : "")}>
          {buttons.map((btn, i) => (
            <div
              key={i}
              className={cn(
                "text-center text-xs font-medium py-1.5 px-3 rounded-md border",
                isSent
                  ? "border-primary-foreground/30 text-primary-foreground/90 bg-primary-foreground/10"
                  : "border-border text-primary bg-primary/5"
              )}
            >
              {btn}
            </div>
          ))}
        </div>
      )}
    </>
  );
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
   conversations, selectedPhone, onSelect, searchTerm, onSearchChange, readPhones, instances, selectedInstanceId, onInstanceChange, syncing, onSync, onFetchPhoto, onRefreshPhotos,
 }: {
   conversations: Conversation[]; selectedPhone: string | null; onSelect: (phone: string) => void; searchTerm: string; onSearchChange: (v: string) => void; readPhones: Set<string>;
   instances: { id: string; instance_name: string; is_default: boolean }[]; selectedInstanceId: string; onInstanceChange: (id: string) => void; syncing: boolean; onSync: () => void;
   onFetchPhoto: (phone: string, force?: boolean) => void;
   onRefreshPhotos: () => void;
}) => (
  <div className="flex flex-col h-full bg-card border-r border-border">
    <div className="p-3 border-b border-border bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
         <div className="flex gap-1">
           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefreshPhotos} disabled={syncing} title="Atualizar fotos de perfil">
             <Camera className={cn("w-4 h-4", syncing && "animate-spin")} />
           </Button>
           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSync} disabled={syncing} title="Sincronizar histórico">
             <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
           </Button>
         </div>
      </div>
      {instances.length > 1 && (
        <select
          className="w-full h-8 text-xs rounded-md border border-border bg-background px-2 text-foreground"
          value={selectedInstanceId}
          onChange={(e) => onInstanceChange(e.target.value)}
        >
          <option value="all">Todas as instâncias</option>
          {instances.map((inst) => (
            <option key={inst.id} value={inst.id}>
              {inst.instance_name}{inst.is_default ? ' (Padrão)' : ''}
            </option>
          ))}
        </select>
      )}
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
            <Avatar className="h-11 w-11 shrink-0 border border-border/50 overflow-hidden">
              {conv.profilePictureUrl ? (
                <AvatarImage 
                  src={conv.profilePictureUrl} 
                  className="object-cover"
                  onError={() => onFetchPhoto(conv.phone, true)}
                />
              ) : null}
              <AvatarFallback className="bg-[#DFE5E7] text-primary text-sm font-medium">
                <WhatsAppDefaultAvatar />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground truncate">
                    {getConversationDisplayName(conv.contactName, conv.phone)}
                  </span>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                  {formatTimestamp(conv.lastTimestamp)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {(conv.lastMessage || '').length > 60 ? (conv.lastMessage || '').slice(0, 60) + '...' : (conv.lastMessage || '')}
              </p>
            </div>
            {!readPhones.has(conv.phone) && (
              <span className="w-3 h-3 rounded-full bg-primary shrink-0" />
            )}
          </button>
        ))
      )}
    </ScrollArea>
  </div>
);

// Chat view
const ChatView = ({
  conversation, onBack, isMobile, onSaveContact, onFetchPhoto, loadingPhoto, onSendMessage, onOpenProfile, onTriggerFlow, campaignTemplates,
}: {
  conversation: Conversation | null; onBack: () => void; isMobile: boolean;
  onSaveContact: (phone: string, currentName: string) => void; onFetchPhoto: (phone: string, force?: boolean) => void; loadingPhoto: boolean;
  onSendMessage: (phone: string, message: string, options?: {
    mediaUrl?: string;
    mediaType?: string;
    viewOnce?: boolean;
    isPtv?: boolean;
    preferredInstanceId?: string | null;
    title?: string;
    footer?: string;
    buttonActions?: Array<{
      id: string;
      type: 'CALL' | 'URL' | 'REPLY';
      label: string;
      phone?: string;
      url?: string;
    }>;
    carouselCards?: MessageTemplate['carouselCards'];
    templateId?: string;
  }) => Promise<void>;
  onOpenProfile: () => void;
  onTriggerFlow: (phone: string) => void;
  campaignTemplates?: Map<string, string>;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{ file: File; previewUrl: string; mediaType: string } | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const [isPtv, setIsPtv] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const { templates, loading: templatesLoading, incrementUsage } = useMessageTemplates();
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages.length]);

  const handleSend = async () => {
    if ((!newMessage.trim() && !attachedFile) || !conversation || sending) return;
    setSending(true);
    try {
      if (attachedFile) {
        // Upload to Supabase storage then send URL
        const { supabase } = await import('@/integrations/supabase/client');
        const ext = attachedFile.file.name.split('.').pop() || 'bin';
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Usuário não autenticado");
        const path = `${currentUser.id}/chat-media/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('template-media').upload(path, attachedFile.file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('template-media').getPublicUrl(path);
        const isVideo = attachedFile.mediaType === 'video';
        await onSendMessage(conversation.phone, newMessage.trim(), {
          mediaUrl: publicUrl,
          mediaType: attachedFile.mediaType,
          viewOnce: isVideo ? viewOnce : undefined,
          isPtv: isVideo ? isPtv : undefined,
          preferredInstanceId: conversation.preferredInstanceId,
        });
        setAttachedFile(null);
        setViewOnce(false);
        setIsPtv(false);
      } else {
        await onSendMessage(conversation.phone, newMessage.trim(), {
          preferredInstanceId: conversation.preferredInstanceId,
        });
      }
      setNewMessage("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e?.message || "Falha ao enviar mensagem", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    let mediaType = 'document';
    if (file.type.startsWith('image/')) mediaType = 'image';
    else if (file.type.startsWith('video/')) mediaType = 'video';
    else if (file.type.startsWith('audio/')) mediaType = 'audio';

    const previewUrl = URL.createObjectURL(file);
    setAttachedFile({ file, previewUrl, mediaType });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingTime(0);
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const audioFile = new File([audioBlob], `audio-${Date.now()}.ogg`, { type: 'audio/ogg' });
        
        // Upload and send
        if (!conversation) return;
        setSending(true);
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) throw new Error("Usuário não autenticado");
          const path = `${currentUser.id}/chat-media/${Date.now()}.ogg`;
          const { error: uploadError } = await supabase.storage.from('template-media').upload(path, audioFile);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('template-media').getPublicUrl(path);
          await onSendMessage(conversation.phone, '', {
            mediaUrl: publicUrl,
            mediaType: 'audio',
            preferredInstanceId: conversation.preferredInstanceId,
          });
        } catch (e) {
          toast({ title: "Erro", description: "Falha ao enviar áudio.", variant: "destructive" });
        } finally {
          setSending(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível acessar o microfone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectTemplate = async (template: MessageTemplate) => {
    setTemplatePopoverOpen(false);
    setTemplateSearch("");

    const carouselCards = Array.isArray(template.carouselCards) ? template.carouselCards : [];
    if (carouselCards.length > 0) {
      if (!conversation) return;
      setSending(true);
      try {
        await onSendMessage(conversation.phone, template.content, {
          preferredInstanceId: conversation.preferredInstanceId,
          carouselCards,
          templateId: template.id,
        });
        incrementUsage(template.id);
        toast({ title: "Modelo enviado", description: `"${template.name}" enviado com sucesso.` });
      } catch {
        toast({ title: "Erro", description: "Falha ao enviar modelo.", variant: "destructive" });
      } finally {
        setSending(false);
      }
      return;
    }

    const templateButtonActions = (template.buttons || []).map((button, index) => {
      const rawType = (button.type || 'reply').toString().toLowerCase();
      return {
        id: button.id || String(index + 1),
        label: button.text || `Botão ${index + 1}`,
        type: (rawType === 'url' ? 'URL' : rawType === 'call' ? 'CALL' : 'REPLY') as 'CALL' | 'URL' | 'REPLY',
        ...(rawType === 'url' ? { url: button.value } : {}),
        ...(rawType === 'call' ? { phone: button.value } : {}),
      };
    }).filter((button) => button.label && (button.type === 'REPLY' || button.url || button.phone));
    
    // If template has media, send directly
    if (template.mediaUrl && template.type && template.type !== 'texto') {
      if (!conversation) return;
      setSending(true);
      try {
        let mediaType = 'document';
        if (['image', 'imagem', 'imagem_botoes'].includes(template.type)) mediaType = 'image';
        else if (['video', 'video_botoes'].includes(template.type)) mediaType = 'video';
        else if (template.type === 'audio') mediaType = 'audio';
        
        await onSendMessage(conversation.phone, template.content, {
          mediaUrl: template.mediaUrl,
          mediaType,
          preferredInstanceId: conversation.preferredInstanceId,
          title: template.header || undefined,
          footer: template.footer || undefined,
          buttonActions: templateButtonActions.length > 0 ? templateButtonActions : undefined,
          templateId: template.id,
        });
        incrementUsage(template.id);
        toast({ title: "Modelo enviado", description: `"${template.name}" enviado com sucesso.` });
      } catch {
        toast({ title: "Erro", description: "Falha ao enviar modelo.", variant: "destructive" });
      } finally {
        setSending(false);
      }
    } else if (templateButtonActions.length > 0) {
      if (!conversation) return;
      setSending(true);
      try {
        await onSendMessage(conversation.phone, template.content, {
          preferredInstanceId: conversation.preferredInstanceId,
          title: template.header || undefined,
          footer: template.footer || undefined,
          buttonActions: templateButtonActions,
          templateId: template.id,
        });
        incrementUsage(template.id);
        toast({ title: "Modelo enviado", description: `"${template.name}" enviado com sucesso.` });
      } catch {
        toast({ title: "Erro", description: "Falha ao enviar modelo.", variant: "destructive" });
      } finally {
        setSending(false);
      }
    } else {
      // Text-only template without buttons: fill the input
      setNewMessage(template.content);
      incrementUsage(template.id);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.content.toLowerCase().includes(templateSearch.toLowerCase())
  );

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
        <Avatar className="h-10 w-10 border border-border/50 overflow-hidden">
          {conversation.profilePictureUrl && (
            <AvatarImage 
              src={conversation.profilePictureUrl} 
              className="object-cover"
              onError={() => onFetchPhoto(conversation.phone, true)}
            />
          )}
          <AvatarFallback className="bg-[#DFE5E7] text-primary text-sm font-medium">
            <WhatsAppDefaultAvatar />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">
            {getConversationDisplayName(conversation.contactName, conversation.phone)}
          </h3>
          <p className="text-xs text-muted-foreground">
            {conversation.contactName ? formatPhone(conversation.phone) : `${conversation.messages.length} mensagens`}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Disparar fluxo" onClick={() => conversation && onTriggerFlow(conversation.phone)}>
            <Bot className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver perfil" onClick={onOpenProfile}>
            <User className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Buscar foto" onClick={() => onFetchPhoto(conversation.phone)} disabled={loadingPhoto}>
            {loadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title={conversation.contactName ? "Editar contato" : "Salvar contato"} onClick={() => onSaveContact(conversation.phone, conversation.contactName || '')}>
            {conversation.contactName ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          </Button>
          <ZapiChatActionsMenu phone={conversation.phone} />
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
                        <MessageContent content={msg.content} isSent={false} templates={templates} campaignId={msg.campaign_id} campaignTemplates={campaignTemplates} />
                        <p className="text-[10px] text-muted-foreground text-right mt-1">
                          {formatMessageTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                        <MessageContent content={msg.content} isSent={true} templates={templates} campaignId={msg.campaign_id} campaignTemplates={campaignTemplates} />
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

      {/* Attached file preview */}
      {attachedFile && (
        <div className="border-t border-border bg-muted/30 px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              {attachedFile.mediaType === 'image' && (
                <img src={attachedFile.previewUrl} className="h-12 w-12 rounded object-cover" alt="" />
              )}
              {attachedFile.mediaType === 'video' && (
                <video src={attachedFile.previewUrl} className="h-12 w-12 rounded object-cover" muted playsInline preload="metadata" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{attachedFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {attachedFile.mediaType === 'image' ? '📷 Imagem' : attachedFile.mediaType === 'video' ? '🎥 Vídeo' : '📎 Arquivo'}
                </p>
              </div>
            </div>
            {attachedFile.mediaType === 'video' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => { setViewOnce(!viewOnce); if (!viewOnce) setIsPtv(false); }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors",
                    viewOnce
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  )}
                  title="Vídeo que só pode ser visto uma vez"
                >
                  👁 Única vez
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPtv(!isPtv); if (!isPtv) setViewOnce(false); }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors",
                    isPtv
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  )}
                  title="Vídeo circular instantâneo (PTV)"
                >
                  <Video className="w-3.5 h-3.5" />
                  Instantâneo
                </button>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setAttachedFile(null); setViewOnce(false); setIsPtv(false); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
          onChange={handleFileSelect}
        />
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          {isRecording ? (
            <>
              <div className="flex-1 flex items-center gap-3 bg-destructive/10 rounded-md px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium text-destructive">{formatRecordingTime(recordingTime)}</span>
                <span className="text-xs text-muted-foreground">Gravando...</span>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={cancelRecording} title="Cancelar">
                <X className="w-4 h-4" />
              </Button>
              <Button size="icon" className="shrink-0 h-10 w-10 bg-destructive hover:bg-destructive/90" onClick={stopRecording} title="Enviar áudio">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-10 w-10"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Anexar arquivo"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-10 w-10"
                    disabled={sending}
                    title="Enviar modelo"
                  >
                    <FileText className="w-4 h-4" />
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
                    {templatesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredTemplates.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        Nenhum modelo encontrado
                      </div>
                    ) : (
                      <div className="py-1">
                        {filteredTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-medium text-foreground truncate">{template.name}</span>
                              <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">
                                {template.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {template.content}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <Textarea
                placeholder="Digite uma mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[40px] max-h-[120px] resize-none text-sm"
                rows={1}
              />
              {newMessage.trim() || attachedFile ? (
                <Button
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={handleSend}
                  disabled={(!newMessage.trim() && !attachedFile) || sending}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={startRecording}
                  disabled={sending}
                  title="Gravar áudio"
                >
                  <Mic className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MensagensRecebidas = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(() => normalizeSelectedConversationPhone(searchParams.get("phone")));
  const handledPhoneParamRef = useRef<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogPhone, setSaveDialogPhone] = useState("");
  const [saveDialogName, setSaveDialogName] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [manualProfilePic, setManualProfilePic] = useState<string | null>(null);
  const [campaignTemplates, setCampaignTemplates] = useState<Map<string, string>>(new Map());
  const { instances: allInstances, activeInstance: rawActiveInstance } = useZapiInstances();
  // Mensagens usa exclusivamente Z-API: filtra todas as instâncias por provider
  const instances = useMemo(
    () => allInstances.filter((i: any) => (i.api_provider || "zapi").toLowerCase() === "zapi"),
    [allInstances]
  );
  const activeInstance = useMemo(
    () =>
      (rawActiveInstance && ((rawActiveInstance as any).api_provider || "zapi").toLowerCase() === "zapi"
        ? rawActiveInstance
        : instances.find((i: any) => i.is_default) || instances[0] || null),
    [rawActiveInstance, instances]
  );
  const [connectedInstanceIds, setConnectedInstanceIds] = useState<string[] | null>(null);
  const [connectedInstanceNames, setConnectedInstanceNames] = useState<string[] | null>(null);
  const [connectedUiInstanceIds, setConnectedUiInstanceIds] = useState<string[] | null>(null);
  // Show data from connected instances. If none are online yet (e.g., new instance still pending QR scan),
  // fall back to all registered instances so the user keeps seeing the historic conversations
  // instead of an empty list.
  const allInstanceIds = useMemo(
    () => instances.map((i: any) => i.zapi_instance_id).filter(Boolean) as string[],
    [instances],
  );
  const allInstanceNames = useMemo(
    () => instances.map((i: any) => i.instance_name).filter(Boolean) as string[],
    [instances],
  );
  const knownInstanceIds = useMemo(() => {
    if (connectedInstanceIds === null) return undefined; // still checking → show everything
    if (connectedInstanceIds.length > 0) return connectedInstanceIds;
    return allInstanceIds.length > 0 ? allInstanceIds : undefined;
  }, [connectedInstanceIds, allInstanceIds]);
  const knownInstanceNames = useMemo(() => {
    if (connectedInstanceNames === null) return undefined;
    if (connectedInstanceNames.length > 0) return connectedInstanceNames;
    return allInstanceNames.length > 0 ? allInstanceNames : undefined;
  }, [connectedInstanceNames, allInstanceNames]);
  const [selectedInstanceId, setSelectedInstanceId] = useState("all");
  // Only show connected instances in the picker. While we're still checking
  // connection status, fall back to all registered instances to avoid an empty UI.
  const visibleInstances = useMemo(() => {
    if (connectedUiInstanceIds === null) return instances;
    if (connectedUiInstanceIds.length === 0) return instances;
    const set = new Set(connectedUiInstanceIds);
    return instances.filter((i: any) => set.has(i.id));
  }, [instances, connectedUiInstanceIds]);
  // Map UI instance id to zapi_instance_id for filtering
  const selectedInstance = selectedInstanceId === "all" ? undefined : instances.find(i => i.id === selectedInstanceId);
  const filterZapiInstanceId = selectedInstance?.zapi_instance_id;
  const filterInstanceName = selectedInstance?.instance_name;
  // Auto-sync the chat list from the connected provider (Z-API or UAZAPI) so
  // we always show the latest live conversations, not only the historic logs
  // stored in the database.
  const shouldAutoSyncHistory = Boolean(selectedInstance?.api_provider || activeInstance?.api_provider);
   const { conversations, loading, saveContact, fetchProfilePicture, sendMessage, refetch, forceUpdateAllPhotos } = useMessageLogs(
    filterZapiInstanceId,
    filterInstanceName,
    knownInstanceIds,
    knownInstanceNames,
  );
  const [syncing, setSyncing] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const syncHistory = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-zapi-history', {
        body: { maxChats: 200, amountPerChat: 12, instanceId: selectedInstance?.id || activeInstance?.id },
      });
      if (error) throw error;
      if (data?.error === 'disconnected') {
        toast({ title: "⚠️ WhatsApp desconectado", description: "Reconecte sua instância na página de Dispositivos.", variant: "destructive" });
      } else if ((data?.importedMessages || data?.importedChats || 0) > 0) {
        toast({ title: "Histórico sincronizado", description: `${data?.importedMessages || data?.importedChats || 0} conversas importadas.` });
        refetch();
      } else {
        toast({ title: "Já sincronizado", description: "Nenhuma mensagem nova encontrada." });
      }
    } catch (err) {
      console.error('Erro ao sincronizar histórico:', err);
      toast({ title: "Erro", description: "Falha ao sincronizar histórico.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchConnectedInstances = async () => {
      if (instances.length === 0) {
        if (!cancelled) {
          setConnectedInstanceIds([]);
          setConnectedInstanceNames([]);
        }
        return;
      }

      const results = await Promise.all(
        instances.map(async (instance) => {
          try {
            const { data } = await supabase.functions.invoke('get-device-status', {
              body: { instanceId: instance.id },
            });
            const connected = data?.data?.connected === true;
            return connected ? instance : null;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      const connected = results.filter(Boolean);
      setConnectedInstanceIds(connected.map((i) => i!.zapi_instance_id).filter(Boolean));
      setConnectedInstanceNames(connected.map((i) => i!.instance_name).filter(Boolean));
      setConnectedUiInstanceIds(connected.map((i) => i!.id).filter(Boolean));
    };

    fetchConnectedInstances();
    const interval = window.setInterval(fetchConnectedInstances, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [instances]);

  // Auto-configure UAZAPI webhook on the provider once per session so that
  // incoming user replies (needed for flow captures) actually arrive at our
  // webhook-zapi function. Without this, only delivery acks are sent.
  useEffect(() => {
    if (instances.length === 0) return;
    try {
      const flagKey = 'uazapi_webhook_synced_v1';
      if (sessionStorage.getItem(flagKey)) return;
      sessionStorage.setItem(flagKey, '1');
      supabase.functions.invoke('uazapi-set-webhook', { body: {} }).catch(() => { /* silent */ });
    } catch { /* ignore */ }
  }, [instances]);

  // Track read conversations in localStorage
  const [readPhones, setReadPhones] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('readConversations');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const markAsRead = (phone: string) => {
    setReadPhones(prev => {
      const next = new Set(prev);
      next.add(phone);
      localStorage.setItem('readConversations', JSON.stringify([...next]));
      return next;
    });
  };

  const handleSelectPhone = (phone: string) => {
    const normalizedPhone = normalizeSelectedConversationPhone(phone);
    setSelectedPhone(normalizedPhone);
    if (normalizedPhone) markAsRead(normalizedPhone);
  };

  // Auto-select phone from URL query param
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    const normalizedPhone = normalizeSelectedConversationPhone(phoneParam);
    if (!normalizedPhone || handledPhoneParamRef.current === normalizedPhone) return;

    handledPhoneParamRef.current = normalizedPhone;
    setSelectedPhone(normalizedPhone);
    if (normalizedPhone) markAsRead(normalizedPhone);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("phone");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Auto history sync only for Z-API. For UAZAPI, keep the initial live list stable
  // and allow manual sync via the refresh button instead of importing old chats automatically.
  useEffect(() => {
    if (!shouldAutoSyncHistory) return;
    if ((knownInstanceIds?.length || 0) === 0) return;
    syncHistory();
  }, [shouldAutoSyncHistory, knownInstanceIds?.join('|')]);

  // Background sync every 5 minutes to keep the chat list fresh while the
  // page is open (UAZAPI/Z-API). Refreshes only the chat list — message
  // history per chat is fetched on-demand on conversation open.
  useEffect(() => {
    if (!shouldAutoSyncHistory) return;
    if ((knownInstanceIds?.length || 0) === 0) return;
    const interval = window.setInterval(() => {
      syncHistory();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoSyncHistory, knownInstanceIds?.join('|')]);

  // On-demand: when the user opens a conversation, fetch its message history
  // from the live provider (UAZAPI /chat/messages or Z-API equivalent) and
  // persist into message_logs. Only triggers once per phone per session.
  const fetchedHistoryRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedPhone) return;
    const targetInstance = selectedInstance || activeInstance;
    if (!targetInstance) return;
    const key = `${targetInstance.id}:${selectedPhone}`;
    if (fetchedHistoryRef.current.has(key)) return;
    fetchedHistoryRef.current.add(key);

    supabase.functions
      .invoke('fetch-chat-messages', {
        body: { phone: selectedPhone, instanceId: targetInstance.id, limit: 30 },
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn('fetch-chat-messages failed', error);
          return;
        }
        if ((data?.imported || 0) > 0) {
          refetch();
        }
      })
      .catch((err) => console.warn('fetch-chat-messages error', err));
  }, [selectedPhone, selectedInstance?.id, activeInstance?.id, refetch]);

  // Collect campaign_ids referenced in conversations and load their template_id
  // so we can render carousel cards in the chat bubble.
  useEffect(() => {
    const ids = new Set<string>();
    conversations.forEach((c) => {
      c.messages.forEach((m: any) => {
        if (m.campaign_id && !campaignTemplates.has(m.campaign_id)) ids.add(m.campaign_id);
      });
    });
    if (ids.size === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, template_id')
        .in('id', Array.from(ids));
      if (cancelled || error || !data) return;
      setCampaignTemplates((prev) => {
        const next = new Map(prev);
        data.forEach((row: any) => {
          if (row.template_id) next.set(row.id, row.template_id);
        });
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [conversations, campaignTemplates]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return conv.phone.includes(term) || (conv.lastMessage || '').toLowerCase().includes(term) || (conv.contactName && conv.contactName.toLowerCase().includes(term));
  });

  const normalizedSelectedPhone = normalizeSelectedConversationPhone(selectedPhone);
  const selectedConversation = conversations.find((c) => c.phone === normalizedSelectedPhone) || null;

  // DEBUG: log selection mismatch to help diagnose "messages not appearing"
  useEffect(() => {
    if (!selectedPhone) return;
    const match = conversations.find((c) => c.phone === normalizedSelectedPhone);
    if (!match) {
      console.warn('[MensagensRecebidas] selectedPhone has no matching conversation', {
        selectedPhone,
        normalizedSelectedPhone,
        conversationsCount: conversations.length,
        samplePhones: conversations.slice(0, 5).map((c) => c.phone),
      });
    } else {
      console.log('[MensagensRecebidas] selected conversation', {
        phone: match.phone,
        messages: match.messages.length,
        contactName: match.contactName,
      });
    }
  }, [selectedPhone, normalizedSelectedPhone, conversations]);

  const handleSaveContact = (phone: string, currentName: string) => {
    setSaveDialogPhone(phone);
    setSaveDialogName(currentName);
    setSaveDialogOpen(true);
  };

  const handleDoSave = async (name: string) => {
    await saveContact(saveDialogPhone, name);
    toast({ title: "Contato salvo", description: `${name} foi salvo com sucesso.` });
  };

  const handleFetchPhoto = async (phone: string, force = false) => {
    if (!force) setLoadingPhoto(true);
    setManualProfilePic(null);
    const url = await fetchProfilePicture(
      phone, 
      selectedInstance?.zapi_instance_id || activeInstance?.zapi_instance_id || null,
      force
    );
    if (url) setManualProfilePic(url);
    if (!force) setLoadingPhoto(false);
    
    if (url && !force) {
      toast({ title: "Foto atualizada", description: "Foto de perfil carregada com sucesso." });
    } else if (!url && !force) {
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
          <div className={cn("flex-shrink-0", isMobile ? "w-full" : "w-[480px]")}>
             <ConversationList conversations={filteredConversations} selectedPhone={selectedPhone} onSelect={handleSelectPhone} searchTerm={searchTerm} onSearchChange={setSearchTerm} readPhones={readPhones} instances={visibleInstances} selectedInstanceId={selectedInstanceId} onInstanceChange={setSelectedInstanceId} syncing={syncing} onSync={syncHistory} onFetchPhoto={handleFetchPhoto} onRefreshPhotos={forceUpdateAllPhotos} />
          </div>
        )}
        {showChat && (
          <ChatView conversation={selectedConversation} onBack={() => setSelectedPhone(null)} isMobile={isMobile} onSaveContact={handleSaveContact} onFetchPhoto={handleFetchPhoto} loadingPhoto={loadingPhoto} onOpenProfile={() => setProfileOpen(true)} onTriggerFlow={() => setProfileOpen(true)} campaignTemplates={campaignTemplates} onSendMessage={async (phone, message, options) => {
            await sendMessage(phone, message, options);
            toast({ title: "Mensagem enviada", description: "Mensagem enviada com sucesso." });
          }} />
        )}
      </div>
      <SaveContactDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} phone={saveDialogPhone} currentName={saveDialogName} onSave={handleDoSave} />
      {selectedConversation && (
        <ContactProfileDialog
          contact={{
            phone: selectedConversation.phone,
            name: selectedConversation.contactName || undefined,
            lastMessage: selectedConversation.lastMessage,
            lastMessageDate: selectedConversation.lastTimestamp,
            status: 'ativo',
            messageCount: selectedConversation.messages.length,
            tags: [] as string[],
            profilePictureUrl: manualProfilePic || selectedConversation.profilePictureUrl,
          }}
          preferredInstanceId={filterZapiInstanceId || selectedConversation.preferredInstanceId}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      )}
    </>
  );
};

export default MensagensRecebidas;
