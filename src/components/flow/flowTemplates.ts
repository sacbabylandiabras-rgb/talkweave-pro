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

const baseInicial: Node = {
  id: "1",
  type: "blocoInicial",
  position: { x: 250, y: 50 },
  data: { label: "Bloco Inicial", description: "Seu fluxo começa por este bloco. Conecte com outro bloco." },
};

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
    icon: RefreshCw,
    color: "text-green-500",
    mode: "contacts",
    isSpecial: true,
    nodes: [
      {
        id: "1",
        type: "blocoGatilho",
        position: { x: 250, y: 50 },
        data: { 
          label: "Checkout Webhook", 
          description: "Recebe eventos do seu checkout (Hotmart, Kiwify, etc)",
          isWebhook: true 
        },
      },
      {
        id: "2",
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
        id: "3",
        type: "agenteIA",
        position: { x: 250, y: 400 },
        data: {
          label: "Agente de Recuperação",
          model: "claude-sonnet-4-5-20250929",
          prompt: "Você é um especialista em recuperação de vendas. Seu objetivo é ajudar o cliente a concluir a compra, tirando dúvidas e oferecendo suporte.",
        },
      },
    ],
    edges: [edge("1", "2"), edge("2", "3")],
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
      baseInicial,
      {
        id: "2",
        type: "blocoConteudo",
        position: { x: 250, y: 220 },
        data: {
          label: "Saudação",
          contentType: "text",
          content: "Olá {{nome}}! 👋 Seja muito bem-vindo(a)! Como posso te ajudar hoje?",
        },
      },
      {
        id: "3",
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
    edges: [edge("1", "2"), edge("2", "3")],
  },
...
  {
    id: "enquete-grupo",
    name: "Enquete simples",
    description: "Pergunta com botões de resposta para the grupo.",
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