import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
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
  runId?: string;
}

const STORAGE_KEY = "zaplynx-warmup-config";
const WARMUP_CONFIG_EVENT = "zaplynx-warmup-config-updated";
const WARMUP_PROGRESS_KEY = "zaplynx-warmup-progress";
const WARMUP_PROGRESS_EVENT = "zaplynx-warmup-progress-updated";
const WARMUP_PHONES_KEY = "zaplynx-warmup-phones";
const WARMUP_PROGRESS_PHONE_SEPARATOR = "::";

const DEFAULT_WARMUP_CONFIG: WarmupConfig = {
  active: false,
  instanceIds: [],
  minDelay: 30,
  maxDelay: 120,
  dailyLimit: 50,
};

const userWarmupStorageKey = (userId?: string) => `${STORAGE_KEY}:${userId || "anonymous"}`;

const todayKey = () => new Date().toISOString().slice(0, 10);

const normalizeWarmupPhone = (phone: string) => String(phone || "").replace(/\D/g, "");

const warmupProgressPhoneKey = (instanceId: string, phone: string) =>
  `${instanceId}${WARMUP_PROGRESS_PHONE_SEPARATOR}${normalizeWarmupPhone(phone)}`;

const readWarmupPhonesMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(WARMUP_PHONES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const readProgress = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(WARMUP_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const dayData = parsed[todayKey()] || {};
    const phonesMap = readWarmupPhonesMap();
    const visibleProgress: Record<string, number> = {};
    for (const [instanceId, phone] of Object.entries(phonesMap)) {
      visibleProgress[instanceId] = Number(dayData[warmupProgressPhoneKey(instanceId, phone)] || 0);
    }
    return visibleProgress;
  } catch {
    return {};
  }
};

export default function AquecimentoNumero() {
   const { instances } = useZapiInstances({ includeWarmup: true });
  const [config, setConfig] = useState<WarmupConfig>(DEFAULT_WARMUP_CONFIG);
  const [userId, setUserId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>(readProgress);

  useEffect(() => {
    const sync = () => setProgress(readProgress());
    window.addEventListener(WARMUP_PROGRESS_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    const interval = setInterval(sync, 5000);
    return () => {
      window.removeEventListener(WARMUP_PROGRESS_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      clearInterval(interval);
    };
  }, []);

  const persistConfig = (nextConfig: WarmupConfig) => {
    if (!userId) return;
    localStorage.setItem(userWarmupStorageKey(userId), JSON.stringify(nextConfig));
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(WARMUP_CONFIG_EVENT));
  };

  const syncServerControl = async (nextConfig: WarmupConfig) => {
    const { data, error } = await supabase.functions.invoke("warmup-control", {
      body: {
        active: nextConfig.active,
        runId: nextConfig.runId,
        instanceIds: nextConfig.instanceIds,
        minDelay: nextConfig.minDelay,
        maxDelay: nextConfig.maxDelay,
        dailyLimit: nextConfig.dailyLimit,
      },
    });

    if (error) throw new Error("Não consegui sincronizar o controle do aquecimento");
    if ((data as any)?.success === false) throw new Error((data as any)?.error || "Erro ao salvar controle");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUserId = session?.user?.id;
      setUserId(currentUserId);
      if (!currentUserId) return;
      try {
        const scopedSaved = localStorage.getItem(userWarmupStorageKey(currentUserId));
        const legacySaved = localStorage.getItem(STORAGE_KEY);
        const saved = scopedSaved || legacySaved;
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<WarmupConfig>;
          // Preserva o estado real (não força pausa ao reabrir a página),
          // assim o aquecimento continua rodando quando o usuário navega entre rotas.
          const restored = { ...DEFAULT_WARMUP_CONFIG, ...parsed };
          setConfig(restored);
          if (!scopedSaved) {
            localStorage.setItem(userWarmupStorageKey(currentUserId), JSON.stringify(restored));
          }
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        /* ignore */
      }
    });
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
      persistConfig(config);
      await syncServerControl(config);
      toast.success("Configuração de aquecimento salva");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!config.active && config.instanceIds.length < 1) {
      toast.error("Selecione pelo menos 1 instância para aquecer");
      return;
    }

    const updated = {
      ...config,
      active: !config.active,
      runId: crypto.randomUUID(),
    };

    setConfig(updated);
    persistConfig(updated);

    try {
      await syncServerControl(updated);
      toast.success(updated.active ? "Aquecimento iniciado em ciclos contínuos" : "Aquecimento pausado");
    } catch (err) {
      if (!updated.active) {
        toast.warning("Pausado nesta aba; o bloqueio do servidor será aplicado assim que sincronizar.");
        return;
      }
      const rolledBack = { ...config, runId: crypto.randomUUID() };
      setConfig(rolledBack);
      persistConfig(rolledBack);
      toast.error("Não consegui sincronizar o controle do aquecimento");
    }
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
            As instâncias doadoras enviarão mensagens em PV para a(s) instância(s) selecionada(s)
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progresso de hoje</CardTitle>
          <CardDescription>
            Mensagens recebidas por instância no dia atual (limite: {config.dailyLimit})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.instanceIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Selecione instâncias acima para acompanhar o progresso.
            </p>
          ) : (
            config.instanceIds.map((id) => {
              const inst = instances.find((i) => i.id === id);
              const sent = progress[id] || 0;
              const pct = Math.min(100, Math.round((sent / Math.max(1, config.dailyLimit)) * 100));
              return (
                <div key={id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {inst?.instance_name || id}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {sent} / {config.dailyLimit} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
