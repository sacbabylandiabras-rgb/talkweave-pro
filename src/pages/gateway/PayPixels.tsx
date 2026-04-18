import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, Eye, EyeOff, Facebook, BarChart3, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useGatewayPixels, PixelConfig } from "@/hooks/useGatewayPixels";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const EVENTS = ["Purchase", "InitiateCheckout", "AddPaymentInfo", "Lead"];

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.2 8.2 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.14z" />
  </svg>
);

interface PlatformDef {
  key: string;
  name: string;
  icon: LucideIcon | React.FC<{ className?: string }>;
  iconColor: string;
  fields: { key: string; label: string; placeholder: string; isExtra?: boolean; secret?: boolean }[];
}

const PLATFORMS: PlatformDef[] = [
  {
    key: "meta",
    name: "Meta Pixel",
    icon: Facebook,
    iconColor: "text-blue-500",
    fields: [
      { key: "pixel_id", label: "Pixel ID", placeholder: "123456789" },
      { key: "api_token", label: "Conversions API Token", placeholder: "EAAGx...", secret: true },
      { key: "test_event_code", label: "Test Event Code (opcional)", placeholder: "TEST12345", isExtra: true },
    ],
  },
  {
    key: "tiktok",
    name: "TikTok Pixel",
    icon: TikTokIcon,
    iconColor: "text-pink-500",
    fields: [
      { key: "pixel_id", label: "Pixel ID", placeholder: "C1234567890" },
      { key: "api_token", label: "Access Token", placeholder: "token...", secret: true },
    ],
  },
  {
    key: "google",
    name: "Google Ads / GA4",
    icon: BarChart3,
    iconColor: "text-amber-500",
    fields: [
      { key: "pixel_id", label: "Tag ID", placeholder: "AW-123456789" },
      { key: "conversion_label", label: "Conversion Label", placeholder: "abc123", isExtra: true },
      { key: "conversion_id", label: "Conversion ID", placeholder: "123456789", isExtra: true },
    ],
  },
];

interface PixelFormState {
  pixel_id: string;
  api_token: string;
  extra_config: Record<string, string>;
  events: string[];
  active: boolean;
}

