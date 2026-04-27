import { useState } from "react";
import { Search, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export interface CheckoutTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  settings: Record<string, any>;
}

const TemplateIcon = ({ type }: { type: string }) => {
  const color = type === "lynxfy" || type === "confianca" ? "#16A34A" : "#a78bfa";
  const bg = type === "lynxfy" || type === "confianca" ? "#F0FDF4" : "#FFF5F3";

  const icons: Record<string, React.ReactNode> = {
    minimalista: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="4" width="32" height="10" rx="2" fill={color} opacity="0.3" />
        <rect x="4" y="17" width="32" height="10" rx="2" fill={color} opacity="0.5" />
        <rect x="10" y="30" width="20" height="6" rx="2" fill={color} />
      </svg>
    ),
    "alto-impacto": (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="2" width="32" height="6" rx="2" fill={color} />
        <rect x="4" y="11" width="15" height="12" rx="2" fill={color} opacity="0.3" />
        <rect x="21" y="11" width="15" height="12" rx="2" fill={color} opacity="0.3" />
        <rect x="4" y="26" width="15" height="12" rx="2" fill={color} opacity="0.5" />
        <rect x="21" y="26" width="15" height="12" rx="2" fill={color} opacity="0.5" />
      </svg>
    ),
    tiktok: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="10" y="2" width="20" height="4" rx="2" fill={color} />
        <rect x="10" y="8" width="20" height="10" rx="2" fill={color} opacity="0.3" />
        <rect x="10" y="20" width="20" height="5" rx="2.5" fill={color} opacity="0.4" />
        <rect x="10" y="27" width="20" height="5" rx="2.5" fill={color} opacity="0.4" />
        <rect x="10" y="34" width="20" height="5" rx="2" fill={color} />
      </svg>
    ),
    streamline: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="2" y="8" width="10" height="24" rx="2" fill={color} opacity="0.5" />
        <rect x="15" y="8" width="10" height="24" rx="2" fill={color} opacity="0.3" />
        <rect x="28" y="8" width="10" height="24" rx="2" fill={color} opacity="0.3" />
        <line x1="12" y1="20" x2="15" y2="20" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
        <line x1="25" y1="20" x2="28" y2="20" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
      </svg>
    ),
    lynxfy: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="2" y="4" width="22" height="32" rx="2" fill={color} opacity="0.4" />
        <rect x="26" y="4" width="12" height="32" rx="2" fill={color} opacity="0.6" />
      </svg>
    ),
    confianca: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="2" y="4" width="22" height="14" rx="2" fill={color} opacity="0.3" />
        <rect x="26" y="4" width="12" height="14" rx="2" fill={color} opacity="0.3" />
        <rect x="2" y="20" width="22" height="16" rx="2" fill={color} opacity="0.5" />
        <rect x="26" y="20" width="12" height="7" rx="2" fill={color} opacity="0.5" />
        <circle cx="32" cy="34" r="4" fill={color} opacity="0.7" />
        <path d="M30 34l1.5 1.5L34 32" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return (
    <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
      {icons[type] || icons.minimalista}
    </div>
  );
};

