import { useState, useEffect, useRef } from "react";
import { Save, Palette, CreditCard, FormInput, Layout, RefreshCw, Loader2, CheckCircle2, Upload, Monitor, Smartphone, Eye, EyeOff, Blocks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCheckoutDefaults, CheckoutDefaults, emptyDefaults } from "@/hooks/useCheckoutDefaults";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CheckoutTemplateGallery from "@/components/gateway/CheckoutTemplateGallery";
import CheckoutPreview from "@/components/gateway/CheckoutPreview";
import CheckoutElementsSidebar from "@/components/gateway/checkout-elements/CheckoutElementsSidebar";
import CheckoutElementEditor from "@/components/gateway/checkout-elements/CheckoutElementEditor";
import { CheckoutElement, CheckoutElementType, ElementPosition, ELEMENT_DEFINITIONS, generateElementId } from "@/components/gateway/checkout-elements/types";

const TEMPLATE_OPTIONS = [
  { value: "none", label: "Nenhum (padrão)" },
  { value: "minimalista", label: "Minimalista" },
  { value: "alto-impacto", label: "Alto Impacto" },
  { value: "tiktok", label: "TokLynx / TikTok" },
  { value: "streamline", label: "Streamline" },
  { value: "lynxfy", label: "LynxFy" },
  { value: "confianca", label: "Confiança" },
];

const FONT_OPTIONS = [
  { value: "inter", label: "Inter" },
  { value: "poppins", label: "Poppins" },
  { value: "roboto", label: "Roboto" },
  { value: "montserrat", label: "Montserrat" },
  { value: "open-sans", label: "Open Sans" },
];

const STEP_STYLES = [
  { value: "circles", label: "Círculos" },
  { value: "pills", label: "Pills" },
  { value: "progress", label: "Barra" },
];

const FORMAT_OPTIONS = [
  { value: "multi_step", label: "Multi Etapas" },
  { value: "one_step", label: "Uma Etapa" },
  { value: "modal", label: "Modal" },
  { value: "inline", label: "Inline" },
];

const STEP_COUNT_OPTIONS = [
  { value: "3", label: "3 Etapas (Identificação, Conferência, Pagamento)" },
  { value: "4", label: "4 Etapas (Identificação, Endereço, Conferência, Pagamento)" },
];

function PreviewFrame({ previewMode, children }: { previewMode: "desktop" | "mobile"; children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const baseWidth = previewMode === "desktop" ? 800 : 375;

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.offsetWidth;
        let s = availableWidth / baseWidth;
        if (previewMode === "mobile") {
          s = Math.min(s, 0.85);
        }
        setScale(s);
      }
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [baseWidth]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-auto border border-border bg-muted/20"
      style={{ height: "calc(100vh - 140px)" }}
    >
      <div style={{
        width: baseWidth,
        transform: `scale(${scale})`,
        transformOrigin: previewMode === "mobile" ? "top center" : "top left",
        margin: previewMode === "mobile" ? "0 auto" : undefined,
      }}>
        {children}
      </div>
    </div>
  );
}

