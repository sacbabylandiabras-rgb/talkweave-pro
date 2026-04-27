import { useEffect, useState } from "react";
import { Bot, Plus, Trash2, CheckCircle2, ExternalLink, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TgBot {
  id: string;
  bot_token: string;
  bot_id: number | null;
  username: string | null;
  first_name: string | null;
  active: boolean;
  last_validated_at: string | null;
  created_at: string;
}

export default function TelegramCriarBot() {
  const [bots, setBots] = useState<TgBot[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  async function load() {
    setFetching(true);
    const { data, error } = await supabase
      .from("telegram_bots")
      .select("id, bot_token, bot_id, username, first_name, active, last_validated_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setBots((data ?? []) as TgBot[]);
    setFetching(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConnect() {
    const trimmed = token.trim();
    if (!trimmed) {
      toast.error("Cole o token do BotFather");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-validate-bot", {
        body: { token: trimmed, save: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Bot @${(data as any).me?.username} conectado!`);
      setToken("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao validar token");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(bot: TgBot) {
    const { error } = await supabase
      .from("telegram_bots")
      .update({ active: !bot.active })
      .eq("id", bot.id);
    if (error) toast.error(error.message);
    else {
      toast.success(bot.active ? "Bot pausado" : "Bot ativado");
      load();
    }
  }

  async function removeBot(bot: TgBot) {
    if (!confirm(`Remover o bot @${bot.username}?`)) return;
    const { error } = await supabase.from("telegram_bots").delete().eq("id", bot.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Bot removido");
      load();
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="glass-card rounded-2xl p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[rgba(96,165,250,0.18)] border border-[rgba(96,165,250,0.30)] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#60a5fa]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Criar Bot</h1>
            <p className="text-sm text-white/60">
              Conecte seu bot do Telegram colando o token gerado pelo @BotFather.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-5 space-y-2">
          <p className="text-sm font-medium text-white">Como gerar seu token</p>
          <ol className="text-xs text-white/60 space-y-1 list-decimal list-inside">
            <li>
              Abra{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-[#60a5fa] hover:underline inline-flex items-center gap-1"
              >
                @BotFather <ExternalLink className="w-3 h-3" />
              </a>{" "}
              no Telegram.
            </li>
            <li>Envie <code className="bg-white/10 px-1 rounded">/newbot</code> e siga as instruções.</li>
            <li>Copie o token (formato <code className="bg-white/10 px-1 rounded">123456789:AAH...</code>) e cole abaixo.</li>
          </ol>
        </div>

        <div className="space-y-3">
          <Label className="text-white">Token do Bot</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="123456789:AAHk...."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="font-mono"
              disabled={loading}
            />
            <Button onClick={handleConnect} disabled={loading || !token.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              {loading ? "Validando..." : "Conectar"}
            </Button>
          </div>
          <p className="text-xs text-white/50 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            O token é validado em <code>api.telegram.org/getMe</code> antes de ser salvo.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 max-w-4xl">
        <h2 className="text-lg font-semibold text-white mb-4">Bots conectados</h2>
        {fetching ? (
          <p className="text-white/50 text-sm">Carregando...</p>
        ) : bots.length === 0 ? (
          <p className="text-white/50 text-sm">Nenhum bot conectado ainda.</p>
        ) : (
          <div className="space-y-3">
            {bots.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[rgba(96,165,250,0.2)] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#60a5fa]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{b.first_name || "(sem nome)"}</span>
                      {b.active && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ativo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/50 flex items-center gap-2">
                      <span>@{b.username}</span>
                      <span>·</span>
                      <span>ID {b.bot_id}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`@${b.username}`);
                          toast.success("Username copiado");
                        }}
                        className="hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(b)}>
                    {b.active ? "Pausar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeBot(b)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