const CHECKOUT_TEMPLATES: CheckoutTemplate[] = [
  {
    id: "minimalista",
    name: "Minimalista",
    description: "Checkout limpo e direto. Ideal para quem prioriza simplicidade e menos distração.",
    icon: <TemplateIcon type="minimalista" />,
    settings: {
      format: "multi_step",
      theme: "light",
      bgColor: "#F2F2F2",
      primaryColor: "#1A1A1A",
      textColor: "#1F2937",
      font: "inter",
      borderStyle: "rounded",
      showTimer: false,
      timerMinutes: 9,
      showGuarantee: false,
      showSecurityBadges: true,
      showOrderBump: false,
      creditCard: true,
      pix: true,
      boleto: false,
      debitCard: false,
      showCpf: true,
      showPhone: true,
      showAddress: true,
      showBirthdate: false,
      buttonText: "PRÓXIMO",
    },
  },
  {
    id: "alto-impacto",
    name: "Alto Impacto / Conversão",
    description: "Selos, countdown de 10 min e depoimento. Confiança e urgência sem exagero.",
    icon: <TemplateIcon type="alto-impacto" />,
    settings: {
      format: "one_step",
      theme: "light",
      bgColor: "#F5F5F5",
      primaryColor: "#E8174A",
      textColor: "#1F2937",
      font: "inter",
      borderStyle: "rounded",
      showTimer: false,
      timerMinutes: 10,
      showGuarantee: false,
      guaranteeDays: 7,
      showSecurityBadges: true,
      showOrderBump: false,
      creditCard: true,
      pix: true,
      boleto: true,
      debitCard: false,
      showCpf: true,
      showPhone: true,
      showAddress: true,
      showBirthdate: false,
      buttonText: "Finalizar pedido",
    },
  },
  {
    id: "tiktok",
    name: "Estilo TikTok / TokLynx",
    description: "Visual inspirado em TikTok Shop. Countdown discreto e layout compacto para mobile.",
    icon: <TemplateIcon type="tiktok" />,
    settings: {
      format: "one_step",
      theme: "dark",
      bgColor: "#0D0D0D",
      primaryColor: "#a78bfa",
      textColor: "#FFFFFF",
      font: "plus_jakarta",
      borderStyle: "pill",
      showTimer: false,
      timerMinutes: 15,
      showGuarantee: false,
      showSecurityBadges: true,
      showOrderBump: false,
      creditCard: true,
      pix: true,
      boleto: true,
      debitCard: false,
      showCpf: false,
      showPhone: true,
      showAddress: false,
      showBirthdate: false,
      buttonText: "COMPRAR AGORA",
    },
  },
  {
    id: "streamline",
    name: "Streamline (3 Etapas)",
    description: "Layout horizontal. Um depoimento e benefícios para reforçar confiança.",
    icon: <TemplateIcon type="streamline" />,
    settings: {
      format: "multi_step",
      theme: "light",
      bgColor: "#FFFFFF",
      primaryColor: "#E8174A",
      textColor: "#1F2937",
      font: "inter",
      borderStyle: "rounded",
      showTimer: false,
      timerMinutes: 9,
      showGuarantee: false,
      showSecurityBadges: true,
      showOrderBump: false,
      creditCard: true,
      pix: true,
      boleto: false,
      debitCard: true,
      showCpf: true,
      showPhone: true,
      showAddress: true,
      showBirthdate: false,
      buttonText: "PRÓXIMO",
    },
  },
  {
    id: "lynxfy",
    name: "LynxFy (2 Colunas)",
    description: "Layout clássico em duas colunas com formulário completo e resumo lateral.",
    icon: <TemplateIcon type="lynxfy" />,
    settings: {
      format: "one_step",
      theme: "light",
      bgColor: "#F5F5F5",
      primaryColor: "#16A34A",
      textColor: "#1F2937",
      font: "inter",
      borderStyle: "rounded",
      showTimer: false,
      timerMinutes: 10,
      showGuarantee: false,
      showSecurityBadges: true,
      showOrderBump: false,
      creditCard: true,
      pix: true,
      boleto: true,
      debitCard: false,
      showCpf: true,
      showPhone: true,
      showAddress: true,
      showBirthdate: false,
      buttonText: "🔒 Finalizar Pedido",
    },
  },
  {
    id: "confianca",
    name: "Confiança (Verde)",
    description: "Depoimentos, FAQ e banner verde-limão para máxima confiança.",
    icon: <TemplateIcon type="confianca" />,
    settings: {
      format: "multi_step",
      theme: "custom",
      bgColor: "#C8E832",
      primaryColor: "#7AC800",
      textColor: "#1A1A1A",
      font: "inter",
      borderStyle: "rounded",
      showTimer: false,
      showGuarantee: false,
      guaranteeDays: 30,
      showSecurityBadges: true,
      showOrderBump: false,
      creditCard: true,
      pix: true,
      boleto: true,
      debitCard: false,
      showCpf: true,
      showPhone: true,
      showAddress: true,
      showBirthdate: false,
      buttonText: "Continuar",
    },
  },
];

interface Props {
  onApply: (settings: Record<string, any>, templateName: string, templateId: string) => void;
  activeTemplateId?: string;
}

export default function CheckoutTemplateGallery({ onApply, activeTemplateId }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = CHECKOUT_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full gap-2 text-xs border-dashed">
          <LayoutGrid className="w-3.5 h-3.5" />
          {activeTemplateId
            ? `Modelo: ${CHECKOUT_TEMPLATES.find((t) => t.id === activeTemplateId)?.name || "Custom"}`
            : "Escolher modelo"}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[360px] sm:w-[400px] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="text-base">Modelos de Checkout</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Escolha um modelo como ponto de partida. Você pode editar tudo depois.
            </p>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border-[1.5px] p-4 transition-all hover:shadow-sm"
                style={{
                  borderColor: activeTemplateId === template.id ? "#a78bfa" : "#E5E5E5",
                  background: activeTemplateId === template.id ? "#FFF5F3" : "#FFFFFF",
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  {template.icon}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: "#000000" }}>{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {template.description}
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full text-xs font-semibold"
                  style={{ background: "#a78bfa", color: "#fff" }}
                  onClick={() => {
                    onApply(template.settings, template.name, template.id);
                    setOpen(false);
                  }}
                >
                  Usar este modelo
                </Button>
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">
                Nenhum modelo encontrado.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { CHECKOUT_TEMPLATES };
