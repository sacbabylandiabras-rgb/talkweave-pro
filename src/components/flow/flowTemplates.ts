import type { Node, Edge } from "reactflow";
import type { LucideIcon } from "lucide-react";
import {
  Hand,
  Target,
  ListChecks,
  ShoppingCart,
  Star,
  Megaphone,
  Flame,
  Rocket,
  CalendarDays,
  BarChart3,
  RefreshCw,
  LayoutTemplate,
} from "lucide-react";

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  mode: "contacts" | "groups" | "both";
  nodes: Node[];
  edges: Edge[];
  suggestedKeyword?: string;
  isSpecial?: boolean;
}

const createInitialNode = (id: string): Node => ({
  id,
  type: "blocoInicial",
  position: { x: 250, y: 50 },
  data: { label: "Bloco Inicial", description: "Seu fluxo começa por este bloco. Conecte com outro bloco." },
});

const edge = (source: string, target: string, sourceHandle?: string): Edge => ({
  id: `e-${source}-${target}${sourceHandle ? `-${sourceHandle}` : ""}`,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
  animated: true,
  style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
});

export const FLOW_TEMPLATES: FlowTemplate[] = [
  // ===== ESPECIAL =====
  {
    id: "recuperacao-vendas",
    name: "Recuperação de Vendas",
    description: "Modelo pronto para recuperar carrinhos e pix pendentes usando IA.",
    icon: LayoutTemplate,
    color: "text-green-500",
    mode: "contacts",
    isSpecial: true,
    nodes: [
      {
        id: "rv-1",
        type: "blocoGatilho",
        position: { x: 250, y: 50 },
        data: { 
          label: "Checkout Webhook", 
          description: "Recebe eventos do seu checkout (Hotmart, Kiwify, etc)",
          isWebhook: true 
        },
      },
      {
        id: "rv-2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Coletar Dados",
          contentType: "text",
          content: "Olá! Vi que você tentou comprar em nossa loja. Qual o seu melhor e-mail para eu te enviar um cupom?",
          captureEmail: true,
        },
      },
      {
        id: "rv-3",
        type: "agenteIA",
        position: { x: 250, y: 400 },
        data: {
          label: "Agente de Recuperação",
          model: "claude-sonnet-4-5-20250929",
          prompt: "Você é um especialista em recuperação de vendas. Seu objetivo é ajudar o cliente a concluir a compra, tirando dúvidas e oferecendo suporte.",
        },
      },
      {
        id: "rv-4",
        type: "blocoAcao",
        position: { x: 450, y: 130 },
        data: {
          label: "Aguardar Remarketing",
          actionType: "delay",
          delaySeconds: 259200, // Default 3 days
        }
      },
    ],
    edges: [
      edge("rv-1", "rv-4"),
      edge("rv-4", "rv-2"),
      edge("rv-2", "rv-3")
    ],
  },
  // ===== CONTATOS =====
  {
    id: "boas-vindas",
    name: "Boas-vindas",
    description: "Saudação inicial + apresentação rápida da empresa.",
    icon: Hand,
    color: "text-sky-500",
    mode: "contacts",
    suggestedKeyword: "oi",
    nodes: [
      createInitialNode("bv-1"),
      {
        id: "bv-2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Saudação",
          contentType: "text",
          content: "Olá {{nome}}! 👋 Seja muito bem-vindo(a)! Como posso te ajudar hoje?",
        },
      },
      {
        id: "bv-3",
        type: "blocoConteudo",
        position: { x: 250, y: 400 },
        data: {
          label: "Apresentação",
          contentType: "text",
          content: "Somos especialistas em ajudar você a alcançar seus objetivos. Me conte um pouco sobre o que procura. 😊",
          delay: 3,
        },
      },
    ],
    edges: [edge("bv-1", "bv-2"), edge("bv-2", "bv-3")],
  },
  {
    id: "qualificacao-lead",
    name: "Qualificação de Lead",
    description: "Captura nome, WhatsApp e e-mail antes de seguir.",
    icon: Target,
    color: "text-violet-500",
    mode: "contacts",
    suggestedKeyword: "quero",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Pedir nome",
          contentType: "text",
          content: "Que ótimo ter você por aqui! Para começar, qual é o seu nome?",
          captureName: true,
        },
      },
      {
        id: "3",
        type: "blocoConteudo",
        position: { x: 250, y: 400 },
        data: {
          label: "Pedir e-mail",
          contentType: "text",
          content: "Prazer, {{nome}}! Pode me passar seu melhor e-mail?",
          captureEmail: true,
        },
      },
      {
        id: "4",
        type: "blocoConteudo",
        position: { x: 250, y: 580 },
        data: {
          label: "Confirmação",
          contentType: "text",
          content: "Perfeito! Em instantes um especialista vai falar com você. ✅",
        },
      },
    ],
    edges: [edge("1", "2"), edge("2", "3"), edge("3", "4")],
  },
  {
    id: "menu-interativo",
    name: "Menu de Atendimento",
    description: "Menu com botões para direcionar o cliente.",
    icon: ListChecks,
    color: "text-indigo-500",
    mode: "contacts",
    suggestedKeyword: "menu",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Menu",
          contentType: "text",
          content: "Olá {{nome}}! Como podemos te ajudar?",
          buttons: [
            { label: "Comprar", payload: "comprar" },
            { label: "Suporte", payload: "suporte" },
            { label: "Falar com humano", payload: "humano" },
          ],
        },
      },
    ],
    edges: [edge("1", "2")],
  },
  {
    id: "recuperacao-carrinho",
    name: "Recuperação de Carrinho",
    description: "Lembrete + cupom de desconto após carrinho abandonado.",
    icon: ShoppingCart,
    color: "text-amber-500",
    mode: "contacts",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Lembrete",
          contentType: "text",
          content: "Oi {{nome}}! Vi que você deixou alguns itens no carrinho. Está com alguma dúvida? 🛒",
        },
      },
      {
        id: "3",
        type: "blocoAcao",
        position: { x: 250, y: 400 },
        data: {
          label: "Aguardar 30 min",
          actionType: "delay",
          delaySeconds: 1800,
        },
      },
      {
        id: "4",
        type: "blocoConteudo",
        position: { x: 250, y: 580 },
        data: {
          label: "Oferta",
          contentType: "text",
          content: "Para te ajudar a decidir, separei um cupom exclusivo de 10% OFF: VOLTA10 🎁",
        },
      },
    ],
    edges: [edge("1", "2"), edge("2", "3"), edge("3", "4")],
  },
  {
    id: "pos-venda",
    name: "Pós-venda",
    description: "Agradecimento + pesquisa de satisfação.",
    icon: Star,
    color: "text-yellow-500",
    mode: "contacts",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Agradecimento",
          contentType: "text",
          content: "Obrigado pela sua compra, {{nome}}! 🎉 Estamos preparando tudo com muito carinho.",
        },
      },
      {
        id: "3",
        type: "blocoAcao",
        position: { x: 250, y: 400 },
        data: {
          label: "Aguardar 2 dias",
          actionType: "delay",
          delaySeconds: 172800,
        },
      },
      {
        id: "4",
        type: "blocoConteudo",
        position: { x: 250, y: 580 },
        data: {
          label: "Pesquisa",
          contentType: "text",
          content: "{{nome}}, como foi sua experiência conosco? Sua opinião é muito importante! ⭐",
          buttons: [
            { label: "Excelente", payload: "5" },
            { label: "Boa", payload: "4" },
            { label: "Regular", payload: "3" },
          ],
        },
      },
    ],
    edges: [edge("1", "2"), edge("2", "3"), edge("3", "4")],
  },

  // ===== GRUPOS =====
  {
    id: "anuncio-grupo",
    name: "Anúncio para Grupo",
    description: "Mensagem única de anúncio com mídia opcional.",
    icon: Megaphone,
    color: "text-blue-500",
    mode: "groups",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Anúncio",
          contentType: "text",
          content: "📢 *Atenção pessoal!*\n\nNovidade chegando para vocês. Fiquem ligados! 🚀",
        },
      },
    ],
    edges: [edge("1", "2")],
  },
  {
    id: "promocao-grupo",
    name: "Promoção em Grupo",
    description: "Anúncio + link da oferta com botão.",
    icon: Flame,
    color: "text-orange-500",
    mode: "groups",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Promoção",
          contentType: "text",
          content: "🔥 *PROMOÇÃO RELÂMPAGO!* 🔥\n\nDescontos imperdíveis por tempo limitado. Não fique de fora!",
          buttons: [
            { label: "Quero aproveitar", payload: "promo", url: "https://" },
          ],
        },
      },
    ],
    edges: [edge("1", "2")],
  },
  {
    id: "lancamento-grupo",
    name: "Lançamento em 3 partes",
    description: "Sequência de 3 mensagens com intervalos.",
    icon: Rocket,
    color: "text-fuchsia-500",
    mode: "groups",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Teaser",
          contentType: "text",
          content: "🤫 Algo grande está chegando... Fiquem ligados!",
        },
      },
      {
        id: "3",
        type: "blocoAcao",
        position: { x: 250, y: 400 },
        data: { label: "Aguardar 1h", actionType: "delay", delaySeconds: 3600 },
      },
      {
        id: "4",
        type: "blocoConteudo",
        position: { x: 250, y: 580 },
        data: {
          label: "Revelação",
          contentType: "text",
          content: "🚀 *É HOJE!* Apresentamos nossa novidade. Vocês vão amar!",
        },
      },
      {
        id: "5",
        type: "blocoAcao",
        position: { x: 250, y: 760 },
        data: { label: "Aguardar 30 min", actionType: "delay", delaySeconds: 1800 },
      },
      {
        id: "6",
        type: "blocoConteudo",
        position: { x: 250, y: 940 },
        data: {
          label: "Call to action",
          contentType: "text",
          content: "👉 Garanta o seu agora antes que acabe!",
          buttons: [{ label: "Acessar agora", payload: "cta", url: "https://" }],
        },
      },
    ],
    edges: [edge("1", "2"), edge("2", "3"), edge("3", "4"), edge("4", "5"), edge("5", "6")],
  },
  {
    id: "lembrete-evento",
    name: "Lembrete de Evento",
    description: "Aviso de evento com data e horário.",
    icon: CalendarDays,
    color: "text-emerald-500",
    mode: "groups",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Lembrete",
          contentType: "text",
          content: "📅 *Lembrete!*\n\nNosso evento começa em breve. Não esqueça de participar! ⏰",
        },
      },
    ],
    edges: [edge("1", "2")],
  },
  {
    id: "enquete-grupo",
    name: "Enquete simples",
    description: "Pergunta com botões de resposta para o grupo.",
    icon: BarChart3,
    color: "text-pink-500",
    mode: "groups",
    nodes: [
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Enquete",
          contentType: "text",
          content: "📊 *Enquete!* Qual opção vocês preferem?",
          buttons: [
            { label: "Opção A", payload: "a" },
            { label: "Opção B", payload: "b" },
            { label: "Opção C", payload: "c" },
          ],
        },
      },
    ],
    edges: [edge("1", "2")],
  },
];

export function getTemplatesForMode(mode: "contacts" | "groups" | "meta"): FlowTemplate[] {
  const effectiveMode = mode === "meta" ? "contacts" : mode;
  return FLOW_TEMPLATES.filter((t) => t.mode === effectiveMode || t.mode === "both");
}
