import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventRow {
  id: string;
  event_type: string;
  email_id: string | null;
  recipient: string | null;
  sender: string | null;
  subject: string | null;
  created_at: string;
  raw_payload?: any;
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

const getPayloadHtml = (payload: any) =>
  typeof payload?.data?.html === "string" && payload.data.html.trim()
    ? payload.data.html
    : null;

export default function EmailCaixaEntrada() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EventRow | null>(null);
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);

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

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("resend_webhook_events")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Email apagado com sucesso");
    } catch (error: any) {
      console.error("Error deleting email event:", error);
      toast.error("Erro ao apagar email");
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedEmail?.email_id) { setBodyHtml(getPayloadHtml(selectedEmail?.raw_payload)); return; }
    setBodyLoading(true);
    setBodyHtml(null);
    (async () => {
      const payloadHtml = getPayloadHtml(selectedEmail.raw_payload);
      if (payloadHtml) {
        setBodyHtml(payloadHtml);
        setBodyLoading(false);
        return;
      }

      const { data } = await (supabase as any)
        .from("sent_emails_mapping")
        .select("html")
        .eq("email_id", selectedEmail.email_id)
        .maybeSingle();
      let html = (data as any)?.html || null;

      if (!html) {
        const { data: sentEvent } = await (supabase as any)
          .from("resend_webhook_events")
          .select("raw_payload")
          .eq("email_id", selectedEmail.email_id)
          .eq("event_type", "email.sent")
          .not("raw_payload->data->>html", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        html = getPayloadHtml((sentEvent as any)?.raw_payload);
      }

      setBodyHtml(html);
      setBodyLoading(false);
    })();
  }, [selectedEmail]);

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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => setSelectedEmail(r)}
                      title="Ver conteúdo"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(r.id)}
                      title="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{selectedEmail?.subject || "(sem assunto)"}</DialogTitle>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/50 p-3 rounded-md">
                <div>
                  <p className="font-semibold text-muted-foreground">Para:</p>
                  <p className="break-all">{selectedEmail.recipient}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">De:</p>
                  <p className="break-all">{selectedEmail.sender || "N/A"}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Data:</p>
                  <p>{new Date(selectedEmail.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Status:</p>
                  <Badge variant="outline" className="mt-1 h-5 text-[10px] uppercase">
                    {selectedEmail.event_type.replace("email.", "")}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold border-b pb-1">Mensagem:</p>
                {bodyLoading ? (
                  <div className="flex items-center justify-center min-h-[120px] border rounded-md">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : bodyHtml ? (
                  <iframe
                    title="email-body"
                    srcDoc={bodyHtml}
                    sandbox=""
                    className="w-full min-h-[400px] rounded-md border bg-white"
                  />
                ) : (
                  <div className="p-4 rounded-md border bg-white text-black text-sm min-h-[100px]">
                    Corpo do email não disponível (enviado antes do registro de histórico).
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}