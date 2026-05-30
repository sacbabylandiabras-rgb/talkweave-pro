import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Send, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";

interface Template { id: string; name: string; subject: string; html: string; }

export default function EmailDisparo() {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [fromAlias, setFromAlias] = useState("contato");
  const [senderName, setSenderName] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("user_email_templates")
        .select("id,name,subject,html")
        .order("created_at", { ascending: false });
      setTemplates((data as Template[]) || []);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("email_sender_name, full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (profile) setSenderName(profile.email_sender_name || profile.full_name || "");
      }
    })();
  }, []);

  const applyTemplate = (id: string) => {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setHtml(t.html);
  };

  const handleSend = async () => {
    const pending = toInput.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
    const all = Array.from(new Set([...recipients, ...pending]));
    if (!all.length || !subject.trim() || !html.trim()) {
      toast.error("Preencha destinatários, assunto e mensagem.");
      return;
    }
    if (pending.length) {
      setRecipients(all);
      setToInput("");
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-user-email", {
        body: { to: all, subject, html, fromAlias, senderName: senderName.trim() || undefined },
      });
      if (error) throw error;
      const sent = (data as any)?.sent || 0;
      const total = (data as any)?.total || all.length;
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

  const addFromInput = () => {
    const parts = toInput.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setRecipients(prev => Array.from(new Set([...prev, ...parts])));
    setToInput("");
  };

  const removeRecipient = (email: string) => {
    setRecipients(prev => prev.filter(e => e !== email));
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Disparo de Email</h1>
        <p className="text-sm text-muted-foreground">Envie emails para um ou vários destinatários — cada e-mail vira um bloco separado.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Novo envio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Nome do remetente</Label>
              <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Ex: Equipe ZapLynx" />
              <p className="text-xs text-muted-foreground mt-1">Nome exibido na caixa de entrada</p>
            </div>
            <div>
              <Label>Remetente (prefixo)</Label>
              <Input value={fromAlias} onChange={e => setFromAlias(e.target.value)} placeholder="contato" />
              <p className="text-xs text-muted-foreground mt-1">ex.: {fromAlias}@seudominio.com</p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Usar template</Label>
              {templates.length > 0 ? (
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Escolha um template salvo" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <span>Nenhum template salvo ainda.</span>
                  <Link to="/email/templates" className="text-primary font-medium hover:underline">
                    Criar template
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Destinatários</Label>
            <div className="min-h-[44px] flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-2 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              {recipients.map(email => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary text-xs font-medium px-2 py-1"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeRecipient(email)}
                    className="hover:bg-primary/20 rounded p-0.5"
                    aria-label={`Remover ${email}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                value={toInput}
                onChange={e => setToInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === ";") {
                    e.preventDefault();
                    addFromInput();
                  } else if (e.key === "Backspace" && !toInput && recipients.length) {
                    setRecipients(prev => prev.slice(0, -1));
                  }
                }}
                onBlur={addFromInput}
                onPaste={e => {
                  const text = e.clipboardData.getData("text");
                  if (/[\s,;\n]/.test(text)) {
                    e.preventDefault();
                    const parts = text.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
                    if (parts.length) setRecipients(prev => Array.from(new Set([...prev, ...parts])));
                  }
                }}
                placeholder={recipients.length ? "" : "Digite um e-mail e pressione Enter"}
                className="flex-1 min-w-[180px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pressione Enter, Tab ou cole vários para adicionar como blocos.</p>
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