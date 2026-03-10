import { useState, useEffect } from "react";
import { MetricCard } from "./MetricCard";
import { MessageSquare, Send, CheckCircle2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function StatsGrid() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, sent: 0, delivered: 0, failed: 0 });

  const loadStats = async () => {
    try {
      const { data: sends, error } = await supabase.from('campaign_sends').select('status');
      console.log("[StatsGrid] sends:", sends?.length, "error:", error);
      if (sends) {
        setStats({
          total: sends.length,
          sent: sends.filter(s => s.status === 'sent').length,
          delivered: sends.filter(s => s.status === 'delivered').length,
          failed: sends.filter(s => s.status === 'failed').length,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Listen for auth state changes to load data when session is ready
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        loadStats();
      } else {
        setLoading(false);
      }
    });

    // Also try immediately in case session is already available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadStats();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <MetricCard title="Total" value={stats.total} icon={MessageSquare} variant="info" />
      <MetricCard title="Enviadas" value={stats.sent} icon={Send} variant="success" />
      <MetricCard title="Entregues" value={stats.delivered} icon={CheckCircle2} variant="success" />
      <MetricCard title="Falhas" value={stats.failed} icon={X} variant="error" />
    </div>
  );
}
