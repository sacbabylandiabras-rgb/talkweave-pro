import { Suspense, useEffect, useState } from "react";
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
  runId?: string;
}

const WARMUP_STORAGE_KEY = "zaplynx-warmup-config";
const WARMUP_CONFIG_EVENT = "zaplynx-warmup-config-updated";
const WARMUP_PROGRESS_KEY = "zaplynx-warmup-progress";
const WARMUP_PROGRESS_EVENT = "zaplynx-warmup-progress-updated";
const WARMUP_PHONES_KEY = "zaplynx-warmup-phones";
const WARMUP_PROGRESS_PHONE_SEPARATOR = "::";

const userWarmupStorageKey = (userId?: string) => `${WARMUP_STORAGE_KEY}:${userId || "anonymous"}`;

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

const getVisibleWarmupProgress = (dayData: Record<string, number>, instanceIds: string[]) => {
  const phonesMap = readWarmupPhonesMap();
  return instanceIds.reduce<Record<string, number>>((acc, id) => {
    const phone = phonesMap[id];
    const key = phone ? warmupProgressPhoneKey(id, phone) : id;
    acc[id] = Number(dayData[key] || 0);
    return acc;
  }, {});
};

const recordWarmupProgress = (
  sentByTarget: Record<string, number>,
  targetInstanceMap: Record<string, string>,
) => {
  try {
    // Detecta troca de número: se o phone associado a um instanceId mudou,
    // zera o contador daquela instância antes de acumular o novo envio.
    const phonesMap = readWarmupPhonesMap();
    const resetIds = new Set<string>();
    for (const [phone, instanceId] of Object.entries(targetInstanceMap || {})) {
      if (!instanceId || !phone) continue;
      const normalizedPhone = normalizeWarmupPhone(phone);
      const prev = phonesMap[instanceId];
      if (prev && normalizeWarmupPhone(prev) !== normalizedPhone) resetIds.add(instanceId);
      phonesMap[instanceId] = normalizedPhone;
    }
    localStorage.setItem(WARMUP_PHONES_KEY, JSON.stringify(phonesMap));

    const raw = localStorage.getItem(WARMUP_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const day = todayKey();
    const dayData: Record<string, number> = parsed[day] || {};
    if (resetIds.size) {
      for (const id of resetIds) {
        delete dayData[id];
        Object.keys(dayData).forEach((key) => {
          if (key.startsWith(`${id}${WARMUP_PROGRESS_PHONE_SEPARATOR}`)) delete dayData[key];
        });
      }
    }
    let changed = false;
    for (const [phone, count] of Object.entries(sentByTarget || {})) {
      const instanceId = targetInstanceMap?.[phone];
      if (!instanceId || !count) continue;
      const key = warmupProgressPhoneKey(instanceId, phone);
      delete dayData[instanceId];
      dayData[key] = (dayData[key] || 0) + Number(count);
      changed = true;
    }
    if (!changed && resetIds.size === 0) return;
    const next = { [day]: dayData };
    localStorage.setItem(WARMUP_PROGRESS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(WARMUP_PROGRESS_EVENT));
  } catch {
    /* ignore */
  }
};

const readWarmupConfig = (userId?: string): WarmupConfig => {
  const fallback: WarmupConfig = {
    active: false,
    instanceIds: [],
    minDelay: 30,
    maxDelay: 120,
    dailyLimit: 50,
    runId: undefined,
  };

  try {
    const saved = userId ? localStorage.getItem(userWarmupStorageKey(userId)) : null;
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
      setWarmupConfig(readWarmupConfig(session.user.id));
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
        setWarmupConfig(readWarmupConfig(session.user.id));
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const syncWarmupConfig = () => {
      const next = readWarmupConfig(userId);
      setWarmupConfig((prev) => {
        // Evita re-render desnecessário se nada relevante mudou
        if (
          prev.active === next.active &&
          prev.minDelay === next.minDelay &&
          prev.maxDelay === next.maxDelay &&
          prev.dailyLimit === next.dailyLimit &&
          prev.runId === next.runId &&
          prev.instanceIds.length === next.instanceIds.length &&
          prev.instanceIds.every((id, i) => id === next.instanceIds[i])
        ) {
          return prev;
        }
        return next;
      });
    };

    window.addEventListener("storage", syncWarmupConfig);
    window.addEventListener("focus", syncWarmupConfig);
    window.addEventListener(WARMUP_CONFIG_EVENT, syncWarmupConfig);

    return () => {
      window.removeEventListener("storage", syncWarmupConfig);
      window.removeEventListener("focus", syncWarmupConfig);
      window.removeEventListener(WARMUP_CONFIG_EVENT, syncWarmupConfig);
    };
  }, [userId]);

  useEffect(() => {
    if (loading || !warmupConfig.active || !warmupConfig.instanceIds.length) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (cancelled) return;
      // Re-check config no localStorage para abortar imediatamente se foi pausado
      const liveConfig = readWarmupConfig(userId);
      if (!liveConfig.active || !liveConfig.instanceIds.length) {
        return;
      }
      try {
        const progressRaw = localStorage.getItem(WARMUP_PROGRESS_KEY);
        const progressDay = progressRaw ? JSON.parse(progressRaw)?.[todayKey()] || {} : {};
        const visibleProgress = getVisibleWarmupProgress(progressDay, liveConfig.instanceIds);
        const totalProgress = liveConfig.instanceIds.reduce(
          (sum, id) => sum + Number(visibleProgress[id] || 0),
          0,
        );

        // Dispara DM e conversa em grupo em PARALELO (sincronizados no mesmo ciclo).
        // Se o DM falhar (ex.: instâncias desconectadas), o grupo ainda roda independentemente.
        const dmPromise = supabase.functions.invoke("run-warmup", {
          body: {
            instanceIds: liveConfig.instanceIds,
            minDelay: liveConfig.minDelay,
            maxDelay: liveConfig.maxDelay,
            dailyLimit: liveConfig.dailyLimit,
            runId: liveConfig.runId,
            mode: "tick",
            batchSize: 1,
            targetOffset: totalProgress,
          },
        });

        const groupPromise = supabase.functions
          .invoke("warmup-group-chat", { body: { batchSize: 2, runId: liveConfig.runId } })
          .catch(() => null);

        const [dmResult] = await Promise.all([dmPromise, groupPromise]);
        const { data, error } = dmResult;

        // Se foi pausado enquanto a chamada estava em curso, descarta o resultado
        // para não registrar progresso nem agendar próximos ciclos.
        const postCheck = readWarmupConfig(userId);
        if (cancelled || !postCheck.active || postCheck.runId !== liveConfig.runId || !postCheck.instanceIds.length) {
          return;
        }

        if (error) {
          toast.error(error.message || "Erro no aquecimento normal");
        } else if ((data as any)?.success === false) {
          toast.error((data as any)?.error || "Erro ao executar ciclo");
        } else {
          const failed = Number((data as any)?.failed || 0);
          const normalSent = Number((data as any)?.sent || 0) + Number((data as any)?.replies || 0);
          if (normalSent <= 0 && failed > 0 && liveConfig.instanceIds.length >= 1) {
            toast.error("Aquecimento normal: instâncias desconectadas ou no limite. Grupo seguiu normalmente.");
          }
          const sentByTarget = (data as any)?.sentByTarget;
          const targetInstanceMap = (data as any)?.targetInstanceMap;
          if (sentByTarget && targetInstanceMap) {
            recordWarmupProgress(sentByTarget, targetInstanceMap);
            try {
              const progressRaw2 = localStorage.getItem(WARMUP_PROGRESS_KEY);
              const dayProg = progressRaw2 ? JSON.parse(progressRaw2)?.[todayKey()] || {} : {};
              const visibleDayProg = getVisibleWarmupProgress(dayProg, liveConfig.instanceIds);
              supabase.functions
                .invoke("warmup-join-groups", {
                  body: {
                    sentByTarget,
                    targetInstanceMap,
                    currentProgress: visibleDayProg,
                    instanceIds: liveConfig.instanceIds,
                  },
                })
                .catch(() => null);
            } catch (_) { /* silencioso */ }
          }
        }
      } catch (err: any) {
        toast.error(err?.message || "Erro no ciclo de aquecimento");
      } finally {
        // Re-check antes de agendar próximo ciclo: se foi pausado durante o envio, não agenda
        const stillActive = readWarmupConfig(userId);
        if (!cancelled && stillActive.active && stillActive.runId === liveConfig.runId && stillActive.instanceIds.length) {
          const min = Math.max(5, liveConfig.minDelay);
          const max = Math.max(min, liveConfig.maxDelay);
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
  }, [loading, userId, warmupConfig.active, warmupConfig.instanceIds, warmupConfig.minDelay, warmupConfig.maxDelay, warmupConfig.dailyLimit, warmupConfig.runId]);

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
      "/perfil-empresa": "perfil-empresa",
      "/campanhas": "campanhas",
      "/contatos": "contatos",
       "/modelos": "modelos",
       "/modelos/previa": "modelos-previa",
      "/enviar-mensagem": "enviar-mensagem",
      "/relatorio": "relatorio",
      "/fluxo-visual": "fluxo-visual",
      "/admin": "admin",
      "/gateway": "gateway",
      "/mensagens": "mensagens",
      "/notificacoes": "notificacoes",
      "/apanhador-grupos": "apanhador-grupos",
      "/agente-ia": "agente-ia",
      "/criar-grupos": "criar-grupos",
      "/canais": "canais",
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
      "/meta/mensagens": "mensagens-meta",
      "/meta/fluxo": "fluxo-meta",
      "/meta/campanhas": "campanhas-meta",
      "/meta/contatos": "contatos-meta",
      "/meta/relatorio": "relatorio-meta",
      "/meta/gateway": "gateway-meta",
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
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
