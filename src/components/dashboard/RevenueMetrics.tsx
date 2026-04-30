import { useState, useEffect, useCallback } from "react";
import { MetricCard } from "./MetricCard";
import { DollarSign, Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RevenueMetrics() {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({ gross: 0, net: 0 });

  const loadRevenue = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      let gross = 0;
      let net = 0;
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("gateway_transactions")
          .select("amount, net, fee, status")
          .eq("user_id", user.id)
          .in("status", ["approved", "paid"])
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        for (const t of data) {
          gross += t.amount || 0;
          net += (t.net ?? ((t.amount || 0) - (t.fee || 0)));
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setRevenue({ gross, net });
    } catch (e) {
      console.error("Error loading revenue:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadRevenue();
      else setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadRevenue();
    });

    const channel = supabase
      .channel("revenue-metrics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "gateway_transactions" }, () => loadRevenue())
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [loadRevenue]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <MetricCard title="Faturamento" value={formatBRL(revenue.gross)} subtitle="Pix gerado" icon={DollarSign} variant="success" />
      <MetricCard title="Faturamento Líquido" value={formatBRL(revenue.net)} subtitle="Venda aprovada" icon={Wallet} variant="info" />
    </div>
  );
}
