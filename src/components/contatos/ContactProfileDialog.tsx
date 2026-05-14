import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
   Phone, MessageSquare, Tag, Plus, X, Bot, Calendar, 
    Hash, Clock, Pencil, Check, Send, ShieldAlert, Ban, UserCheck, Image, RefreshCw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Contact } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { useZapi } from "@/hooks/useZapi";
  import { useZapiInstances } from "@/hooks/useZapiInstances";
import { WhatsAppDefaultAvatar } from "@/components/ui/whatsapp-default-avatar";

interface ContactProfileDialogProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
  preferredInstanceId?: string;
}

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

const isLikelyTechnicalIdentifier = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  return !phone.includes('@') && !phone.includes('-group') && /^\d{14,16}$/.test(clean) && !clean.startsWith('55');
};

const getInvokeErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const response = error.context;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.clone().json();
        return data?.message || data?.error || JSON.stringify(data);
      }

      const text = await response.clone().text();
      if (text === 'user_not_found') return 'A instância vinculada a esta conversa não existe mais ou está inativa.';
      if (text === 'missing_instance_id') return 'Nenhuma instância foi identificada para este contato.';
      if (text === 'incomplete_credentials') return 'A instância selecionada está sem credenciais completas.';
      return text || fallback;
    } catch {
      return fallback;
    }
  }

  if (error instanceof Error) return error.message;
  return fallback;
};

