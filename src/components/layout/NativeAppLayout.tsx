import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
 import { LayoutDashboard, Send, Wallet, Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "@/pages/Dashboard";
import DashboardMeta from "@/pages/DashboardMeta";
import PayDashboard from "@/pages/gateway/PayDashboard";
import NotificacoesApp from "@/pages/NotificacoesApp";

 type Tab = "painel" | "telegram" | "saques" | "avisos";
 
 const tabs: { key: Tab; label: string; icon: any }[] = [
   { key: "painel", label: "Painel", icon: LayoutDashboard },
   { key: "telegram", label: "Telegram", icon: Send },
   { key: "saques", label: "Saques", icon: Wallet },
   { key: "avisos", label: "Avisos", icon: Bell },
 ];
 import TelegramDashboard from "@/pages/telegram/TelegramDashboard";
 import PayWithdrawals from "@/pages/gateway/PayWithdrawals";

export default function NativeAppLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState<Tab>("painel");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        setLoading(false);
        return;
      }

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

      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Content */}
       <main className="flex-1 overflow-auto bg-[#0f1117] p-4 pb-20">
         {activeTab === "painel" && <PayDashboard />}
         {activeTab === "telegram" && <TelegramDashboard />}
         {activeTab === "saques" && <PayWithdrawals />}
         {activeTab === "avisos" && <NotificacoesApp />}
       </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around h-16 z-50 safe-area-bottom">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
