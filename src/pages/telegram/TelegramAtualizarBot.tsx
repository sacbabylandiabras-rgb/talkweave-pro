import { useEffect, useState } from "react";
import { Bot, Save, Plus, Trash2, Pencil, LifeBuoy, Workflow, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TgBot {
  id: string;
  bot_token: string;
  username: string | null;
  first_name: string | null;
  short_description: string | null;
  description: string | null;
}

interface Cmd {
  command: string;
  description: string;
}

export default function TelegramAtualizarBot() {
  const [bots, setBots] = useState<TgBot[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [commands, setCommands] = useState<Cmd[]>([{ command: "start", description: "Iniciar" }]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingToken, setEditingToken] = useState(false);
  const [newToken, setNewToken] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("telegram_bots")
        .select("id, bot_token, username, first_name, short_description, description")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else {
        setBots((data ?? []) as TgBot[]);
        if (data && data.length > 0) setSelectedId(data[0].id);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const bot = bots.find((b) => b.id === selectedId);
    if (bot) {
      setName(bot.first_name ?? "");
      setShortDesc(bot.short_description ?? "");
      setLongDesc(bot.description ?? "");
      setEditingToken(false);
      setNewToken("");
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("telegram_bot_commands")
        .select("command, description, sort_order")
        .eq("bot_id", selectedId)
        .order("sort_order");
      if (data && data.length > 0) {
        setCommands(data.map((c: any) => ({ command: c.command, description: c.description })));
      } else {
        setCommands([{ command: "start", description: "Iniciar" }]);
      }
    })();
  }, [selectedId, bots]);

  function addCmd() {
    setCommands([...commands, { command: "", description: "" }]);
  }
  function updateCmd(i: number, field: keyof Cmd, value: string) {
    setCommands(commands.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }
  function removeCmd(i: number) {
    setCommands(commands.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const cleanedCommands = commands
        .filter((c) => c.command.trim())
        .map((c) => ({
          command: c.command.replace(/^\//, "").toLowerCase(),
          description: c.description,
        }));
      const { data, error } = await (supabase as any).functions.invoke("telegram-update-bot", {
        body: {
          bot_id: selectedId,
          name,
          short_description: shortDesc,
          description: longDesc,
          commands: cleanedCommands,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Alterações enviadas com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function changeToken() {
    if (!selectedId || !newToken.trim()) return;
    try {
      const { data, error } = await (supabase as any).functions.invoke("telegram-validate-bot", {
        body: { token: newToken.trim(), save: true, bot_id: selectedId, replace: true },
      });
      if (error) throw error;
      toast.success("Token atualizado com sucesso!");
      setEditingToken(false);
      setNewToken("");
      // refresh
      const { data: refreshed } = await (supabase as any)
        .from("telegram_bots")
        .select("id, bot_token, username, first_name, short_description, description")
        .order("created_at", { ascending: false });
      setBots((refreshed ?? []) as TgBot[]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao validar token");
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  if (bots.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-2xl text-center">
          <Bot className="w-10 h-10 text-[#a78bfa] mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-foreground mb-2">Nenhum bot conectado</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Vá em <strong>Criar bot</strong> e conecte seu primeiro bot.
          </p>
          <Button asChild>
            <Link to="/telegram/criar-bot">Conectar bot</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentBot = bots.find((b) => b.id === selectedId);
  const tokenMasked = currentBot?.bot_token
    ? `${currentBot.bot_token.slice(0, 10)}${"•".repeat(20)}`
    : "";

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Dados do bot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atualize e mantenha seus dados em dia para uma experiência personalizada
          </p>
        </div>
      </div>

      {/* Gestão de Cadastro */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">Gestão de Cadastro</h2>
          <div className="ml-auto">
            <Link
              to="/telegram/criar-bot"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              Acessar Flow Chat <Workflow className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-medium">Envie suas atualizações para a plataforma</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ao modificar as informações do bot, não se esqueça de clicar em "Salvar alterações" para enviar as novas configurações
            </p>
          </div>
          <Button onClick={save} disabled={saving} className="shrink-0">
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {/* Configurações */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Configurações</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Definições de tipo de bot e token principal, mantenha as definições atualizadas para garantir a autenticação e o funcionamento
          </p>
        </div>

        <div>
          <Label className="text-foreground text-sm">
            Bot<span className="text-primary">*</span>
          </Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bots.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  @{b.username} — {b.first_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-foreground text-sm">
            Tipo<span className="text-primary">*</span>
          </Label>
          <Select value="flowchat" disabled>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Flow Chat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flowchat">Flow Chat</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-foreground text-sm">
            Token do bot principal<span className="text-primary">*</span>
          </Label>
          {editingToken ? (
            <div className="flex gap-2 mt-1.5">
              <Input
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                placeholder="Cole o novo token"
                className="flex-1"
              />
              <Button onClick={changeToken} disabled={!newToken.trim()}>
                Salvar token
              </Button>
              <Button variant="ghost" onClick={() => { setEditingToken(false); setNewToken(""); }}>
                Cancelar
              </Button>
            </div>
          ) : (
            <>
              <Input value={tokenMasked} disabled className="mt-1.5 font-mono" />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setEditingToken(true)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Mudar token
              </Button>
            </>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-3">
          <Workflow className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground/80">
            Este bot foi criado via <strong className="text-foreground">Flow Chat</strong>. Acesse o Flow Chat e configure filtros para direcionar mensagens a públicos específicos, incluir imagens, textos, botões e mais.
          </p>
        </div>
      </div>

      {/* Personalização */}
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Personalização do bot</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Edite nome e descrições exibidas no perfil do bot.
          </p>
        </div>

        <div>
          <Label className="text-foreground text-sm">Nome do bot (até 64 caracteres)</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label className="text-foreground text-sm">Descrição curta (até 120) — exibida no perfil</Label>
          <Textarea
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            maxLength={120}
            rows={2}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground/70 mt-1">{shortDesc.length}/120</p>
        </div>

        <div>
          <Label className="text-foreground text-sm">
            Descrição longa (até 512) — tela "O que este bot pode fazer?"
          </Label>
          <Textarea
            value={longDesc}
            onChange={(e) => setLongDesc(e.target.value)}
            maxLength={512}
            rows={4}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground/70 mt-1">{longDesc.length}/512</p>
        </div>
      </div>

      {/* Comandos */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Comandos do menu</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Comandos aparecem no menu "/" dentro da conversa.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addCmd}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {commands.map((c, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-muted-foreground">/</span>
                <Input
                  placeholder="start"
                  value={c.command}
                  onChange={(e) => updateCmd(i, "command", e.target.value)}
                  maxLength={32}
                  className="font-mono"
                />
              </div>
              <Input
                placeholder="Descrição"
                value={c.description}
                onChange={(e) => updateCmd(i, "description", e.target.value)}
                maxLength={256}
                className="flex-[2]"
              />
              <Button size="icon" variant="ghost" onClick={() => removeCmd(i)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-3">
          Use letras minúsculas, números e <code>_</code>.
        </p>
      </div>

      {/* Suporte */}
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-foreground font-medium">
            Está enfrentando alguma dificuldade com o seu bot e não conseguiu resolver sozinho?
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Entre em contato com nossa equipe! Estamos prontos para te ajudar a resolver problemas e ajustar configurações do seu bot.
          </p>
        </div>
        <Button variant="outline" className="shrink-0">
          <LifeBuoy className="w-4 h-4 mr-1.5" /> Acionar suporte
        </Button>
      </div>
    </div>
  );
}
