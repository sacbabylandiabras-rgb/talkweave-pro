import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
    import { Search, MessageSquare, ArrowLeft, Loader2, UserPlus, Pencil, Camera, Megaphone, Bot, Send, SendHorizonal, Paperclip, Mic, Square, X, User, RefreshCw, FileText, Video, Reply, Smile, StickyNote, Trash2, Users, LayoutGrid, FileImage, Tag, Palette, Check, Plus, Phone, PhoneCall, ShieldCheck, Key } from "lucide-react";
 import ContactProfileDialog from "@/components/contatos/ContactProfileDialog";
 import { useMessageTemplates, type MessageTemplate } from "@/hooks/useMessageTemplates";
 import {
   Popover,
   PopoverContent,
   PopoverTrigger,
 } from "@/components/ui/popover";
 import { Label } from "@/components/ui/label";
import type { Contact } from "@/hooks/useContacts";
import { useMessageLogs, type Conversation, type UnifiedMessage } from "@/hooks/useMessageLogs";
import { useZapiInstances, isMobileZapiInstance } from "@/hooks/useZapiInstances";
import { useZapi } from "@/hooks/useZapi";
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
   DialogDescription,
 } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isGroupPhone, isCommunityPhone, isRegularGroupPhone } from "@/lib/group-name-resolution";
import { WhatsAppDefaultAvatar } from "@/components/ui/whatsapp-default-avatar";

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

