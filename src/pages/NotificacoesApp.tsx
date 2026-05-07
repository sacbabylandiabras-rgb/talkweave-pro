import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send, Loader2, AlertTriangle, Clock, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useWebPush } from "@/hooks/useWebPush";

type Prefs = {
  enabled: boolean;
  notify_credit_card: boolean;
  notify_boleto_paid: boolean;
  notify_pix_paid: boolean;
  notify_pix_recurring: boolean;
  notify_apple_pay: boolean;
  notify_pix_or_boleto_issued: boolean;
};

const DEFAULT_PREFS: Prefs = {
  enabled: true,
  notify_credit_card: true,
  notify_boleto_paid: true,
  notify_pix_paid: true,
  notify_pix_recurring: true,
  notify_apple_pay: true,
  notify_pix_or_boleto_issued: true,
};

const TOGGLES: { key: keyof Prefs; label: string }[] = [
  { key: "notify_credit_card", label: "Notificar cartão de crédito" },
  { key: "notify_boleto_paid", label: "Notificar boleto pago" },
  { key: "notify_pix_paid", label: "Notificar pix pago" },
  { key: "notify_pix_recurring", label: "Notificar pix recorrente" },
  { key: "notify_apple_pay", label: "Notificar Apple Pay" },
  { key: "notify_pix_or_boleto_issued", label: "Notificar pix ou boleto emitido" },
];

 const SLOTS = [0, 8, 12, 16.5, 18];

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function NotificacoesApp() {
  const { toast } = useToast();
  const { pushEnabled, pushBusy, enablePush } = useWebPush();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
   const [summaries, setSummaries] = useState<{ slot: number; total: number; count: number; messages: number; date: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);

      const { data } = await (supabase as any)
        .from("notification_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .is("checkout_id", null)
        .maybeSingle();
      if (data) {
        setPrefs({
          enabled: data.enabled,
          notify_credit_card: data.notify_credit_card,
          notify_boleto_paid: data.notify_boleto_paid,
          notify_pix_paid: data.notify_pix_paid,
          notify_pix_recurring: data.notify_pix_recurring,
          notify_apple_pay: data.notify_apple_pay,
          notify_pix_or_boleto_issued: data.notify_pix_or_boleto_issued,
        });
      }

       const start = new Date();
       start.setHours(0, 0, 0, 0);
       
       const [txRes, msgRes] = await Promise.all([
         supabase
           .from("gateway_transactions")
           .select("amount, created_at, status")
           .eq("user_id", session.user.id)
           .in("status", ["paid", "approved", "completed"])
           .gte("created_at", start.toISOString()),
         supabase
           .from("campaign_sends")
           .select("sent_at")
           .eq("user_id", session.user.id)
           .gte("sent_at", start.toISOString())
       ]);
 
       const tx = txRes.data || [];
       const msgs = msgRes.data || [];
       const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
       const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
 
       const list = SLOTS.filter(s => s <= currentHour).reverse().map(s => {
         // Mensagens no período (desde o slot anterior)
         const sortedSlots = [...SLOTS].sort((a, b) => a - b);
         const idx = sortedSlots.indexOf(s);
         const prevS = idx > 0 ? sortedSlots[idx - 1] : -1; // Se for o primeiro do dia, -1 (desde meia noite)
         
         const slotMsgs = msgs.filter((m: any) => {
           const date = new Date(m.sent_at);
           const h = date.getHours() + date.getMinutes() / 60;
           return h >= prevS && h < s;
         }).length;
 
         // Vendas hoje (acumulado até o slot)
         const slotSales = tx.filter((t: any) => {
           const date = new Date(t.created_at);
           const h = date.getHours() + date.getMinutes() / 60;
           return h < s;
         });
 
         const total = slotSales.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
 
         return {
           slot: s,
           total: total,
           count: slotSales.length,
           messages: slotMsgs,
           date: today,
         };
       });
 
       setSummaries(list);
      setSummaries(list);
      setLoading(false);
    })();
  }, []);

  const savePrefs = async (next: Prefs) => {
    if (!userId) return;
    setSaving(true);
    setPrefs(next);
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert(
        { user_id: userId, checkout_id: null, ...next },
        { onConflict: "user_id" }
      );
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const togglePref = (key: keyof Prefs, value: boolean) => {
    savePrefs({ ...prefs, [key]: value });
  };

  const handleEnablePush = async () => {
    try {
      await enablePush();
      toast({ title: "Notificações ativadas!", description: "Você receberá alertas em tempo real." });
    } catch (e: any) {
      toast({ title: "Erro ao ativar", description: e.message, variant: "destructive" });
    }
  };

  const sendTest = async () => {
    if (!userId) { toast({ title: "Faça login primeiro", variant: "destructive" }); return; }
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: userId,
          title: "Teste de Notificação",
          body: "Se você está vendo isso, o push está funcionando!",
          url: window.location.origin + "/aplicativo",
        },
      });
      if (error) throw error;
      toast({ title: "Teste enviado!", description: "Verifique se a notificação chegou." });
    } catch (e: any) {
      toast({ title: "Erro no teste", description: e.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>;
  }

  const allDisabled = !prefs.enabled;

  return (
    <div className="space-y-4 w-full max-w-xl mx-auto">
      {/* Botão ativar */}
      <button
        onClick={handleEnablePush}
        disabled={pushBusy || pushEnabled}
        className="w-full rounded-2xl py-4 px-5 flex items-center justify-center gap-3 font-semibold text-white shadow-lg transition-opacity disabled:opacity-70"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
      >
        {pushBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
        {pushEnabled ? "Notificações Ativadas" : "Ativar Notificações Reais"}
      </button>

      {/* Botão testar */}
      <button
        onClick={sendTest}
        disabled={sendingTest || !userId}
        className="w-full rounded-2xl py-4 px-5 flex items-center justify-center gap-3 font-semibold text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        {sendingTest ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        Enviar Notificação de Teste
      </button>

      {!userId && (
        <p className="flex items-center justify-center gap-2 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4" />
          Faça login primeiro para ativar notificações.
        </p>
      )}

      {/* Master toggle */}
      <div className="rounded-2xl border border-white/10 divide-y divide-white/5 overflow-hidden bg-white/[0.02]">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="font-bold text-white text-base">Notificações</span>
          <Switch checked={prefs.enabled} onCheckedChange={(v) => togglePref("enabled", v)} disabled={saving} />
        </div>

        <div className="px-5 py-3 flex items-center gap-1 text-white/40 text-sm">
          Todos os checkouts (padrão) <ChevronDown className="w-3 h-3" />
        </div>

        {TOGGLES.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4">
            <span className={`text-sm ${allDisabled ? "text-white/30" : "text-white/90"}`}>{label}</span>
            <Switch
              checked={prefs[key] as boolean}
              onCheckedChange={(v) => togglePref(key, v)}
              disabled={saving || allDisabled}
            />
          </div>
        ))}
      </div>

      {/* Como funciona */}
      <div>
       <h2 className="font-bold text-white text-lg mb-2">Como funciona</h2>
       <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
         <p className="text-white/60 text-sm leading-relaxed">
           Você recebe um relatório automático com o resumo de mensagens enviadas e vendas
           hoje via push e Telegram nos horários: 08:00, 12:00, 16:30, 18:00 e 00:00.
         </p>
       </div>
     </div>

      {/* Resumos recentes */}
      <div>
        <h2 className="font-bold text-white text-lg mb-2">Resumos recentes</h2>
        {summaries.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-white/40 text-sm">
            Os resumos aparecerão aqui ao longo do dia.
          </div>
        ) : (
          <div className="space-y-2">
            {summaries.map(s => (
               <div key={s.slot} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 flex items-center gap-3">
                 <Clock className="w-4 h-4 text-primary shrink-0" />
                 <div className="flex-1 min-w-0">
                   <p className="text-white text-sm font-semibold">
                     Relatório das {s.slot === 16.5 ? "16:30" : `${String(Math.floor(s.slot)).padStart(2, "0")}:00`}
                   </p>
                   <p className="text-white/50 text-xs mt-0.5">
                     Mensagens enviadas: {s.messages}, vendas hoje: {formatBRL(s.total)}
                   </p>
                 </div>
                 <span className="text-white/40 text-xs shrink-0">{s.date}</span>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
