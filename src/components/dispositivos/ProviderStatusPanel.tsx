import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type LogRow = {
  id: string;
  provider: string;
  instance_id: string | null;
  phone: string | null;
  endpoint: string | null;
  status: string;
  http_status: number | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
};

export const ProviderStatusPanel = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("provider_send_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((data as any as LogRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const acc = {
      zapi: { ok: 0, err: 0 },
    };
    logs.forEach((l) => {
      const key = "zapi";
      if (l.status === "success") acc[key].ok++;
      else acc[key].err++;
    });
    return acc;
  }, [logs]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" /> Status de envios Z-API
          </CardTitle>
          <CardDescription>Últimos 50 envios — atualiza a cada 15s</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {(["zapi"] as const).map((p) => (
            <div key={p} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold uppercase">{p}</span>
                <Badge variant={stats[p].err === 0 ? "secondary" : "destructive"}>
                  {stats[p].err === 0 ? "estável" : `${stats[p].err} erros`}
                </Badge>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" /> {stats[p].ok}</span>
                <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> {stats[p].err}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Hora</th>
                  <th className="p-2">Provider</th>
                  <th className="p-2">Endpoint</th>
                  <th className="p-2">Telefone</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Erro</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum envio registrado ainda.</td>
                  </tr>
                )}
                {logs.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</td>
                    <td className="p-2 uppercase">{l.provider}</td>
                    <td className="p-2 truncate max-w-[120px]">{l.endpoint || "-"}</td>
                    <td className="p-2 truncate max-w-[140px]">{l.phone || "-"}</td>
                    <td className="p-2">
                      {l.status === "success" ? (
                        <Badge variant="secondary" className="text-[10px]">OK</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">ERRO</Badge>
                      )}
                    </td>
                    <td className="p-2 text-destructive truncate max-w-[260px]">{l.error_message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};