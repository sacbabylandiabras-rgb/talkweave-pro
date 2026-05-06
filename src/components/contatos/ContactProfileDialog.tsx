import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, MessageSquare, Tag, Plus, X, Bot, Calendar, 
   Hash, Clock, Pencil, Check, Send, ShieldAlert, Ban, UserCheck, Image
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Contact } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { useZapi } from "@/hooks/useZapi";

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

const WhatsAppDefaultAvatar = () => (
  <svg viewBox="0 0 212 212" className="w-full h-full text-white">
    <path fill="currentColor" d="M106.251 0.5C164.653 0.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 0.5 164.654 0.5 106.25S47.846 0.5 106.251 0.5Z" />
    <path fill="#ccc" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.623 0 52.661-11.058 70.945-28.985v-.398s-.26-.61-.818-1.678a47.572 47.572 0 0 0-1.07-1.926c-.031-.055-.071-.118-.104-.174a56.024 56.024 0 0 0-1.447-2.324Z" />
    <path fill="#ccc" d="M106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-1.215-5.494 36.68 36.68 0 0 0-3.648-8.298 35.923 35.923 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342Z" />
  </svg>
);

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
  const { blockContact, reportContact, checkIsWhatsApp, getContactProfilePicture, loading: zapiLoading } = useZapi();

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

  useEffect(() => {
    if (!open || !contact) return;
    setLocalTags([...contact.tags]);
    setNewName(contact.name || '');
    loadFlows();
  }, [open, contact?.phone]);

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

  const handleAddTag = () => {
    if (!newTag.trim() || localTags.includes(newTag.trim())) return;
    setLocalTags([...localTags, newTag.trim()]);
    setNewTag("");
    setAddingTag(false);
    toast({ title: "Tag adicionada", description: newTag.trim() });
  };

  const handleRemoveTag = (tag: string) => {
    setLocalTags(localTags.filter(t => t !== tag));
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

    // 1) Respect explicit preferred instance — already resolved from active instances list
    if (preferredInstanceId && preferredInstanceId !== 'all' && preferredInstanceId.length > 10) {
      console.log('🎯 Using preferredInstanceId for flow:', preferredInstanceId);
      return preferredInstanceId;
    }

    // Fetch the user's VALID active instances first to cross-check
    const { data: activeInstances } = await (supabase as any)
      .from('zapi_instances')
      .select('zapi_instance_id')
      .eq('is_active', true)
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

    // 3) Fallback: single active instance or error
    if (validInstanceIds.size > 1) {
      throw new Error('Selecione a instância correta no topo da tela antes de disparar o fluxo.');
    }

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
          <Avatar className="w-24 h-24 bg-[#DFE5E7] border-4 border-background shadow-lg">
            {contact.profilePictureUrl ? (
              <AvatarImage src={contact.profilePictureUrl} />
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
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nome da tag..."
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleAddTag}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => { setAddingTag(false); setNewTag(""); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {localTags.length === 0 && !addingTag ? (
                  <p className="text-xs text-muted-foreground">Nenhuma tag</p>
                ) : (
                  localTags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs gap-1 pr-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
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
