import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, ArrowLeft, Loader2, UserPlus, Pencil, Camera, Megaphone, Bot, Send, SendHorizonal, Paperclip, Mic, Square, X, User, RefreshCw, FileText, Video } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

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

const getInitials = (name: string | null, phone?: string | null) => {
  if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (phone || '').replace(/\D/g, '').slice(-2) || '??';
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
const MessageContent = ({ content, isSent, templates }: { content: string; isSent: boolean; templates?: MessageTemplate[] }) => {
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
  conversations, selectedPhone, onSelect, searchTerm, onSearchChange, readPhones, instances, selectedInstanceId, onInstanceChange, syncing, onSync,
}: {
  conversations: Conversation[]; selectedPhone: string | null; onSelect: (phone: string) => void; searchTerm: string; onSearchChange: (v: string) => void; readPhones: Set<string>;
  instances: { id: string; instance_name: string; is_default: boolean }[]; selectedInstanceId: string; onInstanceChange: (id: string) => void; syncing: boolean; onSync: () => void;
}) => (
  <div className="flex flex-col h-full bg-card border-r border-border">
    <div className="p-3 border-b border-border bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSync} disabled={syncing} title="Sincronizar histórico">
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
        </Button>
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
  conversation, onBack, isMobile, onSaveContact, onFetchPhoto, loadingPhoto, onSendMessage, onOpenProfile, onTriggerFlow,
}: {
  conversation: Conversation | null; onBack: () => void; isMobile: boolean;
  onSaveContact: (phone: string, currentName: string) => void; onFetchPhoto: (phone: string) => void; loadingPhoto: boolean;
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
  }) => Promise<void>;
  onOpenProfile: () => void;
  onTriggerFlow: (phone: string) => void;
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
        const path = `chat-media/${Date.now()}.${ext}`;
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
          const path = `chat-media/${Date.now()}.ogg`;
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
        });
        incrementUsage(template.id);
        toast({ title: "Modelo enviado", description: `"${template.name}" enviado com sucesso.` });
      } catch {
        toast({ title: "Erro", description: "Falha ao enviar modelo.", variant: "destructive" });
      } finally {
        setSending(false);
      }
    } else {
      // Text-only template: fill the input
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
                        <MessageContent content={msg.content} isSent={false} templates={templates} />
                        <p className="text-[10px] text-muted-foreground text-right mt-1">
                          {formatMessageTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="max-w-[75%] bg-primary text-primary-foreground rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                        <MessageContent content={msg.content} isSent={true} templates={templates} />
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
  const [selectedPhone, setSelectedPhone] = useState<string | null>(searchParams.get("phone"));
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogPhone, setSaveDialogPhone] = useState("");
  const [saveDialogName, setSaveDialogName] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { instances, activeInstance } = useZapiInstances();
  const [selectedInstanceId, setSelectedInstanceId] = useState("all");
  // Map UI instance id to zapi_instance_id for filtering
  const selectedInstance = selectedInstanceId === "all" ? undefined : instances.find(i => i.id === selectedInstanceId);
  const filterZapiInstanceId = selectedInstance?.zapi_instance_id;
  const filterInstanceName = selectedInstance?.instance_name;
  const { conversations, loading, saveContact, fetchProfilePicture, sendMessage, refetch } = useMessageLogs(filterZapiInstanceId, filterInstanceName);
  const [syncing, setSyncing] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const syncHistory = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-zapi-history', {
        body: { maxChats: 200, amountPerChat: 12, instanceId: selectedInstance?.zapi_instance_id || activeInstance?.zapi_instance_id },
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
    setSelectedPhone(phone);
    markAsRead(phone);
  };

  // Auto-select phone from URL query param
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam) {
      setSelectedPhone(phoneParam);
      markAsRead(phoneParam);
      // Clean up the URL
      searchParams.delete("phone");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // One-time history sync
  useEffect(() => { syncHistory(); }, []);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return conv.phone.includes(term) || (conv.lastMessage || '').toLowerCase().includes(term) || (conv.contactName && conv.contactName.toLowerCase().includes(term));
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
    const url = await fetchProfilePicture(phone, selectedInstance?.zapi_instance_id || activeInstance?.zapi_instance_id || null);
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
          <div className={cn("flex-shrink-0", isMobile ? "w-full" : "w-[480px]")}>
            <ConversationList conversations={filteredConversations} selectedPhone={selectedPhone} onSelect={handleSelectPhone} searchTerm={searchTerm} onSearchChange={setSearchTerm} readPhones={readPhones} instances={instances} selectedInstanceId={selectedInstanceId} onInstanceChange={setSelectedInstanceId} syncing={syncing} onSync={syncHistory} />
          </div>
        )}
        {showChat && (
          <ChatView conversation={selectedConversation} onBack={() => setSelectedPhone(null)} isMobile={isMobile} onSaveContact={handleSaveContact} onFetchPhoto={handleFetchPhoto} loadingPhoto={loadingPhoto} onOpenProfile={() => setProfileOpen(true)} onTriggerFlow={() => setProfileOpen(true)} onSendMessage={async (phone, message, options) => {
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
            profilePictureUrl: selectedConversation.profilePictureUrl,
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
