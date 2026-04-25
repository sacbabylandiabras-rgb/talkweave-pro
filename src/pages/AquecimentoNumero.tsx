import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Flame, Play, Pause, Plus, Trash2, Loader2, Activity, Clock, MessageSquare } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WarmupConfig {
  active: boolean;
  instanceIds: string[];
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
  messages: string[];
  contacts: string[];
}

const STORAGE_KEY = "zaplynx-warmup-config";

const defaultMessages = [
  "Oi! Tudo bem? 😊",
  "Como você está hoje?",
  "Bom dia! ☀️",
  "Boa tarde!",
  "Espero que esteja tudo bem por aí 👍",
  "Vamos conversar mais tarde?",
  "Ótimo dia para você!",
  "Obrigado pela atenção!",
];

export default function AquecimentoNumero() {
  const { instances: allInstances } = useZapiInstances();
  // Apenas instâncias Z-API do próprio usuário (exclui doadoras UAZAPI cadastradas pelo admin)
  const instances = useMemo(
    () => allInstances.filter((i) => (i.api_provider || 'zapi') === 'zapi'),
    [allInstances],
  );
  const [config, setConfig] = useState<WarmupConfig>({
    active: false,
    instanceIds: [],
    minDelay: 30,
    maxDelay: 120,
    dailyLimit: 50,
    messages: defaultMessages,
    contacts: [],
  });
  const [newMessage, setNewMessage] = useState("");
  const [bulkMessages, setBulkMessages] = useState("");
  const [contactsText, setContactsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WarmupConfig;
        setConfig(parsed);
        setContactsText((parsed.contacts || []).join("\n"));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const stats = useMemo(
    () => ({
      instances: config.instanceIds.length,
      messages: config.messages.length,
      contacts: config.contacts.length,
    }),
    [config],
  );

  const toggleInstance = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      instanceIds: prev.instanceIds.includes(id)
        ? prev.instanceIds.filter((i) => i !== id)
        : [...prev.instanceIds, id],
    }));
  };

  const addMessage = () => {
    if (!newMessage.trim()) return;
    if (config.messages.length >= 800) {
      toast.error("Limite de 800 mensagens atingido");
      return;
    }
    setConfig((prev) => ({ ...prev, messages: [...prev.messages, newMessage.trim()] }));
    setNewMessage("");
  };

  const addBulkMessages = () => {
    const lines = bulkMessages
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!lines.length) {
      toast.error("Cole pelo menos uma mensagem");
      return;
    }
    setConfig((prev) => {
      const remaining = 800 - prev.messages.length;
      if (remaining <= 0) {
        toast.error("Limite de 800 mensagens atingido");
        return prev;
      }
      const toAdd = lines.slice(0, remaining);
      if (lines.length > remaining) {
        toast.message(`Adicionadas ${toAdd.length} (limite de 800). ${lines.length - remaining} ignoradas.`);
      } else {
        toast.success(`${toAdd.length} mensagem(ns) adicionadas`);
      }
      return { ...prev, messages: [...prev.messages, ...toAdd] };
    });
    setBulkMessages("");
  };

  const clearMessages = () => {
    if (!confirm("Remover todas as mensagens do pool?")) return;
    setConfig((prev) => ({ ...prev, messages: [] }));
  };

  const removeMessage = (idx: number) => {
    setConfig((prev) => ({ ...prev, messages: prev.messages.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const contacts = contactsText
        .split(/[\n,;\s]+/)
        .map((c) => c.replace(/\D/g, ""))
        .filter((c) => c.length >= 8);
      const updated = { ...config, contacts };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setConfig(updated);
      toast.success("Configuração de aquecimento salva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!config.active) {
      if (!config.messages.length) {
        toast.error("Adicione ao menos uma mensagem");
        return;
      }
      const targets = (contactsText || "")
        .split(/[\n,;\s]+/)
        .map((c) => c.replace(/\D/g, ""))
        .filter((c) => c.length >= 8);
      if (!targets.length) {
        toast.error("Adicione pelo menos um número alvo em 'Contatos extras'");
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("run-warmup", {
          body: {
            targetPhones: targets,
            messages: config.messages,
            minDelay: config.minDelay,
            maxDelay: config.maxDelay,
            dailyLimit: config.dailyLimit,
          },
        });
        if (error) throw error;
        if ((data as any)?.success === false) throw new Error((data as any)?.error || "Erro ao iniciar");
        toast.success(
          `Aquecimento iniciado: ${(data as any)?.donors || 0} doadora(s) → ${(data as any)?.targets || 0} alvo(s)`,
        );
      } catch (err: any) {
        toast.error(err?.message || "Erro ao iniciar aquecimento");
        return;
      }
    } else {
      toast.success("Aquecimento pausado");
    }
    const updated = { ...config, active: !config.active };
    setConfig(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="w-6 h-6 text-primary" />
            Aquecimento de Número
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mantenha seus números ativos com trocas automáticas de mensagens entre instâncias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.active ? "default" : "secondary"} className="gap-1">
            <Activity className="w-3 h-3" />
            {config.active ? "Ativo" : "Pausado"}
          </Badge>
          <Button
            variant={config.active ? "destructive" : "default"}
            size="sm"
            onClick={toggleActive}
          >
            {config.active ? (
              <>
                <Pause className="w-4 h-4 mr-1" /> Pausar
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" /> Iniciar
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Instâncias</p>
              <p className="text-2xl font-bold">{stats.instances}</p>
            </div>
            <Activity className="w-8 h-8 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Mensagens</p>
              <p className="text-2xl font-bold">{stats.messages}</p>
            </div>
            <MessageSquare className="w-8 h-8 text-primary opacity-50" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Contatos extras</p>
              <p className="text-2xl font-bold">{stats.contacts}</p>
            </div>
            <Clock className="w-8 h-8 text-primary opacity-50" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instâncias para aquecer</CardTitle>
          <CardDescription>
            As instâncias selecionadas irão trocar mensagens entre si automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma instância conectada</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {instances.map((inst) => (
                <Button
                  key={inst.id}
                  variant={config.instanceIds.includes(inst.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleInstance(inst.id)}
                >
                  {inst.instance_name}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações de envio</CardTitle>
          <CardDescription>Defina ritmo e limite diário</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Intervalo mínimo entre mensagens</Label>
              <span className="text-xs font-medium">{config.minDelay}s</span>
            </div>
            <Slider
              value={[config.minDelay]}
              min={5}
              max={300}
              step={5}
              onValueChange={([v]) => setConfig((p) => ({ ...p, minDelay: v }))}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Intervalo máximo entre mensagens</Label>
              <span className="text-xs font-medium">{config.maxDelay}s</span>
            </div>
            <Slider
              value={[config.maxDelay]}
              min={10}
              max={600}
              step={10}
              onValueChange={([v]) => setConfig((p) => ({ ...p, maxDelay: v }))}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Limite diário por instância</Label>
              <span className="text-xs font-medium">{config.dailyLimit} mensagens</span>
            </div>
            <Slider
              value={[config.dailyLimit]}
              min={10}
              max={800}
              step={10}
              onValueChange={([v]) => setConfig((p) => ({ ...p, dailyLimit: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg">Mensagens do aquecimento</CardTitle>
              <CardDescription>
                Mensagens enviadas aleatoriamente para variar o conteúdo (até 800)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{config.messages.length} / 800</Badge>
              {config.messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearMessages} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nova mensagem..."
              onKeyDown={(e) => e.key === "Enter" && addMessage()}
            />
            <Button onClick={addMessage} size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Importar várias (uma por linha)</Label>
            <Textarea
              value={bulkMessages}
              onChange={(e) => setBulkMessages(e.target.value)}
              placeholder="Oi! Tudo bem?&#10;Bom dia!&#10;Como vai?"
              rows={4}
            />
            <Button onClick={addBulkMessages} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Importar mensagens
            </Button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {config.messages.map((msg, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30"
              >
                <span className="text-sm truncate">{msg}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeMessage(idx)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contatos externos (opcional)</CardTitle>
          <CardDescription>
            Telefones adicionais que receberão mensagens do aquecimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={contactsText}
            onChange={(e) => setContactsText(e.target.value)}
            placeholder="5511999990001&#10;5511999990002"
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}