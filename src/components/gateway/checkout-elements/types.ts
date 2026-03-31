export interface CheckoutElement {
  id: string;
  type: CheckoutElementType;
  position: ElementPosition;
  order: number;
  content: Record<string, any>;
  visible: boolean;
}

export type ElementPosition = "top" | "above-form" | "below-form" | "sidebar" | "sidebar-bottom" | "footer";

export type CheckoutElementType =
  | "text"
  | "image"
  | "video"
  | "gallery"
  | "faq"
  | "benefits"
  | "seal"
  | "testimonial"
  | "reviews"
  | "guarantee"
  | "countdown"
  | "list"
  | "progress"
  | "sales";

export interface ElementDefinition {
  type: CheckoutElementType;
  label: string;
  icon: string;
  category: "basic" | "trust" | "conversion";
  defaultContent: Record<string, any>;
}

export const ELEMENT_DEFINITIONS: ElementDefinition[] = [
  // Elementos Básicos
  {
    type: "text",
    label: "Texto",
    icon: "Type",
    category: "basic",
    defaultContent: { text: "Seu texto aqui...", fontSize: "14", fontWeight: "normal", textAlign: "left", color: "" },
  },
  {
    type: "image",
    label: "Imagem",
    icon: "ImageIcon",
    category: "basic",
    defaultContent: { url: "", alt: "Imagem", width: "100%", borderRadius: "8" },
  },
  {
    type: "video",
    label: "Vídeo",
    icon: "PlayCircle",
    category: "basic",
    defaultContent: { url: "", provider: "youtube", autoplay: false },
  },
  {
    type: "gallery",
    label: "Galeria",
    icon: "LayoutGrid",
    category: "basic",
    defaultContent: { images: [], columns: 2 },
  },
  {
    type: "faq",
    label: "FAQ",
    icon: "HelpCircle",
    category: "basic",
    defaultContent: {
      title: "Perguntas Frequentes",
      items: [
        { question: "Como funciona a entrega?", answer: "Após a confirmação do pagamento, você receberá o acesso imediatamente." },
        { question: "Posso pedir reembolso?", answer: "Sim, garantimos reembolso integral em até 7 dias." },
      ],
    },
  },
  // Elementos de Confiança
  {
    type: "benefits",
    label: "Vantagens",
    icon: "ThumbsUp",
    category: "trust",
    defaultContent: {
      title: "Por que escolher?",
      items: [
        { icon: "✅", text: "Entrega imediata" },
        { icon: "🔒", text: "Pagamento 100% seguro" },
        { icon: "⭐", text: "Garantia de satisfação" },
      ],
    },
  },
  {
    type: "seal",
    label: "Selo",
    icon: "Shield",
    category: "trust",
    defaultContent: { text: "Compra 100% Segura", icon: "shield", style: "badge" },
  },
  {
    type: "testimonial",
    label: "Depoimento",
    icon: "Star",
    category: "trust",
    defaultContent: {
      items: [
        { name: "Maria S.", text: "Produto incrível! Superou minhas expectativas.", rating: 5, avatar: "" },
        { name: "João P.", text: "Entrega rápida e qualidade excelente.", rating: 5, avatar: "" },
      ],
    },
  },
  {
    type: "reviews",
    label: "Avaliações",
    icon: "Stars",
    category: "trust",
    defaultContent: { average: 4.8, total: 1247, distribution: [85, 10, 3, 1, 1] },
  },
  {
    type: "guarantee",
    label: "Garantia",
    icon: "Clock",
    category: "trust",
    defaultContent: { days: 7, text: "Garantia incondicional de {days} dias. Se não gostar, devolvemos seu dinheiro.", style: "card" },
  },
  // Elementos de Conversão
  {
    type: "countdown",
    label: "Cronômetro",
    icon: "Timer",
    category: "conversion",
    defaultContent: { minutes: 15, text: "Oferta expira em:", style: "banner", bgColor: "#EF4444", textColor: "#FFFFFF" },
  },
  {
    type: "list",
    label: "Lista",
    icon: "ListOrdered",
    category: "conversion",
    defaultContent: {
      title: "O que você vai receber:",
      items: [
        { text: "Acesso completo ao curso", icon: "✅" },
        { text: "Material de apoio em PDF", icon: "📄" },
        { text: "Suporte exclusivo por WhatsApp", icon: "💬" },
      ],
    },
  },
  {
    type: "progress",
    label: "Progresso",
    icon: "BarChart3",
    category: "conversion",
    defaultContent: { percentage: 73, text: "73% das vagas já preenchidas", style: "bar", color: "#EF4444" },
  },
  {
    type: "sales",
    label: "Vendas",
    icon: "TrendingUp",
    category: "conversion",
    defaultContent: { count: 1847, text: "{count} pessoas já compraram", showAnimation: true, interval: 30 },
  },
];

export const generateElementId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
