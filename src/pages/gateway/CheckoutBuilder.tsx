import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, Eye, Loader2, Palette, CreditCard, FormInput, ShoppingBag, Gift, Code, Layout, Settings2, Upload, Monitor, Smartphone, Globe, Copy, CheckCircle2, AlertTriangle, Blocks, Mail, PartyPopper } from "lucide-react";
import CheckoutElementsSidebar from "@/components/gateway/checkout-elements/CheckoutElementsSidebar";
import CheckoutElementEditor from "@/components/gateway/checkout-elements/CheckoutElementEditor";
import { CheckoutElement, CheckoutElementType, ElementPosition, ELEMENT_DEFINITIONS, generateElementId } from "@/components/gateway/checkout-elements/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCheckoutDefaults } from "@/hooks/useCheckoutDefaults";
import { toast } from "sonner";
import CheckoutPreview from "@/components/gateway/CheckoutPreview";
import CheckoutTemplateGallery from "@/components/gateway/CheckoutTemplateGallery";
import { resolveCheckoutFormat } from "@/components/gateway/checkout-templates/checkout-format-helpers";

const defaultConfig = {
  productName: "",
  offerName: "",
  price: 9900,
  originalPrice: 19900,
  buttonText: "Pagar Agora",
  guaranteeDays: 7,
  showGuarantee: true,
  showTimer: true,
  timerMinutes: 15,
  format: "one_step",
  primaryColor: "#EF4444",
  bgColor: "#EFF1F5",
  textColor: "#1F2937",
  buttonColor: "#EF4444",
  cardBgColor: "#FFFFFF",
  cardLabelColor: "#6B7280",
  cardTextColor: "#1F2937",
  cardBorderColor: "#E5E7EB",
  inputBorderColor: "#D1D5DB",
  inputBgColor: "#FFFFFF",
  cardTitleColor: "#111827",
  cardDescColor: "#6B7280",
  stepBgColor: "#EF4444",
  stepTextColor: "#FFFFFF",
  font: "inter",
  theme: "light" as const,
  borderStyle: "rounded",
  cardBorderRadius: "xl",
  buttonBorderRadius: "full",
  fieldBorderRadius: "xl",
  stepBorderRadius: "rounded",
  mobileInitialState: "collapsed",
  mobileInfoBeforeCart: false,
  showSecurityBadges: true,
  creditCard: true,
  debitCard: false,
  pix: true,
  boleto: false,
  maxInstallments: 12,
  pixDiscount: 0,
  showCpf: true,
  showPhone: true,
  showAddress: false,
  showBirthdate: false,
  showOrderBump: false,
  orderBumpText: "Adicione o pack de bônus exclusivo",
  orderBumpPrice: 2900,
  productImage: "",
  logoUrl: "",
  showLogo: true,
  faviconUrl: "",
  pageTitle: "",
  templateId: "",
  templateName: "",
  shippingEnabled: false,
  shippingPrice: 1500,
  emailPixGenerated: true,
  emailApproved: true,
  thankYouType: "default" as "default" | "custom_url" | "custom_message",
  thankYouUrl: "",
  thankYouTitle: "Pagamento Confirmado!",
  thankYouMessage: "Obrigado pela sua compra! Os detalhes de acesso serão enviados para o seu e-mail ou WhatsApp em instantes.",
  footerCompanyName: "",
  footerCnpj: "",
  stepIndicatorStyle: "circles" as "circles" | "pills" | "progress",
};

const formatOptions = [
  { value: "full_page", label: "Página Completa", desc: "URL própria, ideal para anúncios" },
  { value: "modal", label: "Modal Pop-up", desc: "Abre sobre a página sem redirecionar" },
  { value: "inline", label: "Inline / Embed", desc: "Via <iframe> ou <script>" },
  { value: "one_step", label: "One Step", desc: "Tudo em uma tela" },
  { value: "multi_step", label: "Multi Step", desc: "Dados → Entrega → Pagamento → Confirmação" },
];

const TEMPLATE_NAMES: Record<string, string> = {
  minimalista: "Minimalista",
  "alto-impacto": "Alto Impacto / Conversão",
  tiktok: "Estilo TikTok / TokLynx",
  streamline: "Streamline (3 Etapas)",
  lynxfy: "LynxFy (2 Colunas)",
  confianca: "Confiança (Verde)",
};