const ContactProfileDialog = ({ contact, open, onOpenChange, onUpdate, preferredInstanceId }: ContactProfileDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [selectedFlow, setSelectedFlow] = useState("");
  const [flows, setFlows] = useState<{ id: string; name: string; keyword: string }[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
   const [sendingFlow, setSendingFlow] = useState(false);
   const [localPreferredInstance, setLocalPreferredInstance] = useState<string>("");
   const { instances: zapiInstancesList } = useZapiInstances();
   const { blockContact, reportContact, checkIsWhatsApp, getContactProfilePicture, getChatMetadata, loading: zapiLoading, setZapiInstanceOverride, listTags, addTagChat, removeTagChat, saveChatNote } = useZapi();
    const [availableTags, setAvailableTags] = useState<{ id: string, name: string, color: number }[]>([]);
    const [tagColors, setTagColors] = useState<{ id: number; hex: string; label: string }[]>([]);
    const [note, setNote] = useState("");
    const [capturedEmail, setCapturedEmail] = useState<string | null>(null);
    const [capturedCPF, setCapturedCPF] = useState<string | null>(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [loadingTags, setLoadingTags] = useState(false);

  const loadFlows = async () => {
    setLoadingFlows(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFlows([]);
        return;
      }

      const { data, error } = await supabase
        .from('flow_automations')
        .select('id, name, keyword')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setFlows((data as any[]) || []);
    } catch (e) {
      console.error('loadFlows error:', e);
      setFlows([]);
      toast({ title: "Erro ao carregar fluxos", variant: "destructive" });
    } finally {
      setLoadingFlows(false);
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

  const fetchContactMetadata = async () => {
    if (!contact) return;
    try {
      const data = await getChatMetadata(contact.phone);
      if (data) {
        if (data.tags) {
          const tagNames = data.tags.map((t: any) => t.name);
          setLocalTags(tagNames);
        }
        if (data.notes) {
          setNote(data.notes.content || "");
        }
      }

      // Also fetch from flow_captured_data if available
      const { data: capturedData } = await supabase
        .from('flow_captured_data')
        .select('*')
        .eq('phone', contact.phone)
        .limit(1)
        .maybeSingle();

      if (capturedData) {
        const data = capturedData as any;
        setCapturedEmail(data.email);
        setCapturedCPF(data.cpf);
      }
    } catch (e) {
      console.error('Error fetching contact metadata:', e);
    }
  };

  useEffect(() => {
    if (!open || !contact) {
      if (!open) setZapiInstanceOverride(null);
      return;
    }
    
    setLocalTags([...(contact.tags || [])]);
    setNote(contact.notes?.content || (contact as any).notes?.content || "");
    setNewName(contact.name || '');
    
    loadFlows();
    loadAvailableTags();
    fetchTagColors();
    fetchContactMetadata();

    // If we have a preferred instance, set it in useZapi so subsequent actions use it
    if (preferredInstanceId && preferredInstanceId !== 'all') {
      // We need to fetch the instance details to pass to setZapiInstanceOverride
      const fetchAndSetInstance = async () => {
        const { data } = await supabase
          .from('zapi_instances')
          .select('*')
          .eq('zapi_instance_id', preferredInstanceId)
          .maybeSingle();
        
        if (data) {
          setZapiInstanceOverride(data as any);
        }
      };
      fetchAndSetInstance();
    }
  }, [open, contact?.phone, preferredInstanceId]);

  const handleSaveNote = async () => {
    if (!contact) return;
    setIsSavingNote(true);
    try {
      await saveChatNote(contact.phone, note);
      toast({ title: "Anotação salva!", description: "A anotação foi salva com sucesso no WhatsApp Business." });
      onUpdate?.();
    } catch (e) {
      console.error('handleSaveNote error:', e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const handleSaveName = async () => {
    if (!contact || !newName.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('saved_contacts').upsert(
      { phone: contact.phone, name: newName.trim(), user_id: session.user.id },
      { onConflict: 'phone,user_id' }
    );
    toast({ title: "Nome atualizado!" });
    setEditingName(false);
    onUpdate?.();
  };

  const handleAddTag = async (tagId: string, tagName: string) => {
    if (!contact) return;
    try {
      const res = await addTagChat(contact.phone, tagId);
      console.log('[ContactProfileDialog] Tag added:', res);
      if (!localTags.includes(tagName)) {
        setLocalTags([...localTags, tagName]);
      }
      setAddingTag(false);
      onUpdate?.();
    } catch (e) {
      console.error('handleAddTag error:', e);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!contact) return;
    const tagObj = availableTags.find(t => t.name === tagName);
    if (!tagObj) {
      setLocalTags(localTags.filter(t => t !== tagName));
      return;
    }

    try {
      await removeTagChat(contact.phone, tagObj.id);
      setLocalTags(localTags.filter(t => t !== tagName));
      onUpdate?.();
    } catch (e) {
      console.error('handleRemoveTag error:', e);
    }
  };

  const handleSendFlow = async () => {
    if (!contact || !selectedFlow) return;
    const flow = flows.find(f => f.id === selectedFlow);
    if (!flow) return;
    
    setSendingFlow(true);
    try {
      const instanceId = await getDefaultInstanceId();
      if (!instanceId) {
        throw new Error('Nenhuma instância ativa encontrada para disparar o fluxo');
      }

      let targetPhone = contact.phone;
      let lidToResolve: string | null = null;

      if (targetPhone.includes('@lid')) {
        lidToResolve = targetPhone;
      } else if (isLikelyTechnicalIdentifier(targetPhone)) {
        const suspectLid = `${targetPhone.replace(/\D/g, '')}@lid`;
        const { data: lidEvidence } = await (supabase as any)
          .from('message_logs')
          .select('id')
          .or(`phone.eq.${suspectLid},message_received.eq.${suspectLid}`)
          .limit(1)
          .maybeSingle();

        if (lidEvidence) {
          lidToResolve = suspectLid;
        }
      }

      if (lidToResolve) {
        const { data: resolvedLog } = await (supabase as any)
          .from('message_logs')
          .select('phone')
          .eq('message_received', lidToResolve)
          .eq('keyword_matched', '__lid_map__')
          .not('phone', 'like', '%@lid%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (resolvedLog?.phone) {
          targetPhone = resolvedLog.phone;
        } else {
          throw new Error('Esse lead está com identificador técnico e ainda não foi resolvido para número real.');
        }
      }

      const { data, error } = await supabase.functions.invoke('webhook-zapi', {
        body: {
          phone: targetPhone,
          message: { text: flow.keyword || flow.name, fromMe: false },
          fromMe: false,
          flowId: flow.id,
          instanceId,
          timestamp: Math.floor(Date.now() / 1000),
          __manual_flow_trigger__: true,
          __respect_selected_instance__: true,
        }
      });
      if (error) throw error;
      toast({ title: "Fluxo disparado!", description: `Fluxo "${flow.name}" executado para ${contact.name || targetPhone}` });
      setSelectedFlow("");
    } catch (e) {
      console.error('handleSendFlow error:', e);
      const message = await getInvokeErrorMessage(e, 'Erro ao disparar fluxo');
      toast({ title: "Erro ao disparar fluxo", description: message, variant: "destructive" });
    } finally {
      setSendingFlow(false);
    }
  };

   const handleBlock = async () => {
     if (!contact || !window.confirm(`Deseja realmente bloquear ${contact.name || contact.phone}?`)) return;
     try {
       await blockContact(contact.phone);
       onUpdate?.();
     } catch (e) {
       console.error(e);
     }
   };
 
   const handleReport = async () => {
     if (!contact || !window.confirm(`Deseja realmente denunciar ${contact.name || contact.phone}?`)) return;
     try {
       await reportContact(contact.phone);
       onUpdate?.();
     } catch (e) {
       console.error(e);
     }
   };
 
   const handleCheckIsWhatsApp = async () => {
     if (!contact) return;
     try {
       const res = await checkIsWhatsApp(contact.phone);
       if (res?.exists) {
         toast({ title: "Verificado!", description: "Este número possui WhatsApp." });
       } else {
         toast({ title: "Atenção", description: "Este número não possui WhatsApp ou não pôde ser verificado.", variant: "destructive" });
       }
     } catch (e) {
       console.error(e);
     }
   };
 
   const getDefaultInstanceId = async (): Promise<string> => {
     if (!contact) return '';

     // 1) Respect explicit preferred instance if provided and valid
     if (preferredInstanceId && preferredInstanceId !== 'all' && preferredInstanceId.length > 10) {
       console.log('🎯 Using preferredInstanceId for flow:', preferredInstanceId);
       return preferredInstanceId;
     }

     // Fetch active instances to find default or fallback
     const { data: activeInstances } = await (supabase as any)
       .from('zapi_instances')
       .select('zapi_instance_id, is_default, created_at')
       .eq('is_active', true)
       .order('is_default', { ascending: false })
       .order('created_at', { ascending: true })
       .limit(50);
 
     const validInstanceIds = new Set(
       (activeInstances || []).map((i: any) => i.zapi_instance_id)
     );
 
     // 2) Try to reuse the last instance used by this contact
    const { data: instanceCandidates } = await (supabase as any)
      .from('message_logs')
      .select('instance_id, keyword_matched, message_received, created_at')
      .eq('phone', contact.phone)
      .not('instance_id', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(30);

    const isRealInboundKeyword = (keyword?: string | null) => {
      const value = (keyword || '').trim();
      return !value.startsWith('__');
    };

    // Priority 1: real inbound from a VALID instance
    const realInbound = (instanceCandidates || []).find((row: any) => {
      return row.instance_id && validInstanceIds.has(row.instance_id) &&
        row.message_received && isRealInboundKeyword(row.keyword_matched);
    });
    if (realInbound?.instance_id) return realInbound.instance_id;

    // Priority 2: manual send from a VALID instance
    const manualSend = (instanceCandidates || []).find((row: any) => {
      return row.instance_id && validInstanceIds.has(row.instance_id) &&
        row.keyword_matched === '__manual_send__';
    });
    if (manualSend?.instance_id) return manualSend.instance_id;

    // Priority 3: any log from a VALID instance
    const anyValid = (instanceCandidates || []).find((row: any) => {
      return row.instance_id && validInstanceIds.has(row.instance_id) &&
        row.keyword_matched !== '__processing__' && row.keyword_matched !== '__lid_map__';
    });
    if (anyValid?.instance_id) return anyValid.instance_id;

    // 3) Fallback: default instance, or first active instance
    const defaultInstance = (activeInstances || []).find((i: any) => i.is_default);
    if (defaultInstance?.zapi_instance_id) return defaultInstance.zapi_instance_id;
    return activeInstances?.[0]?.zapi_instance_id || '';
  };

  if (!contact) return null;

  const statusColor = contact.status === 'ativo' 
    ? 'default' 
    : contact.status === 'bloqueado' 
      ? 'destructive' 
      : 'secondary';

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col">
        {/* Header with profile picture */}
        <div className="bg-primary/10 pt-8 pb-6 px-6 flex flex-col items-center gap-3">
          <Avatar className="w-24 h-24 bg-[#DFE5E7] border-4 border-background shadow-lg overflow-hidden">
            {contact.profilePictureUrl ? (
              <AvatarImage
                src={contact.profilePictureUrl}
               onError={() => (getContactProfilePicture as any)(contact.phone, preferredInstanceId)}
              />
            ) : null}
            <AvatarFallback className="bg-[#DFE5E7]">
              <WhatsAppDefaultAvatar />
            </AvatarFallback>
          </Avatar>

          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-[260px]">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="text-center h-9"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingName(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <SheetHeader className="p-0">
                <SheetTitle className="text-xl">{contact.name || 'Contato'}</SheetTitle>
              </SheetHeader>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setNewName(contact.name || ''); setEditingName(true); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <Badge variant={statusColor} className="text-xs">
            {contact.status}
          </Badge>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Informações</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{formatPhone(contact.phone)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <span>{contact.messageCount} mensage{contact.messageCount !== 1 ? 'ns' : 'm'}</span>
                </div>
                {contact.firstContactDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Desde {new Date(contact.firstContactDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {contact.lastMessageDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Última msg: {new Date(contact.lastMessageDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {capturedEmail && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{capturedEmail}</span>
                  </div>
                )}
                {capturedCPF && (
                  <div className="flex items-center gap-3 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span>CPF: {capturedCPF}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Last message */}
            {contact.lastMessage && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Última Mensagem</h3>
                  <p className="text-sm text-muted-foreground italic bg-muted/50 p-3 rounded-lg">
                    "{contact.lastMessage}"
                  </p>
                </div>
                <Separator />
              </>
            )}

            {/* Notes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Anotações (WhatsApp Business)</h3>
              <div className="space-y-2">
                <textarea
                  className="w-full min-h-[100px] p-3 text-sm rounded-lg border border-border bg-background/50 focus:ring-1 focus:ring-primary outline-none resize-none"
                  placeholder="Digite aqui anotações internas sobre este contato..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button 
                  size="sm" 
                  className="w-full h-8 text-xs" 
                  onClick={handleSaveNote} 
                  disabled={isSavingNote || note === (contact.notes?.content || (contact as any).notes?.content || "")}
                >
                  {isSavingNote ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3 h-3 mr-2" />}
                  Salvar Anotação
                </Button>
              </div>
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </h3>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingTag(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              {addingTag && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Select 
                      onValueChange={(val) => {
                        const tag = availableTags.find(t => t.id === val);
                        if (tag) handleAddTag(tag.id, tag.name);
                      }}
                      disabled={loadingTags}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={loadingTags ? "Carregando..." : "Selecionar etiqueta..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags
                          .filter(t => !localTags.includes(t.name))
                          .map(tag => (
                            <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                          ))
                        }
                        {availableTags.length === 0 && !loadingTags && (
                          <div className="p-2 text-xs text-muted-foreground">Crie etiquetas no Perfil da Empresa</div>
                        )}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setAddingTag(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {localTags.length === 0 && !addingTag ? (
                  <p className="text-xs text-muted-foreground">Nenhuma tag</p>
                ) : (
                  localTags.map(tag => (
                    (() => {
                      const tagObj = availableTags.find(t => t.name === tag);
                      const colorHex = tagColors.find(c => c.id === tagObj?.color)?.hex || '#94a3b8';
                      return (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="text-xs gap-1 pr-1 text-white"
                          style={{ backgroundColor: colorHex }}
                        >
                          {tag}
                          <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-red-100">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })()
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Send Flow */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Enviar Fluxo
              </h3>
              <div className="flex flex-col gap-2">
                <div className="w-full">
                  <Select value={selectedFlow} onValueChange={setSelectedFlow} disabled={loadingFlows}>
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue placeholder={loadingFlows ? "Carregando..." : "Selecione um fluxo"} />
                    </SelectTrigger>
                    <SelectContent>
                      {flows.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                      {flows.length === 0 && !loadingFlows && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum fluxo ativo</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" disabled={!selectedFlow || sendingFlow} onClick={handleSendFlow} className="w-full">
                  <Send className="w-4 h-4 mr-1" />
                  Enviar
                </Button>
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ações Rápidas</h3>
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  variant="outline" 
                  className="justify-start gap-2"
                  onClick={() => { onOpenChange(false); navigate(`/mensagens?phone=${encodeURIComponent(contact.phone)}`); }}
                >
                  <MessageSquare className="w-4 h-4" />
                  Abrir Conversa
                </Button>
                 <Button 
                   variant="outline" 
                   className="justify-start gap-2"
                   onClick={() => { onOpenChange(false); navigate(`/enviar?phone=${encodeURIComponent(contact.phone)}`); }}
                 >
                   <Send className="w-4 h-4" />
                   Enviar Mensagem Manual
                 </Button>
                 <Button 
                   variant="outline" 
                   className="justify-start gap-2"
                   onClick={handleCheckIsWhatsApp}
                   disabled={zapiLoading}
                 >
                   <UserCheck className="w-4 h-4" />
                   Verificar WhatsApp
                 </Button>
                 <Button 
                   variant="outline" 
                   className="justify-start gap-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                   onClick={handleReport}
                   disabled={zapiLoading}
                 >
                   <ShieldAlert className="w-4 h-4" />
                   Denunciar Contato
                 </Button>
                 <Button 
                   variant="outline" 
                   className="justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                   onClick={handleBlock}
                   disabled={zapiLoading}
                 >
                   <Ban className="w-4 h-4" />
                   Bloquear Contato
                 </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default ContactProfileDialog;
