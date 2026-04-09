import { useState, useEffect } from "react";
import { Save, Palette, CreditCard, FormInput, Layout, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCheckoutDefaults, CheckoutDefaults, emptyDefaults } from "@/hooks/useCheckoutDefaults";
import { toast } from "sonner";

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

export default function CheckoutDefaultsTab() {
  const { defaults, loading, saving, saveDefaults, applyToAllCheckouts } = useCheckoutDefaults();
  const [form, setForm] = useState<CheckoutDefaults>(emptyDefaults);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!loading) setForm(defaults);
  }, [loading, defaults]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
              <Label className="text-xs">Logo URL</Label>
              <Input value={form.logoUrl} onChange={e => updateForm("logoUrl", e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Favicon URL</Label>
              <Input value={form.faviconUrl} onChange={e => updateForm("faviconUrl", e.target.value)} placeholder="https://..." className="mt-1" />
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
          <div className="grid grid-cols-3 gap-4">
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
              { key: "creditCard" as const, label: "Cartão de Crédito" },
              { key: "debitCard" as const, label: "Cartão de Débito" },
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
  );
}