export default function CheckoutBuilder() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditing = !!editId;
  const { defaults: globalDefaults, loading: defaultsLoading } = useCheckoutDefaults();
  const [config, setConfig] = useState(defaultConfig);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [checkoutName, setCheckoutName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>();
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewPaneWidth, setPreviewPaneWidth] = useState(0);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const [elements, setElements] = useState<CheckoutElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [openAccordions, setOpenAccordions] = useState<string[]>(["produto", "formato", "aparencia", "pagamento", "campos"]);

  // Auto-open "elementos" accordion when an element is selected
  const handleSelectElement = (id: string | null) => {
    setSelectedElementId(id);
    if (id && !openAccordions.includes("elementos")) {
      setOpenAccordions(prev => [...prev, "elementos"]);
    }
  };
  const [draggingType, setDraggingType] = useState<CheckoutElementType | null>(null);
  const [customCheckoutDomain, setCustomCheckoutDomain] = useState("");
  const [savedSlug, setSavedSlug] = useState("");

  const platformCheckoutDomain = "zaplynx.com";
  const activeTemplateName = config.templateId
    ? TEMPLATE_NAMES[config.templateId] || config.templateName
    : config.templateName;
  const checkoutSlug = checkoutName ? checkoutName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : "meu-checkout";
  const effectiveCheckoutSlug = savedSlug || checkoutSlug;
  const hasCustomCheckoutDomain = Boolean(customCheckoutDomain && customCheckoutDomain !== platformCheckoutDomain);
  const platformCheckoutUrl = `https://${platformCheckoutDomain}/pay/${effectiveCheckoutSlug}`;
  const customCheckoutUrl = hasCustomCheckoutDomain ? `https://${customCheckoutDomain}/pay/${effectiveCheckoutSlug}` : "";
  const checkoutUrl = customCheckoutUrl || platformCheckoutUrl;
  const resolvedFormat = resolveCheckoutFormat(config.format);
  const embedCode = resolvedFormat.shell === "inline"
    ? `<iframe src="${checkoutUrl}" width="100%" height="760" style="border:0;border-radius:24px;overflow:hidden;" loading="lazy"></iframe>`
    : resolvedFormat.shell === "modal"
      ? `<button type="button" data-open-zaplynx-checkout>Abrir checkout</button>`
      : `<a href="${checkoutUrl}" target="_blank" rel="noopener">Abrir checkout</a>`;
  const jsCode = resolvedFormat.shell === "inline"
    ? `const iframe = document.createElement('iframe');\niframe.src = '${checkoutUrl}';\niframe.width = '100%';\niframe.height = '760';\niframe.style.border = '0';\niframe.style.borderRadius = '24px';\ndocument.getElementById('checkout-embed')?.appendChild(iframe);`
    : resolvedFormat.shell === "modal"
      ? `document.querySelector('[data-open-zaplynx-checkout]')?.addEventListener('click', () => window.open('${checkoutUrl}', '_blank'));`
      : `window.location.href = '${checkoutUrl}';`;

  const copySnippet = async (content: string, label: string) => {
    await navigator.clipboard.writeText(content);
    toast.success(`${label} copiado!`);
  };

  const previewViewportWidth = previewMode === "mobile" ? 320 : 800;
  const previewScale = previewPaneWidth
    ? Math.min(1, (previewPaneWidth - (previewMode === "mobile" ? 24 : 0)) / previewViewportWidth)
    : 1;

  const applyTemplate = (settings: Record<string, any>, templateName: string, templateId: string) => {
    setConfig(prev => ({ ...prev, ...settings, templateId, templateName }));
    setActiveTemplateId(templateId);
    toast.success(`✅ Modelo "${templateName}" aplicado! Personalize como quiser.`);
  };

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from("gateway_products" as any).select("*").order("name");
      setProducts((data || []) as any[]);

      const storedDomain = localStorage.getItem("checkout_custom_domain") || "";
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("custom_domain")
            .eq("id", user.id)
            .maybeSingle();

          const resolvedDomain = (profile as { custom_domain?: string | null } | null)?.custom_domain || storedDomain;
          if (resolvedDomain) {
            localStorage.setItem("checkout_custom_domain", resolvedDomain);
          }
          setCustomCheckoutDomain(resolvedDomain);
        } catch {
          setCustomCheckoutDomain(storedDomain);
        }
      } else {
        setCustomCheckoutDomain(storedDomain);
      }

      if (editId) {
        const { data: checkout } = await supabase
          .from("gateway_checkouts" as any)
          .select("*")
          .eq("id", editId)
          .maybeSingle();
        if (checkout) {
          const ck = checkout as any;
          setCheckoutName(ck.name || "");
          setSelectedProductId(ck.product_id || "");
          setSavedSlug(ck.slug || "");
          if (ck.config) {
            setConfig(prev => ({ ...prev, ...ck.config }));
            if (ck.config.templateId) {
              setActiveTemplateId(ck.config.templateId);
            }
            if (ck.config.elements && Array.isArray(ck.config.elements)) {
              setElements(ck.config.elements);
            }
          }
        }
      } else if (!defaultsLoading) {
        setSavedSlug("");
        // Apply global defaults for new checkouts
        setConfig(prev => ({ ...prev, ...globalDefaults }));
        if (globalDefaults.templateId) {
          setActiveTemplateId(globalDefaults.templateId);
        }
      }
      setLoading(false);
    };
    init();
  }, [editId, defaultsLoading]);

  useEffect(() => {
    const element = previewPaneRef.current;
    if (!element) return;

    const updateWidth = () => setPreviewPaneWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setPreviewPaneWidth(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Element management
  const addElement = (type: CheckoutElementType, position: ElementPosition) => {
    const def = ELEMENT_DEFINITIONS.find(d => d.type === type);
    if (!def) return;
    const newEl: CheckoutElement = {
      id: generateElementId(),
      type,
      position,
      order: elements.filter(e => e.position === position).length,
      content: JSON.parse(JSON.stringify(def.defaultContent)),
      visible: true,
    };
    setElements(prev => [...prev, newEl]);
    handleSelectElement(newEl.id);
  };

  const removeElement = (id: string) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selectedElementId === id) handleSelectElement(null);
  };

  const toggleElement = (id: string) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, visible: !e.visible } : e));
  };

  const moveElement = (id: string, direction: "up" | "down") => {
    setElements(prev => {
      const el = prev.find(e => e.id === id);
      if (!el) return prev;
      const posEls = prev.filter(e => e.position === el.position).sort((a, b) => a.order - b.order);
      const idx = posEls.findIndex(e => e.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= posEls.length) return prev;
      const swapEl = posEls[swapIdx];
      return prev.map(e => {
        if (e.id === id) return { ...e, order: swapEl.order };
        if (e.id === swapEl.id) return { ...e, order: el.order };
        return e;
      });
    });
  };

  const updateElementContent = (id: string, content: Record<string, any>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, content } : e));
  };

  const updateElementPosition = (id: string, position: ElementPosition) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, position, order: prev.filter(x => x.position === position).length } : e));
  };

  const handleDragStart = (type: CheckoutElementType) => {
    setDraggingType(type);
  };

  const selectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p: any) => p.id === productId);
    if (prod) {
      setConfig(prev => ({
        ...prev,
        productName: prod.name,
        price: prod.price,
        productImage: prod.image_url || "",
        thankYouUrl: prod.thank_you_page_url || prev.thankYouUrl,
        thankYouType: prod.thank_you_page_url ? "custom_url" : prev.thankYouType
      }));
    }
  };

  const handleSave = async () => {
    if (!checkoutName) { toast.error("Informe um nome para o checkout"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);

    const configWithElements = { ...config, elements } as any;

    if (isEditing) {
      const { error } = await supabase.from("gateway_checkouts" as any)
        .update({
          name: checkoutName,
          product_id: selectedProductId || null,
          config: configWithElements,
        } as any)
        .eq("id", editId);
      setSaving(false);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Checkout atualizado com sucesso!");
    } else {
      const { error } = await supabase.from("gateway_checkouts" as any).insert({
        user_id: user.id,
        name: checkoutName,
        product_id: selectedProductId || null,
        slug: checkoutName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        config: configWithElements,
      } as any);
      setSaving(false);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Checkout criado com sucesso!");
    }
    navigate("/gateway-checkout/checkouts");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/gateway-checkout/checkouts")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Construtor de Checkout</h1>
              {activeTemplateName && (
                <span className="rounded-full border border-border bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                  Modelo: {activeTemplateName}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Configure e visualize em tempo real</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full text-xs"><Eye className="w-3.5 h-3.5 mr-1.5" /> Preview</Button>
          <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-5 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            {isEditing ? "Atualizar Checkout" : "Salvar Checkout"}
          </Button>
          <div className="flex border border-border rounded-full overflow-hidden">
            <button
              onClick={() => setPreviewMode("desktop")}
              className="px-2.5 py-1.5 transition-colors"
              style={{ background: previewMode === "desktop" ? "#a78bfa" : "transparent", color: previewMode === "desktop" ? "#fff" : undefined }}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPreviewMode("mobile")}
              className="px-2.5 py-1.5 transition-colors"
              style={{ background: previewMode === "mobile" ? "#a78bfa" : "transparent", color: previewMode === "mobile" ? "#fff" : undefined }}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Config Left + Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start" style={{ minHeight: "calc(100vh - 200px)" }}>
        {/* LEFT: Config Panel (40%) */}
        <div className="lg:col-span-2 space-y-3 overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {/* Checkout Name */}
          <Card className="border-[#2A2A2A]">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div>
                <Label className="text-xs">Nome do Checkout</Label>
                <Input value={checkoutName} onChange={e => setCheckoutName(e.target.value)} placeholder="Ex: Checkout Principal" className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="space-y-2">
            {/* BLOCO A: Produto & Oferta */}
            <AccordionItem value="produto" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-[#a78bfa]" /> Produto & Oferta</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <div>
                  <Label className="text-xs">Produto</Label>
                  <Select value={selectedProductId} onValueChange={selectProduct}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nome da oferta</Label>
                  <Input value={config.offerName} onChange={e => updateConfig("offerName", e.target.value)} placeholder="Ex: Oferta Especial de Lançamento" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Preço de venda (R$)</Label>
                    <Input type="number" step="0.01" value={(config.price / 100).toFixed(2)} onChange={e => updateConfig("price", Math.round(parseFloat(e.target.value || "0") * 100))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Preço "de" riscado (R$)</Label>
                    <Input type="number" step="0.01" value={(config.originalPrice / 100).toFixed(2)} onChange={e => updateConfig("originalPrice", Math.round(parseFloat(e.target.value || "0") * 100))} className="mt-1" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Cobrar Frete</Label>
                    <p className="text-[10px] text-muted-foreground">Ative para produtos físicos/drop</p>
                  </div>
                  <Switch checked={config.shippingEnabled} onCheckedChange={v => updateConfig("shippingEnabled", v)} />
                </div>
                {config.shippingEnabled && (
                  <div>
                    <Label className="text-xs">Valor do Frete (R$)</Label>
                    <Input type="number" step="0.01" value={(config.shippingPrice / 100).toFixed(2)} onChange={e => updateConfig("shippingPrice", Math.round(parseFloat(e.target.value || "0") * 100))} className="mt-1" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Texto do botão</Label>
                  <Input value={config.buttonText} onChange={e => updateConfig("buttonText", e.target.value)} className="mt-1" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Garantia</Label>
                    <p className="text-[10px] text-muted-foreground">{config.guaranteeDays} dias</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={config.guaranteeDays} onChange={e => updateConfig("guaranteeDays", parseInt(e.target.value) || 0)} className="w-16 text-xs" />
                    <Switch checked={config.showGuarantee} onCheckedChange={v => updateConfig("showGuarantee", v)} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Contador de urgência</Label>
                    <p className="text-[10px] text-muted-foreground">{config.timerMinutes} minutos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={config.timerMinutes} onChange={e => updateConfig("timerMinutes", parseInt(e.target.value) || 0)} className="w-16 text-xs" />
                    <Switch checked={config.showTimer} onCheckedChange={v => updateConfig("showTimer", v)} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO B: Formato */}
            <AccordionItem value="formato" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Layout className="w-4 h-4 text-[#a78bfa]" /> Formato</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                {/* Format Options First */}
                <div>
                  <Label className="text-xs mb-2 block">Etapas do Checkout</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {formatOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => updateConfig("format", opt.value)}
                        className="text-left p-3 rounded-lg border transition-all"
                        style={{
                          borderColor: config.format === opt.value ? "#a78bfa" : "#2A2A2A",
                          background: config.format === opt.value ? "rgba(255,77,46,0.08)" : "transparent",
                        }}
                      >
                        <p className="text-xs font-medium" style={{ color: config.format === opt.value ? "#a78bfa" : undefined }}>{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step Indicator Style */}
                {(config.format === "multi_step") && (
                  <div className="space-y-2">
                    <Label className="text-xs">Estilo dos Steps</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "circles", label: "Círculos", preview: (
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-5 h-5 rounded-full border-2 border-[#a78bfa] flex items-center justify-center text-[8px] font-bold text-[#a78bfa]">1</div>
                            <div className="w-3 h-px bg-border" />
                            <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[8px] text-muted-foreground">2</div>
                            <div className="w-3 h-px bg-border" />
                            <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[8px] text-muted-foreground">3</div>
                          </div>
                        )},
                        { value: "pills", label: "Pills", preview: (
                          <div className="flex items-center justify-center gap-1">
                            <div className="px-2 py-0.5 rounded-full bg-[#a78bfa]/10 border border-[#a78bfa]/40 text-[7px] font-medium text-[#a78bfa]">1</div>
                            <div className="px-2 py-0.5 rounded-full border border-border text-[7px] text-muted-foreground">2</div>
                            <div className="px-2 py-0.5 rounded-full border border-border text-[7px] text-muted-foreground">3</div>
                          </div>
                        )},
                        { value: "progress", label: "Barra", preview: (
                          <div className="flex items-center gap-0.5 w-full px-1">
                            <div className="h-1.5 flex-1 rounded-full bg-[#a78bfa]" />
                            <div className="h-1.5 flex-1 rounded-full bg-border" />
                            <div className="h-1.5 flex-1 rounded-full bg-border" />
                          </div>
                        )},
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateConfig("stepIndicatorStyle", opt.value)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all"
                          style={{
                            borderColor: (config.stepIndicatorStyle || "circles") === opt.value ? "#a78bfa" : "hsl(var(--border))",
                            background: (config.stepIndicatorStyle || "circles") === opt.value ? "rgba(255,77,46,0.08)" : "transparent",
                          }}
                        >
                          {opt.preview}
                          <span className="text-[10px] font-medium">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Template Gallery */}
                <CheckoutTemplateGallery onApply={applyTemplate} activeTemplateId={activeTemplateId} />
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO C: Esquema de Cores */}
            <AccordionItem value="aparencia" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Palette className="w-4 h-4 text-[#a78bfa]" /> Esquema de Cores</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                {/* Logo */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Logo do Checkout</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Exibir</span>
                      <Switch
                        checked={config.showLogo !== false}
                        onCheckedChange={(v) => updateConfig("showLogo", v)}
                      />
                    </div>
                  </div>
                  {config.showLogo !== false && (
                    <>
                      <div className="flex items-center gap-2 mt-1">
                        {config.logoUrl ? (
                          <div className="relative">
                            <img src={config.logoUrl} alt="Logo" className="h-10 object-contain rounded border border-gray-200" />
                            <button
                              onClick={() => updateConfig("logoUrl", "")}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center"
                            >×</button>
                          </div>
                        ) : null}
                        <label className="flex items-center gap-1.5 px-3 py-2 text-xs border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                          <Upload className="w-3.5 h-3.5" />
                          {config.logoUrl ? "Trocar" : "Enviar logo"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
                              const { data: { user } } = await supabase.auth.getUser();
                              if (!user) return;
                              const fileName = `${user.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
                              const { error } = await supabase.storage.from("product-images").upload(fileName, file, { upsert: true });
                              if (error) { toast.error("Erro ao enviar: " + error.message); return; }
                              const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
                              updateConfig("logoUrl", urlData.publicUrl);
                              toast.success("Logo enviada!");
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Aparecerá no topo do checkout. Máx 2MB.</p>
                    </>
                  )}
                </div>

                {/* Favicon */}
                <div>
                  <Label className="text-xs">Favicon do Checkout</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {config.faviconUrl ? (
                      <div className="relative">
                        <img src={config.faviconUrl} alt="Favicon" className="h-8 w-8 object-contain rounded border border-gray-200" />
                        <button
                          onClick={() => updateConfig("faviconUrl", "")}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center"
                        >×</button>
                      </div>
                    ) : null}
                    <label className="flex items-center gap-1.5 px-3 py-2 text-xs border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="w-3.5 h-3.5" />
                      {config.faviconUrl ? "Trocar" : "Enviar favicon"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          const fileName = `${user.id}/favicon-${Date.now()}.${file.name.split('.').pop()}`;
                          const { error } = await supabase.storage.from("product-images").upload(fileName, file, { upsert: true });
                          if (error) { toast.error("Erro ao enviar: " + error.message); return; }
                          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
                          updateConfig("faviconUrl", urlData.publicUrl);
                          toast.success("Favicon enviado!");
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Ícone da aba do navegador. Máx 2MB. Recomendado: 32x32px.</p>
                </div>

                {/* Page Title */}
                <div>
                  <Label className="text-xs">Título da Aba</Label>
                  <Input
                    value={config.pageTitle}
                    onChange={e => updateConfig("pageTitle", e.target.value)}
                    placeholder="Ex: Checkout - Minha Loja"
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Texto exibido na aba do navegador. Se vazio, mostra "Checkout".</p>
                </div>

                {/* Footer Company Name */}
                <div>
                  <Label className="text-xs">Nome da Empresa (Rodapé)</Label>
                  <Input
                    value={config.footerCompanyName}
                    onChange={e => updateConfig("footerCompanyName", e.target.value)}
                    placeholder="Ex: Minha Empresa LTDA"
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Nome exibido no rodapé do checkout. Se vazio, mostra "ZapLynxPay".</p>
                </div>

                {/* Footer CNPJ */}
                <div>
                  <Label className="text-xs">CNPJ (Rodapé)</Label>
                  <Input
                    value={config.footerCnpj}
                    onChange={e => updateConfig("footerCnpj", e.target.value)}
                    placeholder="Ex: 12.345.678/0001-90"
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">CNPJ exibido no rodapé. Opcional.</p>
                </div>

                <p className="text-[10px] text-muted-foreground">Defina as cores que serão usadas nos elementos do checkout</p>

                {/* Cor Principal */}
                <div>
                  <Label className="text-xs font-medium">Cor Principal</Label>
                  <p className="text-[10px] text-muted-foreground">Cor usada como acento nos elementos de destaque</p>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.primaryColor} onChange={e => updateConfig("primaryColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={config.primaryColor} onChange={e => updateConfig("primaryColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor dos Botões */}
                <div>
                  <Label className="text-xs font-medium">Cor dos Botões</Label>
                  <p className="text-[10px] text-muted-foreground">Cor dos botões de ação, como pagar, próximo</p>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.buttonColor} onChange={e => updateConfig("buttonColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={config.buttonColor} onChange={e => updateConfig("buttonColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor de Fundo */}
                <div>
                  <Label className="text-xs font-medium">Cor de Fundo</Label>
                  <p className="text-[10px] text-muted-foreground">Cor de fundo da página</p>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.bgColor} onChange={e => updateConfig("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={config.bgColor} onChange={e => updateConfig("bgColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor do Texto */}
                <div>
                  <Label className="text-xs font-medium">Cor do Texto</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.textColor} onChange={e => updateConfig("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={config.textColor} onChange={e => updateConfig("textColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold mb-2">Cards e Inputs</p>
                </div>

                {/* Cor de Fundo dos cards */}
                <div>
                  <Label className="text-[10px]">Cor de Fundo dos cards</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.cardBgColor} onChange={e => updateConfig("cardBgColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.cardBgColor} onChange={e => updateConfig("cardBgColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor de labels dos cards */}
                <div>
                  <Label className="text-[10px]">Cor de labels dos cards</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.cardLabelColor} onChange={e => updateConfig("cardLabelColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.cardLabelColor} onChange={e => updateConfig("cardLabelColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor de texto dos cards */}
                <div>
                  <Label className="text-[10px]">Cor de texto dos cards</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.cardTextColor} onChange={e => updateConfig("cardTextColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.cardTextColor} onChange={e => updateConfig("cardTextColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor das bordas dos cards */}
                <div>
                  <Label className="text-[10px]">Cor das bordas dos cards</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.cardBorderColor} onChange={e => updateConfig("cardBorderColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.cardBorderColor} onChange={e => updateConfig("cardBorderColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor das bordas dos inputs */}
                <div>
                  <Label className="text-[10px]">Cor das bordas dos inputs</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.inputBorderColor} onChange={e => updateConfig("inputBorderColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.inputBorderColor} onChange={e => updateConfig("inputBorderColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor do titulo dos cards */}
                <div>
                  <Label className="text-[10px]">Cor do título dos cards</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.cardTitleColor} onChange={e => updateConfig("cardTitleColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.cardTitleColor} onChange={e => updateConfig("cardTitleColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor da descrição dos cards */}
                <div>
                  <Label className="text-[10px]">Cor da descrição dos cards</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.cardDescColor} onChange={e => updateConfig("cardDescColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.cardDescColor} onChange={e => updateConfig("cardDescColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor de Fundo dos inputs */}
                <div>
                  <Label className="text-[10px]">Cor de Fundo dos inputs</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.inputBgColor} onChange={e => updateConfig("inputBgColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.inputBgColor} onChange={e => updateConfig("inputBgColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold mb-2">Etapas</p>
                </div>

                {/* Cor de Fundo dos steps */}
                <div>
                  <Label className="text-[10px]">Cor de Fundo dos steps</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.stepBgColor} onChange={e => updateConfig("stepBgColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.stepBgColor} onChange={e => updateConfig("stepBgColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Cor de texto dos steps */}
                <div>
                  <Label className="text-[10px]">Cor de texto dos steps</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <input type="color" value={config.stepTextColor} onChange={e => updateConfig("stepTextColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <Input value={config.stepTextColor} onChange={e => updateConfig("stepTextColor", e.target.value)} className="text-[10px] font-mono" />
                  </div>
                </div>

                {/* Tema */}
                <div className="border-t border-border pt-3">
                  <Label className="text-xs">Tema</Label>
                  <div className="flex gap-2 mt-1">
                    {(["dark", "light", "custom"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => updateConfig("theme", t)}
                        className="flex-1 py-2 text-xs font-medium rounded-lg border transition-all"
                        style={{
                          borderColor: config.theme === t ? "#a78bfa" : "#2A2A2A",
                          background: config.theme === t ? "rgba(255,77,46,0.08)" : "transparent",
                          color: config.theme === t ? "#a78bfa" : undefined,
                        }}
                      >
                        {t === "dark" ? "Escuro" : t === "light" ? "Claro" : "Custom"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Selos de segurança</Label>
                  <Switch checked={config.showSecurityBadges} onCheckedChange={v => updateConfig("showSecurityBadges", v)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO C2: Tipografia */}
            <AccordionItem value="tipografia" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><span className="text-[#a78bfa] text-base font-serif">T</span> Tipografia</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <p className="text-[10px] text-muted-foreground">Configure o estilo tipográfico</p>
                <div>
                  <Label className="text-xs">Fonte Principal</Label>
                  <p className="text-[10px] text-muted-foreground">Fonte utilizada em todo o conteúdo textual</p>
                  <Select value={config.font} onValueChange={v => updateConfig("font", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inter">Inter</SelectItem>
                      <SelectItem value="plus_jakarta">Plus Jakarta Sans</SelectItem>
                      <SelectItem value="roboto">Roboto</SelectItem>
                      <SelectItem value="montserrat">Montserrat</SelectItem>
                      <SelectItem value="poppins">Poppins</SelectItem>
                      <SelectItem value="dm_sans">DM Sans</SelectItem>
                      <SelectItem value="nunito">Nunito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO C3: Arredondamento */}
            <AccordionItem value="arredondamento" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><span className="text-[#a78bfa] text-sm font-bold">⊡</span> Arredondamento</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <p className="text-[10px] text-muted-foreground">Ajuste o arredondamento dos elementos</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px]">Cards</Label>
                    <p className="text-[9px] text-muted-foreground">Bordas dos cards e containers</p>
                    <Select value={config.cardBorderRadius} onValueChange={v => updateConfig("cardBorderRadius", v)}>
                      <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem Borda</SelectItem>
                        <SelectItem value="sm">Pequeno</SelectItem>
                        <SelectItem value="md">Médio</SelectItem>
                        <SelectItem value="lg">Grande</SelectItem>
                        <SelectItem value="xl">Extra Grande</SelectItem>
                        <SelectItem value="2xl">2x Extra Grande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Botões</Label>
                    <p className="text-[9px] text-muted-foreground">Bordas dos botões</p>
                    <Select value={config.buttonBorderRadius} onValueChange={v => updateConfig("buttonBorderRadius", v)}>
                      <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem Borda</SelectItem>
                        <SelectItem value="sm">Pequeno</SelectItem>
                        <SelectItem value="md">Médio</SelectItem>
                        <SelectItem value="lg">Grande</SelectItem>
                        <SelectItem value="xl">Extra Grande</SelectItem>
                        <SelectItem value="full">100% Arredondado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Campos</Label>
                    <p className="text-[9px] text-muted-foreground">Bordas dos campos de entrada</p>
                    <Select value={config.fieldBorderRadius} onValueChange={v => updateConfig("fieldBorderRadius", v)}>
                      <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem Borda</SelectItem>
                        <SelectItem value="sm">Pequeno</SelectItem>
                        <SelectItem value="md">Médio</SelectItem>
                        <SelectItem value="lg">Grande</SelectItem>
                        <SelectItem value="xl">Extra Grande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Etapas</Label>
                    <p className="text-[9px] text-muted-foreground">Bordas dos indicadores de etapa</p>
                    <Select value={config.stepBorderRadius} onValueChange={v => updateConfig("stepBorderRadius", v)}>
                      <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem Borda</SelectItem>
                        <SelectItem value="sm">Pequeno</SelectItem>
                        <SelectItem value="rounded">Arredondado</SelectItem>
                        <SelectItem value="full">Circular</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO C4: TokLynx Mobile */}
            <AccordionItem value="toklynx-mobile" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-[#a78bfa]" /> TokLynx Mobile</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <p className="text-[10px] text-muted-foreground">Configure o comportamento das seções no mobile</p>
                <div>
                  <Label className="text-xs">Estado Inicial das Seções</Label>
                  <p className="text-[10px] text-muted-foreground">Como as seções devem aparecer ao carregar o checkout no mobile</p>
                  <Select value={config.mobileInitialState} onValueChange={v => updateConfig("mobileInitialState", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collapsed">Fechadas (Colapsadas)</SelectItem>
                      <SelectItem value="expanded">Abertas (Expandidas)</SelectItem>
                      <SelectItem value="first_open">Apenas a primeira aberta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Informações Antes do Carrinho</Label>
                    <p className="text-[10px] text-muted-foreground">No TokLynx mobile, exibir seção de informações antes do resumo do pedido</p>
                  </div>
                  <Switch checked={config.mobileInfoBeforeCart} onCheckedChange={v => updateConfig("mobileInfoBeforeCart", v)} />
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground">
                    ℹ️ Esta configuração afeta apenas o TokLynx Mobile, controlando se as seções de informações, endereço e CPF aparecem abertas ou fechadas inicialmente.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="pagamento" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#a78bfa]" /> Métodos de Pagamento</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <div className="space-y-2">
                  {[
                    { key: "creditCard", label: "Cartão de Crédito" },
                    { key: "debitCard", label: "Cartão de Débito" },
                    { key: "pix", label: "PIX" },
                    { key: "boleto", label: "Boleto" },
                  ].map(m => (
                    <div key={m.key} className="flex items-center justify-between">
                      <span className="text-xs">{m.label}</span>
                      <Switch checked={(config as any)[m.key]} onCheckedChange={v => updateConfig(m.key, v)} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Parcelas (até)</Label>
                    <Select value={String(config.maxInstallments)} onValueChange={v => updateConfig("maxInstallments", parseInt(v))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Desconto PIX (%)</Label>
                    <Input type="number" value={config.pixDiscount} onChange={e => updateConfig("pixDiscount", parseInt(e.target.value) || 0)} className="mt-1" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO E: Campos */}
            <AccordionItem value="campos" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><FormInput className="w-4 h-4 text-[#a78bfa]" /> Campos do Formulário</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-2">
                {[
                  { key: "showCpf", label: "CPF/CNPJ" },
                  { key: "showPhone", label: "Telefone" },
                  { key: "showBirthdate", label: "Data de Nascimento" },
                  { key: "showAddress", label: "Endereço (CEP)" },
                ].map(f => (
                  <div key={f.key} className="flex items-center justify-between">
                    <span className="text-xs">{f.label}</span>
                    <Switch checked={(config as any)[f.key]} onCheckedChange={v => updateConfig(f.key, v)} />
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO F: Order Bump */}
            <AccordionItem value="bump" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-[#a78bfa]" /> Order Bump & Upsell</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Order Bump</Label>
                  <Switch checked={config.showOrderBump} onCheckedChange={v => updateConfig("showOrderBump", v)} />
                </div>
                {config.showOrderBump && (
                  <>
                    <div>
                      <Label className="text-xs">Texto do bump</Label>
                      <Input value={config.orderBumpText} onChange={e => updateConfig("orderBumpText", e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input type="number" step="0.01" value={(config.orderBumpPrice / 100).toFixed(2)} onChange={e => updateConfig("orderBumpPrice", Math.round(parseFloat(e.target.value || "0") * 100))} className="mt-1" />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO F2: Notificações por Email */}
            <AccordionItem value="notificacoes" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#a78bfa]" /> Notificações por Email</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <p className="text-[10px] text-muted-foreground">Escolha quais emails serão enviados ao lead automaticamente</p>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">PIX Gerado</Label>
                    <p className="text-[10px] text-muted-foreground">Envia o código PIX por email ao cliente</p>
                  </div>
                  <Switch checked={config.emailPixGenerated} onCheckedChange={v => updateConfig("emailPixGenerated", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Compra Aprovada</Label>
                    <p className="text-[10px] text-muted-foreground">Confirma o pagamento por email ao cliente</p>
                  </div>
                  <Switch checked={config.emailApproved} onCheckedChange={v => updateConfig("emailApproved", v)} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO F3: Página de Obrigado */}
            <AccordionItem value="obrigado" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><PartyPopper className="w-4 h-4 text-[#a78bfa]" /> Página de Obrigado</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <p className="text-[10px] text-muted-foreground">Configure o que acontece após o pagamento ser aprovado</p>
                <div>
                  <Label className="text-xs">Tipo de redirecionamento</Label>
                  <Select value={config.thankYouType} onValueChange={v => updateConfig("thankYouType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Página padrão (ZapLynx)</SelectItem>
                      <SelectItem value="custom_url">URL externa personalizada</SelectItem>
                      <SelectItem value="custom_message">Mensagem personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.thankYouType === "custom_url" && (
                  <div>
                    <Label className="text-xs">URL de redirecionamento</Label>
                    <Input
                      value={config.thankYouUrl}
                      onChange={e => updateConfig("thankYouUrl", e.target.value)}
                      placeholder="https://seusite.com/obrigado"
                      className="mt-1 font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      O cliente será redirecionado para esta URL após o pagamento
                    </p>
                  </div>
                )}

                {config.thankYouType === "custom_message" && (
                  <>
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={config.thankYouTitle}
                        onChange={e => updateConfig("thankYouTitle", e.target.value)}
                        placeholder="Pagamento Confirmado!"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mensagem</Label>
                      <Textarea
                        value={config.thankYouMessage}
                        onChange={e => updateConfig("thankYouMessage", e.target.value)}
                        placeholder="Obrigado pela sua compra..."
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {config.thankYouType === "default" && (
                  <div className="bg-muted/30 border border-border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground">
                      ℹ️ A página padrão exibe o resumo da compra com o nome do produto, valor pago e ID da transação.
                    </p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="dominio" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-[#a78bfa]" /> Domínio Personalizado</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <div>
                  <Label className="text-xs">Domínio do Checkout</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={customCheckoutDomain}
                      onChange={e => {
                        const val = e.target.value.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
                        setCustomCheckoutDomain(val);
                        if (val) {
                          localStorage.setItem("checkout_custom_domain", val);
                        } else {
                          localStorage.removeItem("checkout_custom_domain");
                        }
                        updateConfig("_domainTrigger", Date.now());
                      }}
                      placeholder="pay.seusite.com"
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs shrink-0"
                      onClick={() => {
                        if (customCheckoutDomain) toast.success(`Domínio "${customCheckoutDomain}" salvo!`);
                        else toast.info("Nenhum domínio configurado");
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Insira sem http://. Ex: pay.meudominio.com
                  </p>
                </div>

                {customCheckoutDomain && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <p className="text-[10px] text-muted-foreground">
                      Links usarão: <strong className="text-foreground">{customCheckoutDomain}</strong>
                    </p>
                  </div>
                )}

                <div className="space-y-2 p-3 rounded-lg border border-[#2A2A2A] bg-muted/20">
                  <p className="text-[10px] font-medium text-foreground">📋 Configuração DNS:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Registro <strong>A</strong> →</span>
                    <code className="text-[10px] font-mono bg-background border border-[#2A2A2A] rounded px-1.5 py-0.5">185.158.133.1</code>
                    <button onClick={() => { navigator.clipboard.writeText("185.158.133.1"); toast.success("IP copiado!"); }} className="text-muted-foreground hover:text-foreground">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-start gap-1.5 mt-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground">
                      Adicione o domínio em Publish → Domains no Lovable e republique o projeto.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO H: Código de Integração */}
            <AccordionItem value="codigo" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Code className="w-4 h-4 text-[#a78bfa]" /> Código de Integração</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <Tabs defaultValue="link">
                  <TabsList className="bg-muted/50 w-full">
                    <TabsTrigger value="link" className="text-xs flex-1">Link Direto</TabsTrigger>
                    <TabsTrigger value="embed" className="text-xs flex-1">Embed HTML</TabsTrigger>
                    <TabsTrigger value="js" className="text-xs flex-1">JavaScript</TabsTrigger>
                  </TabsList>
                  <TabsContent value="link" className="mt-3 space-y-2">
                    <div className="p-3 rounded-lg bg-muted/30 border border-[#2A2A2A] space-y-1">
                      <p className="text-[10px] font-medium text-foreground">Link da plataforma</p>
                      <code className="text-[10px] font-mono text-muted-foreground break-all">
                        {platformCheckoutUrl}
                      </code>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-full text-xs w-full" onClick={() => copySnippet(platformCheckoutUrl, "Link da plataforma") }>
                      Copiar Link da Plataforma
                    </Button>

                    {hasCustomCheckoutDomain ? (
                      <>
                        <div className="p-3 rounded-lg bg-muted/30 border border-[#2A2A2A] space-y-1">
                          <p className="text-[10px] font-medium text-foreground">Link personalizado</p>
                          <code className="text-[10px] font-mono text-muted-foreground break-all">
                            {customCheckoutUrl}
                          </code>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-full text-xs w-full" onClick={() => copySnippet(customCheckoutUrl, "Link personalizado") }>
                          Copiar Link Personalizado
                        </Button>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        Configure um domínio personalizado para gerar o segundo link.
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="embed" className="mt-3">
                    <div className="p-3 rounded-lg bg-muted/30 border border-[#2A2A2A]">
                      <code className="text-[10px] font-mono text-muted-foreground break-all">
                        {embedCode}
                      </code>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs w-full" onClick={() => copySnippet(embedCode, "Código HTML") }>
                      Copiar Código
                    </Button>
                  </TabsContent>
                  <TabsContent value="js" className="mt-3">
                    <div className="p-3 rounded-lg bg-muted/30 border border-[#2A2A2A]">
                      <code className="text-[10px] font-mono text-muted-foreground break-all">
                        {jsCode}
                      </code>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs w-full" onClick={() => copySnippet(jsCode, "Script") }>
                      Copiar Script
                    </Button>
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO I: Elementos Personalizados */}
            <AccordionItem value="elementos" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Blocks className="w-4 h-4 text-[#a78bfa]" /> Elementos {elements.length > 0 && <span className="text-[10px] bg-[#a78bfa] text-white rounded-full px-1.5">{elements.length}</span>}</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <p className="text-[10px] text-muted-foreground">Arraste ou clique para adicionar elementos ao checkout</p>

                <CheckoutElementsSidebar
                  elements={elements}
                  onAddElement={addElement}
                  onRemoveElement={removeElement}
                  onToggleElement={toggleElement}
                  onSelectElement={handleSelectElement}
                  onMoveElement={moveElement}
                  selectedElementId={selectedElementId}
                  onDragStart={handleDragStart}
                />

                {/* Element editor for selected element — below the list so it's visible after click */}
                {selectedElementId && elements.find(e => e.id === selectedElementId) && (
                  <div ref={(node) => { if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>
                    <CheckoutElementEditor
                      element={elements.find(e => e.id === selectedElementId)!}
                      onUpdate={updateElementContent}
                      onUpdatePosition={updateElementPosition}
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* RIGHT: Live Preview (60%) */}
        <div className="lg:col-span-3 sticky top-4">
          <Card className="border-[#2A2A2A] overflow-hidden" style={{ minHeight: "calc(100vh - 220px)" }}>
            <CardHeader className="py-2 px-4 border-b border-[#2A2A2A] flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono ml-2">
                  {platformCheckoutDomain}/pay/{checkoutName ? checkoutName.toLowerCase().replace(/\s+/g, "-") : "preview"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {formatOptions.find(f => f.value === config.format)?.label}
                </span>
                {activeTemplateName && (
                  <span className="rounded border border-border bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {activeTemplateName}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent
              ref={previewPaneRef}
              className={`flex items-start justify-center overflow-auto ${previewMode === "mobile" ? "p-4" : "p-0"}`}
              style={{ height: "calc(100vh - 280px)", background: previewMode === "mobile" ? "#1a1a2e" : "transparent" }}
            >
              <div
                style={previewMode === "mobile" ? {
                  width: 320,
                  maxWidth: "none",
                  transformOrigin: "top center",
                  transform: `scale(${previewScale})`,
                  margin: "0 auto",
                  flexShrink: 0,
                  borderRadius: "28px",
                  overflow: "hidden",
                  boxShadow: "0 0 32px rgba(0,0,0,0.3)",
                  border: "6px solid #333",
                } : {
                  width: previewViewportWidth,
                  maxWidth: "none",
                  transformOrigin: "top center",
                  transform: `scale(${previewScale})`,
                  margin: "0 auto",
                  flexShrink: 0,
                }}
              >
                <CheckoutPreview 
                  key={`${config.templateId}-${config.format}`}
                  config={config} 
                  templateName={activeTemplateName}
                  elements={elements}
                  isBuilder={true}
                  onSelectElement={handleSelectElement}
                  selectedElementId={selectedElementId}
                  onDropElement={(type, position) => addElement(type, position)}
                  previewMode={previewMode}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}