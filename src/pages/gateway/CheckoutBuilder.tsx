import { useState, useEffect } from "react";
import { ArrowLeft, Save, Eye, Loader2, Palette, CreditCard, FormInput, ShoppingBag, Gift, Code, Layout, Settings2, Upload } from "lucide-react";
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
import { toast } from "sonner";
import CheckoutPreview from "@/components/gateway/CheckoutPreview";

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
  font: "inter",
  theme: "light" as const,
  borderStyle: "rounded",
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
};

const formatOptions = [
  { value: "full_page", label: "Página Completa", desc: "URL própria, ideal para anúncios" },
  { value: "modal", label: "Modal Pop-up", desc: "Abre sobre a página sem redirecionar" },
  { value: "inline", label: "Inline / Embed", desc: "Via <iframe> ou <script>" },
  { value: "one_step", label: "One Step", desc: "Tudo em uma tela" },
  { value: "multi_step", label: "Multi Step", desc: "Dados → Entrega → Pagamento → Confirmação" },
];

export default function CheckoutBuilder() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditing = !!editId;
  const [config, setConfig] = useState(defaultConfig);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [checkoutName, setCheckoutName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.from("gateway_products" as any).select("*").order("name");
      setProducts((data || []) as any[]);

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
          if (ck.config) {
            setConfig(prev => ({ ...prev, ...ck.config }));
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [editId]);

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const selectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p: any) => p.id === productId);
    if (prod) {
      updateConfig("productName", prod.name);
      updateConfig("price", prod.price);
      updateConfig("productImage", prod.image_url || "");
    }
  };

  const handleSave = async () => {
    if (!checkoutName) { toast.error("Informe um nome para o checkout"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);

    if (isEditing) {
      const { error } = await supabase.from("gateway_checkouts" as any)
        .update({
          name: checkoutName,
          product_id: selectedProductId || null,
          config: config as any,
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
        config: config as any,
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
            <h1 className="text-xl font-bold text-foreground">Construtor de Checkout</h1>
            <p className="text-xs text-muted-foreground">Configure e visualize em tempo real</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full text-xs"><Eye className="w-3.5 h-3.5 mr-1.5" /> Preview</Button>
          <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full px-5 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            {isEditing ? "Atualizar Checkout" : "Salvar Checkout"}
          </Button>
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

          <Accordion type="multiple" defaultValue={["produto", "formato", "aparencia", "pagamento", "campos"]} className="space-y-2">
            {/* BLOCO A: Produto & Oferta */}
            <AccordionItem value="produto" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-[#FF4D2E]" /> Produto & Oferta</div>
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
                    <Label className="text-xs">Preço de venda (centavos)</Label>
                    <Input type="number" value={config.price} onChange={e => updateConfig("price", parseInt(e.target.value) || 0)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Preço "de" riscado</Label>
                    <Input type="number" value={config.originalPrice} onChange={e => updateConfig("originalPrice", parseInt(e.target.value) || 0)} className="mt-1" />
                  </div>
                </div>
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
                <div className="flex items-center gap-2"><Layout className="w-4 h-4 text-[#FF4D2E]" /> Formato</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-1 gap-2">
                  {formatOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateConfig("format", opt.value)}
                      className="text-left p-3 rounded-lg border transition-all"
                      style={{
                        borderColor: config.format === opt.value ? "#FF4D2E" : "#2A2A2A",
                        background: config.format === opt.value ? "rgba(255,77,46,0.08)" : "transparent",
                      }}
                    >
                      <p className="text-xs font-medium" style={{ color: config.format === opt.value ? "#FF4D2E" : undefined }}>{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO C: Aparência */}
            <AccordionItem value="aparencia" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Palette className="w-4 h-4 text-[#FF4D2E]" /> Aparência & Tema</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                {/* Logo */}
                <div>
                  <Label className="text-xs">Logo do Checkout</Label>
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
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Cor primária</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <input type="color" value={config.primaryColor} onChange={e => updateConfig("primaryColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                      <Input value={config.primaryColor} onChange={e => updateConfig("primaryColor", e.target.value)} className="text-[10px] font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Fundo</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <input type="color" value={config.bgColor} onChange={e => updateConfig("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                      <Input value={config.bgColor} onChange={e => updateConfig("bgColor", e.target.value)} className="text-[10px] font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Texto</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <input type="color" value={config.textColor} onChange={e => updateConfig("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                      <Input value={config.textColor} onChange={e => updateConfig("textColor", e.target.value)} className="text-[10px] font-mono" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Fonte</Label>
                  <Select value={config.font} onValueChange={v => updateConfig("font", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inter">Inter</SelectItem>
                      <SelectItem value="plus_jakarta">Plus Jakarta Sans</SelectItem>
                      <SelectItem value="roboto">Roboto</SelectItem>
                      <SelectItem value="montserrat">Montserrat</SelectItem>
                      <SelectItem value="poppins">Poppins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tema</Label>
                  <div className="flex gap-2 mt-1">
                    {(["dark", "light", "custom"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => updateConfig("theme", t)}
                        className="flex-1 py-2 text-xs font-medium rounded-lg border transition-all"
                        style={{
                          borderColor: config.theme === t ? "#FF4D2E" : "#2A2A2A",
                          background: config.theme === t ? "rgba(255,77,46,0.08)" : "transparent",
                          color: config.theme === t ? "#FF4D2E" : undefined,
                        }}
                      >
                        {t === "dark" ? "Escuro" : t === "light" ? "Claro" : "Custom"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Bordas</Label>
                  <div className="flex gap-2 mt-1">
                    {["rounded", "square", "pill"].map(s => (
                      <button
                        key={s}
                        onClick={() => updateConfig("borderStyle", s)}
                        className="flex-1 py-2 text-xs rounded-lg border transition-all"
                        style={{
                          borderColor: config.borderStyle === s ? "#FF4D2E" : "#2A2A2A",
                          background: config.borderStyle === s ? "rgba(255,77,46,0.08)" : "transparent",
                          color: config.borderStyle === s ? "#FF4D2E" : undefined,
                        }}
                      >
                        {s === "rounded" ? "Arredondado" : s === "square" ? "Quadrado" : "Pill"}
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

            {/* BLOCO D: Pagamento */}
            <AccordionItem value="pagamento" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#FF4D2E]" /> Métodos de Pagamento</div>
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
                <div className="flex items-center gap-2"><FormInput className="w-4 h-4 text-[#FF4D2E]" /> Campos do Formulário</div>
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
                <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-[#FF4D2E]" /> Order Bump & Upsell</div>
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
                      <Label className="text-xs">Preço (centavos)</Label>
                      <Input type="number" value={config.orderBumpPrice} onChange={e => updateConfig("orderBumpPrice", parseInt(e.target.value) || 0)} className="mt-1" />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* BLOCO H: Código de Integração */}
            <AccordionItem value="codigo" className="border-[#2A2A2A] rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2"><Code className="w-4 h-4 text-[#FF4D2E]" /> Código de Integração</div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <Tabs defaultValue="link">
                  <TabsList className="bg-muted/50 w-full">
                    <TabsTrigger value="link" className="text-xs flex-1">Link Direto</TabsTrigger>
                    <TabsTrigger value="embed" className="text-xs flex-1">Embed HTML</TabsTrigger>
                    <TabsTrigger value="js" className="text-xs flex-1">JavaScript</TabsTrigger>
                  </TabsList>
                  <TabsContent value="link" className="mt-3">
                    <div className="p-3 rounded-lg bg-muted/30 border border-[#2A2A2A]">
                      <code className="text-[10px] font-mono text-muted-foreground break-all">
                        https://pay.zaplynx.com/c/{checkoutName ? checkoutName.toLowerCase().replace(/\s+/g, "-") : "meu-checkout"}
                      </code>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs w-full" onClick={() => { navigator.clipboard.writeText(`https://pay.zaplynx.com/c/${checkoutName?.toLowerCase().replace(/\s+/g, "-") || "meu-checkout"}`); toast.success("Copiado!"); }}>
                      Copiar Link
                    </Button>
                  </TabsContent>
                  <TabsContent value="embed" className="mt-3">
                    <div className="p-3 rounded-lg bg-muted/30 border border-[#2A2A2A]">
                      <code className="text-[10px] font-mono text-muted-foreground break-all">
                        {`<iframe src="https://pay.zaplynx.com/c/${checkoutName?.toLowerCase().replace(/\s+/g, "-") || "meu-checkout"}" width="100%" height="700" frameborder="0"></iframe>`}
                      </code>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs w-full" onClick={() => toast.success("Copiado!")}>
                      Copiar Código
                    </Button>
                  </TabsContent>
                  <TabsContent value="js" className="mt-3">
                    <div className="p-3 rounded-lg bg-muted/30 border border-[#2A2A2A]">
                      <code className="text-[10px] font-mono text-muted-foreground break-all">
                        {`<script src="https://pay.zaplynx.com/js/checkout.js" data-checkout="${checkoutName?.toLowerCase().replace(/\s+/g, "-") || "meu-checkout"}"></script>`}
                      </code>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 rounded-full text-xs w-full" onClick={() => toast.success("Copiado!")}>
                      Copiar Script
                    </Button>
                  </TabsContent>
                </Tabs>
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
                  pay.zaplynx.com/c/{checkoutName ? checkoutName.toLowerCase().replace(/\s+/g, "-") : "preview"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatOptions.find(f => f.value === config.format)?.label}
              </span>
            </CardHeader>
            <CardContent className="p-0" style={{ minHeight: "calc(100vh - 280px)" }}>
              <CheckoutPreview config={config} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}