const getConversationDisplayName = (name?: string | null, phone?: string | null, isCommunityProp?: boolean) => {
  if (!phone) return name || '';
  
   const isGroup = isGroupPhone(phone) && !phone.startsWith('ig_');
   const isCommunity = (isCommunityProp || isCommunityPhone(phone)) && !phone.startsWith('ig_');
  const isChannel = phone.includes('@newsletter');

  // For groups, communities and channels, prioritize the real name if available
  if (name && !(isGroup && looksLikePhoneOrId(name))) return name;
  
  if (isChannel) return 'canal';
  if (isCommunity) return 'comunidade';
  if (isGroup) return 'grupo';

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
    const mediaRegex = /^\[media:(image|imagem|video|video|audio|document|documento|arquivo|sticker|figurinha|gif):(.+?)\]\n?/i;
    const match = content.match(mediaRegex);
  if (match) {
    const remaining = content.replace(mediaRegex, '').trim();
    const rawType = match[1].toLowerCase();
    const typeMap: Record<string, string> = {
      imagem: 'image',
      documento: 'document',
      arquivo: 'document',
      figurinha: 'sticker',
    };
    const normalizedType = typeMap[rawType] || rawType;
    // Check for transcription marker 🎙️
    const transcriptionRegex = /^🎙️\s*(.+)/;
    const transcriptionMatch = remaining.match(transcriptionRegex);
    if (transcriptionMatch) {
      return { mediaType: normalizedType, mediaUrl: match[2], text: '', transcription: transcriptionMatch[1].trim() };
    }
    return { mediaType: normalizedType, mediaUrl: match[2], text: remaining, transcription: null };
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
  const augmentedContent = useMemo(() => {
    // If it's a campaign message and missing interactive markers, enrich it using the template.
    // This handles messages sent before the logger was updated to include markers.
    if (campaignId && campaignTemplates && !content.includes('[media:') && !content.includes('[Botões:')) {
      const tplId = content.match(/\[modelo:([a-f0-9-]+)\]/i)?.[1] || campaignTemplates.get(campaignId);
      const tpl = templates?.find(t => t.id === tplId);
      if (tpl) {
        let result = content.replace(/\[modelo:[a-f0-9-]+\]\s*/gi, '');
        if (tpl.header && !result.includes(tpl.header)) result = `*${tpl.header}*\n${result}`;
        if (tpl.footer && !result.includes(tpl.footer)) result = `${result}\n\n_${tpl.footer}_`;
        const buttonLabels = (tpl.buttons || []).map(b => b.text || (b as any).label).filter(Boolean);
        if (buttonLabels.length > 0 && !result.includes('[Botões:')) {
          result = `${result}\n\n[Botões: ${buttonLabels.join(' | ')}]`;
        }
        if (tpl.mediaUrl && !result.includes('[media:')) {
          const type = tpl.type?.split('_')[0] || 'image';
          result = `[media:${type}:${tpl.mediaUrl}]\n${result}`;
        }
        return result;
      }
    }
    return content;
  }, [content, campaignId, campaignTemplates, templates]);

  // If this message comes from a campaign whose template is a carousel, render its cards.
  const carouselTemplate: MessageTemplate | null = (() => {
    if (!templates) return null;
    const directTemplateId = augmentedContent.match(/\[modelo:([a-f0-9-]+)\]/i)?.[1];
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
    const displayContent = augmentedContent.match(/\[modelo:[a-f0-9-]+\]/i) ? carouselTemplate.content : augmentedContent;
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

  const resolvedContent = templates ? resolveTemplateRef(augmentedContent, templates) : augmentedContent;
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
      {(mediaType === 'sticker' || mediaType === 'gif') && mediaUrl && (
        <img 
          src={mediaUrl} 
          className={cn(
            "object-contain rounded mb-1",
            mediaType === 'sticker' ? "w-[120px] h-[120px]" : "w-full max-h-[200px]"
          )} 
          alt={mediaType === 'sticker' ? "figurinha" : "gif"} 
        />
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
const ChatTypeBadge = ({ phone, isCommunity }: { phone: string; name?: string | null; isCommunity?: boolean }) => {
  if (isCommunity) {
    return (
      <Badge variant="secondary" className="text-[10px] shrink-0 bg-purple-100 text-purple-700">COMUNIDADE</Badge>
    );
  }
  if (isGroupPhone(phone)) {
    return (
      <Badge variant="outline" className="text-[10px] shrink-0">GRUPO</Badge>
    );
  }
  return null;
};

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

const ConversationList = ({
   conversations, selectedPhone, onSelect, searchTerm, onSearchChange, readPhones, instances, selectedInstanceId, onInstanceChange, syncing, onSync, onFetchPhoto, onRefreshPhotos, selectedPhones, onToggleSelect, isSelectionMode, onToggleSelectionMode, onDeleteSelected, onDeleteConversation, availableTags, tagColors,
 }: {
   conversations: Conversation[]; selectedPhone: string | null; onSelect: (phone: string) => void; searchTerm: string; onSearchChange: (v: string) => void; readPhones: Set<string>;
    instances: { id: string; instance_name: string; is_default: boolean }[]; selectedInstanceId: string; onInstanceChange: (id: string) => void; syncing: boolean; onSync: () => void; selectedPhones: Set<string>; onToggleSelect: (phone: string) => void; isSelectionMode: boolean; onToggleSelectionMode: () => void; onDeleteSelected: () => void;
   onDeleteConversation: (phone: string) => void;
   onFetchPhoto: (phone: string, force?: boolean) => void;
   onRefreshPhotos: () => void;
   availableTags?: { id: string; name: string; color: number }[];
   tagColors?: { id: number; hex: string; label: string }[];
}) => (
  <div className="flex flex-col h-full bg-card border-r border-border">
    <div className="p-3 border-b border-border bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <h2 className="text-lg font-semibold text-foreground">Conversas</h2>
          {isSelectionMode && selectedPhones.size > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
              {selectedPhones.size}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {isSelectionMode ? (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" 
                onClick={onDeleteSelected}
                disabled={selectedPhones.size === 0 || syncing}
                title="Apagar selecionadas"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={onToggleSelectionMode} 
                title="Cancelar seleção"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7" 
                onClick={onToggleSelectionMode} 
                title="Selecionar conversas"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefreshPhotos} disabled={syncing} title="Atualizar fotos de perfil">
                <Camera className={cn("w-4 h-4", syncing && "animate-spin")} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSync} disabled={syncing} title="Sincronizar histórico">
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              </Button>
            </>
          )}
        </div>
      </div>
      {instances.length > 0 && (
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
            onClick={() => isSelectionMode ? onToggleSelect(conv.phone) : onSelect(conv.phone)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border/50 group relative",
              selectedPhone === conv.phone && !isSelectionMode && "bg-muted",
              isSelectionMode && selectedPhones.has(conv.phone) && "bg-primary/5 ring-1 ring-inset ring-primary/20"
            )}
          >
             <div className="relative shrink-0">
               {isSelectionMode && (
                 <div className={cn(
                   "absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center transition-colors",
                   selectedPhones.has(conv.phone) ? "bg-primary text-primary-foreground" : "bg-muted text-transparent"
                 )}>
                   <div className="w-1.5 h-1.5 rounded-full bg-current" />
                 </div>
               )}
              <Avatar className="h-11 w-11 border border-border/50 overflow-hidden bg-muted flex items-center justify-center">
                {conv.profilePictureUrl ? (
                  <AvatarImage 
                    src={conv.profilePictureUrl} 
                    className="h-full w-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).onerror = null;
                    }} 
                  />
                ) : null}
                <AvatarFallback className="bg-[#DFE5E7] flex h-full w-full items-center justify-center rounded-full">
                  <WhatsAppDefaultAvatar />
                </AvatarFallback>
              </Avatar>
             </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-medium text-sm text-foreground truncate">
                    {getConversationDisplayName(conv.contactName, conv.phone, conv.isCommunity)}
                  </span>
                  <ChatTypeBadge phone={conv.phone} name={conv.contactName} isCommunity={conv.isCommunity} />
                  {(() => {
                    const tagNames = Array.from(new Set(conv.messages.flatMap(m => (m as any).tags || [])));
                    if (tagNames.length === 0) return null;
                    return (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {tagNames.slice(0, 3).map((tagName: string) => {
                          const tag = availableTags?.find(t => t.name === tagName);
                          const colorHex = tagColors?.find(c => c.id === (tag?.color ?? 0))?.hex || '#94a3b8';
                          return (
                            <span
                              key={tagName}
                              title={tagName}
                              className="inline-block w-2.5 h-2.5 rounded-full border border-background"
                              style={{ backgroundColor: colorHex }}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                  {formatTimestamp(conv.lastTimestamp)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {(conv.lastMessage || '').length > 60 ? (conv.lastMessage || '').slice(0, 60) + '...' : (conv.lastMessage || '')}
              </p>
            </div>
            {!isSelectionMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Apagar esta conversa permanentemente?')) {
                    onDeleteConversation(conv.phone);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Apagar conversa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {!readPhones.has(conv.phone) && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-3 h-3 rounded-full bg-primary" />
              </div>
            )}
          </button>
        ))
      )}
    </ScrollArea>
  </div>
);

// Chat view
interface ChatViewProps {
  conversation: Conversation | null;
  onBack: () => void;
  isMobile: boolean;
  savedContacts: Map<string, any>;
  onSaveContact: (phone: string, currentName: string) => void;
  onFetchPhoto: (phone: string, force?: boolean) => void;
  loadingPhoto: boolean;
  onSendMessage: (phone: string, message: string, options?: any) => Promise<void>;
  onOpenProfile: () => void;
  onTriggerFlow: (phone: string) => void;
  onForwardMessage: (phone: string, messageId: string) => Promise<void>;
  onSendReaction: (phone: string, messageId: string, emoji: string) => Promise<void>;
   onSendSticker: (phone: string, stickerUrl: string) => Promise<void>;
   onSendGif: (phone: string, gifUrl: string, caption?: string) => Promise<void>;
   onDeleteConversation: (phone: string) => Promise<void>;
  onSendCall?: (phone: string, duration?: number, audioUrl?: string) => Promise<void>;
  onGetSipInfo?: () => Promise<any>;
   onUpdate?: () => void;
   campaignTemplates?: Map<string, string>;
}

const ChatView = (props: ChatViewProps) => {
  const {
    conversation,
    onBack,
    isMobile,
    onSaveContact,
    onFetchPhoto,
    loadingPhoto,
    onSendMessage,
    onOpenProfile,
    onTriggerFlow,
    onForwardMessage,
    onSendReaction,
    onSendSticker,
    onSendGif,
    onDeleteConversation,
    onSendCall,
    onGetSipInfo,
    campaignTemplates,
    savedContacts,
    onUpdate,
    activeInstance,
  } = props;
   const { listTags, addTagChat, removeTagChat } = useZapi();
  const { sendCall, getSipInfo, getSipToken, getCallToken } = useZapi();
   const [availableTags, setAvailableTags] = useState<{ id: string, name: string, color: number }[]>([]);
   const [tagColors, setTagColors] = useState<{ id: number; hex: string; label: string }[]>([]);
   const [loadingTags, setLoadingTags] = useState(false);
   const [tagSearchTerm, setTagSearchTerm] = useState("");
   const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
   const [newTagName, setNewTagName] = useState("");
   const [newTagDescription, setNewTagDescription] = useState("");
   const [newTagColor, setNewTagColor] = useState(0);
   const [addingTag, setAddingTag] = useState(false);
  const [sipInfoOpen, setSipInfoOpen] = useState(false);
  const [sipData, setSipData] = useState<any>(null);
  const [loadingSip, setLoadingSip] = useState(false);

  const handleOpenSipInfo = async () => {
    setLoadingSip(true);
    try {
      const info = await getSipInfo();
      const token = await getSipToken();
      const callToken = await getCallToken();
      const pickStr = (v: any): string => {
        if (v == null) return '';
        if (typeof v === 'string' || typeof v === 'number') return String(v);
        if (typeof v === 'object') return String(v.token || v.value || v.sipToken || v.callToken || JSON.stringify(v));
        return String(v);
      };
      setSipData({
        ...(typeof info === 'object' && info !== null ? info : {}),
        sipToken: pickStr(token),
        callToken: pickStr(callToken),
      });
      setSipInfoOpen(true);
    } catch (err: any) {
      toast({ title: "Erro ao buscar info SIP", description: err.message, variant: "destructive" });
    } finally {
      setLoadingSip(false);
    }
  };

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
    const [isUploadingAudio, setIsUploadingAudio] = useState(false);
    const callAudioInputRef = useRef<HTMLInputElement>(null);

    const handleCallAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !conversation) return;
      
      setIsUploadingAudio(true);
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Usuário não autenticado");

        const ext = file.name.split('.').pop() || 'mp3';
        const filePath = `${currentUser.id}/call-audios/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('template-media')
          .upload(filePath, file, { contentType: file.type || 'audio/mpeg', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('template-media')
          .getPublicUrl(filePath);

        await onSendCall(conversation.phone, 15, publicUrl);
      } catch (err: any) {
        console.error('Erro ao upar áudio da chamada:', err);
        toast({ title: "Erro", description: err?.message || "Falha ao enviar áudio da chamada.", variant: "destructive" });
      } finally {
        setIsUploadingAudio(false);
        if (callAudioInputRef.current) callAudioInputRef.current.value = '';
      }
    };
    const stickerInputRef = useRef<HTMLInputElement>(null);
    const gifInputRef = useRef<HTMLInputElement>(null);
   const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !conversation) return;
     
     setSending(true);
     try {
       const { supabase } = await import('@/integrations/supabase/client');
       const ext = file.name.split('.').pop() || 'webp';
       const { data: { user: currentUser } } = await supabase.auth.getUser();
       if (!currentUser) throw new Error("Usuário não autenticado");
       
       const path = `${currentUser.id}/chat-media/${Date.now()}.${ext}`;
       const { error: uploadError } = await supabase.storage.from('template-media').upload(path, file);
       if (uploadError) throw uploadError;
       
       const { data: { publicUrl } } = supabase.storage.from('template-media').getPublicUrl(path);
       await onSendSticker(conversation.phone, publicUrl);
       toast({ title: "Figurinha enviada", description: "Figurinha enviada com sucesso." });
     } catch (e: any) {
       toast({ title: "Erro ao enviar figurinha", description: e?.message || "Falha ao enviar figurinha", variant: "destructive" });
     } finally {
       setSending(false);
        if (stickerInputRef.current) stickerInputRef.current.value = '';
      }
    };

    const handleGifUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !conversation) return;
      
      setSending(true);
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const ext = file.name.split('.').pop() || 'gif';
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Usuário não autenticado");
        
        const path = `${currentUser.id}/chat-media/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('template-media').upload(path, file);
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('template-media').getPublicUrl(path);
        await onSendGif(conversation.phone, publicUrl);
        toast({ title: "GIF enviado", description: "GIF enviado com sucesso." });
      } catch (e: any) {
        toast({ title: "Erro ao enviar GIF", description: e?.message || "Falha ao enviar GIF", variant: "destructive" });
      } finally {
        setSending(false);
        if (gifInputRef.current) gifInputRef.current.value = '';
      }
    };

  const [templateSearch, setTemplateSearch] = useState("");
  const { templates, loading: templatesLoading, incrementUsage } = useMessageTemplates();
  const { toast } = useToast();
  const [localReactions, setLocalReactions] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; isSent: boolean } | null>(null);

  const handleReactionClick = async (msg: UnifiedMessage, emoji: string) => {
    if (!conversation) return;
    setLocalReactions((prev) => ({ ...prev, [msg.id]: emoji }));
    try {
      await onSendReaction(conversation.phone, msg.externalMessageId || msg.id, emoji);
    } catch {
      setLocalReactions((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
    }
  };

   const loadAvailableTags = async () => {
     setLoadingTags(true);
     try {
       const data = await listTags();
       setAvailableTags(Array.isArray(data) ? data : []);
     } catch (e) {
       console.error('loadAvailableTags error:', e);
     } finally {
       setLoadingTags(false);
     }
   };

   const fetchTagColors = async () => {
     try {
       const { data } = await supabase.functions.invoke("zapi-chat-actions", {
         body: { action: "tag-colors" },
       });
       setTagColors(Array.isArray(data?.data) ? data.data : []);
     } catch (err) {
       console.error("Erro ao buscar cores de etiquetas:", err);
     }
   };

   useEffect(() => {
     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
     if (conversation) {
       loadAvailableTags();
       fetchTagColors();
     }
   }, [conversation?.messages.length, conversation?.phone]);

   useEffect(() => {
     if (conversation) {
       (window as any).handleCreateTag = handleCreateTag;
     }
     return () => {
       delete (window as any).handleCreateTag;
     };
   }, [conversation, newTagName, newTagColor, newTagDescription]);

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
          ...(replyingTo ? { messageId: replyingTo.id } : {}),
        });
        setAttachedFile(null);
        setViewOnce(false);
        setIsPtv(false);
      } else {
        await onSendMessage(conversation.phone, newMessage.trim(), {
          preferredInstanceId: conversation.preferredInstanceId,
          ...(replyingTo ? { messageId: replyingTo.id } : {}),
        });
      }
      setNewMessage("");
      setReplyingTo(null);
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
    if (file.type === 'image/gif') mediaType = 'gif';
    else if (file.type.startsWith('image/')) mediaType = 'image';
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

  const handleClearChat = async () => {
    if (!conversation) return;
    if (!confirm(`Apagar toda a conversa com ${getConversationDisplayName(conversation.contactName, conversation.phone, conversation.isCommunity)}?`)) return;
    
    try {
      await onDeleteConversation(conversation.phone);
    } catch {
      toast({ title: "Erro", description: "Não foi possível apagar a conversa.", variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

   const handleCreateTag = async () => {
     if (!newTagName.trim() || !conversation) return;
     setLoadingTags(true);
     try {
       const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
         body: { 
           action: "create-tag", 
           payload: { name: newTagName, color: newTagColor } 
         },
       });
       if (error) throw error;
       toast({ title: "Etiqueta criada" });
       setNewTagName("");
       setNewTagDescription("");
       setIsCreateTagOpen(false);
       loadAvailableTags();
     } catch (err: any) {
       toast({ title: "Erro ao criar etiqueta", description: err.message, variant: "destructive" });
     } finally {
       setLoadingTags(false);
     }
   };

   const handleAddTag = async (tagId: string) => {
     if (!conversation) return;
     try {
       await addTagChat(conversation.phone, tagId);
       setAddingTag(false);
       onUpdate?.();
     } catch (e) {
       console.error('handleAddTag error:', e);
     }
   };

   const handleRemoveTag = async (tagId: string) => {
     if (!conversation) return;
     try {
       await removeTagChat(conversation.phone, tagId);
       onUpdate?.();
     } catch (e) {
       console.error('handleRemoveTag error:', e);
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

    // If template has special fields (PIX, location, etc), it contains a JSON payload
    const SPECIAL_PREFIX = "__SPECIAL_TEMPLATE__:";
    const isSpec = typeof template.content === 'string' && template.content.startsWith(SPECIAL_PREFIX);

    let specialData: any = null;
    if (isSpec) {
      try {
        specialData = JSON.parse(template.content.slice(SPECIAL_PREFIX.length));
      } catch (e) {}
    }

    const rawButtons = template.buttons || [];
    const templateButtonActions = rawButtons.map((button, index) => {
      const rawType = (button.type || 'reply').toString().toLowerCase();
      let type: 'REPLY' | 'URL' | 'CALL' | 'COPY' = 'REPLY';
      if (rawType === 'url') type = 'URL';
      else if (rawType === 'call') type = 'CALL';
      else if (rawType === 'copy') type = 'COPY';

      return {
        id: button.id || String(index + 1),
        label: button.text || `Botão ${index + 1}`,
        type,
        ...(type === 'URL' ? { url: button.value } : {}),
        ...(type === 'CALL' ? { phone: button.value } : {}),
        ...(type === 'COPY' ? { copyText: button.value } : {}),
      };
    });

    // If it's a copy_paste special template, ensure it has a copy button
    if (specialData?.type === 'copia_cola' && !templateButtonActions.some(b => b.type === 'COPY')) {
      templateButtonActions.push({
        id: 'copy_btn',
        type: 'COPY' as const,
        label: specialData.buttonLabel || 'Copiar',
        copyText: specialData.copyText || specialData.description || '',
      });
    }

    const filteredButtonActions = templateButtonActions.filter((button) => 
      button.label && (button.type === 'REPLY' || button.url || button.phone || (button as any).copyText)
    );

    if (isSpec) {
      if (!conversation) return;
      setSending(true);
      try {
        if (specialData) {
          const isPix = specialData.type === 'pix' || specialData.type === 'gateway_billing';
          const isLocation = specialData.type === 'localizacao';
          const isContact = specialData.type === 'contato';

          const sendOptions: any = {
            specialType: specialData.type,
            specialPayload: specialData,
            preferredInstanceId: conversation.preferredInstanceId,
            templateId: template.id,
          };

          if (isPix || isLocation || isContact) {
            // Use standard sendMessage to avoid circular reference, 
            // ensuring we pass the correct payload structure for special types
            // Special case for PIX: value must be a number
            if (isPix && (specialData.amount || specialData.pixAmount)) {
              const amt = specialData.amount || specialData.pixAmount;
              specialData.amount = Number(String(amt).replace(',', '.'));
            }
            
            const effectiveMessage = specialData.description || specialData.text || template.content;
            try {
              await onSendMessage(conversation.phone, effectiveMessage, sendOptions);
              incrementUsage(template.id);
              toast({ title: "Modelo enviado", description: `"${template.name}" enviado com sucesso.` });
            } catch (err: any) {
              console.error("Erro no callback onSendMessage:", err);
              toast({ 
                title: "Erro no envio", 
                description: err.message || "Erro desconhecido ao enviar o modelo.", 
                variant: "destructive" 
              });
            }
            setSending(false);
            return;
          }
        }
      } catch (err: any) {
        console.error("Erro ao enviar template especial:", err);
        toast({ title: "Erro", description: err.message || "Falha ao enviar modelo.", variant: "destructive" });
        setSending(false);
        return;
      }
    }

    // If template has media, send directly
    if (template.mediaUrl && template.type && template.type !== 'texto') {
      if (!conversation) return;
      setSending(true);
      try {
        let mediaType = 'document';
        if (['image', 'imagem', 'imagem_botoes'].includes(template.type)) mediaType = 'image';
        else if (['video', 'video_botoes'].includes(template.type)) mediaType = 'video';
        else if (template.type === 'audio') mediaType = 'audio';
        
        const sendOptions: any = {
          mediaUrl: template.mediaUrl,
          mediaType,
          preferredInstanceId: conversation.preferredInstanceId,
          title: template.header || undefined,
          footer: template.footer || undefined,
          templateId: template.id,
        };

        if (filteredButtonActions.length > 0) {
          sendOptions.buttonActions = filteredButtonActions;
        }

        await onSendMessage(conversation.phone, template.content, sendOptions);
        incrementUsage(template.id);
        toast({ title: "Modelo enviado", description: `"${template.name}" enviado com sucesso.` });
      } catch {
        toast({ title: "Erro", description: "Falha ao enviar modelo.", variant: "destructive" });
      } finally {
        setSending(false);
      }
    } else if (filteredButtonActions.length > 0) {
      if (!conversation) return;
      setSending(true);
      try {
        await onSendMessage(conversation.phone, template.content, {
          preferredInstanceId: conversation.preferredInstanceId,
          title: template.header || undefined,
          footer: template.footer || undefined,
          buttonActions: filteredButtonActions,
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

   const filteredTemplates = useMemo(() => {
     return templates.filter(t => 
       t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
       (t.category && t.category.toLowerCase().includes(templateSearch.toLowerCase())) ||
       (t.content && t.content.toLowerCase().includes(templateSearch.toLowerCase()))
     );
   }, [templates, templateSearch]);

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
        <Avatar className="h-10 w-10 shrink-0 border border-border/50 overflow-hidden bg-muted flex items-center justify-center">
          <AvatarImage 
            src={conversation.profilePictureUrl || undefined} 
            className="h-full w-full object-cover" 
            onError={(e) => {
              (e.target as HTMLImageElement).onerror = null;
            }} 
          />
          <AvatarFallback className="bg-[#DFE5E7] flex h-full w-full items-center justify-center rounded-full">
            <WhatsAppDefaultAvatar />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-medium text-foreground truncate">
              {getConversationDisplayName(conversation.contactName, conversation.phone, conversation.isCommunity)}
            </h3>
            <ChatTypeBadge phone={conversation.phone} name={conversation.contactName} isCommunity={conversation.isCommunity} />
          </div>
           <div className="flex items-center gap-2">
             <p className="text-xs text-muted-foreground">
               {conversation.contactName ? formatPhone(conversation.phone) : `${conversation.messages.length} mensagens`}
             </p>
             {conversation.messages.some(m => (m as any).tags?.length > 0) && (
               <div className="flex gap-1 flex-wrap">
                 {Array.from(new Set(conversation.messages.flatMap(m => (m as any).tags || []))).map(tagName => {
                   const tag = availableTags.find(t => t.name === tagName);
                    // Z-API defines colors as numeric IDs. If availableTags has the color, use it.
                    // Otherwise, try to find by name in availableTags to get its color ID.
                    const effectiveColorId = tag?.color ?? 0;
                    const colorHex = tagColors.find(c => c.id === effectiveColorId)?.hex || '#94a3b8';
                   return (
                     <Badge 
                       key={tagName} 
                       variant="secondary" 
                       className="text-[9px] px-1.5 h-4 text-white" 
                       style={{ backgroundColor: colorHex }}
                     >
                       {tagName}
                       <X 
                         className="w-2 h-2 ml-1 cursor-pointer hover:text-red-200" 
                         onClick={(e) => {
                           e.stopPropagation();
                           if (tag) handleRemoveTag(tag.id);
                         }}
                       />
                     </Badge>
                   );
                 })}
               </div>
             )}
           </div>
        </div>
        <div className="flex gap-1 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="Ligações">
                <Phone className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="space-y-1">
                <div className="p-2 space-y-2">
                  <div className="space-y-1">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Chamada de WhatsApp (15s)</Label>
                      {rawActiveInstance && !isMobileZapiInstance(rawActiveInstance) && (
                        <p className="text-[9px] text-amber-600 font-medium leading-tight">
                          Aviso: Chamadas funcionam melhor em instâncias Mobile.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        className="flex-1 justify-start text-[11px] h-8 gap-1.5 border-green-200 hover:bg-green-50 px-2" 
                        onClick={() => conversation && onSendCall(conversation.phone, 15)}
                        title="Apenas chamar sem áudio"
                      >
                        <PhoneCall className="w-3 h-3 text-green-600 shrink-0" />
                        Chamar
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 justify-start text-[11px] h-8 gap-1.5 border-blue-200 hover:bg-blue-50 px-2" 
                        onClick={() => callAudioInputRef.current?.click()}
                        disabled={isUploadingAudio}
                        title="Subir áudio para tocar na chamada"
                      >
                        {isUploadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3 text-blue-600 shrink-0" />}
                        {isUploadingAudio ? "Sendo..." : "Com Áudio"}
                      </Button>
                      <input 
                        type="file" 
                        ref={callAudioInputRef} 
                        className="hidden" 
                        accept="audio/*" 
                        onChange={handleCallAudioUpload}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase">Falar agora (SIP)</Label>
                    <Button 
                      variant="default" 
                      className="w-full justify-start text-xs h-8 gap-2 bg-green-600 hover:bg-green-700" 
                      onClick={handleOpenSipInfo}
                      disabled={loadingSip}
                    >
                      {loadingSip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                      Configurar Ramal SIP
                    </Button>
                    <p className="text-[10px] text-muted-foreground leading-tight px-1">
                      Para conversar por voz, é necessário configurar um ramal (Zoiper/MicroSIP).
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm h-9 gap-2" 
                  onClick={handleOpenSipInfo}
                  disabled={loadingSip}
                >
                  {loadingSip ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-blue-600" />}
                  Configurações SIP
                </Button>
              </div>
            </PopoverContent>
          </Popover>

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
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:text-destructive" 
            title="Limpar conversa"
            onClick={handleClearChat}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3 bg-background">
        <div className="max-w-3xl mx-auto space-y-1">
          {Array.from(messagesByDate.entries()).map(([dateKey, msgs]) => (
            <div key={dateKey}>
              <div className="flex justify-center my-3">
                <span className="text-[12px] px-3 py-1 rounded-full bg-muted text-muted-foreground shadow-sm border border-border">
                  {formatDateSeparator(msgs[0].timestamp)}
                </span>
              </div>
              {msgs.map((msg) => {
                 const senderPhone = msg.sender_phone ? String(msg.sender_phone).replace(/\D/g, '') : null;
                 const senderContact = senderPhone ? savedContacts.get(senderPhone) : null;
                 const senderPhoto = (msg.sender_photo && msg.sender_photo !== 'null' && msg.sender_photo !== 'undefined' && /^https?:\/\//i.test(msg.sender_photo))
                   ? msg.sender_photo
                   : (senderContact?.profile_picture_url && senderContact.profile_picture_url !== 'null' && senderContact.profile_picture_url !== 'undefined' && /^https?:\/\//i.test(senderContact.profile_picture_url))
                   ? senderContact.profile_picture_url
                   : (isGroupPhone(conversation.phone) ? null : conversation.profilePictureUrl);

                return (
                  <div key={msg.id} className="mb-2">
                    {(/(?:entrou no grupo|saiu do grupo)\s*$/i).test(String(msg.content || '').trim()) ? (
                      <div className="flex justify-center my-2">
                        <span className="text-[12px] px-3 py-1 rounded-full bg-muted text-muted-foreground shadow-sm border border-border">
                          {String(msg.content || '').trim()}
                        </span>
                      </div>
                    ) : msg.type === 'received' ? (
                      <div className="flex justify-start gap-2 items-end">
                        {!isGroupPhone(conversation.phone) ? (
                          <Avatar className="w-8 h-8 shrink-0 border border-border overflow-hidden bg-muted flex items-center justify-center">
                            {senderPhoto && <AvatarImage src={senderPhoto} className="object-cover" />}
                            <AvatarFallback className="text-[10px] font-semibold">
                              {(conversation.contactName || conversation.phone || '?').replace(/[^A-Za-zÀ-ú0-9]/g, '').slice(0, 2).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <Avatar className="w-8 h-8 shrink-0 border border-border overflow-hidden bg-muted flex items-center justify-center">
                            {senderPhoto && <AvatarImage src={senderPhoto} className="object-cover" />}
                            <AvatarFallback className="text-[10px] font-semibold">
                              {(msg.sender_name || msg.sender_phone || '?').replace(/[^A-Za-zÀ-ú0-9]/g, '').slice(0, 2).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      <div className="max-w-[75%] rounded-lg px-3 py-2 shadow-sm bg-card text-card-foreground">
                        {isGroupPhone(conversation.phone) && (msg.sender_name || msg.sender_phone) && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            {msg.sender_name && (
                              <span className="text-[11px] font-semibold truncate" style={{ color: '#128c7e' }}>
                                {msg.sender_name}
                              </span>
                            )}
                            {msg.sender_phone && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                +{String(msg.sender_phone).replace(/\D/g, '')}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="relative group/msg">
                          <MessageContent content={msg.content} isSent={false} templates={templates} campaignId={msg.campaign_id} campaignTemplates={campaignTemplates} />
                          <p className="text-[10px] text-right mt-1 opacity-70">
                            {formatMessageTime(msg.timestamp)}
                          </p>
                          {localReactions[msg.id] && (
                            <span className="absolute -bottom-3 right-2 rounded-full bg-card border border-border px-1 text-xs shadow-sm">
                              {localReactions[msg.id]}
                            </span>
                          )}
                          <div className="absolute top-0 -right-8 flex flex-col gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-muted"
                              title="Responder"
                              onClick={() => setReplyingTo({ id: msg.externalMessageId || msg.id, content: msg.content, isSent: false })}
                            >
                              <Reply className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-muted"
                              title="Encaminhar"
                              onClick={() => onForwardMessage(conversation.phone, msg.id)}
                            >
                              <Send className="w-3 h-3" />
                            </Button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted" title="Reagir">
                                  <Smile className="w-3 h-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-1" side="top">
                                <div className="flex gap-1">
                                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <button
                                      key={emoji}
                                      className="hover:scale-125 transition-transform p-1"
                                      onClick={() => handleReactionClick(msg, emoji)}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end group/msg">
                      <div className="max-w-[75%] relative rounded-lg px-3 py-2 shadow-sm bg-primary text-primary-foreground">
                        <div className="absolute top-0 -left-8 flex flex-col gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted text-foreground"
                            title="Responder"
                            onClick={() => setReplyingTo({ id: msg.externalMessageId || msg.id, content: msg.content, isSent: true })}
                          >
                            <Reply className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted text-foreground"
                            title="Encaminhar"
                            onClick={() => onForwardMessage(conversation.phone, msg.id)}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted text-foreground" title="Reagir">
                                <Smile className="w-3 h-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" side="top">
                              <div className="flex gap-1">
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                  <button
                                    key={emoji}
                                    className="hover:scale-125 transition-transform p-1"
                                    onClick={() => handleReactionClick(msg, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <MessageContent content={msg.content} isSent={true} templates={templates} campaignId={msg.campaign_id} campaignTemplates={campaignTemplates} />
                        <div className="flex items-center justify-end gap-1.5 mt-1 opacity-80">
                          {msg.source !== 'message_log' && (
                            <span className="text-[9px] flex items-center gap-0.5">
                              {getSourceIcon(msg.source)}
                              {getSourceLabel(msg.source, msg.keyword_matched)}
                            </span>
                          )}
                          <span className="text-[10px]">
                            {formatMessageTime(msg.timestamp)}
                          </span>
                        </div>
                        {localReactions[msg.id] && (
                          <span className="absolute -bottom-3 left-2 rounded-full bg-card border border-border px-1 text-xs shadow-sm text-foreground">
                            {localReactions[msg.id]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Reply preview */}
      {replyingTo && (
        <div className="border-t border-border bg-muted/30 px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0 border-l-4 border-primary pl-3">
              <p className="text-xs font-medium text-primary">
                Respondendo {replyingTo.isSent ? 'à sua mensagem' : 'à mensagem'}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {replyingTo.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setReplyingTo(null)}
              title="Cancelar resposta"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

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
      <div className="border-t border-border bg-background px-4 py-3">
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
               <input
                 type="file"
                 ref={stickerInputRef}
                 className="hidden"
                 accept="image/webp,image/png,image/jpeg"
                 onChange={handleStickerUpload}
               />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => stickerInputRef.current?.click()}
                  disabled={sending}
                  title="Enviar figurinha"
                >
                  <StickyNote className="w-4 h-4" />
                </Button>
                <input
                  type="file"
                  ref={gifInputRef}
                  className="hidden"
                  accept="image/gif"
                  onChange={handleGifUpload}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => gifInputRef.current?.click()}
                  disabled={sending}
                  title="Enviar GIF"
                >
                  <FileImage className="w-4 h-4 text-purple-500" />
                </Button>
               <Popover open={addingTag} onOpenChange={setAddingTag}>
                 <PopoverTrigger asChild>
                   <span className="hidden" />
                 </PopoverTrigger>
                 <PopoverContent className="w-80 p-0" align="start" side="top">
                   <div className="p-3 border-b border-border bg-muted/20">
                     <div className="flex items-center justify-between mb-2">
                       <h4 className="text-sm font-semibold">Etiquetas do Contato</h4>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6" 
                         onClick={() => {
                           setNewTagName("");
                           setNewTagDescription("");
                           setNewTagColor(tagColors[0]?.id ?? 0);
                           setIsCreateTagOpen(true);
                         }}
                       >
                         <Plus className="w-4 h-4" />
                       </Button>
                     </div>
                     <div className="relative">
                       <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                       <Input
                         placeholder="Buscar etiqueta..."
                         value={tagSearchTerm}
                         onChange={(e) => setTagSearchTerm(e.target.value)}
                         className="h-8 pl-8 text-xs"
                       />
                     </div>
                   </div>
                   <ScrollArea className="max-h-[300px]">
                     <div className="p-1">
                       {loadingTags ? (
                         <div className="flex items-center justify-center py-4">
                           <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                         </div>
                       ) : availableTags.length === 0 ? (
                         <div className="text-center py-4 text-xs text-muted-foreground">
                           Nenhuma etiqueta encontrada
                         </div>
                       ) : (
                         availableTags
                           .filter(t => t.name.toLowerCase().includes(tagSearchTerm.toLowerCase()))
                           .map((tag) => {
                             const isAttached = conversation?.messages.some(m => 
                               m.keyword_matched?.includes(`[Tag:${tag.name}]`) || 
                               (m as any).tags?.includes(tag.name)
                             ) || false;

                             return (
                               <button
                                 key={tag.id}
                                 onClick={() => handleAddTag(tag.id)}
                                 className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 rounded-md transition-colors"
                               >
                                 <div className="flex items-center gap-2 overflow-hidden">
                                   <div 
                                     className="w-3 h-3 rounded-full shrink-0" 
                                  style={{ backgroundColor: tagColors.find(c => c.id === tag.color)?.hex || '#94a3b8' }} 
                                   />
                                   <span className="text-sm truncate">{tag.name}</span>
                                 </div>
                                 {isAttached && <Check className="w-4 h-4 text-primary shrink-0" />}
                               </button>
                             );
                           })
                       )}
                     </div>
                   </ScrollArea>
                 </PopoverContent>
               </Popover>

               {/* Dialog for creating new Tag */}
               <Dialog open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen}>
                 <DialogContent className="sm:max-w-[480px]">
                   <DialogHeader>
                     <DialogTitle>Nova Etiqueta</DialogTitle>
                     <DialogDescription>Crie novas tags para uma melhor organização</DialogDescription>
                   </DialogHeader>
                   <div className="space-y-4 py-2">
                     <div className="space-y-2">
                       <Label htmlFor="newTagName" className="text-sm">Nome</Label>
                       <Input
                         id="newTagName"
                         placeholder="Nome da tag"
                         value={newTagName}
                         onChange={(e) => setNewTagName(e.target.value)}
                       />
                     </div>

                     <div className="space-y-2">
                       <Label htmlFor="newTagDescription" className="text-sm">Descrição</Label>
                       <Input
                         id="newTagDescription"
                         placeholder="Descrição da tag"
                         value={newTagDescription}
                         onChange={(e) => setNewTagDescription(e.target.value)}
                       />
                     </div>

                     <div className="grid grid-cols-9 gap-3 pt-2">
                       {tagColors.length > 0 ? (
                        tagColors.length > 0 ? tagColors.map((c) => (
                           <button
                             key={c.id}
                             type="button"
                            onClick={() => {
                              setNewTagColor(c.id);
                            }}
                             className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                             style={{ backgroundColor: c.hex }}
                             aria-label={c.label || `Cor ${c.id}`}
                           >
                             {newTagColor === c.id && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />}
                           </button>
                        )) : (
                          ['#ef4444', '#dc2626', '#f87171', '#fb7185', '#ec4899', '#f472b6', '#fed7aa', '#f97316', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#7dd3fc', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d8b4fe', '#94a3b8', '#000000'].map((hex, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setNewTagColor(idx)}
                              className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                              style={{ backgroundColor: hex }}
                            >
                              {newTagColor === idx && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />}
                            </button>
                          ))
                        )
                       ) : (
                         ['#ef4444', '#dc2626', '#f87171', '#fb7185', '#ec4899', '#f472b6', '#fed7aa', '#f97316', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#7dd3fc', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d8b4fe', '#94a3b8', '#000000'].map((hex, idx) => (
                           <button
                             key={idx}
                             type="button"
                             onClick={() => setNewTagColor(idx)}
                             className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                             style={{ backgroundColor: hex }}
                           >
                             {newTagColor === idx && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />}
                           </button>
                         ))
                       )}
                     </div>
                   </div>
                   <DialogFooter>
                     <Button onClick={handleCreateTag} disabled={loadingTags || !newTagName.trim()} className="w-full sm:w-auto">
                       {loadingTags ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                       Confirmar
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>

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
                   <ScrollArea className="max-h-[500px]">
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
                className="min-h-[40px] max-h-[120px] resize-none text-sm bg-white text-black placeholder:text-black/60 border-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg shadow-sm"
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

      <Dialog open={sipInfoOpen} onOpenChange={setSipInfoOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Configurações SIP para Chamadas
            </DialogTitle>
            <DialogDescription>
               Utilize estas informações em seu cliente SIP (Softphone) para realizar chamadas. 
                <a href="https://zaplynxpro.online/sip-info" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block mt-1">
                 Ver guia de configuração do Zoiper/MicroSIP
               </a>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Servidor / Domain</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md border text-sm font-mono">
                  {sipData?.server || "sip.z-api.io"}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Porta</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md border text-sm font-mono">
                  {sipData?.port || "5060"}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Usuário / Ramal</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md border text-sm font-mono break-all">
                {sipData?.username || sipData?.extension || "---"}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Senha / Token SIP</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md border text-sm font-mono break-all">
                {sipData?.sipToken || "---"}
              </div>
            </div>

             <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 space-y-2">
               <p className="font-semibold">Como configurar:</p>
               <ol className="list-decimal ml-4 space-y-1">
                 <li>Baixe um Softphone (Zoiper ou MicroSIP).</li>
                 <li>Crie uma nova conta do tipo <b>SIP</b>.</li>
                 <li>Use o <b>Usuário</b> e <b>Servidor</b> acima.</li>
                 <li>No campo de senha, use o <b>Token SIP</b>.</li>
                 <li>Certifique-se que o transporte está como <b>UDP</b>.</li>
               </ol>
             </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1">
                <Key className="w-3 h-3" /> Token de Chamada:
              </p>
              <p className="break-all opacity-80">{sipData?.callToken || "Nenhum token disponível"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSipInfoOpen(false)}>Fechar</Button>
            <Button onClick={() => {
              const text = `SIP Info:\nServer: ${sipData?.server}\nPort: ${sipData?.port}\nUser: ${sipData?.username}\nPass: ${sipData?.sipToken}`;
              navigator.clipboard.writeText(text);
              toast({ title: "Copiado", description: "Configurações copiadas para a área de transferência." });
            }}>
              Copiar Tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const { instances: allInstances, activeInstance: rawActiveInstance } = useZapiInstances({ provider: 'zapi' });
  // Mensagens usa exclusivamente Z-API: filtra todas as instâncias por provider
  // Mensagens no painel ZapLynx usa exclusivamente instâncias Z-API
  const instances = useMemo(() => 
    allInstances.filter((i: any) => {
      const provider = (i.api_provider || "zapi").toLowerCase();
      return provider === "zapi" || provider === "uazapi";
    }), [allInstances]);
  const activeInstance = useMemo(() => {
    const provider = ((rawActiveInstance as any)?.api_provider || "zapi").toLowerCase();
    const isSupported = provider === "zapi" || provider === "uazapi";
    
    return (rawActiveInstance && isSupported
      ? rawActiveInstance
      : instances.find((i: any) => i.is_default) || instances[0] || null);
  }, [rawActiveInstance, instances]);
  const [connectedInstanceIds, setConnectedInstanceIds] = useState<string[] | null>(null);
  const [connectedInstanceNames, setConnectedInstanceNames] = useState<string[] | null>(null);
  const [pageAvailableTags, setPageAvailableTags] = useState<{ id: string; name: string; color: number }[]>([]);
  const [pageTagColors, setPageTagColors] = useState<{ id: number; hex: string; label: string }[]>([]);
  const [connectedUiInstanceIds, setConnectedUiInstanceIds] = useState<string[] | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
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
  const knownInstanceIds = useMemo(() => 
    instances.map(i => i.id).filter(Boolean)
  , [instances]);

  const knownInstanceNames = useMemo(() => 
    instances.map(i => i.instance_name).filter(Boolean)
  , [instances]);
  const handleDeleteConversation = async (phone: string) => {
    try {
      await deleteConversation(phone);
      if (selectedPhone === phone) setSelectedPhone(null);
      toast({ title: "Conversa apagada", description: "Conversa removida com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível apagar a conversa.", variant: "destructive" });
    }
  };

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
  // Auto-sync the chat list from the connected provider (Z-API) so
  // we always show the latest live conversations, not only the historic logs
  // stored in the database.
  const shouldAutoSyncHistory = Boolean(selectedInstance?.api_provider || activeInstance?.api_provider);
    const {
      conversations,
      loading, 
      saveContact, 
      fetchProfilePicture, 
      sendMessage, 
      refetch, 
      forceUpdateAllPhotos, 
      syncMetadata,
      savedContacts,
      deleteConversation,
      clearFetchedPhotosCache,
      refetch: refetchLogs
    } = useMessageLogs(
    filterZapiInstanceId,
    filterInstanceName,
    knownInstanceIds,
    knownInstanceNames,
  );
  const [syncing, setSyncing] = useState(false);
   const isMobile = useIsMobile();
   const { toast } = useToast();

   useEffect(() => {
     // Limpa o localStorage de conversas deletadas antigas
     localStorage.removeItem('deletedConversations');
     localStorage.removeItem('readConversations');
     // Força refetch completo
     refetch();
   }, []); // roda só uma vez ao montar

    const { forwardMessage, sendReaction, sendSticker, sendGif, sendCall: sendCallZapi, setOverride } = useZapi();
   // Sincroniza a instância selecionada com o hook useZapi
   useEffect(() => {
     if (selectedInstance) {
       setOverride(selectedInstance as any);
     } else {
       setOverride(null);
     }
   }, [selectedInstance, setOverride]);

   const { listTags: pageListTags } = useZapi();
 
   useEffect(() => {
     let cancelled = false;
     (async () => {
       try {
         const tags = await pageListTags();
         if (!cancelled) setPageAvailableTags(Array.isArray(tags) ? tags : []);
       } catch (e) { console.error('Erro ao carregar etiquetas (lista):', e); }
       try {
         const { data } = await supabase.functions.invoke('zapi-chat-actions', { body: { action: 'tag-colors' } });
         if (!cancelled) setPageTagColors(Array.isArray(data?.data) ? data.data : []);
       } catch (e) { console.error('Erro ao carregar cores das etiquetas (lista):', e); }
     })();
     return () => { cancelled = true; };
   }, []);
  const syncHistory = async () => {
    setSyncing(true);
    try {
      // Usa a instância conectada, não "all"
      const targetInstance = connectedUiInstanceIds?.length
        ? instances.find(i => i.id === connectedUiInstanceIds[0])
        : selectedInstance || activeInstance;

      if (!targetInstance) {
        toast({ 
          title: "Nenhuma instância conectada", 
          description: "Conecte seu WhatsApp primeiro.", 
          variant: "destructive" 
        });
        return;
      }

      // Para instâncias Meta, não há sincronização de histórico via API de chats.
      if (targetInstance.api_provider === 'meta') {
        toast({ 
          title: "Sincronização automática", 
          description: "A API da Meta sincroniza mensagens em tempo real via Webhook.",
        });
        setSyncing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-zapi-history', {
        body: { 
          maxChats: 200, 
          amountPerChat: 12, 
          instanceId: targetInstance.id
        },
      });

      if (error) throw error;
      if (data?.error === 'disconnected') {
        toast({ 
          title: "⚠️ WhatsApp desconectado", 
          description: "Reconecte sua instância na página de Dispositivos.", 
          variant: "destructive" 
        });
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
          setConnectedUiInstanceIds([]);
        }
        return;
      }

      const results = await Promise.all(
        instances.map(async (instance) => {
          if (instance.api_provider === 'meta') return instance;
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
      
      // ✅ Pega APENAS os zapi_instance_ids das instâncias conectadas agora
      const connectedZapiIds = connected
        .map((i) => i!.zapi_instance_id)
        .filter(Boolean);
        
      setConnectedInstanceIds(connectedZapiIds);
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

  const prevConnectedRef = useRef<string[]>([]);

  useEffect(() => {
    if (!connectedInstanceIds || connectedInstanceIds.length === 0) {
      prevConnectedRef.current = [];
      return;
    }

    // Detecta instâncias que acabaram de conectar (não estavam antes)
    const newlyConnected = connectedInstanceIds.filter(
      id => !prevConnectedRef.current.includes(id)
    );

    if (newlyConnected.length > 0) {
      console.log('Nova instância conectada, sincronizando...', newlyConnected);
      syncHistory(); // ✅ sincroniza automaticamente ao conectar
    }

    prevConnectedRef.current = connectedInstanceIds;
  }, [connectedInstanceIds]);

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

  const toggleSelectPhone = (phone: string) => {
    const normalized = normalizeSelectedConversationPhone(phone);
    if (!normalized) return;
    setSelectedPhones(prev => {
      const next = new Set(prev);
      if (next.has(normalized)) next.delete(normalized);
      else next.add(normalized);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedPhones.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja apagar as ${selectedPhones.size} conversas selecionadas? Esta ação não apaga as mensagens no WhatsApp dos contatos.`)) return;

    setSyncing(true);
    try {
      for (const phone of selectedPhones) {
        await deleteConversation(phone);
      }
      toast({ title: "Conversas apagadas", description: `${selectedPhones.size} conversas foram removidas localmente.` });
      setSelectedPhones(new Set());
      setIsSelectionMode(false);
      refetchLogs();
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao apagar algumas conversas.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
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

  // Auto history sync for Z-API to keep the latest live conversations.
  useEffect(() => {
    if (!shouldAutoSyncHistory) return;
    if ((knownInstanceIds?.length || 0) === 0) return;
    syncHistory();
  }, [shouldAutoSyncHistory, knownInstanceIds?.join('|')]);

  // Background sync every 5 minutes to keep the chat list fresh.
  // Refreshes only the chat list — message
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

  // On-demand: when the user opens a conversation, fetch its message history from Z-API
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

  const zapiConversations = useMemo(() => {
    return conversations.filter(conv => {
      // Include if it's NOT a meta instance and doesn't have messages from meta
      const isMeta = conv.preferredInstanceId?.startsWith('meta:') || 
                   conv.messages.some(m => m.externalMessageId?.startsWith('meta:') || m.content.includes('[sender:meta:'));
      return !isMeta;
    });
  }, [conversations]);

  const filteredConversations = zapiConversations.filter((conv) => {
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

  const handleRefreshAll = async () => {
    setSyncing(true);
    try {
      // Chama até 5 páginas de 100 contatos cada
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.functions.invoke('sync-profile-photos', {
          body: { page: i }
        });
        
        if (data && data.hasMore === false) {
          break;
        }
      }
      
      await refetch();
      clearFetchedPhotosCache();

      toast({ 
        title: "Fotos sincronizadas", 
        description: "Fotos de perfil atualizadas." 
      });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };
 
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

    // Reconstruct correct format for Z-API (needs @g.us for groups)
    const zapiPhone = phone.endsWith('-group')
      ? `${phone.replace(/-group$/, '')}@g.us`
      : phone;

    const url = await fetchProfilePicture(
      zapiPhone,
      force,
      selectedInstance?.zapi_instance_id || activeInstance?.zapi_instance_id || null
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
              <ConversationList 
                conversations={filteredConversations} 
                selectedPhone={selectedPhone} 
                onSelect={handleSelectPhone} 
                searchTerm={searchTerm} 
                onSearchChange={setSearchTerm} 
                readPhones={readPhones} 
                instances={visibleInstances} 
                selectedInstanceId={selectedInstanceId} 
                onInstanceChange={setSelectedInstanceId} 
                syncing={syncing} 
                onSync={syncHistory} 
                onFetchPhoto={handleFetchPhoto} 
                onRefreshPhotos={handleRefreshAll}
                isSelectionMode={isSelectionMode}
                selectedPhones={selectedPhones}
                onToggleSelect={toggleSelectPhone}
                onToggleSelectionMode={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedPhones(new Set());
                }}
                onDeleteSelected={handleDeleteSelected}
                onDeleteConversation={handleDeleteConversation}
                availableTags={pageAvailableTags}
                tagColors={pageTagColors}
              />
          </div>
        )}
        {showChat && (
          <ChatView
            conversation={selectedConversation}
            onBack={() => setSelectedPhone(null)}
            isMobile={isMobile}
            onSaveContact={handleSaveContact}
            onFetchPhoto={handleFetchPhoto}
            loadingPhoto={loadingPhoto}
            onOpenProfile={() => setProfileOpen(true)}
            onTriggerFlow={(phone) => setProfileOpen(true)}
            campaignTemplates={campaignTemplates}
            savedContacts={savedContacts}
            activeInstance={rawActiveInstance}
            onSendMessage={async (phone, message, options) => {
              await sendMessage(phone, message, options);
              toast({ title: "Mensagem enviada", description: "Mensagem enviada com sucesso." });
            }}
            onSendCall={async (phone, duration, audioUrl) => {
              const cleanPhone = String(phone || '').replace(/\D/g, '');
              console.log(`[MensagensRecebidas] Iniciando chamada para ${cleanPhone} (Duração: ${duration}s)`);
              await sendCallZapi(cleanPhone, duration, audioUrl);
            }}
            onForwardMessage={async (phone, messageId) => {
              const destination = window.prompt(
                'Encaminhar mensagem para qual número? (ex: 5511999998888)',
              );
              if (!destination) return;
              await forwardMessage(phone, messageId, destination);
            }}
             onSendReaction={async (phone, messageId, emoji) => {
               await sendReaction(phone, messageId, emoji);
             }}
              onSendSticker={async (phone, stickerUrl) => {
                await sendSticker(phone, stickerUrl);
              }}
              onSendGif={async (phone, gifUrl, caption) => {
                await sendGif(phone, gifUrl, caption);
              }}
             onDeleteConversation={async (phone) => {
               await deleteConversation(phone);
             }}
             onUpdate={refetch}
           />
         )}
       </div>
        <SaveContactDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} phone={saveDialogPhone} currentName={saveDialogName} onSave={handleDoSave} />

        <ContactProfileDialog
          contact={selectedConversation ? {
            phone: selectedConversation.phone,
            name: selectedConversation.contactName || '',
            status: 'ativo',
            messageCount: selectedConversation.messages.length,
            lastMessageDate: selectedConversation.lastTimestamp,
            firstContactDate: selectedConversation.messages[0]?.timestamp || null,
            tags: [],
            profilePictureUrl: selectedConversation.profilePictureUrl || null,
          } : null}
          open={profileOpen}
          onOpenChange={setProfileOpen}
          onUpdate={refetch}
          preferredInstanceId={selectedInstanceId === 'all' ? undefined : filterZapiInstanceId}
        />
      </>
   );
 };

export default MensagensRecebidas;
