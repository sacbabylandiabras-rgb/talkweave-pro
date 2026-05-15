import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Send, Users, User, FileText, Image, Plus, Trash2, MessageSquare, List, MousePointer, Upload, Video, FileAudio, Paperclip, Clock, Eye, Sparkles, CalendarClock, Reply, Pencil, XCircle, LayoutTemplate } from "lucide-react";
 import { WhatsAppPreview } from "@/components/WhatsAppPreview";
import { useZapi, setZapiInstanceOverride, setZapiRotateMode } from "@/hooks/useZapi";
import { useToast } from "@/hooks/use-toast";
import InstanceSelector, { ROTATE_ALL } from "@/components/envio/InstanceSelector";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useCampaigns } from "@/hooks/useCampaigns";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import MediaModelSection from "@/components/envio/MediaModelSection";
import WhatsAppCarouselPreview from "@/components/envio/WhatsAppCarouselPreview";
import EventosSection from "@/components/envio/EventosSection";

const SPECIAL_TEMPLATE_PREFIX = "__SPECIAL_TEMPLATE__:";
const parseSpecialTemplate = (content?: string | null) => {
  if (!content || !content.startsWith(SPECIAL_TEMPLATE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SPECIAL_TEMPLATE_PREFIX.length));
  } catch {
    return null;
  }
};

const isStatusOnlySpecialTemplate = (_type?: string | null) => false;
const getStatusOnlyTemplateError = () =>
  'O tipo Status publica nos Stories da instância selecionada (broadcast) e não envia mensagem para um número específico.';

const phoneSchema = z.string()
  .min(10, "Número deve ter pelo menos 10 dígitos")
  .refine((val) => {
    const normalPhone = /^\d{10,15}$/.test(val);
    const lidPhone = /^\d+@lid$/.test(val);
    return normalPhone || lidPhone;
  }, "Número inválido. Use 10-15 dígitos ou formato 123456789@lid");

const normalizePhoneInput = (value: string) => {
  const trimmed = value.trim();
  if (/^\d+@lid$/i.test(trimmed)) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, '');
};

const messageSchema = z.object({
  phone: phoneSchema,
  message: z.string()
    .min(1, "Mensagem não pode estar vazia")
    .max(4096, "Mensagem deve ter no máximo 4096 caracteres")
});

const buttonMessageSchema = z.object({
  phone: phoneSchema,
  message: z.string().max(4096, "Mensagem deve ter no máximo 4096 caracteres")
});

