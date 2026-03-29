import { useState, useEffect } from "react";
import { Settings, TestTube, Power, Loader2, CheckCircle } from "lucide-react";
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
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: allTx } = await supabase
        .from("gateway_transactions")
        .select("amount, status")
        .gte("created_at", startOfMonth);

      const txs = allTx || [];
      const approved = txs.filter(t => t.status === "approved");
      const vol = approved.reduce((a, t) => a + (t.amount || 0), 0);

      setVolumeMonth(vol / 100);
      setTxCount(txs.length);
      setApprovalRate(txs.length > 0 ? Math.round((approved.length / txs.length) * 100) : 100);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("https://api.openpix.com.br/api/v1/status", {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.success("Conexão com Woovi (OpenPix) está funcionando!");
      } else {
        toast.error("Woovi retornou erro: " + res.status);
      }
    } catch {
      toast.error("Não foi possível conectar à API da Woovi");
    }
    setTesting(false);
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
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs rounded-full"
                onClick={() => window.open("https://app.openpix.com.br", "_blank")}
              >
                <Settings className="w-3 h-3 mr-1" /> Configurar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs rounded-full"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <TestTube className="w-3 h-3 mr-1" />}
                Testar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
