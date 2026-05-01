import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Globe, CreditCard, Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "@/pages/Dashboard";
import DashboardMeta from "@/pages/DashboardMeta";
import PayDashboard from "@/pages/gateway/PayDashboard";
import NotificacoesApp from "@/pages/NotificacoesApp";

type Tab = "whatsapp" | "meta" | "gateway" | "notif";

const tabs: { key: Tab; label: string; icon: typeof MessageSquare }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "meta", label: "Meta API", icon: Globe },
  { key: "gateway", label: "Gateway", icon: CreditCard },
  { key: "notif", label: "Alertas", icon: Bell },
];

export default function NativeAppLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("whatsapp");

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
      <main className="flex-1 overflow-auto p-4 pb-20">
        {activeTab === "whatsapp" && <Dashboard />}
        {activeTab === "meta" && <DashboardMeta />}
        {activeTab === "gateway" && <PayDashboard />}
        {activeTab === "notif" && <NotificacoesApp />}
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
