import { useState, useEffect } from "react";
import { Settings, TestTube, Loader2, CheckCircle, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyReais } from "./mock-data";
import { toast } from "sonner";

export default function AdminAcquirers() {
  const [volumeMonth, setVolumeMonth] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [approvalRate, setApprovalRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [testingWoovi, setTestingWoovi] = useState(false);
  const [testingHubpague, setTestingHubpague] = useState(false);

  // HubPague stats
  const [hubVolumeMonth, setHubVolumeMonth] = useState(0);
  const [hubTxCount, setHubTxCount] = useState(0);
  const [hubApprovalRate, setHubApprovalRate] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: allTx } = await supabase
        .from("gateway_transactions")
        .select("amount, status, metadata")
        .gte("created_at", startOfMonth);

      const txs = allTx || [];

      // Separate by provider
      const wooviTxs = txs.filter(t => !(t.metadata as any)?.provider || (t.metadata as any)?.provider === 'openpix');
      const hubTxs = txs.filter(t => (t.metadata as any)?.provider === 'hubpague');

      // Woovi stats
      const wooviApproved = wooviTxs.filter(t => t.status === "approved");
      setVolumeMonth(wooviApproved.reduce((a, t) => a + (t.amount || 0), 0) / 100);
      setTxCount(wooviTxs.length);
      setApprovalRate(wooviTxs.length > 0 ? Math.round((wooviApproved.length / wooviTxs.length) * 100) : 100);

      // HubPague stats
      const hubApproved = hubTxs.filter(t => t.status === "approved");
      setHubVolumeMonth(hubApproved.reduce((a, t) => a + (t.amount || 0), 0) / 100);
      setHubTxCount(hubTxs.length);
      setHubApprovalRate(hubTxs.length > 0 ? Math.round((hubApproved.length / hubTxs.length) * 100) : 100);

      setLoading(false);
    };
    fetchStats();
  }, []);

  const handleTestWoovi = async () => {
    setTestingWoovi(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pix-charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ slug: "__test__", amount: 100 }),
      });
      const rawBody = await response.text();
      let data: any = null;
      try { data = rawBody ? JSON.parse(rawBody) : null; } catch { data = { error: rawBody }; }

      if (response.status === 404 && data?.error === "Checkout not found") {
        toast.success("Conexão com a Edge Function e Woovi está respondendo corretamente.");
      } else if (response.ok && data?.qrCodeImage) {
        toast.success("Conexão com Woovi (OpenPix) está funcionando!");
      } else if (data?.error === "OpenPix not configured") {
        toast.error("OPENPIX_APP_ID não está configurado nos secrets do Supabase.");
      } else {
        toast.error(`Erro ao testar: ${data?.error || `status ${response.status}`}`);
      }
    } catch (e: any) {
      toast.error("Falha no teste: " + (e.message || "erro desconhecido"));
    } finally {
      setTestingWoovi(false);
    }
  };

  const handleTestHubpague = async () => {
    setTestingHubpague(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-hubpague-charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ slug: "__test__", amount: 100 }),
      });
      const rawBody = await response.text();
      let data: any = null;
      try { data = rawBody ? JSON.parse(rawBody) : null; } catch { data = { error: rawBody }; }

      if (response.status === 404 && data?.error === "Checkout not found") {
        toast.success("Conexão com a Edge Function e HubPague está respondendo corretamente.");
      } else if (response.ok && data?.brCode) {
        toast.success("Conexão com HubPague está funcionando!");
      } else if (data?.error === "HubPague not configured") {
        toast.error("HUBPAGUE_TOKEN não está configurado nos secrets do Supabase.");
      } else {
        toast.error(`Erro ao testar: ${data?.error || `status ${response.status}`}`);
      }
    } catch (e: any) {
      toast.error("Falha no teste: " + (e.message || "erro desconhecido"));
    } finally {
      setTestingHubpague(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Adquirentes</h1>
        <p className="text-sm text-muted-foreground">Gerencie as adquirentes de pagamento da plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Woovi (OpenPix) Card */}
        <Card className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Woovi (OpenPix)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] text-emerald-400 bg-emerald-500/10">Produção</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Volume Mês</p>
                <p className="font-bold text-sm">{formatCurrencyReais(volumeMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Transações</p>
                <p className="font-bold text-sm">{txCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Aprovação</p>
                <p className="font-bold text-sm text-emerald-400">{approvalRate}%</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={() => window.open("https://app.woovi.com", "_blank")}>
                <Settings className="w-3 h-3 mr-1" /> Configurar
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={handleTestWoovi} disabled={testingWoovi}>
                {testingWoovi ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* HubPague Card */}
        <Card className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">HubPague</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] text-blue-400 bg-blue-500/10">Produção</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">Volume Mês</p>
                <p className="font-bold text-sm">{formatCurrencyReais(hubVolumeMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Transações</p>
                <p className="font-bold text-sm">{hubTxCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Aprovação</p>
                <p className="font-bold text-sm text-blue-400">{hubApprovalRate}%</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={() => window.open("https://app.hubpague.io", "_blank")}>
                <Settings className="w-3 h-3 mr-1" /> Configurar
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-full" onClick={handleTestHubpague} disabled={testingHubpague}>
                {testingHubpague ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 rounded-lg border border-[#2A2A2A] bg-muted/30">
        <h3 className="text-sm font-semibold mb-2">📌 Webhook do HubPague</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Configure a URL abaixo como webhook no painel do HubPague em{" "}
          <a href="https://app.hubpague.io/integrations" target="_blank" className="text-blue-400 underline">Integrações</a>:
        </p>
        <code className="text-xs bg-background px-3 py-2 rounded border border-[#2A2A2A] block break-all">
          {import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-hubpague
        </code>
      </div>
    </div>
  );
}
