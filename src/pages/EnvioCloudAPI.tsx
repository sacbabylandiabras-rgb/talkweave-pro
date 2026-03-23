import { useState } from "react";
import { Send, Users, FileText, ChevronDown, Plus, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function EnvioCloudAPI() {
  const [sendType, setSendType] = useState<"single" | "bulk">("single");
  const [phone, setPhone] = useState("");
  const [template, setTemplate] = useState("");
  const [variables, setVariables] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);

  const mockTemplates = [
    { id: "1", name: "boas_vindas_cliente", vars: 1 },
    { id: "2", name: "confirmacao_pedido", vars: 3 },
    { id: "5", name: "lembrete_pagamento", vars: 3 },
  ];

  const selectedTemplate = mockTemplates.find((t) => t.id === template);

  const handleSend = () => {
    if (!phone || !template) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success("Mensagem enviada via Cloud API!");
      setPhone("");
    }, 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Envio via Cloud API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie mensagens utilizando a API oficial do WhatsApp Business
        </p>
      </div>

      {/* Send type tabs */}
      <div className="flex gap-2">
        <Button
          variant={sendType === "single" ? "default" : "outline"}
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setSendType("single")}
        >
          <Phone className="w-3.5 h-3.5" />
          Envio Individual
        </Button>
        <Button
          variant={sendType === "bulk" ? "default" : "outline"}
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setSendType("bulk")}
        >
          <Users className="w-3.5 h-3.5" />
          Envio em Massa
        </Button>
      </div>

      <Card className="p-5 space-y-5">
        {/* Destination */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {sendType === "single" ? "Número do destinatário" : "Lista de contatos"}
          </Label>
          {sendType === "single" ? (
            <Input
              placeholder="+55 11 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 text-sm"
            />
          ) : (
            <div className="border border-dashed border-border rounded-lg p-6 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                Selecione uma lista de contatos ou importe um CSV
              </p>
              <Button variant="outline" size="sm" className="mt-3 text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Selecionar contatos
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Template selection */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Template aprovado
            <Badge variant="secondary" className="text-[9px]">Obrigatório</Badge>
          </Label>
          <Select value={template} onValueChange={(v) => {
            setTemplate(v);
            const t = mockTemplates.find((mt) => mt.id === v);
            if (t) setVariables(Array(t.vars).fill(""));
          }}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione um template aprovado" />
            </SelectTrigger>
            <SelectContent>
              {mockTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-sm">
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Apenas templates com status "Aprovado" pela Meta podem ser usados para envio.
          </p>
        </div>

        {/* Variables */}
        {selectedTemplate && selectedTemplate.vars > 0 && (
          <div className="space-y-3">
            <Label className="text-xs font-medium">Variáveis do template</Label>
            {variables.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                  {`{{${i + 1}}}`}
                </Badge>
                <Input
                  placeholder={`Valor para variável ${i + 1}`}
                  value={v}
                  onChange={(e) => {
                    const next = [...variables];
                    next[i] = e.target.value;
                    setVariables(next);
                  }}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Info box */}
        <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1">
          <p className="text-[11px] font-medium text-foreground">Informações do envio</p>
          <ul className="text-[10px] text-muted-foreground space-y-0.5">
            <li>• Mensagens enviadas via WhatsApp Cloud API v21.0</li>
            <li>• Apenas templates aprovados podem ser utilizados</li>
            <li>• Conversas de marketing consomem créditos da Meta</li>
            <li>• Rate limit: 80 mensagens/segundo (Business Tier)</li>
          </ul>
        </div>

        <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {sending ? "Enviando..." : "Enviar via Cloud API"}
        </Button>
      </Card>
    </div>
  );
}