export default function CheckoutDefaultsTab() {
  const { defaults, loading, saving, saveDefaults, applyToAllCheckouts } = useCheckoutDefaults();
  const [form, setForm] = useState<CheckoutDefaults>(emptyDefaults);
  const [applying, setApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [elements, setElements] = useState<CheckoutElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setForm(defaults);
      setElements(defaults.elements || []);
    }
  }, [loading, defaults]);

  // Sync elements back to form
  useEffect(() => {
    setForm(prev => ({ ...prev, elements }));
  }, [elements]);

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
    setSelectedElementId(newEl.id);
  };

  const removeElement = (id: string) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
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

  const handleImageUpload = async (file: File, field: "logoUrl" | "faviconUrl") => {
    const setUploading = field === "logoUrl" ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      updateForm(field, urlData.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const updateForm = (key: keyof CheckoutDefaults, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const ok = await saveDefaults(form);
    if (ok) toast.success("Configurações globais salvas!");
    else toast.error("Erro ao salvar configurações");
  };

  const handleApplyAll = async () => {
    setApplying(true);
    const ok = await saveDefaults(form);
    if (!ok) { toast.error("Erro ao salvar"); setApplying(false); return; }
    const count = await applyToAllCheckouts(form);
    setApplying(false);
    if (count > 0) toast.success(`Configuração aplicada a ${count} checkout(s)!`);
    else toast("Nenhum checkout encontrado para atualizar");
  };

  const handleApplyTemplate = (settings: Record<string, any>, _name: string, templateId: string) => {
    setForm(prev => ({ ...prev, ...settings, templateId }));
    toast.success("Modelo aplicado! Salve para confirmar.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Config Panel */}
      <div className={`space-y-4 ${showPreview ? "w-[55%] flex-shrink-0" : "w-full"} min-w-0`}>
        {/* Preview Toggle */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? "Ocultar Preview" : "Mostrar Preview"}
          </Button>
        </div>
      {/* Modelos */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Layout className="w-4 h-4" /> Modelo de Checkout
          </CardTitle>
          <CardDescription className="text-xs">Escolha um modelo visual como base</CardDescription>
        </CardHeader>
        <CardContent>
          <CheckoutTemplateGallery onApply={handleApplyTemplate} activeTemplateId={form.templateId} />
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4" /> Aparência
          </CardTitle>
          <CardDescription className="text-xs">Cores, fontes e estilo visual padrão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Logo</Label>
              <input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0], "logoUrl"); }} />
              <div className="flex items-center gap-2 mt-1">
                {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="w-8 h-8 rounded object-contain border border-border" />}
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" disabled={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                  {uploadingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {form.logoUrl ? "Trocar" : "Enviar"}
                </Button>
                {form.logoUrl && <Input value={form.logoUrl} onChange={e => updateForm("logoUrl", e.target.value)} className="flex-1 text-xs" placeholder="URL" />}
              </div>
            </div>
            <div>
              <Label className="text-xs">Favicon</Label>
              <input type="file" accept="image/*" ref={faviconInputRef} className="hidden" onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0], "faviconUrl"); }} />
              <div className="flex items-center gap-2 mt-1">
                {form.faviconUrl && <img src={form.faviconUrl} alt="Favicon" className="w-6 h-6 rounded object-contain border border-border" />}
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" disabled={uploadingFavicon} onClick={() => faviconInputRef.current?.click()}>
                  {uploadingFavicon ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {form.faviconUrl ? "Trocar" : "Enviar"}
                </Button>
                {form.faviconUrl && <Input value={form.faviconUrl} onChange={e => updateForm("faviconUrl", e.target.value)} className="flex-1 text-xs" placeholder="URL" />}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Cor Primária</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.primaryColor} onChange={e => updateForm("primaryColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={form.primaryColor} onChange={e => updateForm("primaryColor", e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor do Botão</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.buttonColor} onChange={e => updateForm("buttonColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={form.buttonColor} onChange={e => updateForm("buttonColor", e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Fundo</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.bgColor} onChange={e => updateForm("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={form.bgColor} onChange={e => updateForm("bgColor", e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Texto</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.textColor} onChange={e => updateForm("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={form.textColor} onChange={e => updateForm("textColor", e.target.value)} className="flex-1 text-xs" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Fonte</Label>
              <Select value={form.font} onValueChange={v => updateForm("font", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Template Padrão</Label>
              <Select value={form.templateId || "none"} onValueChange={v => updateForm("templateId", v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TEMPLATE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estilo das Etapas</Label>
              <Select value={form.stepIndicatorStyle} onValueChange={v => updateForm("stepIndicatorStyle", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STEP_STYLES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Formato do Checkout</Label>
              <Select value={form.format} onValueChange={v => updateForm("format", v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Label className="text-xs">Quantidade de Etapas</Label>
            <Select value={String(form.checkoutSteps || "3")} onValueChange={v => updateForm("checkoutSteps", v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{STEP_COUNT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pagamento */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Métodos de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "pix" as const, label: "PIX" },
              { key: "creditCard" as const, label: "Cartão de Crédito/Débito" },
              { key: "boleto" as const, label: "Boleto" },
            ].map(method => (
              <div key={method.key} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <span className="text-sm">{method.label}</span>
                <Switch checked={form[method.key]} onCheckedChange={v => updateForm(method.key, v)} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Máximo de Parcelas</Label>
              <Select value={String(form.maxInstallments)} onValueChange={v => updateForm("maxInstallments", Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desconto PIX (%)</Label>
              <Input type="number" min={0} max={50} value={form.pixDiscount} onChange={e => updateForm("pixDiscount", Number(e.target.value))} className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campos do Formulário */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FormInput className="w-4 h-4" /> Campos do Formulário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "showCpf" as const, label: "CPF/CNPJ" },
              { key: "showPhone" as const, label: "Telefone" },
              { key: "showAddress" as const, label: "Endereço" },
              { key: "showBirthdate" as const, label: "Data de Nascimento" },
            ].map(field => (
              <div key={field.key} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                <span className="text-sm">{field.label}</span>
                <Switch checked={form[field.key]} onCheckedChange={v => updateForm(field.key, v)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Extras */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Layout className="w-4 h-4" /> Extras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
              <span className="text-sm">Selo de Garantia</span>
              <Switch checked={form.showGuarantee} onCheckedChange={v => updateForm("showGuarantee", v)} />
            </div>
            <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
              <span className="text-sm">Selos de Segurança</span>
              <Switch checked={form.showSecurityBadges} onCheckedChange={v => updateForm("showSecurityBadges", v)} />
            </div>
          </div>
          {form.showGuarantee && (
            <div>
              <Label className="text-xs">Dias de Garantia</Label>
              <Input type="number" min={0} max={365} value={form.guaranteeDays} onChange={e => updateForm("guaranteeDays", Number(e.target.value))} className="mt-1 w-32" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Nome da Empresa (rodapé)</Label>
              <Input value={form.footerCompanyName} onChange={e => updateForm("footerCompanyName", e.target.value)} placeholder="Sua Empresa LTDA" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">CNPJ (rodapé)</Label>
              <Input value={form.footerCnpj} onChange={e => updateForm("footerCnpj", e.target.value)} placeholder="00.000.000/0001-00" className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Elementos Personalizados */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Blocks className="w-4 h-4" /> Elementos {elements.length > 0 && <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">{elements.length}</span>}
          </CardTitle>
          <CardDescription className="text-xs">Adicione elementos personalizados ao checkout (banners, avisos, contadores, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CheckoutElementsSidebar
            elements={elements}
            onAddElement={addElement}
            onRemoveElement={removeElement}
            onToggleElement={toggleElement}
            onSelectElement={setSelectedElementId}
            onMoveElement={moveElement}
            selectedElementId={selectedElementId}
          />

          {selectedElementId && elements.find(e => e.id === selectedElementId) && (
            <CheckoutElementEditor
              element={elements.find(e => e.id === selectedElementId)!}
              onUpdate={updateElementContent}
              onUpdatePosition={updateElementPosition}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Padrão
        </Button>
        <Button onClick={handleApplyAll} disabled={applying} variant="outline" className="gap-2">
          {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Aplicar a Todos os Checkouts
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        "Salvar Padrão" define os valores iniciais para novos checkouts. "Aplicar a Todos" sobrescreve as configurações em todos os checkouts existentes.
      </p>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <div className="flex-1 min-w-0">
          <div className="sticky top-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">Preview</h3>
              <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
                <Button
                  variant={previewMode === "desktop" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPreviewMode("desktop")}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant={previewMode === "mobile" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <PreviewFrame previewMode={previewMode}>
              <CheckoutPreview config={form as any} previewMode={previewMode} />
            </PreviewFrame>
          </div>
        </div>
      )}
    </div>
  );
}