const EnviarMensagem = () => {
  const [mensagem, setMensagem] = useState("");
  const [contatos, setContatos] = useState("");
  const [numero, setNumero] = useState("");
  const [titulo, setTitulo] = useState("");
  const [rodape, setRodape] = useState("");
  const [errors, setErrors] = useState<{phone?: string, message?: string}>({});
  
  // Estados para botões de ação 
  const [botoesAcao, setBotoesAcao] = useState([{id: "1", type: "REPLY" as "CALL" | "URL" | "REPLY" | "OPTION" | "COPY", label: "", phone: "", url: "", copyText: ""}]);
  
  // Estados para lista de opções
  const [tituloLista, setTituloLista] = useState("");
  const [labelBotaoLista, setLabelBotaoLista] = useState("Ver opções");
  const [opcoes, setOpcoes] = useState([{id: "1", title: "", description: ""}]);
  
  // Estados para mídia e modelos
  const [arquivoMidia, setArquivoMidia] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [modeloSelecionado, setModeloSelecionado] = useState("");
  const [delay, setDelay] = useState(2);
  const [viewOnce, setViewOnce] = useState(false);
  const [isPtv, setIsPtv] = useState(false);
  const [enviandoEmMassa, setEnviandoEmMassa] = useState(false);
  const cancelarEnvioRef = useRef(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [instanceSelectionMode, setInstanceSelectionMode] = useState<'default' | 'single' | 'rotate'>('default');
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);

   const { sendMessage, sendButtonActions, sendOptionList, sendImage, sendVideo, sendAudio, sendDocument, sendSpecialTemplate, sendCarousel, sendMessageCatalog, sendMessageContact, sendEvent, sendEditEvent, sendEventResponse, loading, setOverride } = useZapi();
  const { toast } = useToast();
   const { instances: allInstances, activeInstance } = useZapiInstances({ includeMeta: true });
   const instances = useMemo(() => {
     return allInstances.filter(i => {
       const provider = (i.api_provider || 'zapi').toLowerCase();
       // Allow uazapi and meta instances to be selected
       return true;
     });
   }, [allInstances]);
  const { templates: modelosDisponiveis, loading: loadingTemplates } = useMessageTemplates();

  // Subset de instâncias efetivamente escolhidas pelo usuário no seletor (modo revezamento)
  const rotateInstances = useMemo(() => {
    if (!selectedInstanceIds.length) return instances;
    const ids = new Set(selectedInstanceIds);
    const filtered = instances.filter(i => ids.has(i.id));
    return filtered.length > 0 ? filtered : instances;
  }, [instances, selectedInstanceIds]);

  // Definir instância padrão apenas enquanto o usuário não escolheu manualmente outra opção
  // Set default instance only when no manual selection
  useEffect(() => {
    if (instanceSelectionMode === 'default' && activeInstance) {
      setZapiInstanceOverride(activeInstance);
    }
  }, [activeInstance, instanceSelectionMode]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => setZapiInstanceOverride(null);
  }, []);
  const { createCampaign } = useCampaigns();

  // Helper para registrar envios individuais no campaign_sends para aparecer no painel
  const trackIndividualSend = async (phone: string, messageContent: string, status: 'sent' | 'failed', errorMsg?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      // Criar uma campanha de envio individual
      const campanha = await createCampaign({
        name: `Envio Individual - ${new Date().toLocaleString('pt-BR')}`,
        description: `Envio individual para ${phone}`,
        schedule_type: 'immediate',
      });

      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campanha.id);

      const isMassaTemplate = modeloSelecionado && modelosDisponiveis.find(m => m.id === modeloSelecionado)?.type === 'multiplos_contatos';
      
      await supabase.from('campaign_sends').insert({
        campaign_id: campanha.id,
        phone,
        message_content: messageContent,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        error_message: errorMsg || null,
        user_id: session.user.id,
      });
    } catch (err) {
      console.error('Erro ao registrar envio individual:', err);
    }
  };

  const sendResolvedContent = async (phone: string, nome?: string) => {
    const modeloData = modeloSelecionado
      ? modelosDisponiveis.find(m => m.id === modeloSelecionado)
      : null;

    const mensagemPersonalizada = (modeloData?.content || mensagem)
      .replace(/\{nome\}/g, nome || "")
      .replace(/\{numero\}/g, phone);

    const specialTpl = parseSpecialTemplate(modeloData?.content);
    const templateType = String(modeloData?.type || '').toLowerCase();
    const isAudioTemplate = templateType === 'audio' || templateType === 'áudio';
    const isVideoTemplate = templateType === 'video' || templateType === 'video_botoes';
    const isImageTemplate = templateType === 'imagem' || templateType === 'image' || templateType === 'imagem_botoes';
    const isListTemplate = templateType === 'lista_opcao' || templateType === 'lista' || templateType === 'lista de opção';
    const isCopyPasteTemplate = templateType === 'copia_cola' || templateType === 'copia e cola' || templateType === 'copy_paste';
    const isDocumentTemplate = templateType === 'arquivo' || templateType === 'documento';
    const isContactTemplate = templateType === 'contato' || templateType === 'contact' || templateType === 'contato (vcard)' || templateType === 'multiplos_contatos';
    const temListaOpcoes = isListTemplate && Array.isArray(modeloData?.listItems) && modeloData!.listItems!.length > 0;
     const isProductTemplate = templateType === 'produto' || templateType === 'product';
     const temCarrossel = !specialTpl && !isProductTemplate && Array.isArray(modeloData?.carouselCards) && modeloData.carouselCards.length > 0;
    const audioComBotoes = isAudioTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
    const videoComBotoes = isVideoTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
    const imagemComBotoes = isImageTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
    const documentoComBotoes = isDocumentTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
    const temBotoes = !specialTpl && !temCarrossel && !isAudioTemplate && !videoComBotoes && !imagemComBotoes && !documentoComBotoes && !isListTemplate && !isCopyPasteTemplate && !!modeloData?.buttons?.length;
    const temMidiaModelo = !specialTpl && !temCarrossel && !audioComBotoes && !videoComBotoes && !imagemComBotoes && !documentoComBotoes && !isListTemplate && !isCopyPasteTemplate && (!!modeloData?.mediaUrl || isAudioTemplate);
    const temMidiaAvulsa = !modeloData && !!arquivoMidia;

    if (specialTpl && specialTpl.type !== 'copia_cola') {
      if (isStatusOnlySpecialTemplate(specialTpl.type)) {
        throw new Error(getStatusOnlyTemplateError());
      }

      const specialAllowsExtraButtons = !['uaz_status', 'uaz_location_button', 'uaz_request_payment'].includes(specialTpl.type);
      await sendSpecialTemplate(phone, specialTpl.type, {
        ...specialTpl,
        description: mensagemPersonalizada || specialTpl.description,
      });

      // Enviar botões do modelo (ex: PIX cobrança com botão Copiar)
      if (specialAllowsExtraButtons && modeloData?.buttons?.length) {
        await sendButtonActions(
          phone,
          mensagemPersonalizada || specialTpl.description || modeloData?.name || 'Pagamento',
          modeloData.buttons.map((btn: any) => {
            const buttonType = (btn.type || 'REPLY').toUpperCase();
            const buttonData: any = {
              id: btn.id || btn.text || Math.random().toString(),
              type: buttonType,
              label: btn.text || btn.label || 'Botão',
            };
            if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
            else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
            else if (buttonType === 'COPY' && (btn.copyText || btn.value || specialTpl.pixKey)) {
              buttonData.copyText = btn.copyText || btn.value || specialTpl.pixKey;
            }
            return buttonData;
          }),
          modeloData?.header || undefined,
          modeloData?.footer || undefined,
        );
      }

      return mensagemPersonalizada || `${modeloData?.name || 'Modelo especial'} enviado`;
    }

    if (isContactTemplate) {
      const special = parseSpecialTemplate(modeloData?.content);
      
      if (templateType === 'multiplos_contatos' || (special?.type === 'multiplos_contatos')) {
        const phonesArray = special?.phones || [];
        if (!Array.isArray(phonesArray) || phonesArray.length === 0) {
          throw new Error('Nenhum número de telefone encontrado no modelo de múltiplos contatos');
        }
        
        // Envia cada contato separadamente para o destinatário
        for (const targetPhone of phonesArray) {
          const cleanPhone = String(targetPhone).replace(/\D/g, '');
          if (cleanPhone) {
            await sendMessageContact(phone, `Contato ${cleanPhone}`, cleanPhone, '');
          }
        }
        return `[múltiplos contatos] ${modeloData?.name || 'Contatos enviados'}`;
      } else {
        const contactName = special?.contactName || (modeloData as any)?.contactName || '';
        const contactPhone = special?.contactPhone || (modeloData as any)?.contactPhone || '';
        const contactDesc = special?.description || special?.contactBusinessDescription || '';

        if (!contactName || !contactPhone) throw new Error('Nome e telefone do contato são obrigatórios no modelo');

        await sendMessageContact(phone, contactName, contactPhone, contactDesc);
        return `[contato:${contactName}] ${modeloData?.name || mensagemPersonalizada || 'Contato enviado'}`;
      }
    }

    if (isProductTemplate) {
      const special = parseSpecialTemplate(modeloData?.content);
      const prodId = special?.productId || (modeloData as any)?.productId || '';
      const catId = special?.catalogId || (modeloData as any)?.catalogId || '';
      if (!prodId) throw new Error('ID do produto não encontrado no modelo');

      await sendMessageCatalog(
        phone,
        catId,
        prodId,
        mensagemPersonalizada || modeloData?.name || '',
        modeloData?.footer || ''
      );
      return `[produto:${prodId}] ${modeloData?.name || mensagemPersonalizada || 'Produto enviado'}`;
    }
 
     if (temCarrossel) {
      await sendCarousel(phone, modeloData!.carouselCards as any, mensagemPersonalizada);
      return `[carrossel] ${modeloData?.name || mensagemPersonalizada || 'Modelo enviado'}`;
    }

    if (audioComBotoes) {
      // 1) Envia o áudio puro
      await sendAudio(phone, modeloData!.mediaUrl!, '');
      // 2) Em seguida, envia o texto + botões
      await sendButtonActions(
        phone,
        mensagemPersonalizada || modeloData?.content || '',
        modeloData!.buttons!.map((btn: any) => {
          const buttonType = (btn.type || 'REPLY').toUpperCase();
          const buttonData: any = {
            id: btn.id || btn.text || Math.random().toString(),
            type: buttonType,
            label: btn.text || btn.label || 'Botão',
          };
          if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
          else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
          else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
          return buttonData;
        }),
        modeloData?.header || undefined,
        modeloData?.footer || undefined,
      );
      return mensagemPersonalizada || modeloData?.name || 'Áudio + texto com botões enviado';
    }

    if (videoComBotoes) {
      // 1) Envia o vídeo puro
      await sendVideo(phone, modeloData!.mediaUrl!, '', viewOnce, isPtv);
      // 2) Em seguida, envia o texto + botões
      await sendButtonActions(
        phone,
        mensagemPersonalizada || modeloData?.content || '',
        modeloData!.buttons!.map((btn: any) => {
          const buttonType = (btn.type || 'REPLY').toUpperCase();
          const buttonData: any = {
            id: btn.id || btn.text || Math.random().toString(),
            type: buttonType,
            label: btn.text || btn.label || 'Botão',
          };
          if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
          else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
          else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
          return buttonData;
        }),
        modeloData?.header || undefined,
        modeloData?.footer || undefined,
      );
      return mensagemPersonalizada || modeloData?.name || 'Vídeo + texto com botões enviado';
    }

    if (imagemComBotoes) {
      // Imagem + botões em uma única chamada (mesma instância)
      await sendButtonActions(
        phone,
        mensagemPersonalizada || modeloData?.content || '',
        modeloData!.buttons!.map((btn: any) => {
          const buttonType = (btn.type || 'REPLY').toUpperCase();
          const buttonData: any = {
            id: btn.id || btn.text || Math.random().toString(),
            type: buttonType,
            label: btn.text || btn.label || 'Botão',
          };
          if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
          else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
          else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
          return buttonData;
        }),
        modeloData?.header || undefined,
        modeloData?.footer || undefined,
        modeloData!.mediaUrl!,
        'image',
      );
      return mensagemPersonalizada || modeloData?.name || 'Imagem + texto com botões enviado';
    }

    if (documentoComBotoes) {
      // 1) Envia o documento puro
      await sendDocument(
        phone,
        modeloData!.mediaUrl!,
        modeloData?.fileName || 'arquivo',
        modeloData?.fileType?.split('/').pop() || 'pdf',
        '',
      );
      // 2) Em seguida, envia o texto + botões
      await sendButtonActions(
        phone,
        mensagemPersonalizada || modeloData?.content || '',
        modeloData!.buttons!.map((btn: any) => {
          const buttonType = (btn.type || 'REPLY').toUpperCase();
          const buttonData: any = {
            id: btn.id || btn.text || Math.random().toString(),
            type: buttonType,
            label: btn.text || btn.label || 'Botão',
          };
          if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
          else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
          else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
          return buttonData;
        }),
        modeloData?.header || undefined,
        modeloData?.footer || undefined,
      );
      return mensagemPersonalizada || modeloData?.name || 'Documento + texto com botões enviado';
    }

    if (isListTemplate && !temListaOpcoes) {
      throw new Error('Este modelo de lista não possui opções válidas. Edite o modelo e salve pelo menos um item na lista.');
    }

    if (temListaOpcoes) {
      const validOptions = modeloData!.listItems!
        .filter((it: any) => it && String(it.title || '').trim().length > 0)
        .map((it: any, idx: number) => ({ id: String(it.id ?? idx + 1), title: String(it.title), description: it.description ? String(it.description) : '' }));

      if (validOptions.length === 0) {
        throw new Error('A lista de opções precisa de pelo menos um item com título');
      }

      await sendOptionList(phone, mensagemPersonalizada || modeloData?.content || '', {
        title: modeloData?.header || modeloData?.name || 'Opções',
        buttonLabel: 'Ver opções',
        options: validOptions,
      });

      return mensagemPersonalizada || modeloData?.name || 'Lista de opções enviada';
    }

    if (isCopyPasteTemplate) {
      const varsCopy = (modeloData?.variables && typeof modeloData.variables === 'object' && !Array.isArray(modeloData.variables))
        ? (modeloData.variables as Record<string, any>).copyText
        : undefined;
      const specialCopy = specialTpl && typeof specialTpl.copyText === 'string' ? specialTpl.copyText : '';
      const copyContent = (specialCopy && specialCopy.trim())
        || (typeof varsCopy === 'string' && varsCopy.trim() ? varsCopy : '')
        || (modeloData?.header && modeloData.header.trim() ? modeloData.header : '')
        || (specialTpl ? '' : (modeloData?.content || ''))
        || mensagemPersonalizada
        || '';
      const bodyMessage = (mensagem && mensagem.trim() ? mensagemPersonalizada : '')
        || specialTpl?.description
        || modeloData?.name
        || 'Toque em copiar';
      await sendButtonActions(
        phone,
        bodyMessage,
        [
          {
            id: 'copy_btn',
            type: 'COPY',
            label: 'Copiar',
            copyText: copyContent,
          } as any,
        ],
        undefined,
        undefined,
      );
      return mensagemPersonalizada || modeloData?.name || 'Mensagem copia e cola enviada';
    }

    if (temBotoes) {
      await sendButtonActions(
        phone,
        mensagemPersonalizada,
        modeloData!.buttons!.map((btn: any) => {
          const buttonType = (btn.type || 'REPLY').toUpperCase();
          const buttonData: any = {
            id: btn.id || btn.text || Math.random().toString(),
            type: buttonType,
            label: btn.text || btn.label || 'Botão'
          };

          if (buttonType === "CALL" && (btn.phone || btn.value)) {
            buttonData.phone = btn.phone || btn.value;
          } else if (buttonType === "URL" && (btn.url || btn.value)) {
            buttonData.url = btn.url || btn.value;
          } else if (buttonType === "COPY" && (btn.copyText || btn.value)) {
            buttonData.copyText = btn.copyText || btn.value;
          }

          return buttonData;
        }),
        modeloData?.header || undefined,
        modeloData?.footer || undefined
      );

      return mensagemPersonalizada || modeloData?.name || 'Modelo com botões enviado';
    }

    if (temMidiaModelo) {
      const mediaCaption = legenda || mensagemPersonalizada;

      if (templateType === 'audio' || templateType === 'áudio') {
        await sendAudio(phone, modeloData!.mediaUrl!, mediaCaption);
      } else if (templateType === 'video' || templateType === 'video_botoes') {
        await sendVideo(phone, modeloData!.mediaUrl!, mediaCaption, viewOnce, isPtv);
      } else if (templateType === 'arquivo' || templateType === 'documento') {
        await sendDocument(
          phone,
          modeloData!.mediaUrl!,
          modeloData?.fileName || 'arquivo',
          modeloData?.fileType?.split('/').pop() || 'txt',
          mediaCaption,
        );
      } else {
        await sendImage(phone, modeloData!.mediaUrl!, mediaCaption);
      }

      return mediaCaption || modeloData?.name || 'Modelo com mídia enviado';
    }

    if (temMidiaAvulsa) {
      const base64File = await convertToBase64(arquivoMidia);
      const fileExtension = arquivoMidia.name.split('.').pop()?.toLowerCase();

      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', '3gp', 'mkv', 'webm'];
      const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'flac'];

      const isImage = imageExtensions.includes(fileExtension || '');
      const isVideo = videoExtensions.includes(fileExtension || '');
      const isAudio = audioExtensions.includes(fileExtension || '');

      if (isImage) {
        await sendImage(phone, base64File, legenda || mensagem);
      } else if (isVideo) {
        await sendVideo(phone, base64File, legenda || mensagem, viewOnce, isPtv);
      } else if (isAudio) {
        await sendAudio(phone, base64File, legenda || mensagem);
      } else {
        await sendDocument(
          phone,
          base64File,
          arquivoMidia.name,
          fileExtension || 'txt',
          legenda || mensagem,
        );
      }

      return legenda || mensagem;
    }

    await sendMessage(phone, mensagemPersonalizada);
    return mensagemPersonalizada;
  };

  const handleSendIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const modeloData = modeloSelecionado
        ? modelosDisponiveis.find(m => m.id === modeloSelecionado)
        : null;
      // Quando há modelo selecionado, o campo "mensagem" é opcional —
      // o conteúdo virá do próprio modelo (texto, mídia, PIX, etc.)
      const effectiveMessage = mensagem || modeloData?.content || modeloData?.name || 'modelo';
      const validatedData = messageSchema.parse({ phone: numero, message: effectiveMessage });
      setErrors({});
      
      let sendStatus: 'sent' | 'failed' = 'sent';
      let errorMsg: string | undefined;
      let trackedContent = validatedData.message;
      
      try {
        trackedContent = await sendResolvedContent(validatedData.phone);
      } catch (sendError) {
        sendStatus = 'failed';
        errorMsg = sendError instanceof Error ? sendError.message : 'Erro desconhecido';
        throw sendError;
      } finally {
        await trackIndividualSend(validatedData.phone, trackedContent, sendStatus, errorMsg);
      }
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleSendButtonActions = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = buttonMessageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});
      
      const validButtons = botoesAcao.filter(btn => {
        if (btn.label.trim() === "") return false;
        if (btn.type === "CALL" && btn.phone.trim() === "") return false;
        if (btn.type === "URL" && btn.url.trim() === "") return false;
        if (btn.type === "COPY" && btn.copyText.trim() === "") return false;
        return true;
      });
      
      if (validButtons.length === 0) {
        throw new Error("Adicione pelo menos um botão válido");
      }

      let sendStatus: 'sent' | 'failed' = 'sent';
      let errorMsg: string | undefined;

      try {
        // Verificar se há mídia anexada
        const temMidia = !!arquivoMidia;
        
        if (temMidia) {
          const base64File = await convertToBase64(arquivoMidia);
          const fileExtension = arquivoMidia.name.split('.').pop()?.toLowerCase();
          
          const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
          const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', '3gp', 'mkv', 'webm'];
          const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'flac'];
          
          const isImage = imageExtensions.includes(fileExtension || '');
          const isVideo = videoExtensions.includes(fileExtension || '');
          const isAudio = audioExtensions.includes(fileExtension || '');

          if (isImage) {
            await sendImage(validatedData.phone, base64File, legenda || '');
          } else if (isVideo) {
            await sendVideo(validatedData.phone, base64File, legenda || '', viewOnce, isPtv);
          } else if (isAudio) {
            await sendAudio(validatedData.phone, base64File, legenda || '');
          } else {
            await sendDocument(
              validatedData.phone,
              base64File,
              arquivoMidia.name,
              fileExtension || 'txt',
              legenda || ''
            );
          }
        }
        
        await sendButtonActions(
          validatedData.phone, 
          validatedData.message, 
          validButtons.map(btn => ({
            id: btn.id,
            type: btn.type,
            label: btn.label,
            ...(btn.type === "CALL" && { phone: btn.phone }),
            ...(btn.type === "URL" && { url: btn.url }),
            ...(btn.type === "COPY" && { copyText: btn.copyText })
          })),
          titulo || undefined,
          rodape || undefined
        );
      } catch (sendError) {
        sendStatus = 'failed';
        errorMsg = sendError instanceof Error ? sendError.message : 'Erro desconhecido';
        throw sendError;
      } finally {
        await trackIndividualSend(validatedData.phone, validatedData.message, sendStatus, errorMsg);
      }
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
      setTitulo("");
      setRodape("");
      setBotoesAcao([{id: "1", type: "REPLY", label: "", phone: "", url: "", copyText: ""}]);
      setArquivoMidia(null);
      setLegenda("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleSendOptionList = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});
      
      const validOptions = opcoes.filter(opt => opt.title.trim() !== "" && opt.description.trim() !== "");
      if (validOptions.length === 0) {
        throw new Error("Adicione pelo menos uma opção válida");
      }
      
      if (!tituloLista.trim()) {
        throw new Error("Título da lista é obrigatório");
      }

      let sendStatus: 'sent' | 'failed' = 'sent';
      let errorMsg: string | undefined;

      try {
        // Verificar se há mídia anexada
        const temMidia = !!arquivoMidia;
        
        if (temMidia) {
          const base64File = await convertToBase64(arquivoMidia);
          const fileExtension = arquivoMidia.name.split('.').pop()?.toLowerCase();
          
          const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
          const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', '3gp', 'mkv', 'webm'];
          const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'flac'];
          
          const isImage = imageExtensions.includes(fileExtension || '');
          const isVideo = videoExtensions.includes(fileExtension || '');
          const isAudio = audioExtensions.includes(fileExtension || '');

          if (isImage) {
            await sendImage(validatedData.phone, base64File, legenda || '');
          } else if (isVideo) {
            await sendVideo(validatedData.phone, base64File, legenda || '', viewOnce, isPtv);
          } else if (isAudio) {
            await sendAudio(validatedData.phone, base64File, legenda || '');
          } else {
            await sendDocument(
              validatedData.phone,
              base64File,
              arquivoMidia.name,
              fileExtension || 'txt',
              legenda || ''
            );
          }
        }
        
        await sendOptionList(validatedData.phone, validatedData.message, {
          title: tituloLista,
          buttonLabel: labelBotaoLista,
          options: validOptions
        });
      } catch (sendError) {
        sendStatus = 'failed';
        errorMsg = sendError instanceof Error ? sendError.message : 'Erro desconhecido';
        throw sendError;
      } finally {
        await trackIndividualSend(validatedData.phone, validatedData.message, sendStatus, errorMsg);
      }
      
      // Limpar formulário após envio bem-sucedido
      setNumero("");
      setMensagem("");
      setTituloLista("");
      setLabelBotaoLista("Ver opções");
      setOpcoes([{id: "1", title: "", description: ""}]);
      setArquivoMidia(null);
      setLegenda("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  // Função para envio em massa com delay
  const handleSendMassa = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contatos.trim()) {
      toast({
        title: "Lista vazia",
        description: "Adicione pelo menos um contato para enviar",
        variant: "destructive"
      });
      return;
    }

    cancelarEnvioRef.current = false;
    setEnviandoEmMassa(true);

    const modeloDataValidation = modeloSelecionado
      ? modelosDisponiveis.find(m => m.id === modeloSelecionado)
      : null;

    // Permite envio sem texto manual quando há modelo selecionado (ex: PIX/cobrança, mídia, botões)
    if (!mensagem.trim() && !modeloDataValidation) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem ou selecione um modelo para enviar",
        variant: "destructive"
      });
      setEnviandoEmMassa(false);
      return;
    }

    try {
      // Processar lista de contatos
      const linhas = contatos.split('\n').filter(linha => linha.trim());
      const contatosProcessados = [];
      
      for (const linha of linhas) {
        const parts = linha.split(/[,;\t]/).map(p => p.trim());
        let nome = '';
        let telefone = '';
        
        // Detectar automaticamente qual parte é o telefone (com ou sem @lid)
        for (const part of parts) {
          // Verificar se tem @lid (canal WhatsApp Business)
          if (part.includes('@lid')) {
            telefone = part;
            nome = parts.find(p => p !== part)?.trim() || `Contato ${contatosProcessados.length + 1}`;
            break;
          }
          
          // Número normal sem @lid
          const numeroLimpo = part.replace(/\D/g, '');
          if (numeroLimpo.length >= 10 && numeroLimpo.length <= 15) {
            telefone = numeroLimpo;
            nome = parts.find(p => p !== part)?.trim() || `Contato ${contatosProcessados.length + 1}`;
            break;
          }
        }
        
        if (telefone) {
          contatosProcessados.push({ nome, telefone });
        }
      }

      if (contatosProcessados.length === 0) {
        toast({
          title: "Nenhum contato válido",
          description: "Verifique se os números têm entre 10 e 15 dígitos",
          variant: "destructive"
        });
        return;
      }

      // Criar campanha automaticamente
      const dataAtual = new Date().toLocaleString('pt-BR');
      const nomeCampanha = `Envio em Massa - ${dataAtual}`;
      
      const campanha = await createCampaign({
        name: nomeCampanha,
        description: `Envio em massa para ${contatosProcessados.length} contatos`,
        template_id: modeloSelecionado || undefined,
        target_audience: { 
          contacts: contatosProcessados.map(c => ({ phone: c.telefone, name: c.nome }))
        },
        schedule_type: 'immediate',
        delay_seconds: delay,
      });

      // Atualizar status da campanha para 'active' imediatamente
      await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', campanha.id);

      // PRÉ-PERSISTIR todos os contatos como 'pending' em campaign_sends
      // Isso garante que o histórico nunca se perca, mesmo se o dispositivo desconectar
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      if (currentUserId) {
        const baseMessage = mensagem || modeloDataValidation?.content || modeloDataValidation?.name || 'Modelo';
        const pendingRecords = contatosProcessados.map((c) => ({
          campaign_id: campanha.id,
          phone: c.telefone,
          contact_name: c.nome,
          message_content: baseMessage.replace(/\{nome\}/g, c.nome).replace(/\{numero\}/g, c.telefone),
          status: 'pending',
          user_id: currentUserId,
        }));

        // Inserir em lotes de 200 para evitar payload grande
        for (let batch = 0; batch < pendingRecords.length; batch += 200) {
          const chunk = pendingRecords.slice(batch, batch + 200);
          const { error: insertErr } = await supabase.from('campaign_sends').insert(chunk);
          if (insertErr) {
            console.error('Erro ao pré-persistir pendentes:', insertErr);
          }
        }
        console.log(`📋 ${pendingRecords.length} contatos pré-persistidos como pending`);
      }

      toast({
        title: "Campanha criada!",
        description: `Iniciando envio para ${contatosProcessados.length} contatos com delay de ${delay}s`,
      });

      let processados = 0;
      let erros = 0;
      let interrompidoExternamente = false;
      let ultimoErro: string | null = null;
      const errosDetalhados: string[] = [];

       for (let i = 0; i < contatosProcessados.length; i++) {
         // Verificar se o envio foi cancelado localmente (via ref, não state)
        if (cancelarEnvioRef.current) {
          await supabase
            .from('campaigns')
            .update({ status: 'paused' })
            .eq('id', campanha.id);
          
          toast({
            title: "Envio pausado",
            description: `Pausado pelo usuário. ${processados} solicitações processadas. Retome pela página de Campanhas.`,
          });
          break;
        }

        // Verificar status no banco ANTES de cada contato (captura pausa externa via dialog/campanhas)
        {
          const { data: campaignCheck } = await supabase
            .from('campaigns')
            .select('status')
            .eq('id', campanha.id)
            .single();

          if (campaignCheck?.status === 'paused' || campaignCheck?.status === 'cancelled') {
            interrompidoExternamente = true;
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              if (token) {
                await supabase.functions.invoke('clear-zapi-queue', {
                  headers: { Authorization: `Bearer ${token}` },
                  body: instanceSelectionMode === 'rotate'
                    ? { clearAllActive: true }
                    : selectedInstanceId
                      ? { instanceId: selectedInstanceId }
                      : { clearAllActive: true },
                });
              }
            } catch (queueErr) {
              console.error('Erro ao limpar fila ao interromper envio:', queueErr);
            }

            toast({
              title: "Envio pausado",
              description: `Campanha ${campaignCheck.status === 'cancelled' ? 'cancelada' : 'pausada'}. ${processados} solicitações processadas.`,
            });
            break;
          }
        }

        // Pré-check de conexão removido: get-device-status estava retornando falsos negativos
        // e pausando campanhas válidas. O provedor já gerencia a fila e reportará erros reais
        // por envio, que são tratados no catch de cada iteração abaixo.
        
        const contato = contatosProcessados[i];
        let sendStatus = 'failed';
        let errorMessage = null;
        
        try {
          const modeloData = modeloSelecionado 
            ? modelosDisponiveis.find(m => m.id === modeloSelecionado)
            : null;

          const specialTpl = parseSpecialTemplate(modeloData?.content);
          let mensagemPersonalizada = mensagem
            .replace(/\{nome\}/g, contato.nome)
            .replace(/\{numero\}/g, contato.telefone);

          const temMidia = !!arquivoMidia;
          const templateType = String(modeloData?.type || '').toLowerCase();
          const isAudioTemplate = templateType === 'audio' || templateType === 'áudio';
          const isVideoTemplate = templateType === 'video' || templateType === 'video_botoes';
          const isImageTemplate = templateType === 'imagem' || templateType === 'image' || templateType === 'imagem_botoes';
          const isListTemplate = templateType === 'lista_opcao' || templateType === 'lista' || templateType === 'lista de opção';
          const isCopyPasteTemplate = templateType === 'copia_cola' || templateType === 'copia e cola' || templateType === 'copy_paste';
          const isDocumentTemplate = templateType === 'arquivo' || templateType === 'documento';
          const temListaOpcoes = isListTemplate && Array.isArray(modeloData?.listItems) && modeloData!.listItems!.length > 0;
          const temCarrossel = !specialTpl && Array.isArray(modeloData?.carouselCards) && modeloData.carouselCards.length > 0;
          const audioComBotoes = isAudioTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
          const videoComBotoes = isVideoTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
          const imagemComBotoes = isImageTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
          const documentoComBotoes = isDocumentTemplate && !!modeloData?.mediaUrl && !!modeloData?.buttons?.length;
          const temBotoes = !specialTpl && !temCarrossel && !isAudioTemplate && !videoComBotoes && !imagemComBotoes && !documentoComBotoes && !isListTemplate && !isCopyPasteTemplate && !!modeloData?.buttons?.length;
          const temMidiaModelo = !specialTpl && !temCarrossel && !audioComBotoes && !videoComBotoes && !imagemComBotoes && !documentoComBotoes && !isListTemplate && !isCopyPasteTemplate && (!!modeloData?.mediaUrl || isAudioTemplate);
          const currentInstance = instanceSelectionMode === 'rotate'
            ? rotateInstances[i % rotateInstances.length]
            : selectedInstanceId
              ? instances.find(inst => inst.id === selectedInstanceId) || null
              : activeInstance || null;

          // Set the specific instance for this contact directly
          if (currentInstance) {
            setZapiInstanceOverride(currentInstance);
          }

          if (specialTpl && specialTpl.type !== 'copia_cola') {
            if (isStatusOnlySpecialTemplate(specialTpl.type)) {
              throw new Error(getStatusOnlyTemplateError());
            }

            const specialAllowsExtraButtons = !['uaz_status', 'uaz_location_button', 'uaz_request_payment'].includes(specialTpl.type);
            await sendSpecialTemplate(contato.telefone, specialTpl.type, {
              ...specialTpl,
              description: mensagemPersonalizada || specialTpl.description,
            });
            if (specialAllowsExtraButtons && modeloData?.buttons?.length) {
              await sendButtonActions(
                contato.telefone,
                mensagemPersonalizada || specialTpl.description || modeloData?.name || 'Pagamento',
                modeloData.buttons.map((btn: any) => {
                  const buttonType = (btn.type || 'REPLY').toUpperCase();
                  const buttonData: any = {
                    id: btn.id || btn.text || Math.random().toString(),
                    type: buttonType,
                    label: btn.text || btn.label || 'Botão',
                  };
                  if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
                  else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
                  else if (buttonType === 'COPY' && (btn.copyText || btn.value || specialTpl.pixKey)) {
                    buttonData.copyText = btn.copyText || btn.value || specialTpl.pixKey;
                  }
                  return buttonData;
                }),
                modeloData?.header || undefined,
                modeloData?.footer || undefined,
              );
            }
          } else if (temCarrossel) {
            await sendCarousel(contato.telefone, modeloData!.carouselCards as any, mensagemPersonalizada);
          } else if (audioComBotoes) {
            // 1) áudio gravado, depois 2) texto com botões
            await sendAudio(contato.telefone, modeloData!.mediaUrl!, '');
            await sendButtonActions(
              contato.telefone,
              mensagemPersonalizada || modeloData?.content || '',
              modeloData!.buttons!.map((btn: any) => {
                const buttonType = (btn.type || 'REPLY').toUpperCase();
                const buttonData: any = {
                  id: btn.id || btn.text || Math.random().toString(),
                  type: buttonType,
                  label: btn.text || btn.label || 'Botão',
                };
                if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
                else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
                else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
                return buttonData;
              }),
              modeloData?.header || undefined,
              modeloData?.footer || undefined,
            );
          } else if (videoComBotoes) {
            // 1) vídeo, depois 2) texto com botões
            await sendVideo(contato.telefone, modeloData!.mediaUrl!, '', viewOnce, isPtv);
            await sendButtonActions(
              contato.telefone,
              mensagemPersonalizada || modeloData?.content || '',
              modeloData!.buttons!.map((btn: any) => {
                const buttonType = (btn.type || 'REPLY').toUpperCase();
                const buttonData: any = {
                  id: btn.id || btn.text || Math.random().toString(),
                  type: buttonType,
                  label: btn.text || btn.label || 'Botão',
                };
                if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
                else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
                else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
                return buttonData;
              }),
              modeloData?.header || undefined,
              modeloData?.footer || undefined,
            );
          } else if (imagemComBotoes) {
            // Imagem + botões em uma única chamada (mesma instância garantida)
            await sendButtonActions(
              contato.telefone,
              mensagemPersonalizada || modeloData?.content || '',
              modeloData!.buttons!.map((btn: any) => {
                const buttonType = (btn.type || 'REPLY').toUpperCase();
                const buttonData: any = {
                  id: btn.id || btn.text || Math.random().toString(),
                  type: buttonType,
                  label: btn.text || btn.label || 'Botão',
                };
                if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
                else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
                else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
                return buttonData;
              }),
              modeloData?.header || undefined,
              modeloData?.footer || undefined,
              modeloData!.mediaUrl!,
              'image',
            );
          } else if (documentoComBotoes) {
            // 1) documento, depois 2) texto com botões
            await sendDocument(
              contato.telefone,
              modeloData!.mediaUrl!,
              modeloData?.fileName || 'arquivo',
              modeloData?.fileType?.split('/').pop() || 'pdf',
              '',
            );
            await sendButtonActions(
              contato.telefone,
              mensagemPersonalizada || modeloData?.content || '',
              modeloData!.buttons!.map((btn: any) => {
                const buttonType = (btn.type || 'REPLY').toUpperCase();
                const buttonData: any = {
                  id: btn.id || btn.text || Math.random().toString(),
                  type: buttonType,
                  label: btn.text || btn.label || 'Botão',
                };
                if (buttonType === 'CALL' && (btn.phone || btn.value)) buttonData.phone = btn.phone || btn.value;
                else if (buttonType === 'URL' && (btn.url || btn.value)) buttonData.url = btn.url || btn.value;
                else if (buttonType === 'COPY' && (btn.copyText || btn.value)) buttonData.copyText = btn.copyText || btn.value;
                return buttonData;
              }),
              modeloData?.header || undefined,
              modeloData?.footer || undefined,
            );
          } else if (isListTemplate && !temListaOpcoes) {
            throw new Error('Este modelo de lista não possui opções válidas. Edite o modelo e salve pelo menos um item na lista.');
          } else if (temListaOpcoes) {
            const validOptions = modeloData!.listItems!
              .filter((it: any) => it && String(it.title || '').trim().length > 0)
              .map((it: any, idx: number) => ({
                id: String(it.id ?? idx + 1),
                title: String(it.title),
                description: it.description ? String(it.description) : '',
              }));

            if (validOptions.length === 0) {
              throw new Error('A lista de opções precisa de pelo menos um item com título');
            }

            await sendOptionList(contato.telefone, mensagemPersonalizada || modeloData?.content || '', {
              title: modeloData?.header || modeloData?.name || 'Opções',
              buttonLabel: 'Ver opções',
              options: validOptions,
            });
          } else if (isCopyPasteTemplate) {
            const varsCopy = (modeloData?.variables && typeof modeloData.variables === 'object' && !Array.isArray(modeloData.variables))
              ? (modeloData.variables as Record<string, any>).copyText
              : undefined;
            const specialCopy = specialTpl && typeof specialTpl.copyText === 'string' ? specialTpl.copyText : '';
            const copyContent = (specialCopy && specialCopy.trim())
              || (typeof varsCopy === 'string' && varsCopy.trim() ? varsCopy : '')
              || (modeloData?.header && modeloData.header.trim() ? modeloData.header : '')
              || (specialTpl ? '' : (modeloData?.content || ''))
              || mensagemPersonalizada
              || '';
            const bodyMessage = (mensagem && mensagem.trim() ? mensagemPersonalizada : '')
              || specialTpl?.description
              || modeloData?.name
              || 'Toque em copiar';
            await sendButtonActions(
              contato.telefone,
              bodyMessage,
              [
                {
                  id: 'copy_btn',
                  type: 'COPY',
                  label: 'Copiar',
                  copyText: copyContent,
                } as any,
              ],
              undefined,
              undefined,
            );
          } else if (temMidiaModelo) {
            const mediaCaption = legenda || mensagemPersonalizada;

            if (templateType === 'audio' || templateType === 'áudio') {
              await sendAudio(contato.telefone, modeloData!.mediaUrl!, mediaCaption);
            } else if (templateType === 'video' || templateType === 'video_botoes') {
              await sendVideo(contato.telefone, modeloData!.mediaUrl!, mediaCaption, viewOnce, isPtv);
            } else if (templateType === 'arquivo' || templateType === 'documento') {
              await sendDocument(
                contato.telefone,
                modeloData!.mediaUrl!,
                modeloData?.fileName || 'arquivo',
                modeloData?.fileType?.split('/').pop() || 'txt',
                mediaCaption,
              );
            } else {
              await sendImage(contato.telefone, modeloData!.mediaUrl!, mediaCaption);
            }
          } else if (temMidia) {
            const base64File = await convertToBase64(arquivoMidia);
            const fileExtension = arquivoMidia.name.split('.').pop()?.toLowerCase();
            
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
            const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', '3gp', 'mkv', 'webm'];
            const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'flac'];
            
            const isImage = imageExtensions.includes(fileExtension || '');
            const isVideo = videoExtensions.includes(fileExtension || '');
            const isAudio = audioExtensions.includes(fileExtension || '');

            if (isImage) {
              await sendImage(contato.telefone, base64File, legenda || '');
            } else if (isVideo) {
              await sendVideo(contato.telefone, base64File, legenda || '', viewOnce, isPtv);
            } else if (isAudio) {
              await sendAudio(contato.telefone, base64File, legenda || '');
            } else {
              await sendDocument(contato.telefone, base64File, arquivoMidia.name, fileExtension || 'txt', legenda || '');
            }
          }
          
          if (specialTpl) {
            // Already sent above via sendSpecialTemplate — skip remaining dispatch.
          } else if (temCarrossel) {
            // Already sent above via sendCarousel — skip remaining dispatch.
          } else if (audioComBotoes) {
            // Already sent above (audio + buttons) — skip remaining dispatch.
          } else if (videoComBotoes) {
            // Already sent above (video + buttons) — skip remaining dispatch.
          } else if (imagemComBotoes) {
            // Already sent above (image + buttons) — skip remaining dispatch.
          } else if (documentoComBotoes) {
            // Already sent above (document + buttons) — skip remaining dispatch.
          } else if (temMidiaModelo) {
            // Already sent above via media template — skip remaining dispatch.
          } else if (temBotoes) {
            await sendButtonActions(
              contato.telefone,
              mensagemPersonalizada,
              modeloData.buttons.map((btn: any) => {
                const buttonType = (btn.type || 'REPLY').toUpperCase();
                const buttonData: any = {
                  id: btn.id || btn.text || Math.random().toString(),
                  type: buttonType,
                  label: btn.text || btn.label || 'Botão'
                };
                
                if (buttonType === "CALL" && (btn.phone || btn.value)) {
                  buttonData.phone = btn.phone || btn.value;
                } else if (buttonType === "URL" && (btn.url || btn.value)) {
                  buttonData.url = btn.url || btn.value;
                } else if (buttonType === "COPY" && (btn.copyText || btn.value)) {
                  buttonData.copyText = btn.copyText || btn.value;
                }
                
                return buttonData;
              }),
              modeloData.header || undefined,
              modeloData.footer || undefined
            );
          } else if (!temMidia && !temBotoes) {
            if (instanceSelectionMode === 'rotate' && currentInstance) {
              console.log(`🔄 [${i+1}/${contatosProcessados.length}] Enviando via "${currentInstance.instance_name}" para ${contato.telefone}`);
            }
            await sendMessage(contato.telefone, mensagemPersonalizada);
          }
          
          sendStatus = 'sent';
          processados++;
          
          toast({
            title: `Mensagem enviada para ${contato.nome}`,
            description: `Progresso: ${i + 1}/${contatosProcessados.length} • instância confirmou a solicitação`,
          });

          // Delay entre mensagens (exceto na última)
          if (i < contatosProcessados.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
          }
          
        } catch (error) {
          erros++;
          sendStatus = 'failed';
          errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          console.error(`Erro ao enviar para ${contato.nome}:`, error);
          ultimoErro = errorMessage;
          errosDetalhados.push(`${contato.nome}: ${errorMessage}`);
          toast({
            title: `Falha ao enviar para ${contato.nome}`,
            description: errorMessage,
            variant: "destructive",
          });
        }
        
        // Determinar nome da instância usada neste envio
        let instanceNameUsed: string | undefined;
        if (instanceSelectionMode === 'rotate' && rotateInstances.length > 0) {
          // No modo revezamento, a instância usada foi a do índice i
          const usedInst = rotateInstances[i % rotateInstances.length];
          instanceNameUsed = usedInst?.instance_name;
        } else if (selectedInstanceId) {
          const usedInst = instances.find(inst => inst.id === selectedInstanceId);
          instanceNameUsed = usedInst?.instance_name;
        }

        // ATUALIZAR o registro pré-persistido (em vez de inserir novo)
        try {
          await supabase.from('campaign_sends').update({
            status: sendStatus,
            sent_at: sendStatus === 'sent' ? new Date().toISOString() : null,
            error_message: errorMessage,
            instance_name: instanceNameUsed,
          })
          .eq('campaign_id', campanha.id)
          .eq('phone', contato.telefone)
          .eq('status', 'pending');
        } catch (dbErr) {
          console.error('Erro ao registrar envio:', dbErr);
        }
      }
      
      // Atualizar status da campanha (apenas se não foi cancelado E não foi interrompido externamente)
      if (!cancelarEnvioRef.current && !interrompidoExternamente) {
        // Verificar se ainda há pendentes antes de marcar como completed
        const { count: remainingPending } = await supabase
          .from('campaign_sends')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campanha.id)
          .eq('status', 'pending');

        const hasPending = (remainingPending ?? 0) > 0;

        if (hasPending) {
          // Ainda há contatos não processados — pausar em vez de concluir
          await supabase
            .from('campaigns')
            .update({ status: 'paused' })
            .eq('id', campanha.id);
        } else if (erros === contatosProcessados.length && processados === 0) {
          // TODOS falharam (ex.: dispositivo deslogado durante o envio) — pausar
          // para permitir retomar depois de reconectar, em vez de marcar como cancelada.
          await supabase
            .from('campaigns')
            .update({ status: 'paused' })
            .eq('id', campanha.id);
        } else {
          await supabase
            .from('campaigns')
            .update({ status: 'completed' })
            .eq('id', campanha.id);
        }

        toast({
          title: "Envio em massa concluído!",
          description: hasPending
            ? `⏸️ ${processados} processados • ${remainingPending} pendentes — campanha pausada`
            : `✅ ${processados} envios confirmados • ❌ ${erros} erros${ultimoErro ? ` — Motivo: ${ultimoErro}` : ''}`,
          variant: processados > 0 ? "default" : "destructive"
        });
      }

       // Limpar formulário e resetar estados
       // Mantém contatos e mensagem preenchidos para permitir novos envios
       // sem precisar recarregar a página. Apenas limpa anexos auxiliares.
       setArquivoMidia(null);
       setLegenda("");

    } catch (error) {
      toast({
        title: "Erro no envio em massa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setEnviandoEmMassa(false);
      cancelarEnvioRef.current = false;
    }
  };

  const addActionButton = () => {
    setBotoesAcao([...botoesAcao, {id: (botoesAcao.length + 1).toString(), type: "REPLY", label: "", phone: "", url: "", copyText: ""}]);
  };

  const removeActionButton = (index: number) => {
    if (botoesAcao.length > 1) {
      setBotoesAcao(botoesAcao.filter((_, i) => i !== index));
    }
  };

  const updateActionButton = (index: number, field: string, value: string) => {
    const newBotoes = [...botoesAcao];
    newBotoes[index] = {...newBotoes[index], [field]: value};
    setBotoesAcao(newBotoes);
  };

  const addOption = () => {
    setOpcoes([...opcoes, {id: (opcoes.length + 1).toString(), title: "", description: ""}]);
  };

  const removeOption = (index: number) => {
    if (opcoes.length > 1) {
      setOpcoes(opcoes.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: string, value: string) => {
    const newOpcoes = [...opcoes];
    newOpcoes[index] = {...newOpcoes[index], [field]: value};
    setOpcoes(newOpcoes);
  };

  // Função para converter arquivo para base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Função para enviar mensagem com mídia
  const handleSendWithMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!arquivoMidia) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Selecione um arquivo para enviar",
        variant: "destructive"
      });
      return;
    }

    try {
      const validatedData = messageSchema.parse({ phone: numero, message: mensagem });
      setErrors({});

      const base64File = await convertToBase64(arquivoMidia);
      const fileExtension = arquivoMidia.name.split('.').pop()?.toLowerCase();
      
      // Categorizar tipos de arquivo
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', '3gp', 'mkv', 'webm'];
      const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'flac'];
      
      const isImage = imageExtensions.includes(fileExtension || '');
      const isVideo = videoExtensions.includes(fileExtension || '');
      const isAudio = audioExtensions.includes(fileExtension || '');

      if (isImage) {
        await sendImage(validatedData.phone, base64File, legenda || mensagem);
      } else if (isVideo) {
        await sendVideo(validatedData.phone, base64File, legenda || mensagem, viewOnce, isPtv);
      } else if (isAudio) {
        await sendAudio(validatedData.phone, base64File, legenda || mensagem);
      } else {
        // Documentos: PDF, DOC, DOCX, TXT, ZIP, etc.
        await sendDocument(
          validatedData.phone,
          base64File,
          arquivoMidia.name,
          fileExtension || 'txt',
          legenda || mensagem
        );
      }

      // Limpar formulário
      setNumero("");
      setMensagem("");
      setLegenda("");
      setArquivoMidia(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: {phone?: string, message?: string} = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'phone') fieldErrors.phone = err.message;
          if (err.path[0] === 'message') fieldErrors.message = err.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  // Função para aplicar modelo
  const aplicarModelo = (modeloId: string) => {
    const modelo = modelosDisponiveis.find(m => m.id === modeloId);
    if (modelo) {
      const special = parseSpecialTemplate(modelo.content);
      if (special) {
        setMensagem(special.description || "");
        toast({
          title: "Modelo especial selecionado",
          description: `${modelo.name} (${special.type}) será enviado pelo formato nativo`,
        });
        return;
      }
      setMensagem(modelo.content);
      toast({
        title: "Modelo aplicado!",
        description: `Modelo "${modelo.name}" foi aplicado à mensagem`,
      });
    }
  };

   const previewTemplateData = useMemo(() => {
     const modeloData = modeloSelecionado 
       ? modelosDisponiveis.find(m => m.id === modeloSelecionado) 
       : null;
 
     if (modeloData) return modeloData;
 
     // Se não tiver modelo, simular um modelo com o conteúdo atual
     return {
       content: mensagem,
       mediaUrl: arquivoMidia ? URL.createObjectURL(arquivoMidia) : undefined,
       fileType: arquivoMidia?.type,
       fileName: arquivoMidia?.name,
       buttons: botoesAcao.map((b, i) => ({ id: i.toString(), text: b.label, type: b.type.toLowerCase() }))
     };
   }, [modeloSelecionado, modelosDisponiveis, mensagem, arquivoMidia, botoesAcao]);
 
   return (
     <div className="space-y-4">
       <h1 className="text-lg font-semibold text-foreground">Enviar Mensagem</h1>

      <Card>
        <CardContent className="pt-4">
          <InstanceSelector
            providerFilter="zapi"
             onInstanceChange={(id) => {
               if (id === ROTATE_ALL) {
                 setInstanceSelectionMode('rotate');
                 setSelectedInstanceId(null);
                 setZapiRotateMode(instances);
               } else {
                 const inst = instances.find(i => i.id === id);
                 if (inst) {
                   setInstanceSelectionMode('single');
                   setOverride(inst);
                   setSelectedInstanceId(id);
                 }
               }
             }}
            onMultiInstanceChange={(ids) => {
              if (ids.length > 1) {
                const selected = instances.filter(i => ids.includes(i.id));
                setZapiRotateMode(selected);
                setSelectedInstanceIds(ids);
              } else {
                setSelectedInstanceIds(ids);
              }
            }}
          />
        </CardContent>
      </Card>

       <div className="flex flex-col lg:flex-row gap-6">
         <div className="flex-1 min-w-0">
           <Tabs defaultValue="individual" className="w-full">
             <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Texto
          </TabsTrigger>
          <TabsTrigger value="botoes" className="flex items-center gap-2">
            <MousePointer className="w-4 h-4" />
            Botões Interativos
          </TabsTrigger>
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            Lista de Opções
          </TabsTrigger>
          <TabsTrigger value="massa" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Envio em Massa
          </TabsTrigger>
          <TabsTrigger value="eventos" className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Eventos
          </TabsTrigger>
        </TabsList>

        {/* Mensagem de Texto Simples */}
        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagem de Texto</CardTitle>
              <CardDescription>Envie uma mensagem de texto simples</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendIndividual}>
                <div className="space-y-4">
                  <MediaModelSection 
                    arquivoMidia={arquivoMidia}
                    setArquivoMidia={setArquivoMidia}
                    legenda={legenda}
                    setLegenda={setLegenda}
                    modeloSelecionado={modeloSelecionado}
                    setModeloSelecionado={setModeloSelecionado}
                    aplicarModelo={aplicarModelo}
                    modelosDisponiveis={modelosDisponiveis}
                    viewOnce={viewOnce}
                    setViewOnce={setViewOnce}
                    isPtv={isPtv}
                    setIsPtv={setIsPtv}
                  />
                  
                  <div>
                    <Label htmlFor="numero">Número do WhatsApp</Label>
                    <Input 
                      id="numero" 
                      type="tel"
                      placeholder="5511999999999"
                      className={`mt-1 text-foreground ${errors.phone ? "border-destructive" : ""}`}
                      value={numero}
                      onChange={(e) => setNumero(normalizePhoneInput(e.target.value))}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Digite apenas números (ex: 5511999999999)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="mensagem-individual">Mensagem</Label>
                    <Textarea 
                      id="mensagem-individual"
                      placeholder="Digite sua mensagem aqui..."
                      className={`mt-1 min-h-[120px] text-foreground ${errors.message ? "border-destructive" : ""}`}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {mensagem.length}/4096 caracteres
                    </p>
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      arquivoMidia ? (
                        <>
                          <Paperclip className="w-4 h-4" />
                          Enviar com Mídia
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar Mensagem
                        </>
                      )
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Botões Interativos Completos */}
        <TabsContent value="botoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagem com Botões Interativos</CardTitle>
              <CardDescription>Envie mensagem com botões para responder, ligar, abrir links + título e rodapé</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendButtonActions}>
                <div className="space-y-4">
                  <MediaModelSection 
                    arquivoMidia={arquivoMidia}
                    setArquivoMidia={setArquivoMidia}
                    legenda={legenda}
                    setLegenda={setLegenda}
                    modeloSelecionado={modeloSelecionado}
                    setModeloSelecionado={setModeloSelecionado}
                    aplicarModelo={aplicarModelo}
                    modelosDisponiveis={modelosDisponiveis}
                    viewOnce={viewOnce}
                    setViewOnce={setViewOnce}
                    isPtv={isPtv}
                    setIsPtv={setIsPtv}
                  />
                  
                  <div>
                    <Label htmlFor="numero-botoes">Número do WhatsApp</Label>
                    <Input 
                      id="numero-botoes" 
                      type="tel"
                      placeholder="5511999999999"
                      className={`mt-1 text-foreground ${errors.phone ? "border-destructive" : ""}`}
                      value={numero}
                      onChange={(e) => setNumero(normalizePhoneInput(e.target.value))}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="titulo-botoes">Título (opcional)</Label>
                    <Input 
                      id="titulo-botoes" 
                      placeholder="Título da mensagem"
                      className="text-foreground"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="mensagem-botoes">Mensagem</Label>
                    <Textarea 
                      id="mensagem-botoes"
                      placeholder="Digite sua mensagem aqui..."
                      className={`mt-1 min-h-[120px] text-foreground ${errors.message ? "border-destructive" : ""}`}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="rodape-botoes">Rodapé (opcional)</Label>
                    <Input 
                      id="rodape-botoes" 
                      placeholder="Texto do rodapé"
                      className="text-foreground"
                      value={rodape}
                      onChange={(e) => setRodape(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Botões Interativos</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Configure botões para resposta rápida, fazer ligações ou abrir links
                    </p>
                    <div className="space-y-4 mt-2">
                      {botoesAcao.map((botao, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                          <div className="flex gap-2 items-center">
                            <Select
                              value={botao.type}
                              onValueChange={(value: "CALL" | "URL" | "REPLY" | "OPTION" | "COPY") => updateActionButton(index, 'type', value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="REPLY">📋 Resposta Rápida</SelectItem>
                                <SelectItem value="URL">🌐 Abrir Link</SelectItem>
                                <SelectItem value="CALL">📞 Ligar</SelectItem>
                                <SelectItem value="OPTION">📝 Opção</SelectItem>
                                <SelectItem value="COPY">📄 Copiar Texto</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Texto do botão"
                              value={botao.label}
                              onChange={(e) => updateActionButton(index, 'label', e.target.value)}
                              className="flex-1"
                            />
                            {botoesAcao.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeActionButton(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          {botao.type === "CALL" && (
                            <div>
                              <Label className="text-sm text-muted-foreground">Número para ligação</Label>
                              <Input
                                placeholder="5511999999999"
                                value={botao.phone}
                                onChange={(e) => updateActionButton(index, 'phone', e.target.value.replace(/\D/g, ''))}
                                className="mt-1"
                              />
                            </div>
                          )}
                          
                          {botao.type === "URL" && (
                            <div>
                              <Label className="text-sm text-muted-foreground">Link de destino</Label>
                              <Input
                                placeholder="https://example.com"
                                value={botao.url}
                                onChange={(e) => updateActionButton(index, 'url', e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          )}

                          {botao.type === "COPY" && (
                            <div>
                              <Label className="text-sm text-muted-foreground">Texto para copiar</Label>
                              <Input
                                placeholder="Código ou texto a ser copiado"
                                value={botao.copyText}
                                onChange={(e) => updateActionButton(index, 'copyText', e.target.value)}
                                className="mt-1"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                💡 Este texto será copiado automaticamente quando o usuário clicar no botão
                              </p>
                            </div>
                          )}

                          {botao.type === "REPLY" && (
                            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                💡 <strong>Botão de Resposta Rápida:</strong> O texto do botão acima será enviado automaticamente como resposta quando o usuário clicar nele.
                              </p>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Exemplo: Se o botão diz "Falar com Suporte", essa será a mensagem enviada.
                              </p>
                            </div>
                          )}

                          {botao.type === "OPTION" && (
                            <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                              💡 Este botão funcionará como uma opção de escolha rápida
                            </p>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addActionButton}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Botão
                      </Button>
                    </div>
                  </div>
                  
                  
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <MousePointer className="w-4 h-4" />
                        Enviar com Botões Interativos
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lista de Opções */}
        <TabsContent value="lista" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Opções</CardTitle>
              <CardDescription>Envie uma lista de opções para o usuário escolher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendOptionList}>
                <div className="space-y-4">
                  <MediaModelSection 
                    arquivoMidia={arquivoMidia}
                    setArquivoMidia={setArquivoMidia}
                    legenda={legenda}
                    setLegenda={setLegenda}
                    modeloSelecionado={modeloSelecionado}
                    setModeloSelecionado={setModeloSelecionado}
                    aplicarModelo={aplicarModelo}
                    modelosDisponiveis={modelosDisponiveis}
                    viewOnce={viewOnce}
                    setViewOnce={setViewOnce}
                    isPtv={isPtv}
                    setIsPtv={setIsPtv}
                  />
                  <div>
                    <Label htmlFor="numero-lista">Número do WhatsApp</Label>
                    <Input 
                      id="numero-lista" 
                      type="tel"
                      placeholder="5511999999999"
                      className={`mt-1 text-foreground ${errors.phone ? "border-destructive" : ""}`}
                      value={numero}
                      onChange={(e) => setNumero(normalizePhoneInput(e.target.value))}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="mensagem-lista">Mensagem</Label>
                    <Textarea 
                      id="mensagem-lista"
                      placeholder="Digite sua mensagem aqui..."
                      className={`mt-1 min-h-[120px] text-foreground ${errors.message ? "border-destructive" : ""}`}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="titulo-lista">Título da Lista</Label>
                    <Input 
                      id="titulo-lista" 
                      placeholder="Opções disponíveis"
                      className="text-foreground"
                      value={tituloLista}
                      onChange={(e) => setTituloLista(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="label-botao">Texto do Botão</Label>
                    <Input 
                      id="label-botao" 
                      placeholder="Ver opções"
                      className="text-foreground"
                      value={labelBotaoLista}
                      onChange={(e) => setLabelBotaoLista(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <Label>Opções da Lista</Label>
                    <div className="space-y-3 mt-2">
                      {opcoes.map((opcao, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex gap-2 items-center">
                            <Input
                              placeholder="Título da opção"
                              className="text-foreground"
                              value={opcao.title}
                              onChange={(e) => updateOption(index, 'title', e.target.value)}
                            />
                            {opcoes.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeOption(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <Input
                            placeholder="Descrição da opção"
                            className="text-foreground"
                            value={opcao.description}
                            onChange={(e) => updateOption(index, 'description', e.target.value)}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addOption}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Opção
                      </Button>
                    </div>
                  </div>
                  
                  
                  <Button type="submit" disabled={loading} className="w-full flex items-center gap-2">
                    {loading ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <List className="w-4 h-4" />
                        Enviar Lista de Opções
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Envio em Massa com Template */}
        <TabsContent value="massa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Envio em Massa</CardTitle>
              <CardDescription>Envie mensagens para múltiplos contatos usando lista ou planilha</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSendMassa}>
                <div className="space-y-4">
                  <MediaModelSection 
                    arquivoMidia={arquivoMidia}
                    setArquivoMidia={setArquivoMidia}
                    legenda={legenda}
                    setLegenda={setLegenda}
                    modeloSelecionado={modeloSelecionado}
                    setModeloSelecionado={setModeloSelecionado}
                    aplicarModelo={aplicarModelo}
                    modelosDisponiveis={modelosDisponiveis}
                    viewOnce={viewOnce}
                    setViewOnce={setViewOnce}
                    isPtv={isPtv}
                    setIsPtv={setIsPtv}
                  />
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Como usar o envio em massa:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                      <li>Baixe o modelo de planilha abaixo</li>
                      <li>Preencha com os números e nomes dos contatos</li>
                      <li>Salve como arquivo CSV</li>
                      <li>Faça o upload do arquivo ou cole a lista manualmente</li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Modelo de Planilha
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Exemplo simples sem cabeçalho
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const csvContent = `João Silva,5511999999999
Maria Santos,5511888888888
Pedro Costa,5511777777777`;
                          
                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.download = 'modelo_contatos_simples.csv';
                          link.click();
                          
                          toast({
                            title: "📥 Modelo baixado!",
                            description: "Arquivo CSV de exemplo foi baixado",
                          });
                        }}
                      >
                        Baixar Modelo CSV
                      </Button>
                    </Card>

                    <Card className="p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Upload de Arquivo
                      </h4>
                      <Input
                        type="file"
                        accept=".csv,.txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const text = event.target?.result as string;
                              setContatos(text);
                              
                              const linhas = text.split('\n').filter(l => l.trim());
                              const totalContatos = linhas.length;
                              
                              toast({
                                title: "Arquivo carregado!",
                                description: `${totalContatos} linhas detectadas`,
                              });
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="mb-3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Formatos aceitos: CSV, TXT
                      </p>
                    </Card>
                  </div>

                  <div>
                    <Label htmlFor="contatos-massa">Lista de Contatos</Label>
                    <Textarea
                      id="contatos-massa"
                      placeholder={`Cole ou digite seus contatos aqui:
João Silva,5511999999999
Maria Santos,5511888888888
Pedro Costa,5511777777777

Formatos aceitos:
• Nome,Telefone
• Telefone,Nome  
• Nome;Telefone
• Telefone;Nome
• Nome    Telefone (separado por tab)`}
                      className="mt-1 min-h-[120px] font-mono text-sm text-foreground"
                      value={contatos}
                      onChange={(e) => setContatos(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      📊 Contatos detectados: {contatos ? contatos.split(/[\n,;]/).filter(n => n.trim().length >= 10).length : 0}
                    </p>
                  </div>

                  {!modeloSelecionado && (
                    <div>
                      <Label htmlFor="mensagem-massa">Mensagem</Label>
                      <Textarea
                        id="mensagem-massa"
                        placeholder="Digite a mensagem ou selecione um modelo acima"
                        className="mt-1 min-h-[120px] text-foreground"
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 Use {"{nome}"} e {"{numero}"} para personalizar a mensagem
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="delay-massa" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Delay entre Mensagens (segundos)
                    </Label>
                    <Input
                      id="delay-massa"
                      type="number"
                      min="1"
                      max="60"
                      value={delay}
                      onChange={(e) => setDelay(parseInt(e.target.value) || 2)}
                      className="mt-1 text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Recomendado: 2-5 segundos para evitar bloqueios
                    </p>
                  </div>

                  
                  <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ <strong>Importante:</strong> O envio em massa deve respeitar as políticas do WhatsApp. 
                      Recomendamos intervalos entre envios e verificar se os números aceitam mensagens comerciais.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Button 
                       type="submit"
                       disabled={loading || enviandoEmMassa || !contatos.trim() || (!mensagem.trim() && !modeloSelecionado)}
                       className="w-full flex items-center gap-2"
                      size="lg"
                    >
                      {loading || enviandoEmMassa ? (
                        <>Enviando...</>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Iniciar Envio em Massa
                          <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">
                            {contatos ? contatos.split(/[\n,]/).filter(n => n.trim().length >= 10).length : 0} contatos
                          </span>
                        </>
                      )}
                    </Button>
                    
                    {enviandoEmMassa && (
                      <Button 
                        type="button"
                        variant="destructive" 
                        onClick={() => cancelarEnvioRef.current = true}
                        className="w-full flex items-center gap-2"
                        size="lg"
                      >
                        ❌ Cancelar Envio em Andamento
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Eventos */}
        <TabsContent value="eventos" className="space-y-4">
          <EventosSection
            sendEvent={sendEvent}
            sendEditEvent={sendEditEvent}
            sendEventResponse={sendEventResponse}
            loading={loading}
          />
        </TabsContent>
           </Tabs>
         </div>
 
         <div className="hidden lg:flex w-[320px] flex-col gap-4 sticky top-6 self-start">
           <div className="flex items-center justify-between">
             <h3 className="text-sm font-semibold flex items-center gap-2">
               <LayoutTemplate className="w-4 h-4 text-primary" />
               Prévia do Envio
             </h3>
             <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
               WhatsApp Web
             </Badge>
           </div>
           <div className="bg-muted/10 rounded-2xl border border-white/5 p-4 flex items-center justify-center">
             <WhatsAppPreview template={previewTemplateData} />
           </div>
           <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
             <p className="text-[11px] text-muted-foreground leading-relaxed">
               <span className="text-primary font-medium">Nota:</span> Esta é uma simulação aproximada de como a mensagem será exibida no dispositivo do destinatário.
             </p>
           </div>
         </div>
       </div>
    </div>
  );
};

export default EnviarMensagem;