import { useState } from "react";
import { Plus, TestTube, Code, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const events = ["Purchase", "InitiateCheckout", "AddPaymentInfo", "Lead"];

function PixelCard({ name, fields }: { name: string; fields: { label: string; placeholder: string }[] }) {
  return (
    <Card className="border-[#2A2A2A]">
      <CardHeader>
        <CardTitle className="text-sm">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map(f => (
          <div key={f.label}>
            <Label className="text-xs">{f.label}</Label>
            <Input placeholder={f.placeholder} className="mt-1" />
          </div>
        ))}
        <div>
          <Label className="text-xs mb-2 block">Eventos</Label>
          <div className="grid grid-cols-2 gap-2">
            {events.map(ev => (
              <div key={ev} className="flex items-center gap-2">
                <Switch defaultChecked={ev === "Purchase"} />
                <span className="text-xs">{ev}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full text-xs"><TestTube className="w-3 h-3 mr-1" /> Verificar</Button>
          <Button variant="outline" size="sm" className="rounded-full text-xs"><Code className="w-3 h-3 mr-1" /> Snippet</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PayPixels() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de Pixels</h1>
        <p className="text-sm text-muted-foreground">Configure seus pixels de rastreamento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PixelCard name="Meta Pixel" fields={[
          { label: "Pixel ID", placeholder: "123456789" },
          { label: "Conversions API Token", placeholder: "EAAGx..." },
          { label: "Test Event Code", placeholder: "TEST12345" },
        ]} />
        <PixelCard name="TikTok Pixel" fields={[
          { label: "Pixel ID", placeholder: "C1234567890" },
          { label: "Access Token", placeholder: "token..." },
        ]} />
        <PixelCard name="Google Ads / GA4" fields={[
          { label: "Tag ID", placeholder: "AW-123456789" },
          { label: "Conversion Label", placeholder: "abc123" },
          { label: "Conversion ID", placeholder: "123456789" },
        ]} />
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Eventos Recentes</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda. Configure seus pixels para começar.</p>
        </CardContent>
      </Card>
    </div>
  );
}
