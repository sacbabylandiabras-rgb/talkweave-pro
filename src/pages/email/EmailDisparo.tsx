import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Template { id: string; name: string; subject: string; html: string; }

export default function EmailDisparo() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [fromAlias, setFromAlias] = useState("contato");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("user_email_templates")
        .select("id,name,subject,html")
        .order("created_at", { ascending: false });
      setTemplates((data as Template[]) || []);
    })();
  }, []);

  const applyTemplate = (id: string) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setHtml(t.html);
  };

  const handleSend = async () => {
    const recipients = to.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!recipients.length || !subject.trim() || !html.trim()) {
      toast.error("Preencha destinatários, assunto e mensagem.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-user-email", {
        body: { to: recipients, subject, html, fromAlias },
      });
      if (error) throw error;
      const sent = (data as any)?.sent || 0;
      const total = (data as any)?.total || recipients.length;
      toast.success(`${sent}/${total} email(s) enviado(s).`);
      if (sent < total) {
        const failed = ((data as any)?.results || []).filter((r: any) => !r.ok);
        console.warn("Falhas:", failed);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Disparo de Email</h1>
        <p className="text-sm text-muted-foreground">Envie emails para um ou vários destinatários (separe por vírgula, ponto-e-vírgula ou linha).</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Novo envio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <Label>Remetente (prefixo)</Label>
              <Input value={fromAlias} onChange={e => setFromAlias(e.target.value)} placeholder="contato" />
              <p className="text-xs text-muted-foreground mt-1">ex.: {fromAlias}@seudominio.com</p>
            </div>
            {templates.length > 0 && (
              <div className="md:col-span-2">
                <Label>Usar template</Label>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Escolha um template salvo" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Destinatários</Label>
            <Textarea value={to} onChange={e => setTo(e.target.value)} placeholder="email1@exemplo.com, email2@exemplo.com" rows={3} />
          </div>
          <div>
            <Label>Assunto</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto do email" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={html} onChange={e => setHtml(e.target.value)} rows={12} placeholder="Digite sua mensagem aqui..." className="text-sm" />
          </div>

          <Button onClick={handleSend} disabled={sending} className="bg-primary hover:bg-primary/90">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}