import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy } from "lucide-react";
import { toast } from "sonner";

const MODELOS: Record<string, Partial<UtmFields>> = {
  personalizado: {},
  facebook: { source: "facebook", medium: "cpc", campaign: "" },
  instagram: { source: "instagram", medium: "social", campaign: "" },
  google: { source: "google", medium: "cpc", campaign: "" },
  tiktok: { source: "tiktok", medium: "cpc", campaign: "" },
};

interface UtmFields {
  source: string;
  campaign: string;
  medium: string;
  content: string;
  term: string;
  id: string;
}

const FIELDS: { key: keyof UtmFields; label: string; placeholder: string }[] = [
  { key: "source", label: "UTM Source", placeholder: "Ex: fonte" },
  { key: "campaign", label: "UTM Campaign", placeholder: "Ex: campanha" },
  { key: "medium", label: "UTM Medium", placeholder: "Ex: meio" },
  { key: "content", label: "UTM Content", placeholder: "Ex: conteudo" },
  { key: "term", label: "UTM Term", placeholder: "Ex: termo" },
  { key: "id", label: "UTM ID", placeholder: "Ex: id" },
];

const BASE_URL = "https://redirect.zaplynx.com.br/bot/access/490697";
const MAX_LEN = 200;

export default function TelegramLinksUtm() {
  const [modelo, setModelo] = useState("personalizado");
  const [fields, setFields] = useState<UtmFields>({
    source: "",
    campaign: "",
    medium: "",
    content: "",
    term: "",
    id: "",
  });

  const handleModelo = (value: string) => {
    setModelo(value);
    const preset = MODELOS[value] ?? {};
    setFields((prev) => ({ ...prev, ...preset } as UtmFields));
  };

  const handleField = (key: keyof UtmFields, val: string) => {
    setFields((prev) => ({ ...prev, [key]: val.slice(0, MAX_LEN) }));
  };

  const generatedUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (fields.source) params.append("utm_source", fields.source);
    if (fields.campaign) params.append("utm_campaign", fields.campaign);
    if (fields.medium) params.append("utm_medium", fields.medium);
    if (fields.content) params.append("utm_content", fields.content);
    if (fields.term) params.append("utm_term", fields.term);
    if (fields.id) params.append("utm_id", fields.id);
    const qs = params.toString();
    return qs ? `${BASE_URL}?${qs}` : BASE_URL;
  }, [fields]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Links UTMify</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gere os links UTM para seus anúncios de marketing
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">
            Gerador de Links UTM
          </h2>
          <p className="text-sm text-muted-foreground mt-1 pl-4">
            Gere os links UTM para seus anúncios de marketing
          </p>
        </div>

        <div className="space-y-2">
          <Label>
            Modelo UTM<span className="text-destructive">*</span>
          </Label>
          <Select value={modelo} onValueChange={handleModelo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personalizado">Personalizado</SelectItem>
              <SelectItem value="facebook">Facebook Ads</SelectItem>
              <SelectItem value="instagram">Instagram Ads</SelectItem>
              <SelectItem value="google">Google Ads</SelectItem>
              <SelectItem value="tiktok">TikTok Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={f.key}>
              {f.label}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id={f.key}
              placeholder={f.placeholder}
              maxLength={MAX_LEN}
              value={fields[f.key]}
              onChange={(e) => handleField(f.key, e.target.value)}
            />
          </div>
        ))}

        <div className="space-y-2 pt-4 border-t border-border">
          <Label>Link gerado</Label>
          <div className="relative">
            <Input value={generatedUrl} readOnly className="pr-12 text-xs" />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={handleCopy}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}