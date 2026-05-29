import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EventRow {
  id: string;
  event_type: string;
  email_id: string | null;
  recipient: string | null;
  sender: string | null;
  subject: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  "email.delivered": "bg-emerald-500/15 text-emerald-400",
  "email.sent": "bg-blue-500/15 text-blue-400",
  "email.opened": "bg-indigo-500/15 text-indigo-400",
  "email.clicked": "bg-violet-500/15 text-violet-400",
  "email.bounced": "bg-red-500/15 text-red-400",
  "email.complained": "bg-orange-500/15 text-orange-400",
  "email.delivery_delayed": "bg-yellow-500/15 text-yellow-400",
};

export default function EmailCaixaEntrada() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("resend_webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as EventRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caixa de Entrada</h1>
          <p className="text-sm text-muted-foreground">Histórico de eventos de email (entregas, aberturas, cliques, retornos).</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Últimos eventos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Nenhum evento ainda. Configure o webhook no painel do provedor para começar a receber eventos.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
                  <Badge className={STATUS_COLORS[r.event_type] || "bg-muted text-foreground"}>{r.event_type.replace("email.", "")}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.subject || "(sem assunto)"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.recipient} {r.sender && `• de ${r.sender}`}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}