import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Flame, Play, Pause, Loader2, Activity } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WarmupConfig {
  active: boolean;
  instanceIds: string[];
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
}

const STORAGE_KEY = "zaplynx-warmup-config";

export default function AquecimentoNumero() {
  const { instances: allInstances } = useZapiInstances();
  const instances = useMemo(
    () => allInstances.filter((i) => (i.api_provider || "zapi") === "zapi"),
    [allInstances],
  );
  const [config, setConfig] = useState<WarmupConfig>({
    active: false,
    instanceIds: [],
    minDelay: 30,
    maxDelay: 120,
    dailyLimit: 50,
  });
  const [saving, setSaving] = useState(false);
  const [cycleRunning, setCycleRunning] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<WarmupConfig>;
        setConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleInstance = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      instanceIds: prev.instanceIds.includes(id)
        ? prev.instanceIds.filter((i) => i !== id)
        : [...prev.instanceIds, id],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      toast.success("Configuração de aquecimento salva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const runWarmupCycle = async () => {
    const { data, error } = await supabase.functions.invoke("run-warmup", {
      body: {
        instanceIds: config.instanceIds,
        minDelay: config.minDelay,
        maxDelay: config.maxDelay,
        dailyLimit: config.dailyLimit,
        mode: "tick",
        batchSize: 1,
      },
    });
    if (error) throw error;
    if ((data as any)?.success === false) throw new Error((data as any)?.error || "Erro ao executar ciclo");
    return data as any;
  };

  useEffect(() => {
    if (!config.active || !config.instanceIds.length) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      const min = Math.max(5, config.minDelay);
      const max = Math.max(min, config.maxDelay);
      const delayMs = (min + Math.random() * (max - min)) * 1000;
      timer = setTimeout(run, delayMs);
    };

    const run = async () => {
      if (cancelled) return;
      setCycleRunning(true);
      try {
        await runWarmupCycle();
      } catch (err: any) {
        toast.error(err?.message || "Erro no ciclo de aquecimento");
      } finally {
        setCycleRunning(false);
        if (!cancelled) scheduleNext();
      }
    };

    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [config.active, config.instanceIds, config.minDelay, config.maxDelay, config.dailyLimit]);

  const toggleActive = async () => {
    if (!config.active) {
      if (!config.instanceIds.length) {
        toast.error("Selecione ao menos uma instância para aquecer");
        return;
      }
      toast.success("Aquecimento iniciado em ciclos contínuos");
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
            Selecione as instâncias para receber mensagens das doadoras configuradas em /admin/aquecimento
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
              <><Pause className="w-4 h-4 mr-1" /> Pausar</>
            ) : (
              <><Play className="w-4 h-4 mr-1" /> Iniciar</>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Instâncias selecionadas</p>
            <p className="text-2xl font-bold">{config.instanceIds.length}</p>
          </div>
          <Activity className="w-8 h-8 text-primary opacity-50" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instâncias para aquecer</CardTitle>
          <CardDescription>
            As instâncias selecionadas receberão mensagens das doadoras (admin)
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
