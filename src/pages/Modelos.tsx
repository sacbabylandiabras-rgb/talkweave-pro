import { useState, useCallback, memo, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { FileText, Plus, Copy, Edit, Trash2, Save, Send, Users, Search, Phone, Link, MessageCircle, Image, Music, Video, List, FileArchive, FileType, Menu, Upload, X, Eye, Wifi, Check, MapPin, User as UserIcon, DollarSign, Play, Pause, ShoppingBag, CalendarClock, Package, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Defaults para os campos especiais (PIX/Localização/Contato)
const SPECIAL_FIELD_DEFAULTS = {
  pixKey: "",
  pixKeyType: "cpf",
  pixAmount: "",
  pixMerchantName: "",
  pixCity: "",
  locLatitude: "",
  locLongitude: "",
  locAddress: "",
  locTitle: "",
   contactName: "",
   contactPhone: "",
   contactBusinessDescription: "",
   catalogId: "",
   productId: "",
   eventTitle: "",
   eventDescription: "",
   eventStartTime: "",
   eventEndTime: "",
   eventLocation: "",
   eventUrl: "",
   eventIsAllDay: false,
   orderStatus: "",
   orderPaymentStatus: "",
   orderReferenceId: "",
    orderJson: "",
    paymentTitle: "",
    paymentDescription: "",
    paymentAmount: "",
    paymentCurrency: "BRL",
    paymentReferenceId: "",
  };

const SPECIAL_TEMPLATE_PREFIX = "__SPECIAL_TEMPLATE__:";

const buildSpecialContent = (type: string, data: any): string => {
  const payload: any = { type };
    if (type === "pix" || type === "gateway_billing") {
      payload.pixSource = data.pixSource || (type === "gateway_billing" ? "gateway" : "manual");
    payload.pixKey = data.pixKey;
    payload.pixKeyType = data.pixKeyType;
    payload.amount = data.pixAmount;
    payload.merchantName = data.pixMerchantName;
    payload.city = data.pixCity;
    payload.description = data.content || "";
  } else if (type === "localizacao") {
    payload.latitude = data.locLatitude;
    payload.longitude = data.locLongitude;
    payload.address = data.locAddress;
    payload.title = data.locTitle;
    payload.description = data.content || "";
  } else if (type === "contato") {
    payload.contactName = data.contactName;
    payload.contactPhone = data.contactPhone;
    payload.contactBusinessDescription = data.contactBusinessDescription || "";
    payload.description = data.content || "";
  } else if (type === "copia_cola") {
    const vars = (data.variables && typeof data.variables === 'object' && !Array.isArray(data.variables))
      ? data.variables as Record<string, any>
      : {};
      payload.copyText = vars.copyText || data.header || data.content || "";
      payload.description = data.content || "";
    } else if (type === "produto") {
      payload.catalogId = data.catalogId || "";
      payload.productId = data.productId || "";
      payload.description = data.content || "";
    } else if (type === "evento") {
      payload.title = data.eventTitle || "";
      payload.description = data.eventDescription || data.content || "";
      payload.startTime = data.eventStartTime ? Math.floor(new Date(data.eventStartTime).getTime() / 1000) : "";
      if (data.eventEndTime) payload.endTime = Math.floor(new Date(data.eventEndTime).getTime() / 1000);
      if (data.eventLocation) payload.location = data.eventLocation;
      if (data.eventUrl) payload.url = data.eventUrl;
      if (data.eventIsAllDay) payload.isAllDay = true;
    } else if (type === "status_pedido" || type === "pagamento_pedido") {
      payload.orderStatus = data.orderStatus || "";
      payload.paymentStatus = data.orderPaymentStatus || "";
      payload.referenceId = data.orderReferenceId || "";
      try {
        if (data.orderJson) payload.order = JSON.parse(data.orderJson);
      } catch {
        payload.orderRaw = data.orderJson;
      }
      payload.description = data.content || "";
    } else if (type === "pagamento") {
      payload.paymentSource = data.paymentSource || "manual";
      payload.title = data.paymentTitle || "";
      payload.description = data.paymentDescription || data.content || "";
      payload.amount = data.paymentAmount ? Number(data.paymentAmount.replace(',', '.')) : 0;
      payload.currency = data.paymentCurrency || "BRL";
      payload.referenceId = data.paymentReferenceId || "";
    }
    return SPECIAL_TEMPLATE_PREFIX + JSON.stringify(payload);
  };

const parseSpecialContent = (content: string): any | null => {
  if (!content || !content.startsWith(SPECIAL_TEMPLATE_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(SPECIAL_TEMPLATE_PREFIX.length));
  } catch {
    return null;
  }
};

const isSpecialType = (type?: string): boolean =>
   type === "pix" || type === "localizacao" || type === "contato" || type === "copia_cola"
    || type === "poll" || type === "sticker" || type === "gif" || type === "link" || type === "produto"
    || type === "evento" || type === "status_pedido" || type === "pagamento_pedido" || type === "pagamento" || type === "gateway_billing";

const getDisplayContent = (template: any): string => {
  const content = template?.content || "";
  if (typeof content === 'string' && content.startsWith(SPECIAL_TEMPLATE_PREFIX)) {
    const parsed = parseSpecialContent(content);
    if (parsed) {
      if (parsed.type === 'copia_cola') {
        return parsed.description || parsed.copyText || template?.name || 'Mensagem com botão Copiar';
      }
      return parsed.description || template?.name || '';
    }
  }
  return content;
};

// Editor compartilhado para PIX / Localização / Contato
const SpecialFieldsEditor = ({
  type,
  data,
  onChange,
}: {
  type: string;
  data: any;
  onChange: (patch: any) => void;
}) => {
  if (!isSpecialType(type)) return null;

  if (type === "pix" || type === "gateway_billing") {
    return (
      <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <DollarSign className="w-4 h-4" /> {type === "gateway_billing" ? "Cobrança Gateway" : "Cobrança PIX"}
        </div>
        <div className="space-y-2">
          <Label>Origem da Cobrança</Label>
          <Select 
            value={data.pixSource || (type === "gateway_billing" ? "gateway" : "manual")} 
            onValueChange={(v) => onChange({ pixSource: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual (Chave PIX)</SelectItem>
              <SelectItem value="gateway">Gateway (Checkout Real)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.pixSource === "gateway" || type === "gateway_billing" ? (
          <div className="space-y-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={data.pixAmount || ""}
                onChange={(e) => onChange({ pixAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição / Nome do Produto *</Label>
              <Input
                placeholder="Ex: Assinatura Mensal VIP"
                value={data.pixMerchantName || ""}
                onChange={(e) => onChange({ pixMerchantName: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Tipo da chave</Label>
            <Select value={data.pixKeyType || "cpf"} onValueChange={(v) => onChange({ pixKeyType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="evp">Aleatória (EVP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$) — opcional</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={data.pixAmount || ""}
              onChange={(e) => onChange({ pixAmount: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Chave PIX *</Label>
          <Input
            placeholder="Sua chave PIX"
            value={data.pixKey || ""}
            onChange={(e) => onChange({ pixKey: e.target.value })}
          />
        </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nome do recebedor *</Label>
                <Input
                  placeholder="Razão social ou nome"
                  maxLength={25}
                  value={data.pixMerchantName || ""}
                  onChange={(e) => onChange({ pixMerchantName: e.target.value })}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  placeholder="Cidade"
                  maxLength={15}
                  value={data.pixCity || ""}
                  onChange={(e) => onChange({ pixCity: e.target.value })}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (type === "localizacao") {
    return (
      <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="w-4 h-4" /> Localização
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Latitude *</Label>
            <Input
              placeholder="-23.5505"
              value={data.locLatitude || ""}
              onChange={(e) => onChange({ locLatitude: e.target.value })}
            />
          </div>
          <div>
            <Label>Longitude *</Label>
            <Input
              placeholder="-46.6333"
              value={data.locLongitude || ""}
              onChange={(e) => onChange({ locLongitude: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Título</Label>
          <Input
            placeholder="Ex: Nosso escritório"
            value={data.locTitle || ""}
            onChange={(e) => onChange({ locTitle: e.target.value })}
          />
        </div>
        <div>
          <Label>Endereço</Label>
          <Input
            placeholder="Av. Paulista, 1000 - São Paulo/SP"
            value={data.locAddress || ""}
            onChange={(e) => onChange({ locAddress: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Dica: pegue as coordenadas no Google Maps clicando com o botão direito no local.
        </p>
      </div>
    );
  }

  if (type === "contato") {
    return (
      <div className="space-y-4 border rounded-xl p-4 bg-purple-500/5 border-purple-500/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
          <UserIcon className="w-5 h-5" /> Enviar Cartão de Contato (vCard)
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome do Contato *</Label>
            <Input
              placeholder="Ex: João da Silva"
              value={data.contactName || ""}
              onChange={(e) => onChange({ contactName: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Telefone (com DDI) *</Label>
            <Input
              placeholder="Ex: +5511999999999"
              value={data.contactPhone || ""}
              onChange={(e) => onChange({ contactPhone: e.target.value })}
              className="bg-background border-purple-500/30 focus-visible:ring-purple-500"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Formato internacional obrigatório (DDI + DDD + Número).
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Descrição Comercial (Opcional)</Label>
            <Input
              placeholder="Ex: Consultor de Vendas"
              value={data.contactBusinessDescription || ""}
              onChange={(e) => onChange({ contactBusinessDescription: e.target.value })}
              className="bg-background"
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === "copia_cola") {
    const currentVars = (data.variables && typeof data.variables === 'object' && !Array.isArray(data.variables))
      ? data.variables as Record<string, any>
      : {};
    const copyText = currentVars.copyText ?? data.header ?? "";
    return (
      <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          📋 Texto para copiar
        </div>
        <div>
          <Label>Conteúdo que será copiado ao clicar no botão *</Label>
          <Textarea
            placeholder="Ex: PIX: contato@exemplo.com  |  Cupom: PROMO10  |  Link: https://..."
            value={copyText}
            onChange={(e) => onChange({
              variables: { ...currentVars, copyText: e.target.value },
              header: "",
            })}
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Este é o texto que vai para a área de transferência do contato. Se ficar vazio, o conteúdo da mensagem será copiado.
          </p>
        </div>
      </div>
    );
  }


  if (type === "produto") {
    return (
      <div className="space-y-4 border rounded-xl p-4 bg-accent/10 border-accent/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <ShoppingBag className="w-5 h-5" /> Enviar Produto do Catálogo
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Catálogo (Opcional)</Label>
            <Input
              placeholder="Ex: 123456789 (vazio para catálogo padrão)"
              value={data.catalogId || ""}
              onChange={(e) => onChange({ catalogId: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Produto *</Label>
            <Input
              placeholder="Ex: 987654321"
              value={data.productId || ""}
              onChange={(e) => onChange({ productId: e.target.value })}
              className="bg-background border-primary/50 focus-visible:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ID do produto cadastrado no Gerenciador de Comércio do Facebook. Obrigatório para este tipo de mensagem.
            </p>
          </div>
        </div>
      </div>
    );
  }
 
  if (type === "evento") {
    return (
      <div className="space-y-4 border rounded-xl p-4 bg-accent/10 border-accent/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <CalendarClock className="w-5 h-5" /> Convite de Evento
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2">
            <Label>Origem da Cobrança</Label>
            <Select 
              value={data.paymentSource || "manual"} 
              onValueChange={(v) => onChange({ paymentSource: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (Personalizado)</SelectItem>
                <SelectItem value="gateway">Gateway (Checkout Real)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Título do evento *</Label>
            <Input
              placeholder="Ex: Reunião de planejamento"
              value={data.eventTitle || ""}
              onChange={(e) => onChange({ eventTitle: e.target.value })}
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              placeholder="Detalhes do evento"
              value={data.eventDescription || ""}
              onChange={(e) => onChange({ eventDescription: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Início *</Label>
              <Input
                type="datetime-local"
                value={data.eventStartTime || ""}
                onChange={(e) => onChange({ eventStartTime: e.target.value })}
              />
            </div>
            <div>
              <Label>Término</Label>
              <Input
                type="datetime-local"
                value={data.eventEndTime || ""}
                onChange={(e) => onChange({ eventEndTime: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Local</Label>
            <Input
              placeholder="Endereço ou nome do local"
              value={data.eventLocation || ""}
              onChange={(e) => onChange({ eventLocation: e.target.value })}
            />
          </div>
          <div>
            <Label>Link (opcional)</Label>
            <Input
              placeholder="https://..."
              value={data.eventUrl || ""}
              onChange={(e) => onChange({ eventUrl: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!data.eventIsAllDay}
              onChange={(e) => onChange({ eventIsAllDay: e.target.checked })}
            />
            Evento de dia inteiro
          </label>
        </div>
      </div>
    );
  }

  if (type === "pagamento") {
    return (
      <div className="space-y-4 border rounded-xl p-4 bg-accent/10 border-accent/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <CreditCard className="w-5 h-5" /> Solicitação de Pagamento
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Título do Pagamento *</Label>
            <Input
              placeholder="Ex: Assinatura Mensal"
              value={data.paymentTitle || ""}
              onChange={(e) => onChange({ paymentTitle: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={data.paymentAmount || ""}
                onChange={(e) => onChange({ paymentAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>Moeda</Label>
              <Select
                value={data.paymentCurrency || "BRL"}
                onValueChange={(v) => onChange({ paymentCurrency: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (BRL)</SelectItem>
                  <SelectItem value="USD">Dólar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              placeholder="Detalhes sobre o que está sendo cobrado"
              value={data.paymentDescription || ""}
              onChange={(e) => onChange({ paymentDescription: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label>Referência (opcional)</Label>
            <Input
              placeholder="Ex: fatura-001"
              value={data.paymentReferenceId || ""}
              onChange={(e) => onChange({ paymentReferenceId: e.target.value })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === "status_pedido" || type === "pagamento_pedido") {
    const isPayment = type === "pagamento_pedido";
    return (
      <div className="space-y-4 border rounded-xl p-4 bg-accent/10 border-accent/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          {isPayment ? <CreditCard className="w-5 h-5" /> : <Package className="w-5 h-5" />}
          {isPayment ? "Atualização de Pagamento do Pedido" : "Atualização de Status do Pedido"}
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Status do pedido {isPayment ? "" : "*"}</Label>
              <Select
                value={data.orderStatus || ""}
                onValueChange={(v) => onChange({ orderStatus: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status do pagamento {isPayment ? "*" : ""}</Label>
              <Select
                value={data.orderPaymentStatus || ""}
                onValueChange={(v) => onChange({ orderPaymentStatus: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="refunded">Reembolsado</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>ID de referência</Label>
            <Input
              placeholder="Ex: pedido-123"
              value={data.orderReferenceId || ""}
              onChange={(e) => onChange({ orderReferenceId: e.target.value })}
            />
          </div>
          <div>
            <Label>Detalhes do pedido (JSON, opcional)</Label>
            <Textarea
              placeholder='{"total":"100.00","items":[...]}'
              value={data.orderJson || ""}
              onChange={(e) => onChange({ orderJson: e.target.value })}
              rows={4}
              className="font-mono text-xs"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
};


// Helper para obter o ícone do tipo de template
const getTemplateIcon = (type?: string) => {
  switch (type) {
    case "imagem":
    case "imagem_botoes":
      return <Image className="w-5 h-5 text-primary" />;
    case "audio":
      return <Music className="w-5 h-5 text-primary" />;
    case "audio_botoes":
      return <Music className="w-5 h-5 text-primary" />;
    case "video":
    case "video_botoes":
      return <Video className="w-5 h-5 text-primary" />;
    case "lista_opcao":
      return <List className="w-5 h-5 text-primary" />;
    case "arquivo":
      return <FileArchive className="w-5 h-5 text-primary" />;
    case "documento":
      return <FileType className="w-5 h-5 text-primary" />;
    case "carrossel":
      return <Menu className="w-5 h-5 text-primary" />;
    case "pix":
      return <DollarSign className="w-5 h-5 text-primary" />;
    case "produto":
      return <ShoppingBag className="w-5 h-5 text-primary" />;
    case "localizacao":
      return <MapPin className="w-5 h-5 text-primary" />;
    case "contato":
      return <UserIcon className="w-5 h-5 text-primary" />;
    case "evento":
      return <CalendarClock className="w-5 h-5 text-primary" />;
    case "status_pedido":
      return <Package className="w-5 h-5 text-primary" />;
    case "pagamento":
    case "pagamento_pedido":
      return <CreditCard className="w-5 h-5 text-primary" />;
    default:
      return <FileText className="w-5 h-5 text-primary" />;
  }
};

// Helper para obter o nome amigável do tipo
const getTypeFriendlyName = (type?: string) => {
  const names: Record<string, string> = {
    texto: "Texto",
    imagem: "Imagem",
    audio: "Áudio",
    video: "Vídeo",
    video_botoes: "Vídeo c/ Botões",
    audio_botoes: "Áudio c/ Botões",
    lista_opcao: "Lista",
    copia_cola: "Copiar/Colar",
    arquivo: "Arquivo",
    imagem_botoes: "Imagem c/ Botões",
    documento: "Documento",
    carrossel: "Carrossel",
    pix: "PIX",
    localizacao: "Localização",
    produto: "Produto",
    contato: "Contato (vCard)",
    evento: "Evento",
    status_pedido: "Status do Pedido",
    pagamento_pedido: "Pagamento do Pedido",
    pagamento: "Solicitar Pagamento",
  };
  return names[type || "texto"] || "Texto";
};

// Componente ButtonEditor separado e memoizado para evitar re-renders
const ButtonEditor = memo(({ 
  buttons, 
  isEdit = false, 
  onAddButton, 
  onUpdateButton, 
  onRemoveButton 
}: { 
   buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>, 
  isEdit?: boolean,
  onAddButton: (isEdit: boolean) => void,
  onUpdateButton: (index: number, field: string, value: string, isEdit: boolean) => void,
  onRemoveButton: (index: number, isEdit: boolean) => void
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Botões de Ação</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddButton(isEdit);
          }}
           disabled={buttons.length >= 10}
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Botão
        </Button>
      </div>
    
      {buttons.map((button, index) => (
        <div key={button.id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Botão {index + 1}</span>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveButton(index, isEdit);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Texto do Botão</Label>
              <Input
                placeholder="Ex: Confirmar Pedido"
                value={button.text}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateButton(index, 'text', e.target.value, isEdit);
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                maxLength={20}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select 
                value={button.type} 
                onValueChange={(value) => {
                  onUpdateButton(index, 'type', value, isEdit);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="reply">
                     <div className="flex items-center">
                       <MessageCircle className="w-4 h-4 mr-2" />
                       Resposta Rápida
                     </div>
                   </SelectItem>
                   <SelectItem value="url">
                     <div className="flex items-center">
                       <Link className="w-4 h-4 mr-2" />
                       Link/URL
                     </div>
                   </SelectItem>
                   <SelectItem value="call">
                     <div className="flex items-center">
                       <Phone className="w-4 h-4 mr-2" />
                       Ligar
                     </div>
                   </SelectItem>
                   <SelectItem value="copy">
                     <div className="flex items-center">
                       <Copy className="w-4 h-4 mr-2" />
                       Copiar Texto
                     </div>
                   </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
           {(button.type === 'url' || button.type === 'call' || button.type === 'copy') && (
            <div>
               <Label>
                 {button.type === 'url' ? 'URL' : button.type === 'copy' ? 'Texto para Copiar' : 'Número de Telefone'}
               </Label>
              <Input
                 placeholder={
                   button.type === 'url' 
                     ? "https://exemplo.com" 
                     : button.type === 'copy' 
                       ? "Texto que será copiado" 
                       : "+5511999999999"
                 }
                value={button.value || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateButton(index, 'value', e.target.value, isEdit);
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          )}
        </div>
      ))}
      
      {buttons.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Nenhum botão adicionado. Clique em "Adicionar Botão" para criar um.
        </div>
      )}
      
      <div className="bg-muted/50 p-2 rounded text-xs text-muted-foreground">
        💡 Máximo 3 botões por modelo. Botões de resposta rápida enviam texto automático, links abrem URLs e botões de ligar iniciam chamadas.
      </div>
    </div>
  );
});

// Validação dos botões: garante texto e, para URL/CALL, valor preenchido e válido.
const validateButtons = (
  buttons: Array<{ id: string; text: string; type: 'reply' | 'url' | 'call'; value?: string }> | undefined,
): string | null => {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const label = `Botão ${i + 1}`;
    const text = (b?.text || '').trim();
    if (!text) return `${label}: o texto do botão é obrigatório.`;
    if (text.length > 20) return `${label}: o texto deve ter no máximo 20 caracteres.`;
    const value = (b?.value || '').trim();
    if (b?.type === 'url') {
      if (!value) return `${label}: a URL é obrigatória para botões de Link.`;
      try {
        const parsed = new URL(value);
        if (!/^https?:$/i.test(parsed.protocol)) {
          return `${label}: a URL deve começar com http:// ou https://.`;
        }
      } catch {
        return `${label}: URL inválida. Use o formato https://exemplo.com.`;
      }
    }
    if (b?.type === 'call') {
      if (!value) return `${label}: o número de telefone é obrigatório para botões de Ligar.`;
      const digits = value.replace(/\D/g, '');
      if (digits.length < 8) return `${label}: telefone inválido. Inclua DDI/DDD (ex.: +5511999999999).`;
    }
  }
  return null;
};
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useToast } from "@/hooks/use-toast";

const isImageTemplateType = (type?: string) => type === "imagem" || type === "imagem_botoes";
const isVideoTemplateType = (type?: string) => type === "video" || type === "video_botoes";
const isAudioTemplateType = (type?: string) => type === "audio" || type === "audio_botoes";
const isDocumentTemplateType = (type?: string) => type === "arquivo" || type === "documento";

const getPreviewFileLabel = (template: any) => {
  if (template?.fileName) return template.fileName;
  if (!template?.mediaUrl) return "Arquivo anexado";

  try {
    const pathname = new URL(template.mediaUrl).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop();
    return lastSegment || "Arquivo anexado";
  } catch {
    const segments = String(template.mediaUrl).split('/').filter(Boolean);
    return segments.pop() || "Arquivo anexado";
  }
};

const Modelos = () => {
  const { templates, loading: templatesLoading, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useMessageTemplates();
  const [realUsage, setRealUsage] = useState<Record<string, number>>({});
  const [loadingUsage, setLoadingUsage] = useState(false);
  // Efeito para carregar a contagem real de uso (envios) por modelo
  useEffect(() => {
    const fetchRealUsage = async () => {
      if (templates.length === 0) return;
      
      try {
        setLoadingUsage(true);
        // Busca a contagem de envios agrupada por template_id através das campanhas
        // Como o JS client não faz joins complexos com agregação facilmente, usamos um query RPC ou similar
        // Mas aqui buscaremos as campanhas e seus contadores
        const { data: campaignStats, error } = await supabase
          .from('campaigns')
          .select('id, template_id');
        
        if (error || !campaignStats) return;

        // Mapear template -> campanhas
        const templateMap: Record<string, string[]> = {};
        campaignStats.forEach(c => {
          if (c.template_id) {
            if (!templateMap[c.template_id]) templateMap[c.template_id] = [];
            templateMap[c.template_id].push(c.id);
          }
        });

        const usageMap: Record<string, number> = {};
        
        // Para cada template que tem campanhas, buscar o total de envios
        // Fazemos isso em paralelo com Promise.all para ser mais rápido
        await Promise.all(Object.keys(templateMap).map(async (templateId) => {
          const campaignIds = templateMap[templateId];
          const { count } = await supabase
            .from('campaign_sends')
            .select('*', { count: 'exact', head: true })
            .in('campaign_id', campaignIds);
          
          usageMap[templateId] = count || 0;
        }));

        setRealUsage(usageMap);
      } catch (err) {
        console.error("Erro ao carregar uso real:", err);
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchRealUsage();
  }, [templates]);

  const { toast } = useToast();
  
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "",
    type: "texto",
    content: "",
    header: "",
    footer: "",
    mediaUrl: "",
    fileName: "",
    fileType: "",
    variables: [] as string[],
    buttons: [] as Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>,
    listItems: [] as Array<{id: string, title: string, description?: string}>,
    carouselCards: [] as Array<{
      id: string;
      image: string;
      title: string;
      description: string;
      buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>;
    }>,
    // Campos específicos PIX
    pixKey: "",
    pixKeyType: "cpf",
    pixAmount: "",
    pixMerchantName: "",
    pixCity: "",
    // Localização
    locLatitude: "",
    locLongitude: "",
    locAddress: "",
    locTitle: "",
    // Contato (vCard)
    contactName: "",
    contactPhone: "",
    contactBusinessDescription: "",
    catalogId: "",
    productId: "",
    paymentTitle: "",
    paymentDescription: "",
    paymentAmount: "",
    paymentCurrency: "BRL",
    paymentReferenceId: "",
   });
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    category: "",
    type: "texto",
    content: "",
    header: "",
    footer: "",
    mediaUrl: "",
    fileName: "",
    fileType: "",
    buttons: [] as Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>,
    listItems: [] as Array<{id: string, title: string, description?: string}>,
    carouselCards: [] as Array<{
      id: string;
      image: string;
      title: string;
      description: string;
      buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call', value?: string}>;
    }>,
    pixKey: "",
    pixKeyType: "cpf",
    pixAmount: "",
    pixMerchantName: "",
    pixCity: "",
    locLatitude: "",
    locLongitude: "",
    locAddress: "",
    locTitle: "",
     contactName: "",
     contactPhone: "",
     contactBusinessDescription: "",
     variables: {} as Record<string, any>,
    catalogId: "",
    productId: "",
    paymentTitle: "",
    paymentDescription: "",
    paymentAmount: "",
    paymentCurrency: "BRL",
    paymentReferenceId: "",
   });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewAudioPlaying, setIsPreviewAudioPlaying] = useState(false);

  useEffect(() => {
    setIsPreviewAudioPlaying(false);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
  }, [previewTemplate?.mediaUrl]);

  const togglePreviewAudio = useCallback(async () => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPreviewAudioPlaying(true);
      } catch {
        setIsPreviewAudioPlaying(false);
      }
      return;
    }

    audio.pause();
    setIsPreviewAudioPlaying(false);
  }, []);

  // Função para fazer upload do arquivo
  const handleFileUpload = async (file: File, isEdit: boolean = false): Promise<string | null> => {
    const validListItems = Array.isArray(newTemplate.listItems)
      ? newTemplate.listItems.filter(item => item.title.trim() !== "")
      : [];

    if (newTemplate.type === "lista_opcao" && validListItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um item na lista de opções", variant: "destructive" });
      return;
    }

    try {
      setUploadingFile(true);
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Usuário não autenticado");
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      // Upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('template-media')
        .upload(filePath, file);

      if (error) throw error;

      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('template-media')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Atualizar estado com a URL
      if (isEdit) {
        setEditFormData(prev => ({
          ...prev,
          mediaUrl: publicUrl,
          fileName: file.name,
          fileType: file.type,
        }));
      } else {
        setNewTemplate(prev => ({
          ...prev,
          mediaUrl: publicUrl,
          fileName: file.name,
          fileType: file.type,
        }));
      }

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso!",
      });
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar arquivo",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const categories = ["Todos", ...new Set(templates.map(t => t.category))];
  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === "Todos" || template.category === selectedCategory;
    const matchesSearch = searchTerm === "" || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.category) {
      toast({
        title: "Erro",
        description: "Preencha nome e categoria",
        variant: "destructive",
      });
      return;
    }
    const buttonsError = validateButtons(newTemplate.buttons);
    if (buttonsError) {
      toast({ title: "Erro nos botões", description: buttonsError, variant: "destructive" });
      return;
    }
    if (!isSpecialType(newTemplate.type) && !newTemplate.content) {
      toast({
        title: "Erro",
        description: "Preencha o conteúdo do modelo",
        variant: "destructive",
      });
      return;
    }
    // Validações por tipo especial
    if (newTemplate.type === "pix" && (!newTemplate.pixKey || !newTemplate.pixMerchantName)) {
      toast({ title: "Erro", description: "Informe a chave PIX e o nome do recebedor", variant: "destructive" });
      return;
    }
    if (newTemplate.type === "localizacao" && (!newTemplate.locLatitude || !newTemplate.locLongitude)) {
      toast({ title: "Erro", description: "Informe latitude e longitude", variant: "destructive" });
      return;
    }
    if (newTemplate.type === "contato" && (!newTemplate.contactName || !newTemplate.contactPhone)) {
      toast({ title: "Erro", description: "Informe nome e telefone do contato", variant: "destructive" });
      return;
    }
    if (newTemplate.type === "produto" && !newTemplate.productId) {
      toast({ title: "Erro", description: "Informe o ID do produto", variant: "destructive" });
      return;
    }
    if (newTemplate.type === "pagamento" && (!newTemplate.paymentTitle || !newTemplate.paymentAmount)) {
      toast({ title: "Erro", description: "Informe o título e o valor do pagamento", variant: "destructive" });
      return;
    }

    const validListItems = Array.isArray(newTemplate.listItems)
      ? newTemplate.listItems.filter(item => item.title.trim() !== "")
      : [];

    if (newTemplate.type === "lista_opcao" && validListItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um item na lista de opções", variant: "destructive" });
      return;
    }

    try {
      // Extract variables from content
      const variableMatches = newTemplate.content.match(/{([^}]+)}/g);
      const variables = variableMatches 
        ? variableMatches.map(match => match.slice(1, -1))
        : [];

      // Validação específica para carrossel
      if (newTemplate.type === "carrossel") {
        if (newTemplate.carouselCards.length < 2) {
          toast({
            title: "Erro",
            description: "Carrossel precisa de pelo menos 2 cards",
            variant: "destructive",
          });
          return;
        }
        
        // Validar cada card
        for (let i = 0; i < newTemplate.carouselCards.length; i++) {
          const card = newTemplate.carouselCards[i];
          
          // Validar campos obrigatórios
          if (!card.title || !card.description) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: Título e descrição são obrigatórios`,
              variant: "destructive",
            });
            return;
          }
          
          // Validar URL da imagem apenas se for texto digitado manualmente (não vazio e não é URL do Supabase)
          if (card.image && card.image.trim() !== '' && !card.image.includes('supabase.co/storage')) {
            const imageUrl = card.image.trim();
            
            // Verificar se é uma URL válida (apenas para URLs digitadas manualmente)
            const isValidUrl = imageUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp)/i);
            
            if (!isValidUrl) {
              toast({
                title: "Erro de Validação",
                description: `Card ${i + 1}: "${imageUrl}" não é uma URL válida de imagem.\n\nUse:\n✅ URLs completas: https://exemplo.com/foto.jpg\n✅ Upload de arquivo (clique em "Escolher arquivo")\n\n❌ Não use texto simples como "ok", "df", etc.`,
                variant: "destructive",
              });
              return;
            }
          }

          if (!card.image || !card.image.trim()) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: imagem é obrigatória`,
              variant: "destructive",
            });
            return;
          }

          if (!Array.isArray(card.buttons) || card.buttons.length === 0) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: adicione pelo menos 1 botão`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      const finalContent = isSpecialType(newTemplate.type)
        ? buildSpecialContent(newTemplate.type, newTemplate)
        : newTemplate.content;

      await createTemplate({
        name: newTemplate.name,
        category: newTemplate.category,
        type: newTemplate.type,
        content: finalContent,
        header: newTemplate.header,
        footer: newTemplate.footer,
        variables,
        buttons: newTemplate.buttons,
        mediaUrl: newTemplate.type === "lista_opcao" ? "" : newTemplate.mediaUrl,
        fileName: newTemplate.type === "lista_opcao" ? "" : newTemplate.fileName,
        fileType: newTemplate.type === "lista_opcao" ? "" : newTemplate.fileType,
        listItems: validListItems,
        carouselCards: newTemplate.carouselCards,
      });

       setNewTemplate({ name: "", category: "", type: "texto", content: "", header: "", footer: "", mediaUrl: "", fileName: "", fileType: "", variables: [], buttons: [], listItems: [], carouselCards: [], ...SPECIAL_FIELD_DEFAULTS, contactBusinessDescription: "", catalogId: "", productId: "", paymentTitle: "", paymentDescription: "", paymentAmount: "", paymentCurrency: "BRL", paymentReferenceId: "" });
       setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleDuplicateTemplate = async (template: any) => {
    const validListItems = Array.isArray(editFormData.listItems)
      ? editFormData.listItems.filter(item => item.title.trim() !== "")
      : [];

    if (editFormData.type === "lista_opcao" && validListItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um item na lista de opções", variant: "destructive" });
      return;
    }

    try {
      await duplicateTemplate(template);
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleDeleteTemplate = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (templateToDelete) {
      try {
        await deleteTemplate(templateToDelete);
      } catch (error) {
        console.error('Error deleting template:', error);
      }
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };


  const handleEditTemplate = (template: any) => {
    const special = parseSpecialContent(template.content) || {};
    const isSpecialContent = typeof template.content === 'string' && template.content.startsWith(SPECIAL_TEMPLATE_PREFIX);
    const cleanContent = isSpecialContent
      ? (special.description ?? "")
      : (template.content ?? "");
    setEditFormData({
      name: template.name,
      category: template.category,
      type: template.type || "texto",
      content: cleanContent,
      header: template.header || "",
      footer: template.footer || "",
      mediaUrl: template.mediaUrl || "",
      fileName: template.fileName || "",
      fileType: template.fileType || "",
      buttons: template.buttons || [],
      listItems: template.listItems || [],
      carouselCards: template.carouselCards || [],
      variables: template.variables || {},
      pixKey: special.pixKey || "",
      pixKeyType: special.pixKeyType || "cpf",
      pixAmount: special.amount || "",
      pixMerchantName: special.merchantName || "",
      pixCity: special.city || "",
      locLatitude: special.latitude || "",
      locLongitude: special.longitude || "",
      locAddress: special.address || "",
      locTitle: special.title || "",
      contactName: special.contactName || "",
      contactBusinessDescription: special.contactBusinessDescription || "",
      catalogId: special.catalogId || "",
      productId: special.productId || "",
      contactPhone: special.contactPhone || "",
      paymentTitle: special.title || "",
      paymentDescription: special.description || "",
      paymentAmount: special.amount ? String(special.amount) : "",
      paymentCurrency: special.currency || "BRL",
      paymentReferenceId: special.referenceId || "",
     });
    setEditingTemplate(template.id);
  };

  const handleUpdateTemplate = async () => {
    if (!editFormData.name || !editFormData.category) {
      toast({
        title: "Erro",
        description: "Preencha nome e categoria",
        variant: "destructive",
      });
      return;
    }
    const editButtonsError = validateButtons(editFormData.buttons);
    if (editButtonsError) {
      toast({ title: "Erro nos botões", description: editButtonsError, variant: "destructive" });
      return;
    }
    if (!isSpecialType(editFormData.type) && !editFormData.content) {
      toast({
        title: "Erro",
        description: "Preencha o conteúdo do modelo",
        variant: "destructive",
      });
      return;
    }
    if (editFormData.type === "pix" && (!editFormData.pixKey || !editFormData.pixMerchantName)) {
      toast({ title: "Erro", description: "Informe a chave PIX e o nome do recebedor", variant: "destructive" });
      return;
    }
    if (editFormData.type === "localizacao" && (!editFormData.locLatitude || !editFormData.locLongitude)) {
      toast({ title: "Erro", description: "Informe latitude e longitude", variant: "destructive" });
      return;
    }
    if (editFormData.type === "contato" && (!editFormData.contactName || !editFormData.contactPhone)) {
      toast({ title: "Erro", description: "Informe nome e telefone do contato", variant: "destructive" });
      return;
    }
    if (editFormData.type === "pagamento" && (!editFormData.paymentTitle || !editFormData.paymentAmount)) {
      toast({ title: "Erro", description: "Informe o título e o valor do pagamento", variant: "destructive" });
      return;
    }

    const validListItems = Array.isArray(editFormData.listItems)
      ? editFormData.listItems.filter(item => item.title.trim() !== "")
      : [];

    if (editFormData.type === "lista_opcao" && validListItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um item na lista de opções", variant: "destructive" });
      return;
    }

    try {
      // Extract variables from content
      const variableMatches = editFormData.content.match(/{([^}]+)}/g);
      const variables = variableMatches 
        ? variableMatches.map(match => match.slice(1, -1))
        : [];

      // Validação específica para carrossel
      if (editFormData.type === "carrossel") {
        if (editFormData.carouselCards.length < 2) {
          toast({
            title: "Erro",
            description: "Carrossel precisa de pelo menos 2 cards",
            variant: "destructive",
          });
          return;
        }
        
        // Validar cada card
        for (let i = 0; i < editFormData.carouselCards.length; i++) {
          const card = editFormData.carouselCards[i];
          
          // Validar campos obrigatórios
          if (!card.title || !card.description) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: Título e descrição são obrigatórios`,
              variant: "destructive",
            });
            return;
          }
          
          // Validar URL da imagem apenas se for texto digitado manualmente (não vazio e não é URL do Supabase)
          if (card.image && card.image.trim() !== '' && !card.image.includes('supabase.co/storage')) {
            const imageUrl = card.image.trim();
            
            // Verificar se é uma URL válida (apenas para URLs digitadas manualmente)
            const isValidUrl = imageUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp)/i);
            
            if (!isValidUrl) {
              toast({
                title: "Erro de Validação",
                description: `Card ${i + 1}: "${imageUrl}" não é uma URL válida de imagem.\n\nUse:\n✅ URLs completas: https://exemplo.com/foto.jpg\n✅ Upload de arquivo (clique em "Escolher arquivo")\n\n❌ Não use texto simples como "ok", "df", etc.`,
                variant: "destructive",
              });
              return;
            }
          }

          if (!card.image || !card.image.trim()) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: imagem é obrigatória`,
              variant: "destructive",
            });
            return;
          }

          if (!Array.isArray(card.buttons) || card.buttons.length === 0) {
            toast({
              title: "Erro",
              description: `Card ${i + 1}: adicione pelo menos 1 botão`,
              variant: "destructive",
            });
            return;
          }
        }
      }

      const finalContent = isSpecialType(editFormData.type)
        ? buildSpecialContent(editFormData.type, editFormData)
        : editFormData.content;

      await updateTemplate(editingTemplate!, {
        name: editFormData.name,
        category: editFormData.category,
        type: editFormData.type,
        content: finalContent,
        header: editFormData.header,
        footer: editFormData.footer,
        variables,
        buttons: editFormData.buttons,
        mediaUrl: editFormData.type === "lista_opcao" ? "" : editFormData.mediaUrl,
        fileName: editFormData.type === "lista_opcao" ? "" : editFormData.fileName,
        fileType: editFormData.type === "lista_opcao" ? "" : editFormData.fileType,
        listItems: validListItems,
        carouselCards: editFormData.carouselCards,
      });

      setEditingTemplate(null);
        setEditFormData({ name: "", category: "", type: "texto", content: "", header: "", footer: "", mediaUrl: "", fileName: "", fileType: "", buttons: [], listItems: [], carouselCards: [], variables: {}, ...SPECIAL_FIELD_DEFAULTS, contactBusinessDescription: "", catalogId: "", productId: "", paymentTitle: "", paymentDescription: "", paymentAmount: "", paymentCurrency: "BRL", paymentReferenceId: "" });
    } catch (error) {
      console.error('Error updating template:', error);
    }
  };

  const sanitizeTemplateTypeChange = (value: string, current: any) => {
    const next = { ...current, type: value };

    if (value === "lista_opcao") {
      next.mediaUrl = "";
      next.fileName = "";
      next.fileType = "";
      next.carouselCards = [];
    }

    if (value !== "lista_opcao") {
      next.listItems = value === "carrossel" ? current.listItems : current.listItems;
    }

    if (!["imagem", "audio", "video", "imagem_botoes", "video_botoes", "arquivo", "documento"].includes(value)) {
      next.mediaUrl = "";
      next.fileName = "";
      next.fileType = "";
    }

    if (value !== "carrossel") {
      next.carouselCards = [];
    }

    return next;
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
      setEditFormData({ name: "", category: "", type: "texto", content: "", header: "", footer: "", mediaUrl: "", fileName: "", fileType: "", buttons: [], listItems: [], carouselCards: [], variables: {}, ...SPECIAL_FIELD_DEFAULTS, contactBusinessDescription: "", catalogId: "", productId: "", paymentTitle: "", paymentDescription: "", paymentAmount: "", paymentCurrency: "BRL", paymentReferenceId: "" });
  };

  const addButton = useCallback((isEdit = false) => {
    const newButton = {
      id: Date.now().toString(),
      text: "",
      type: 'reply' as 'reply' | 'url' | 'call',
      value: "",
    };
    
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        buttons: [...prev.buttons, newButton]
      }));
    } else {
      setNewTemplate(prev => ({
        ...prev,
        buttons: [...prev.buttons, newButton]
      }));
    }
  }, []);

  const updateButton = useCallback((index: number, field: string, value: string, isEdit = false) => {
    if (isEdit) {
      setEditFormData(prev => {
        const newButtons = [...prev.buttons];
        newButtons[index] = { ...newButtons[index], [field]: value };
        return { ...prev, buttons: newButtons };
      });
    } else {
      setNewTemplate(prev => {
        const newButtons = [...prev.buttons];
        newButtons[index] = { ...newButtons[index], [field]: value };
        return { ...prev, buttons: newButtons };
      });
    }
  }, []);

  const removeButton = useCallback((index: number, isEdit = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        buttons: prev.buttons.filter((_, i) => i !== index)
      }));
    } else {
      setNewTemplate(prev => ({
        ...prev,
        buttons: prev.buttons.filter((_, i) => i !== index)
      }));
    }
  }, []);


  if (templatesLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Modelos de Mensagem</h1>

      {/* Campo de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar modelos por nome, categoria ou conteúdo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {categories.map((categoria) => (
            <Button 
              key={categoria} 
              variant={selectedCategory === categoria ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedCategory(categoria)}
            >
              {categoria}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo Modelo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Criar Novo Modelo
                </DialogTitle>
                <DialogDescription>
                  Configure um novo modelo de mensagem com texto personalizado e botões interativos
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto space-y-4 py-4">
                <div>
                  <Label htmlFor="template-name">Nome do Modelo</Label>
                  <Input
                    id="template-name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Saudação Personalizada"
                  />
                </div>
                <div>
                  <Label htmlFor="template-category">Categoria</Label>
                  <Input
                    id="template-category"
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ex: Vendas, Suporte"
                  />
                </div>

                <div>
                  <Label htmlFor="template-type">Tipo de Template</Label>
                  <Select
                    value={newTemplate.type}
                    onValueChange={(value) => setNewTemplate(prev => sanitizeTemplateTypeChange(value, prev))}
                  >
                    <SelectTrigger id="template-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="texto">texto</SelectItem>
                      <SelectItem value="imagem">imagem</SelectItem>
                      <SelectItem value="audio">audio</SelectItem>
                      <SelectItem value="video">video</SelectItem>
                      <SelectItem value="video_botoes">vídeo com botões</SelectItem>
                      <SelectItem value="audio_botoes">áudio com botões</SelectItem>
                      <SelectItem value="lista_opcao">lista de opção</SelectItem>
                      <SelectItem value="copia_cola">copia e cola</SelectItem>
                      <SelectItem value="arquivo">arquivo</SelectItem>
                      <SelectItem value="imagem_botoes">imagem com botões</SelectItem>
                      <SelectItem value="documento">documento</SelectItem>
                      <SelectItem value="carrossel">carrossel</SelectItem>
                       <SelectItem value="pix">PIX (cobrança)</SelectItem>
                       <SelectItem value="produto">produto</SelectItem>
                       <SelectItem value="localizacao">localização</SelectItem>
                       <SelectItem value="contato">contato (vCard)</SelectItem>
                       <SelectItem value="evento">evento</SelectItem>
                       <SelectItem value="status_pedido">status do pedido</SelectItem>
                        <SelectItem value="pagamento_pedido">pagamento do pedido</SelectItem>
                        <SelectItem value="pagamento">solicitar pagamento</SelectItem>
                        <SelectItem value="status">Status (Stories)</SelectItem>
                        <SelectItem value="gateway_billing">cobrança gateway</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠️ Botões funcionam com "imagem com botões", "vídeo com botões" e "áudio com botões"
                  </p>
                </div>

                <SpecialFieldsEditor
                  type={newTemplate.type}
                  data={newTemplate}
                  onChange={(patch) => setNewTemplate(prev => ({ ...prev, ...patch }))}
                />

                {/* Campos específicos por tipo */}
                {(newTemplate.type === "imagem" || newTemplate.type === "audio" || newTemplate.type === "audio_botoes" || newTemplate.type === "video" || newTemplate.type === "imagem_botoes" || newTemplate.type === "video_botoes") && (
                  <div className="space-y-3">
                    <div>
                      <Label>Upload de Arquivo</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept={
                              newTemplate.type === "imagem" || newTemplate.type === "imagem_botoes"
                                ? "image/*"
                                : newTemplate.type === "audio" || newTemplate.type === "audio_botoes"
                                ? "audio/*"
                                : "video/*"
                            }
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, false);
                            }}
                            disabled={uploadingFile}
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Enviando arquivo...
                            </p>
                          )}
                        </div>
                        {newTemplate.mediaUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {newTemplate.mediaUrl && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Arquivo: {newTemplate.fileName}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="template-media-url">Ou cole a URL da Mídia</Label>
                      <Input
                        id="template-media-url"
                        value={newTemplate.mediaUrl}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, mediaUrl: e.target.value }))}
                        placeholder="https://exemplo.com/arquivo.jpg"
                      />
                    </div>
                  </div>
                )}

                {(newTemplate.type === "arquivo" || newTemplate.type === "documento") && (
                  <div className="space-y-3">
                    <div>
                      <Label>Upload de Arquivo</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file, false);
                            }}
                            disabled={uploadingFile}
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Enviando arquivo...
                            </p>
                          )}
                        </div>
                        {newTemplate.mediaUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {newTemplate.mediaUrl && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Arquivo: {newTemplate.fileName}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="template-file-url">Ou cole a URL do Arquivo</Label>
                      <Input
                        id="template-file-url"
                        value={newTemplate.mediaUrl}
                        onChange={(e) => setNewTemplate(prev => ({ ...prev, mediaUrl: e.target.value }))}
                        placeholder="https://exemplo.com/documento.pdf"
                      />
                    </div>
                    {!newTemplate.fileName && newTemplate.mediaUrl && (
                      <div>
                        <Label htmlFor="template-file-name">Nome do Arquivo</Label>
                        <Input
                          id="template-file-name"
                          value={newTemplate.fileName}
                          onChange={(e) => setNewTemplate(prev => ({ ...prev, fileName: e.target.value }))}
                          placeholder="documento.pdf"
                        />
                      </div>
                    )}
                  </div>
                )}

                {newTemplate.type === "lista_opcao" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Itens da Lista</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewTemplate(prev => ({
                          ...prev,
                          listItems: [...prev.listItems, { id: Date.now().toString(), title: "", description: "" }]
                        }))}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Item
                      </Button>
                    </div>
                    {newTemplate.listItems.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Item {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({
                              ...prev,
                              listItems: prev.listItems.filter((_, i) => i !== index)
                            }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Título do item"
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...newTemplate.listItems];
                            newItems[index] = { ...item, title: e.target.value };
                            setNewTemplate(prev => ({ ...prev, listItems: newItems }));
                          }}
                        />
                        <Input
                          placeholder="Descrição (opcional)"
                          value={item.description || ""}
                          onChange={(e) => {
                            const newItems = [...newTemplate.listItems];
                            newItems[index] = { ...item, description: e.target.value };
                            setNewTemplate(prev => ({ ...prev, listItems: newItems }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Editor de Carrossel */}
                {newTemplate.type === "carrossel" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Cards do Carrossel</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewTemplate(prev => ({
                          ...prev,
                          carouselCards: [...prev.carouselCards, {
                            id: Date.now().toString(),
                            image: "",
                            title: "",
                            description: "",
                            buttons: []
                          }]
                        }))}
                        disabled={newTemplate.carouselCards.length >= 10}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Card
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Mínimo 2 cards, máximo 10 cards. Cada card pode ter até 2 botões.
                    </p>
                    {newTemplate.carouselCards.map((card, cardIndex) => (
                      <div key={card.id} className="border-2 rounded-lg p-4 space-y-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Card {cardIndex + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewTemplate(prev => ({
                              ...prev,
                              carouselCards: prev.carouselCards.filter((_, i) => i !== cardIndex)
                            }))}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                        
                    <div>
                      <Label>URL da Imagem *</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const uploadedUrl = await handleFileUpload(file, false);
                                if (uploadedUrl) {
                                  const newCards = [...newTemplate.carouselCards];
                                  newCards[cardIndex] = { ...card, image: uploadedUrl };
                                  setNewTemplate(prev => ({ 
                                    ...prev, 
                                    carouselCards: newCards,
                                    mediaUrl: "" // Limpar para não interferir
                                  }));
                                }
                              }
                            }}
                            disabled={uploadingFile}
                            className="mb-2"
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mb-1">
                              Enviando imagem...
                            </p>
                          )}
                        </div>
                        {card.image && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newCards = [...newTemplate.carouselCards];
                              newCards[cardIndex] = { ...card, image: "" };
                              setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {card.image && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Imagem configurada
                        </p>
                      )}
                    </div>
                        
                        <div>
                          <Label>Título *</Label>
                          <Input
                            placeholder="Título do card"
                            value={card.title}
                            onChange={(e) => {
                              const newCards = [...newTemplate.carouselCards];
                              newCards[cardIndex] = { ...card, title: e.target.value };
                              setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                        </div>
                        
                        <div>
                          <Label>Descrição *</Label>
                          <Textarea
                            placeholder="Descrição do card"
                            value={card.description}
                            rows={4}
                            onChange={(e) => {
                              const newCards = [...newTemplate.carouselCards];
                              newCards[cardIndex] = { ...card, description: e.target.value };
                              setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Botões do Card</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newCards = [...newTemplate.carouselCards];
                                newCards[cardIndex].buttons.push({
                                  id: Date.now().toString(),
                                  text: "",
                                  type: 'url',
                                  value: ""
                                });
                                setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                              }}
                              disabled={card.buttons.length >= 2}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Botão
                            </Button>
                          </div>
                          
                          {card.buttons.map((button, btnIndex) => (
                            <div key={button.id} className="border rounded p-2 space-y-2 bg-background">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium">Botão {btnIndex + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newCards = [...newTemplate.carouselCards];
                                    newCards[cardIndex].buttons = newCards[cardIndex].buttons.filter((_, i) => i !== btnIndex);
                                    setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              
                              <Input
                                placeholder="Texto do botão"
                                value={button.text}
                                maxLength={20}
                                onChange={(e) => {
                                  const newCards = [...newTemplate.carouselCards];
                                  newCards[cardIndex].buttons[btnIndex].text = e.target.value;
                                  setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                }}
                              />
                              
                              <Select
                                value={button.type}
                                onValueChange={(value: 'reply' | 'url' | 'call') => {
                                  const newCards = [...newTemplate.carouselCards];
                                  newCards[cardIndex].buttons[btnIndex].type = value;
                                  setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="url">Link/URL</SelectItem>
                                  <SelectItem value="call">Ligar</SelectItem>
                                  <SelectItem value="reply">Resposta</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              {(button.type === 'url' || button.type === 'call') && (
                                <Input
                                  placeholder={button.type === 'url' ? "https://..." : "+5511999999999"}
                                  value={button.value || ''}
                                  onChange={(e) => {
                                    const newCards = [...newTemplate.carouselCards];
                                    newCards[cardIndex].buttons[btnIndex].value = e.target.value;
                                    setNewTemplate(prev => ({ ...prev, carouselCards: newCards }));
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {newTemplate.carouselCards.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                        Clique em "Adicionar Card" para criar os cards do carrossel
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <Label htmlFor="template-header">Título/Cabeçalho da Mensagem (opcional)</Label>
                  <Input
                    id="template-header"
                    value={newTemplate.header}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, header: e.target.value }))}
                    placeholder="Ex: Oferta Especial"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Aparece no topo da mensagem no WhatsApp</p>
                </div>
                
                <div>
                  <Label htmlFor="template-content">Conteúdo do Modelo</Label>
                  <Textarea
                    id="template-content"
                    value={newTemplate.content}
                    onChange={(e) => {
                      setNewTemplate(prev => ({ ...prev, content: e.target.value }));
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder="Digite o conteúdo do modelo..."
                    rows={4}
                    className="min-h-[100px] resize-none overflow-hidden"
                    style={{ height: 'auto' }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                      }
                    }}
                  />
                </div>
                
                <div>
                  <Label htmlFor="template-footer">Rodapé da Mensagem (opcional)</Label>
                  <Input
                    id="template-footer"
                    value={newTemplate.footer}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, footer: e.target.value }))}
                    placeholder="Ex: Empresa XYZ - www.exemplo.com"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Aparece no final da mensagem no WhatsApp</p>
                </div>

                <ButtonEditor 
                  buttons={newTemplate.buttons} 
                  isEdit={false} 
                  onAddButton={addButton}
                  onUpdateButton={updateButton}
                  onRemoveButton={removeButton}
                />

                <div className="bg-muted/50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium mb-1">Variáveis Disponíveis:</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><code>{"{nome}"}</code> - Nome do contato</div>
                    <div><code>{"{empresa}"}</code> - Nome da empresa</div>
                    <div><code>{"{data}"}</code> - Data atual</div>
                    <div><code>{"{hora}"}</code> - Hora atual</div>
                  </div>
                </div>
              </form>

              <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="button" onClick={handleCreateTemplate} className="w-full sm:w-auto">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Modelo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="min-h-[220px] flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  {getTemplateIcon(template.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm truncate">{template.name}</CardTitle>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{template.category}</Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {getTypeFriendlyName(template.type)}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-0">
              <div>
                <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                  {getDisplayContent(template)}
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {template.header && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">📋 Header</Badge>
                  )}
                  {template.mediaUrl && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">🔗 Mídia</Badge>
                  )}
                  {template.footer && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">📝 Rodapé</Badge>
                  )}
                  {template.buttons && template.buttons.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">🔘 {template.buttons.length} botões</Badge>
                  )}
                  {template.carouselCards && template.carouselCards.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">🎠 {template.carouselCards.length} cards</Badge>
                  )}
                  {template.listItems && template.listItems.length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">📋 {template.listItems.length} itens</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Usado {loadingUsage ? "..." : (realUsage[template.id] ?? template.usage_count ?? 0)}x
                </p>
              </div>
              <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPreviewTemplate(template)}>
                  <Eye className="w-3 h-3 mr-1" /> Prévia
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => navigator.clipboard.writeText(template.content)}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleEditTemplate(template)}>
                  <Edit className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleDuplicateTemplate(template)}>
                  <Copy className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => handleDeleteTemplate(template.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredTemplates.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {selectedCategory === "Todos" 
                  ? "Nenhum modelo encontrado. Crie seu primeiro modelo!" 
                  : `Nenhum modelo encontrado na categoria "${selectedCategory}".`
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Edição */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => {
        if (!open) handleCancelEdit();
      }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Editar Modelo
            </DialogTitle>
            <DialogDescription>
              Modifique as configurações do modelo de mensagem
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => e.preventDefault()} className="flex-1 overflow-y-auto space-y-4 py-4">
            <div>
              <Label htmlFor="edit-template-name">Nome do Modelo</Label>
              <Input
                id="edit-template-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Saudação Personalizada"
              />
            </div>
            <div>
              <Label htmlFor="edit-template-category">Categoria</Label>
              <Input
                id="edit-template-category"
                value={editFormData.category}
                onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: Vendas, Suporte"
              />
            </div>

            <div>
              <Label htmlFor="edit-template-type">Tipo de Template</Label>
              <Select
                value={editFormData.type}
                onValueChange={(value) => setEditFormData(prev => sanitizeTemplateTypeChange(value, prev))}
              >
                <SelectTrigger id="edit-template-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="texto">texto</SelectItem>
                  <SelectItem value="imagem">imagem</SelectItem>
                  <SelectItem value="audio">audio</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="video_botoes">vídeo com botões</SelectItem>
                  <SelectItem value="audio_botoes">áudio com botões</SelectItem>
                  <SelectItem value="lista_opcao">lista de opção</SelectItem>
                  <SelectItem value="copia_cola">copia e cola</SelectItem>
                  <SelectItem value="arquivo">arquivo</SelectItem>
                  <SelectItem value="imagem_botoes">imagem com botões</SelectItem>
                  <SelectItem value="documento">documento</SelectItem>
                  <SelectItem value="carrossel">carrossel</SelectItem>
                   <SelectItem value="pix">PIX (cobrança)</SelectItem>
                   <SelectItem value="produto">produto</SelectItem>
                   <SelectItem value="localizacao">localização</SelectItem>
                   <SelectItem value="contato">contato (vCard)</SelectItem>
                   <SelectItem value="evento">evento</SelectItem>
                   <SelectItem value="status_pedido">status do pedido</SelectItem>
                    <SelectItem value="pagamento_pedido">pagamento do pedido</SelectItem>
                    <SelectItem value="pagamento">solicitar pagamento</SelectItem>
                    <SelectItem value="gateway_billing">cobrança gateway</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                ⚠️ Botões funcionam com "imagem com botões", "vídeo com botões" e "áudio com botões"
              </p>
            </div>

            <SpecialFieldsEditor
              type={editFormData.type}
              data={editFormData}
              onChange={(patch) => setEditFormData(prev => ({ ...prev, ...patch }))}
            />

            {/* Campos específicos por tipo - Edição */}
            {(editFormData.type === "imagem" || editFormData.type === "audio" || editFormData.type === "audio_botoes" || editFormData.type === "video" || editFormData.type === "imagem_botoes" || editFormData.type === "video_botoes") && (
              <div className="space-y-3">
                <div>
                  <Label>Upload de Arquivo</Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept={
                          editFormData.type === "imagem" || editFormData.type === "imagem_botoes"
                            ? "image/*"
                            : editFormData.type === "audio" || editFormData.type === "audio_botoes"
                            ? "audio/*"
                            : "video/*"
                        }
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, true);
                        }}
                        disabled={uploadingFile}
                      />
                      {uploadingFile && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviando arquivo...
                        </p>
                      )}
                    </div>
                    {editFormData.mediaUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {editFormData.mediaUrl && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Arquivo: {editFormData.fileName}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="edit-template-media-url">Ou cole a URL da Mídia</Label>
                  <Input
                    id="edit-template-media-url"
                    value={editFormData.mediaUrl}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, mediaUrl: e.target.value }))}
                    placeholder="https://exemplo.com/arquivo.jpg"
                  />
                </div>
              </div>
            )}

            {(editFormData.type === "arquivo" || editFormData.type === "documento") && (
              <div className="space-y-3">
                <div>
                  <Label>Upload de Arquivo</Label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, true);
                        }}
                        disabled={uploadingFile}
                      />
                      {uploadingFile && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviando arquivo...
                        </p>
                      )}
                    </div>
                    {editFormData.mediaUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({ ...prev, mediaUrl: "", fileName: "", fileType: "" }))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {editFormData.mediaUrl && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Arquivo: {editFormData.fileName}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="edit-template-file-url">Ou cole a URL do Arquivo</Label>
                  <Input
                    id="edit-template-file-url"
                    value={editFormData.mediaUrl}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, mediaUrl: e.target.value }))}
                    placeholder="https://exemplo.com/documento.pdf"
                  />
                </div>
                {!editFormData.fileName && editFormData.mediaUrl && (
                  <div>
                    <Label htmlFor="edit-template-file-name">Nome do Arquivo</Label>
                    <Input
                      id="edit-template-file-name"
                      value={editFormData.fileName}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, fileName: e.target.value }))}
                      placeholder="documento.pdf"
                    />
                  </div>
                )}
              </div>
            )}

            {editFormData.type === "lista_opcao" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Itens da Lista</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditFormData(prev => ({
                      ...prev,
                      listItems: [...prev.listItems, { id: Date.now().toString(), title: "", description: "" }]
                    }))}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>
                {editFormData.listItems.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({
                          ...prev,
                          listItems: prev.listItems.filter((_, i) => i !== index)
                        }))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Título do item"
                      value={item.title}
                      onChange={(e) => {
                        const newItems = [...editFormData.listItems];
                        newItems[index] = { ...item, title: e.target.value };
                        setEditFormData(prev => ({ ...prev, listItems: newItems }));
                      }}
                    />
                    <Input
                      placeholder="Descrição (opcional)"
                      value={item.description || ""}
                      onChange={(e) => {
                        const newItems = [...editFormData.listItems];
                        newItems[index] = { ...item, description: e.target.value };
                        setEditFormData(prev => ({ ...prev, listItems: newItems }));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Editor de Carrossel - Edição */}
            {editFormData.type === "carrossel" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Cards do Carrossel</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditFormData(prev => ({
                      ...prev,
                      carouselCards: [...prev.carouselCards, {
                        id: Date.now().toString(),
                        image: "",
                        title: "",
                        description: "",
                        buttons: []
                      }]
                    }))}
                    disabled={editFormData.carouselCards.length >= 10}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Card
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 2 cards, máximo 10 cards. Cada card pode ter até 2 botões.
                </p>
                {editFormData.carouselCards.map((card, cardIndex) => (
                  <div key={card.id} className="border-2 rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Card {cardIndex + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditFormData(prev => ({
                          ...prev,
                          carouselCards: prev.carouselCards.filter((_, i) => i !== cardIndex)
                        }))}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                    
                    <div>
                      <Label>URL da Imagem *</Label>
                      <div className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const uploadedUrl = await handleFileUpload(file, true);
                                if (uploadedUrl) {
                                  const newCards = [...editFormData.carouselCards];
                                  newCards[cardIndex] = { ...card, image: uploadedUrl };
                                  setEditFormData(prev => ({ 
                                    ...prev, 
                                    carouselCards: newCards,
                                    mediaUrl: "" // Limpar para não interferir
                                  }));
                                }
                              }
                            }}
                            disabled={uploadingFile}
                            className="mb-2"
                          />
                          {uploadingFile && (
                            <p className="text-xs text-muted-foreground mb-1">
                              Enviando imagem...
                            </p>
                          )}
                        </div>
                        {card.image && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newCards = [...editFormData.carouselCards];
                              newCards[cardIndex] = { ...card, image: "" };
                              setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {card.image && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Imagem configurada
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label>Título *</Label>
                      <Input
                        placeholder="Título do card"
                        value={card.title}
                        onChange={(e) => {
                          const newCards = [...editFormData.carouselCards];
                          newCards[cardIndex] = { ...card, title: e.target.value };
                          setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                        }}
                      />
                    </div>
                    
                    <div>
                      <Label>Descrição *</Label>
                      <Textarea
                        placeholder="Descrição do card"
                        value={card.description}
                        rows={4}
                        onChange={(e) => {
                          const newCards = [...editFormData.carouselCards];
                          newCards[cardIndex] = { ...card, description: e.target.value };
                          setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Botões do Card</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newCards = [...editFormData.carouselCards];
                            newCards[cardIndex].buttons.push({
                              id: Date.now().toString(),
                              text: "",
                              type: 'url',
                              value: ""
                            });
                            setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                          }}
                          disabled={card.buttons.length >= 2}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Botão
                        </Button>
                      </div>
                      
                      {card.buttons.map((button, btnIndex) => (
                        <div key={button.id} className="border rounded p-2 space-y-2 bg-background">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Botão {btnIndex + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newCards = [...editFormData.carouselCards];
                                newCards[cardIndex].buttons = newCards[cardIndex].buttons.filter((_, i) => i !== btnIndex);
                                setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          
                          <Input
                            placeholder="Texto do botão"
                            value={button.text}
                            maxLength={20}
                            onChange={(e) => {
                              const newCards = [...editFormData.carouselCards];
                              newCards[cardIndex].buttons[btnIndex].text = e.target.value;
                              setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          />
                          
                          <Select
                            value={button.type}
                            onValueChange={(value: 'reply' | 'url' | 'call') => {
                              const newCards = [...editFormData.carouselCards];
                              newCards[cardIndex].buttons[btnIndex].type = value;
                              setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="url">Link/URL</SelectItem>
                              <SelectItem value="call">Ligar</SelectItem>
                              <SelectItem value="reply">Resposta</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {(button.type === 'url' || button.type === 'call') && (
                            <Input
                              placeholder={button.type === 'url' ? "https://..." : "+5511999999999"}
                              value={button.value || ''}
                              onChange={(e) => {
                                const newCards = [...editFormData.carouselCards];
                                newCards[cardIndex].buttons[btnIndex].value = e.target.value;
                                setEditFormData(prev => ({ ...prev, carouselCards: newCards }));
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {editFormData.carouselCards.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Clique em "Adicionar Card" para criar os cards do carrossel
                  </div>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="edit-template-header">Título/Cabeçalho da Mensagem (opcional)</Label>
              <Input
                id="edit-template-header"
                value={editFormData.header}
                onChange={(e) => setEditFormData(prev => ({ ...prev, header: e.target.value }))}
                placeholder="Ex: Oferta Especial"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">Aparece no topo da mensagem no WhatsApp</p>
            </div>
            
            <div>
              <Label htmlFor="edit-template-content">Conteúdo do Modelo</Label>
              <Textarea
                id="edit-template-content"
                value={editFormData.content}
                onChange={(e) => {
                  setEditFormData(prev => ({ ...prev, content: e.target.value }));
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="Digite o conteúdo do modelo..."
                rows={4}
                className="min-h-[100px] resize-none overflow-hidden"
                style={{ height: 'auto' }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }
                }}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-template-footer">Rodapé da Mensagem (opcional)</Label>
              <Input
                id="edit-template-footer"
                value={editFormData.footer}
                onChange={(e) => setEditFormData(prev => ({ ...prev, footer: e.target.value }))}
                placeholder="Ex: Empresa XYZ - www.exemplo.com"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">Aparece no final da mensagem no WhatsApp</p>
            </div>

                          <ButtonEditor 
                            buttons={editFormData.buttons} 
                            isEdit={true} 
                            onAddButton={addButton}
                            onUpdateButton={updateButton}
                            onRemoveButton={removeButton}
                          />

            <div className="bg-muted/50 p-3 rounded-lg">
              <h4 className="text-sm font-medium mb-1">Variáveis Disponíveis:</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div><code>{"{nome}"}</code> - Nome do contato</div>
                <div><code>{"{empresa}"}</code> - Nome da empresa</div>
                <div><code>{"{data}"}</code> - Data atual</div>
                <div><code>{"{hora}"}</code> - Hora atual</div>
              </div>
            </div>
          </form>
          
          <DialogFooter className="flex-shrink-0 flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCancelEdit} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="button" onClick={handleUpdateTemplate} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Prévia WhatsApp */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl border-0">
          <div className="flex flex-col h-[600px]">
            <div className="bg-[hsl(142,70%,35%)] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">Prévia da Mensagem</p>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> online
                </p>
              </div>
            </div>

            <div
              className="flex-1 p-4 space-y-2 overflow-y-auto"
              style={{ backgroundColor: '#e5ddd5' }}
            >
              {previewTemplate && (
                previewTemplate.type === 'copia_cola' || (typeof previewTemplate.content === 'string' && previewTemplate.content.startsWith(SPECIAL_TEMPLATE_PREFIX) && parseSpecialContent(previewTemplate.content)?.type === 'copia_cola') ? (
                  (() => {
                    const special = parseSpecialContent(previewTemplate.content || '') || {};
                    const vars = (previewTemplate.variables && typeof previewTemplate.variables === 'object' && !Array.isArray(previewTemplate.variables))
                      ? previewTemplate.variables as Record<string, any>
                      : {};
                    const copyText = special.copyText || vars.copyText || previewTemplate.header || special.description || '';
                    const bodyText = special.description || previewTemplate.name || 'Toque em copiar para usar o conteúdo';
                    return (
                      <div className="flex justify-end">
                        <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm">
                          <div className="px-3 py-2 space-y-2">
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{bodyText}</p>
                            {copyText && (
                              <div className="rounded-md bg-background/60 border border-border/40 px-2 py-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Texto para copiar</p>
                                <p className="text-xs font-mono text-foreground whitespace-pre-wrap break-all leading-snug">{copyText}</p>
                              </div>
                            )}
                            {previewTemplate.footer && (
                              <p className="text-xs text-muted-foreground italic">{previewTemplate.footer}</p>
                            )}
                            <div className="flex items-center justify-end gap-1 pt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <Check className="w-3 h-3 text-blue-500" />
                              <Check className="w-3 h-3 text-blue-500 -ml-2" />
                            </div>
                          </div>
                          <div className="border-t border-border/30 text-center py-2 text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center justify-center gap-1">
                            <Copy className="w-3 h-3" /> Copiar
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (previewTemplate.type === 'pix' || (typeof previewTemplate.content === 'string' && previewTemplate.content.startsWith(SPECIAL_TEMPLATE_PREFIX) && parseSpecialContent(previewTemplate.content)?.type === 'pix')) ? (
                  (() => {
                    const special = parseSpecialContent(previewTemplate.content || '') || {};
                    const amount = special.amount
                      ? `R$ ${Number(String(special.amount).replace(',', '.')).toFixed(2).replace('.', ',')}`
                      : '';
                    return (
                      <div className="flex justify-end">
                        <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm overflow-hidden">
                          <div className="px-3 py-2 space-y-2">
                            <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                              <span className="text-base">💸</span>
                              <p className="text-sm font-semibold text-foreground">Cobrança PIX</p>
                            </div>
                            {amount && (
                              <p className="text-lg font-bold text-foreground">{amount}</p>
                            )}
                            {special.description && (
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{special.description}</p>
                            )}
                            {special.pixKey && (
                              <div className="rounded-md bg-background/60 border border-border/40 px-2 py-1.5 space-y-0.5">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Chave {special.pixKeyType ? `(${special.pixKeyType})` : ''}
                                </p>
                                <p className="text-xs font-mono text-foreground break-all">{special.pixKey}</p>
                              </div>
                            )}
                            {special.city && (
                              <p className="text-[11px] text-muted-foreground">📍 {special.city}</p>
                            )}
                            {previewTemplate.footer && (
                              <p className="text-xs text-muted-foreground italic">{previewTemplate.footer}</p>
                            )}
                          </div>
                          {previewTemplate.buttons && previewTemplate.buttons.length > 0 && (
                            <div className="border-t border-border/30">
                              {previewTemplate.buttons.map((btn: any) => (
                                <div
                                  key={btn.id}
                                  className="text-center py-2 text-sm text-blue-600 dark:text-blue-400 font-medium border-b border-border/20 last:border-0"
                                >
                                  {btn.text}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (previewTemplate.type === 'localizacao' || (typeof previewTemplate.content === 'string' && previewTemplate.content.startsWith(SPECIAL_TEMPLATE_PREFIX) && parseSpecialContent(previewTemplate.content)?.type === 'localizacao')) ? (
                  (() => {
                    const special = parseSpecialContent(previewTemplate.content || '') || {};
                    const lat = Number(String(special.latitude ?? '').replace(',', '.'));
                    const lng = Number(String(special.longitude ?? '').replace(',', '.'));
                    const hasCoords = !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
                    const delta = 0.005;
                    const bbox = hasCoords
                      ? `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
                      : null;
                    const mapUrl = hasCoords
                      ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
                      : null;
                    return (
                      <div className="flex justify-end">
                        <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm overflow-hidden">
                          {hasCoords && (
                            <a
                              href={`https://www.google.com/maps?q=${lat},${lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block bg-muted relative"
                            >
                              <iframe
                                src={mapUrl!}
                                title="Mapa"
                                className="w-full h-36 border-0 pointer-events-none"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <MapPin className="w-8 h-8 text-red-600 drop-shadow-lg" />
                              </div>
                            </a>
                          )}
                          <div className="px-3 py-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-foreground" />
                              <p className="text-sm font-semibold text-foreground">
                                {special.title || previewTemplate.name || 'Localização'}
                              </p>
                            </div>
                            {special.address && (
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{special.address}</p>
                            )}
                            {hasCoords && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {lat.toFixed(6)}, {lng.toFixed(6)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (previewTemplate.type === 'contato' || (typeof previewTemplate.content === 'string' && previewTemplate.content.startsWith(SPECIAL_TEMPLATE_PREFIX) && parseSpecialContent(previewTemplate.content)?.type === 'contato')) ? (
                  (() => {
                    const special = parseSpecialContent(previewTemplate.content || '') || {};
                    const name = special.contactName || previewTemplate.name || 'Contato';
                    const phone = special.contactPhone || '';
                    return (
                      <div className="flex justify-end">
                        <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm overflow-hidden min-w-[240px]">
                          <div className="px-3 py-3 flex items-center gap-3 border-b border-border/30">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <UserIcon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                              {phone && (
                                <p className="text-xs text-muted-foreground truncate">{phone}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-center py-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                            Adicionar contato
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (previewTemplate.type === 'pagamento' || (typeof previewTemplate.content === 'string' && previewTemplate.content.startsWith(SPECIAL_TEMPLATE_PREFIX) && parseSpecialContent(previewTemplate.content)?.type === 'pagamento')) ? (
                  (() => {
                    const special = parseSpecialContent(previewTemplate.content || '') || {};
                    const amount = special.amount
                      ? `${special.currency || 'BRL'} ${Number(special.amount).toFixed(2).replace('.', ',')}`
                      : '';
                    return (
                      <div className="flex justify-end">
                        <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm overflow-hidden min-w-[240px]">
                          <div className="px-4 py-3 space-y-2">
                            <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                              <CreditCard className="w-4 h-4 text-primary" />
                              <p className="text-sm font-bold text-foreground">{special.title || 'Solicitação de Pagamento'}</p>
                            </div>
                            {amount && (
                              <p className="text-xl font-black text-foreground">{amount}</p>
                            )}
                            {special.description && (
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{special.description}</p>
                            )}
                            {special.referenceId && (
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground pt-1">Ref: {special.referenceId}</p>
                            )}
                            {previewTemplate.footer && (
                              <p className="text-xs text-muted-foreground italic pt-1 border-t border-border/10">{previewTemplate.footer}</p>
                            )}
                          </div>
                          <div className="border-t border-border/30 bg-primary/5 text-center py-2.5 text-sm text-primary font-bold">
                            Pagar agora
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : previewTemplate.type === 'carrossel' && Array.isArray(previewTemplate.carouselCards) && previewTemplate.carouselCards.length > 0 ? (
                  <div className="flex flex-col gap-2 items-end">
                    {previewTemplate.content && (
                      <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm px-3 py-2">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {previewTemplate.content}
                        </p>
                      </div>
                    )}
                    <div className="w-full overflow-x-auto pb-2 -mx-2 px-2">
                      <div className="flex gap-2 snap-x snap-mandatory">
                        {previewTemplate.carouselCards.map((card: any, idx: number) => (
                          <div
                            key={card.id || idx}
                            className="snap-start shrink-0 w-[78%] bg-background rounded-lg shadow-sm overflow-hidden border border-border/40 flex flex-col"
                          >
                            {card.image ? (
                              <img
                                src={card.image}
                                alt={card.title || `Card ${idx + 1}`}
                                className="w-full aspect-square object-cover bg-muted"
                              />
                            ) : (
                              <div className="w-full aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                <Image className="w-6 h-6" />
                              </div>
                            )}
                            <div className="px-3 py-2 space-y-1">
                              {card.title && (
                                <p className="font-semibold text-sm text-foreground leading-tight">{card.title}</p>
                              )}
                              {card.description && (
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-snug">{card.description}</p>
                              )}
                            </div>
                            {Array.isArray(card.buttons) && card.buttons.length > 0 && (
                              <div className="border-t border-border/30 mt-auto">
                                {card.buttons.map((btn: any, bIdx: number) => (
                                  <div
                                    key={btn.id || bIdx}
                                    className="text-center py-2 text-sm text-blue-600 dark:text-blue-400 font-medium border-b border-border/20 last:border-0 flex items-center justify-center gap-1"
                                  >
                                    {btn.type === 'url' && <Link className="w-3 h-3" />}
                                    {btn.type === 'call' && <Phone className="w-3 h-3" />}
                                    {btn.type === 'reply' && <MessageCircle className="w-3 h-3" />}
                                    <span className="truncate">{btn.text || `Botão ${bIdx + 1}`}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground self-end pr-1">
                      ◀ Deslize para ver os {previewTemplate.carouselCards.length} cards ▶
                    </p>
                  </div>
                ) : (
                <div className="flex justify-end">
                  <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm">
                    {previewTemplate.mediaUrl && isImageTemplateType(previewTemplate.type) && (
                      <img src={previewTemplate.mediaUrl} alt="Mídia" className="w-full rounded-t-lg object-cover max-h-48" />
                    )}
                    {previewTemplate.mediaUrl && isVideoTemplateType(previewTemplate.type) && (
                      <video
                        src={previewTemplate.mediaUrl}
                        className="w-full rounded-t-lg object-cover max-h-48 bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    )}
                    {previewTemplate.mediaUrl && isAudioTemplateType(previewTemplate.type) && (
                      <div className="px-3 pt-3">
                        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Music className="w-4 h-4 text-primary" />
                            <span>Áudio</span>
                          </div>
                          <button
                            type="button"
                            onClick={togglePreviewAudio}
                            className="flex w-full items-center gap-3 rounded-lg bg-muted/70 px-3 py-3 text-left transition-colors hover:bg-muted"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              {isPreviewAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-border/70">
                                <span className={`block h-full rounded-full bg-primary transition-all ${isPreviewAudioPlaying ? 'w-2/3' : 'w-1/4'}`} />
                              </span>
                              <span className="mt-2 block truncate text-xs text-muted-foreground">
                                {isPreviewAudioPlaying ? 'Reproduzindo áudio…' : 'Toque para reproduzir o áudio'}
                              </span>
                            </span>
                          </button>
                          <audio
                            ref={previewAudioRef}
                            src={previewTemplate.mediaUrl}
                            preload="metadata"
                            className="hidden"
                            onPlay={() => setIsPreviewAudioPlaying(true)}
                            onPause={() => setIsPreviewAudioPlaying(false)}
                            onEnded={() => setIsPreviewAudioPlaying(false)}
                          />
                        </div>
                      </div>
                    )}
                    {previewTemplate.mediaUrl && isDocumentTemplateType(previewTemplate.type) && (
                      <div className="px-3 pt-3">
                        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileType className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{getPreviewFileLabel(previewTemplate)}</p>
                            <p className="text-xs text-muted-foreground">Arquivo anexado</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="px-3 py-2 space-y-1">
                      {previewTemplate.header && (
                        <p className="font-bold text-sm text-foreground">{previewTemplate.header}</p>
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {previewTemplate.content}
                      </p>
                      {previewTemplate.footer && (
                        <p className="text-xs text-muted-foreground italic">{previewTemplate.footer}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 pt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Check className="w-3 h-3 text-blue-500" />
                        <Check className="w-3 h-3 text-blue-500 -ml-2" />
                      </div>
                    </div>
                    {previewTemplate.buttons && previewTemplate.buttons.length > 0 && (
                      <div className="border-t border-border/30">
                        {previewTemplate.buttons.map((btn: any) => (
                          <div key={btn.id} className="text-center py-2 text-sm text-blue-600 dark:text-blue-400 font-medium border-b border-border/20 last:border-0">
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {(
                      (previewTemplate.type === 'lista_opcao'
                        || previewTemplate.type === 'lista'
                        || previewTemplate.type === 'lista de opção')
                      && previewTemplate.listItems
                      && previewTemplate.listItems.length > 0
                    ) && (
                      <div className="border-t border-border/30 px-3 py-2">
                        <div className="bg-background/50 rounded p-2 text-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                          📋 Ver opções ({previewTemplate.listItems.length})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )
              )}
            </div>

            <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 border-t border-border">
              <div className="flex-1 bg-background rounded-full px-4 py-2 text-xs text-muted-foreground">Mensagem</div>
              <div className="w-8 h-8 rounded-full bg-[hsl(142,70%,35%)] flex items-center justify-center">
                <Phone className="w-4 h-4 text-white rotate-[135deg]" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este modelo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-destructive hover:bg-destructive/90">
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Modelos;