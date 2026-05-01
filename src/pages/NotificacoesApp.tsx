import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, TrendingUp, Zap, Loader2 } from "lucide-react";

type Notif = {
  id: string;
  kind: "sale" | "pix";
  title: string;
  subtitle: string;
  amount?: number;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatBRL(cents?: number) {
  if (!cents && cents !== 0) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function NotificacoesApp() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const userId = session.user.id;

    const tx = await supabase
      .from("gateway_transactions")
      .select("id, customer_name, amount, payment_method, status, created_at")
      .eq("user_id", userId)
      .in("status", ["paid", "approved", "completed"])
      .order("created_at", { ascending: false })
      .limit(60);

    const merged: Notif[] = [];

    (tx.data || []).forEach((t: any) => {
      const isPix = (t.payment_method || "").toLowerCase().includes("pix");
      merged.push({
        id: `t-${t.id}`,
        kind: isPix ? "pix" : "sale",
        title: isPix ? "Pix recebido" : "Nova venda aprovada",
        subtitle: t.customer_name || "Cliente",
        amount: t.amount,
        created_at: t.created_at,
      });
    });

    merged.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setItems(merged.slice(0, 60));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notif-app")
      .on("postgres_changes", { event: "*", schema: "public", table: "gateway_transactions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-bebas text-[26px] text-white tracking-[2px] leading-none">NOTIFICAÇÕES</h1>
          <p className="font-nunito text-[12px] text-white/40 mt-1">Vendas e relatórios em 08h, 12h, 18h e 00h</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Bell className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Nenhuma notificação ainda</p>
          <p className="text-white/30 text-xs mt-1">Suas vendas e mensagens aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = n.kind === "pix" ? Zap : TrendingUp;
            const iconColor =
              n.kind === "pix" ? "text-purple-400 bg-purple-500/15"
              : "text-emerald-400 bg-emerald-500/15";
            return (
              <div key={n.id} className="glass-card p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white text-sm font-semibold truncate">{n.title}</p>
                    <span className="text-white/40 text-[11px] shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-white/50 text-xs truncate mt-0.5">{n.subtitle}</p>
                </div>
                {n.amount !== undefined && (
                  <div className="text-right shrink-0">
                    <p className="text-emerald-400 text-sm font-bold">+ {formatBRL(n.amount)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}