import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface WarmupConfig {
  active: boolean;
  instanceIds: string[];
  minDelay: number;
  maxDelay: number;
  dailyLimit: number;
}

const WARMUP_STORAGE_KEY = "zaplynx-warmup-config";
const WARMUP_CONFIG_EVENT = "zaplynx-warmup-config-updated";
const WARMUP_PROGRESS_KEY = "zaplynx-warmup-progress";
const WARMUP_PROGRESS_EVENT = "zaplynx-warmup-progress-updated";

const todayKey = () => new Date().toISOString().slice(0, 10);

const recordWarmupProgress = (
  sentByTarget: Record<string, number>,
  targetInstanceMap: Record<string, string>,
) => {
  try {
    const raw = localStorage.getItem(WARMUP_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const day = todayKey();
    const dayData: Record<string, number> = parsed[day] || {};
    let changed = false;
    for (const [phone, count] of Object.entries(sentByTarget || {})) {
      const instanceId = targetInstanceMap?.[phone];
      if (!instanceId || !count) continue;
      dayData[instanceId] = (dayData[instanceId] || 0) + Number(count);
      changed = true;
    }
    if (!changed) return;
    const next = { [day]: dayData };
    localStorage.setItem(WARMUP_PROGRESS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WARMUP_PROGRESS_EVENT));
  } catch {
    /* ignore */
  }
};

const readWarmupConfig = (): WarmupConfig => {
  const fallback: WarmupConfig = {
    active: false,
    instanceIds: [],
    minDelay: 30,
    maxDelay: 120,
    dailyLimit: 50,
  };

  try {
    const saved = localStorage.getItem(WARMUP_STORAGE_KEY);
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
};

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>();
  const [warmupConfig, setWarmupConfig] = useState<WarmupConfig>(readWarmupConfig);
  const { setTheme } = useTheme();

  // Glassmorphism Dark é o tema visual padrão do dashboard
  useEffect(() => {
    setTheme("dark");
  }, [setTheme]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        setLoading(false);
        return;
      }

      // Check if account is active
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", session.user.id)
        .single();

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        navigate("/auth");
        setLoading(false);
        return;
      }

      setUserId(session.user.id);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const syncWarmupConfig = () => setWarmupConfig(readWarmupConfig());

    window.addEventListener("storage", syncWarmupConfig);
    window.addEventListener("focus", syncWarmupConfig);
    window.addEventListener(WARMUP_CONFIG_EVENT, syncWarmupConfig);

    return () => {
      window.removeEventListener("storage", syncWarmupConfig);
      window.removeEventListener("focus", syncWarmupConfig);
      window.removeEventListener(WARMUP_CONFIG_EVENT, syncWarmupConfig);
    };
  }, []);

  useEffect(() => {
    if (loading || !warmupConfig.active || !warmupConfig.instanceIds.length) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (cancelled) return;
      // Re-check config no localStorage para abortar imediatamente se foi pausado
      const liveConfig = readWarmupConfig();
      if (!liveConfig.active || !liveConfig.instanceIds.length) {
        return;
      }
      try {
        const progressRaw = localStorage.getItem(WARMUP_PROGRESS_KEY);
        const progressDay = progressRaw ? JSON.parse(progressRaw)?.[todayKey()] || {} : {};
        const totalProgress = liveConfig.instanceIds.reduce(
          (sum, id) => sum + Number(progressDay[id] || 0),
          0,
        );
        const { data, error } = await supabase.functions.invoke("run-warmup", {
          body: {
            instanceIds: liveConfig.instanceIds,
            minDelay: liveConfig.minDelay,
            maxDelay: liveConfig.maxDelay,
            dailyLimit: liveConfig.dailyLimit,
            mode: "tick",
            batchSize: 1,
            targetOffset: totalProgress,
          },
        });

        if (error) throw error;
        if ((data as any)?.success === false) {
          throw new Error((data as any)?.error || "Erro ao executar ciclo");
        }
        const sentByTarget = (data as any)?.sentByTarget;
        const targetInstanceMap = (data as any)?.targetInstanceMap;
        if (sentByTarget && targetInstanceMap) {
          recordWarmupProgress(sentByTarget, targetInstanceMap);
          // Após atualizar o progresso, dispara a checagem de entrada em grupos
          try {
            const progressRaw2 = localStorage.getItem(WARMUP_PROGRESS_KEY);
            const dayProg = progressRaw2 ? JSON.parse(progressRaw2)?.[todayKey()] || {} : {};
            await supabase.functions.invoke("warmup-join-groups", {
              body: {
                sentByTarget,
                targetInstanceMap,
                currentProgress: dayProg,
              },
            });
          } catch (_) { /* silencioso */ }
        }
      } catch (err: any) {
        toast.error(err?.message || "Erro no ciclo de aquecimento");
      } finally {
        // Re-check antes de agendar próximo ciclo: se foi pausado durante o envio, não agenda
        const stillActive = readWarmupConfig();
        if (!cancelled && stillActive.active && stillActive.instanceIds.length) {
          const min = Math.max(5, warmupConfig.minDelay);
          const max = Math.max(min, warmupConfig.maxDelay);
          const delayMs = (min + Math.random() * (max - min)) * 1000;
          timer = setTimeout(run, delayMs);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loading, warmupConfig.active, warmupConfig.instanceIds, warmupConfig.minDelay, warmupConfig.maxDelay, warmupConfig.dailyLimit]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getActiveItem = () => {
    const path = location.pathname;
    const map: Record<string, string> = {
      "/dashboard": "painel",
      "/dispositivos": "dispositivos",
      "/perfil": "perfil",
      "/campanhas": "campanhas",
      "/contatos": "contatos",
      "/modelos": "modelos",
      "/enviar-mensagem": "enviar-mensagem",
      "/relatorio": "relatorio",
      "/fluxo-visual": "fluxo-visual",
      "/admin": "admin",
      "/gateway": "gateway",
      "/mensagens": "mensagens",
      "/apanhador-grupos": "apanhador-grupos",
      "/agente-ia": "agente-ia",
      "/criar-grupos": "criar-grupos",
      // Instagram routes
      "/instagram/dashboard": "ig-dashboard",
      "/instagram/campanhas": "ig-campanhas",
      "/instagram/automacao": "ig-automacao",
      "/instagram/contatos": "ig-contatos",
      "/instagram/configuracao": "ig-configuracao",
      // Meta API routes
      "/meta/dashboard": "painel-meta",
      "/meta/templates": "templates-aprovados",
      "/meta/enviar": "envio-cloud",
      "/meta/configuracao": "configuracao-meta",
    };
    return map[path] || "painel";
  };

  return (
    <div className="flex h-screen bg-transparent">
      <Sidebar activeItem={getActiveItem()} userId={userId} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onNavigate={(item) => {
          if (item === "painel") navigate("/dashboard");
          else navigate(`/${item}`);
        }} />
        <main className="flex-1 overflow-auto p-6 bg-transparent dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
