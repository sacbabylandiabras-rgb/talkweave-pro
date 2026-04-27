import { useEffect, useState } from "react";
import { Bot, Save, Plus, Trash2 } from "lucide-react";
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

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("telegram_bots")
        .select("id, username, first_name, short_description, description")
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
    }
    // load commands
    (async () => {
      const { data } = await (supabase as any)
        .from("telegram_bot_commands")
        .select("command, description, sort_order")
        .eq("bot_id", selectedId)
        .order("sort_order");
      if (data && data.length > 0) {
        setCommands(data.map((c) => ({ command: c.command, description: c.description })));
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
      toast.success("Bot atualizado no Telegram!");
    } catch (e: any) {
      toast.error(e.message || "Falha ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-white/60">Carregando...</div>;

  if (bots.length === 0) {
    return (
      <div className="p-6">
        <div className="glass-card rounded-2xl p-8 max-w-2xl text-center">
          <Bot className="w-10 h-10 text-[#60a5fa] mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-white mb-2">Nenhum bot conectado</h1>
          <p className="text-sm text-white/60 mb-4">
            Vá em <strong>Criar Bot</strong> e conecte seu primeiro bot do Telegram.
          </p>
          <Button asChild>
            <a href="/telegram/criar-bot">Conectar bot</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="glass-card rounded-2xl p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[rgba(96,165,250,0.18)] border border-[rgba(96,165,250,0.30)] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#60a5fa]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Atualizar Bot</h1>
            <p className="text-sm text-white/60">
              Personalize nome, descrições e comandos diretamente no Telegram.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-white">Bot</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
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
            <Label className="text-white">Nome do bot (até 64 caracteres)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
          </div>

          <div>
            <Label className="text-white">Descrição curta (até 120) — exibida no perfil</Label>
            <Textarea
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              maxLength={120}
              rows={2}
            />
            <p className="text-xs text-white/40 mt-1">{shortDesc.length}/120</p>
          </div>

          <div>
            <Label className="text-white">Descrição longa (até 512) — tela "O que este bot pode fazer?"</Label>
            <Textarea
              value={longDesc}
              onChange={(e) => setLongDesc(e.target.value)}
              maxLength={512}
              rows={4}
            />
            <p className="text-xs text-white/40 mt-1">{longDesc.length}/512</p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Comandos do menu</h2>
          <Button size="sm" variant="outline" onClick={addCmd}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {commands.map((c, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-white/60">/</span>
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
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/40 mt-3">
          Use letras minúsculas, números e <code>_</code>. Comandos aparecem no menu "/" do Telegram.
        </p>
      </div>

      <div className="max-w-3xl flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Salvando..." : "Salvar no Telegram"}
        </Button>
      </div>
    </div>
  );
}
