import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Bot { id: string; first_name: string | null; username: string | null }
interface Downsell {
  id: string;
  bot_id: string | null;
  titulo: string;
  plano: string;
  valor_promocional: number;
  vendas_quant: number;
  vendas_val: number;
  cliques: number;
  envios: number;
  status: boolean;
  minutos: number;
  mensagem: string;
  trigger_type: "pending_sale" | "no_purchase";
  button_label: string | null;
  button_url: string | null;
}

const PLANOS = ["Mensal", "Trimestral", "Semestral", "Anual", "Vitalício"];
const TRIGGERS = [
  { value: "pending_sale", label: "Venda pendente (PIX não pago)" },
  { value: "no_purchase", label: "Lead que nunca comprou" },
] as const;

const empty = {
  titulo: "",
  plano: PLANOS[0],
  valor: "",
  minutos: "30",
  mensagem: "Oi! Última chance: {plano} por R$ {valor}. Aproveita!",
  trigger_type: "pending_sale" as "pending_sale" | "no_purchase",
  bot_id: "",
  button_label: "",
  button_url: "",
};

export default function TelegramDownsell() {
  const [items, setItems] = useState<Downsell[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Downsell | null>(null);
  const [testOpen, setTestOpen] = useState<Downsell | null>(null);
  const [testChatId, setTestChatId] = useState("");

  const [form, setForm] = useState({ ...empty });

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [d, b] = await Promise.all([
      supabase.from("telegram_downsells" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("telegram_bots").select("id, first_name, username").eq("user_id", user.id).eq("active", true),
    ]);
    if (d.error) toast.error("Falha ao carregar"); else setItems((d.data ?? []) as any);
    if (!b.error) setBots(b.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...empty, bot_id: bots[0]?.id ?? "" });
    setOpen(true);
  }

  function openEdit(d: Downsell) {
    setEditing(d);
    setForm({
      titulo: d.titulo,
      plano: d.plano,
      valor: String(d.valor_promocional ?? ""),
      minutos: String(d.minutos),
      mensagem: d.mensagem,
      trigger_type: d.trigger_type,
      bot_id: d.bot_id ?? "",
      button_label: d.button_label ?? "",
      button_url: d.button_url ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      toast.error("Preencha título e mensagem"); return;
    }
    if (!form.bot_id) { toast.error("Selecione um bot"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); return; }

    const payload = {
      user_id: user.id,
      bot_id: form.bot_id,
      titulo: form.titulo,
      plano: form.plano,
      valor_promocional: Number(form.valor) || 0,
      minutos: Number(form.minutos) || 0,
      mensagem: form.mensagem,
      trigger_type: form.trigger_type,
      button_label: form.button_label || null,
      button_url: form.button_url || null,
    };

    const res = editing
      ? await supabase.from("telegram_downsells" as any).update(payload).eq("id", editing.id)
      : await supabase.from("telegram_downsells" as any).insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Atualizado" : "Disparo criado");
    setOpen(false);
    load();
  }

  async function toggle(d: Downsell) {
    const { error } = await supabase.from("telegram_downsells" as any).update({ status: !d.status }).eq("id", d.id);
    if (error) toast.error(error.message); else load();
  }

  async function remover(id: string) {
    if (!confirm("Remover este disparo?")) return;
    const { error } = await supabase.from("telegram_downsells" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  }

  async function sendTest() {
    if (!testOpen) return;
    if (!testChatId.trim()) { toast.error("Informe o chat_id do Telegram"); return; }
    const { data, error } = await supabase.functions.invoke("telegram-downsell-tick", {
      body: { mode: "test", downsell_id: testOpen.id, chat_id: Number(testChatId) },
    });
    if (error || (data && (data as any).error)) {
      toast.error(((data as any)?.error) || error?.message || "Falha no envio");
    } else if ((data as any)?.ok) {
      toast.success("Mensagem enviada");
      setTestOpen(null); setTestChatId("");
    } else {
      toast.error("Falha no envio");
    }
  }

  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const botLabel = useMemo(() => {
    const m = new Map(bots.map((b) => [b.id, b.first_name || b.username || b.id.slice(0, 6)]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [bots]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Downsell</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mensagens automáticas de recuperação enviadas pelo bot do Telegram após X minutos.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Todos os disparos criados
            <Badge className="bg-primary text-primary-foreground rounded-full">{items.length}</Badge>
          </h2>
          <Button onClick={openCreate} disabled={bots.length === 0}>
            <Plus className="w-4 h-4 mr-1.5" /> Criar novo disparo
          </Button>
        </div>

        {bots.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground mb-3">
            Conecte um bot do Telegram antes de criar disparos.
          </p>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-t border-b">
                <TableHead>Título</TableHead>
                <TableHead>Bot</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Envios</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Minutos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground text-sm">Carregando...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-16 text-center text-muted-foreground text-sm">Nenhum disparo criado ainda.</TableCell></TableRow>
              ) : items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.titulo}</TableCell>
                  <TableCell className="text-sm">{botLabel(d.bot_id)}</TableCell>
                  <TableCell className="text-xs">{TRIGGERS.find(t => t.value === d.trigger_type)?.label}</TableCell>
                  <TableCell>{d.plano}</TableCell>
                  <TableCell>{fmt(d.valor_promocional)}</TableCell>
                  <TableCell>{d.envios ?? 0}</TableCell>
                  <TableCell><Switch checked={d.status} onCheckedChange={() => toggle(d)} /></TableCell>
                  <TableCell>{d.minutos} min</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Testar" onClick={() => { setTestOpen(d); setTestChatId(""); }}><Send className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(d)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" title="Remover" onClick={() => remover(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar disparo" : "Criar novo disparo de downsell"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Recuperação 50% OFF" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bot</Label>
              <Select value={form.bot_id} onValueChange={(v) => setForm({ ...form, bot_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {bots.map((b) => <SelectItem key={b.id} value={b.id}>{b.first_name || b.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gatilho</Label>
              <Select value={form.trigger_type} onValueChange={(v: any) => setForm({ ...form, trigger_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {form.trigger_type === "pending_sale"
                  ? "Dispara para quem gerou cobrança e não pagou após X minutos."
                  : "Dispara para leads que iniciaram conversa com o bot e nunca compraram."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Plano</Label>
                <Select value={form.plano} onValueChange={(v) => setForm({ ...form, plano: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLANOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor promocional (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="9,90" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Disparar após (minutos)</Label>
              <Input type="number" min={0} value={form.minutos} onChange={(e) => setForm({ ...form, minutos: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea rows={4} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} placeholder="Use {plano}, {valor}, {minutos}" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Texto do botão (opcional)</Label>
                <Input value={form.button_label} onChange={(e) => setForm({ ...form, button_label: e.target.value })} placeholder="Garantir oferta" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL do botão</Label>
                <Input value={form.button_url} onChange={(e) => setForm({ ...form, button_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar disparo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!testOpen} onOpenChange={(o) => !o && setTestOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar teste</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Chat ID do Telegram</Label>
            <Input value={testChatId} onChange={(e) => setTestChatId(e.target.value)} placeholder="123456789" />
            <p className="text-[11px] text-muted-foreground">Use o numérico do chat. Você pode obter enviando /start ao bot e olhando em Conversas.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(null)}>Cancelar</Button>
            <Button onClick={sendTest}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