function PixelCard({
  platform,
  existingPixel,
  onSave,
  onDelete,
}: {
  platform: PlatformDef;
  existingPixel?: PixelConfig;
  onSave: (data: Partial<PixelConfig> & { platform: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<PixelFormState>({
    pixel_id: existingPixel?.pixel_id || "",
    api_token: existingPixel?.api_token || "",
    extra_config: (existingPixel?.extra_config as Record<string, string>) || {},
    events: existingPixel?.events || ["Purchase"],
    active: existingPixel?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (existingPixel) {
      setForm({
        pixel_id: existingPixel.pixel_id || "",
        api_token: existingPixel.api_token || "",
        extra_config: (existingPixel.extra_config as Record<string, string>) || {},
        events: existingPixel.events || ["Purchase"],
        active: existingPixel.active ?? true,
      });
    }
  }, [existingPixel]);

  const handleFieldChange = (key: string, value: string, isExtra?: boolean) => {
    if (isExtra) {
      setForm(prev => ({ ...prev, extra_config: { ...prev.extra_config, [key]: value } }));
    } else if (key === "pixel_id") {
      setForm(prev => ({ ...prev, pixel_id: value }));
    } else if (key === "api_token") {
      setForm(prev => ({ ...prev, api_token: value }));
    }
  };

  const toggleEvent = (event: string) => {
    setForm(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      id: existingPixel?.id,
      platform: platform.key,
      pixel_id: form.pixel_id,
      api_token: form.api_token,
      extra_config: form.extra_config,
      events: form.events,
      active: form.active,
    });
    setSaving(false);
  };

  const getFieldValue = (field: PlatformDef["fields"][0]) => {
    if (field.isExtra) return form.extra_config[field.key] || "";
    if (field.key === "pixel_id") return form.pixel_id;
    if (field.key === "api_token") return form.api_token;
    return "";
  };

  const hasChanges = existingPixel
    ? form.pixel_id !== existingPixel.pixel_id ||
      form.api_token !== existingPixel.api_token ||
      JSON.stringify(form.events) !== JSON.stringify(existingPixel.events) ||
      JSON.stringify(form.extra_config) !== JSON.stringify(existingPixel.extra_config) ||
      form.active !== existingPixel.active
    : form.pixel_id.length > 0;

  return (
    <Card className="border-[#2A2A2A]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <platform.icon className={`w-4 h-4 ${platform.iconColor}`} /> {platform.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {existingPixel && (
              <Badge className={existingPixel.active ? "bg-emerald-500/10 text-emerald-400 border-0 text-[10px]" : "bg-muted text-muted-foreground border-0 text-[10px]"}>
                {existingPixel.active ? "Ativo" : "Inativo"}
              </Badge>
            )}
            <Switch
              checked={form.active}
              onCheckedChange={(checked) => setForm(prev => ({ ...prev, active: checked }))}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {platform.fields.map(f => (
          <div key={f.key}>
            <Label className="text-xs">{f.label}</Label>
            <div className="relative mt-1">
              <Input
                type={f.secret && !showSecrets[f.key] ? "password" : "text"}
                placeholder={f.placeholder}
                value={getFieldValue(f)}
                onChange={(e) => handleFieldChange(f.key, e.target.value, f.isExtra)}
              />
              {f.secret && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecrets(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                >
                  {showSecrets[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        ))}

        <div>
          <Label className="text-xs mb-2 block">Eventos de Rastreamento</Label>
          <div className="grid grid-cols-2 gap-2">
            {EVENTS.map(ev => (
              <div key={ev} className="flex items-center gap-2">
                <Switch
                  checked={form.events.includes(ev)}
                  onCheckedChange={() => toggleEvent(ev)}
                />
                <span className="text-xs">{ev}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full text-xs"
            disabled={!hasChanges || saving}
            onClick={handleSave}
          >
            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
            Salvar
          </Button>
          {existingPixel && onDelete && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-xs text-red-400 hover:text-red-300"
              onClick={() => onDelete(existingPixel.id)}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Remover
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PayPixels() {
  const { pixels, loading, savePixel, deletePixel } = useGatewayPixels();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4D2E]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de Pixels</h1>
        <p className="text-sm text-muted-foreground">Configure seus pixels de rastreamento para acompanhar conversões</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map(platform => {
          const existing = pixels.find(p => p.platform === platform.key);
          return (
            <PixelCard
              key={platform.key}
              platform={platform}
              existingPixel={existing}
              onSave={savePixel}
              onDelete={deletePixel}
            />
          );
        })}
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-sm">Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Configure o <strong>Pixel ID</strong> e o <strong>Token de API</strong> da plataforma desejada</p>
          <p>2. Selecione os <strong>eventos</strong> que deseja rastrear (Purchase, InitiateCheckout, etc.)</p>
          <p>3. Os eventos serão disparados automaticamente quando um cliente interagir com seu checkout</p>
          <p>4. Use o <strong>Test Event Code</strong> (Meta) para validar antes de ativar em produção</p>
        </CardContent>
      </Card>

      <CapturedEventsCard activePixels={pixels.filter(p => p.active)} />
    </div>
  );
}

function CapturedEventsCard({ activePixels: _ }: { activePixels: PixelConfig[] }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("pixel_event_logs")
      .select("id, platform, event_name, status, http_status, value, currency, customer_name, customer_email, error_message, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("pixel-event-logs-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pixel_event_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const platformLabels: Record<string, string> = {
    meta: "Meta",
    tiktok: "TikTok",
    google: "Google Ads",
  };

  const statusBadge = (status: string) => {
    if (status === "success") return "bg-green-500/10 text-green-500 border-green-500/30";
    if (status === "error") return "bg-red-500/10 text-red-500 border-red-500/30";
    return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
  };

  return (
    <Card className="border-[#2A2A2A]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">Eventos capturados (CAPI real)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Disparos reais enviados via Conversions API. Cada linha é uma chamada HTTP confirmada.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum disparo CAPI registrado ainda. Os eventos aparecerão aqui em tempo real após cada venda aprovada.
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[#2A2A2A] bg-background/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className={statusBadge(ev.status)}>
                    {ev.event_name}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {platformLabels[ev.platform] || ev.platform}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ev.customer_name || ev.customer_email || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: ptBR })}
                      {ev.http_status ? ` · HTTP ${ev.http_status}` : ""}
                      {ev.error_message ? ` · ${ev.error_message}` : ""}
                    </p>
                  </div>
                </div>
                {ev.value ? (
                  <span className="text-sm font-semibold tabular-nums flex-shrink-0">
                    R$ {Number(ev.value).toFixed(2).replace(".", ",")}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
