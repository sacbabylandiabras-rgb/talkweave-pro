import { useState, useEffect, useCallback } from "react";
import { MetricCard } from "./MetricCard";
import { DollarSign, Wallet, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RevenueMetrics() {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({ pixGenerated: 0, approved: 0 });
  const [hasTransactions, setHasTransactions] = useState(false);
  const [msgPerSale, setMsgPerSale] = useState<{ messages: number; sales: number }>({ messages: 0, sales: 0 });

  const loadRevenue = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      let pixGenerated = 0;
      let approved = 0;
      let approvedSalesCount = 0;
      let from = 0;
      let totalCount = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("gateway_transactions")
          .select("amount, net, fee, status")
          .eq("user_id", user.id)
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        totalCount += data.length;
        for (const t of data) {
          pixGenerated += t.amount || 0;
          if (t.status === "approved" || t.status === "paid") {
            approved += t.amount || 0;
            approvedSalesCount += 1;
          }
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Also include external gateways (Hotmart, Kiwify, etc.) via webhook
      let extFrom = 0;
      while (true) {
        const { data, error } = await (supabase as any)
          .from("external_gateway_events")
          .select("amount, status")
          .eq("user_id", user.id)
          .range(extFrom, extFrom + pageSize - 1);
        if (error || !data || data.length === 0) break;
        totalCount += data.length;
        for (const t of data as Array<{ amount: number; status: string }>) {
          pixGenerated += t.amount || 0;
          if (t.status === "approved" || t.status === "paid") {
            approved += t.amount || 0;
            approvedSalesCount += 1;
          }
        }
        if (data.length < pageSize) break;
        extFrom += pageSize;
      }

      // Count messages sent (sent/delivered) for this user
      const { count: msgCount } = await supabase
        .from("campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["sent", "delivered", "read"]);

      setRevenue({ pixGenerated, approved });
      setHasTransactions(totalCount > 0);
      setMsgPerSale({ messages: msgCount || 0, sales: approvedSalesCount });
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

  // Hide cards entirely for users that don't use the gateway
  if (!hasTransactions) return null;

  const ratio = msgPerSale.sales > 0
    ? (msgPerSale.messages / msgPerSale.sales)
    : null;
  const ratioLabel = ratio !== null
    ? `${ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} msg/venda`
    : "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard title="Pix Gerado" value={formatBRL(revenue.pixGenerated)} icon={DollarSign} variant="info" />
      <MetricCard title="Venda Aprovada" value={formatBRL(revenue.approved)} icon={Wallet} variant="success" />
      <MetricCard
        title="Mensagens por Venda"
        value={ratioLabel}
        icon={Send}
        variant="info"
      />
    </div>
  );
}
