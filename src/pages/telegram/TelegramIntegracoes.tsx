import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import logoUtmify from "@/assets/logo-utmify.png";
import logoMeta from "@/assets/logo-meta.png";

interface Integration {
  id: "utmify" | "pixel-meta";
  name: string;
  description: string;
  logo: string;
  fields: { key: string; label: string; placeholder: string }[];
}

const integrations: Integration[] = [
  {
    id: "utmify",
    name: "UTMify",
    description: "Faça o rastreamento de campanhas de marketing",
    logo: logoUtmify,
    fields: [
      { key: "api_token", label: "Token da API", placeholder: "Cole seu token UTMify" },
    ],
  },
  {
    id: "pixel-meta",
    name: "Pixel Meta",
    description: "Faça o rastreamento de campanhas de marketing",
    logo: logoMeta,
    fields: [
      { key: "pixel_id", label: "ID do Pixel", placeholder: "Ex: 1234567890" },
      { key: "access_token", label: "Token de acesso", placeholder: "Cole seu token de acesso" },
    ],
  },
];

export default function TelegramIntegracoes() {
  const [open, setOpen] = useState<Integration | null>(null);
  const [linked, setLinked] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSave = () => {
    if (!open) return;
    setLinked((prev) => ({ ...prev, [open.id]: true }));
    toast.success(`${open.name} vinculado com sucesso`);
    setOpen(null);
    setValues({});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Traqueamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Traqueamento</p>
        </div>
        <button className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
          <Youtube className="w-4 h-4 text-red-500" />
          Assistir tutorial
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((it) => {
          const isLinked = linked[it.id];
          return (
            <Card
              key={it.id}
              className="flex items-center gap-4 p-4 hover:shadow-md transition-shadow"
            >
              <img
                src={it.logo}
                alt={`${it.name} logo`}
                width={80}
                height={80}
                loading="lazy"
                className="w-20 h-20 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{it.name}</h3>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {it.description}
                </p>
                <Button
                  size="sm"
                  variant={isLinked ? "outline" : "default"}
                  onClick={() => setOpen(it)}
                >
                  {isLinked ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Conectado
                    </>
                  ) : (
                    "Vincular conta"
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular {open?.name}</DialogTitle>
            <DialogDescription>
              Preencha as credenciais para conectar sua conta {open?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {open?.fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  placeholder={f.placeholder}
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Vincular conta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}