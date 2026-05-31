import { useEffect, useState } from "react";
import {
  Bot,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Copy,
  Settings,
  Clock,
  PauseCircle,
  Youtube,
  LifeBuoy,
  Workflow,
  Info,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  bot_id: number | null;
  username: string | null;
  first_name: string | null;
  active: boolean;
  last_validated_at: string | null;
  created_at: string;
}

export default function TelegramCriarBot() {
  const navigate = useNavigate();
  const [bots, setBots] = useState<TgBot[]>([]);
  const [token, setToken] = useState("");
  const [botType, setBotType] = useState("flowchat");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [revalidating, setRevalidating] = useState<string | null>(null);

  function formatRelative(iso: string | null) {
    if (!iso) return "nunca validado";
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "agora mesmo";
    const min = Math.floor(sec / 60);
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    const days = Math.floor(h / 24);
    if (days < 30) return `há ${days}d`;
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  async function load() {
    setFetching(true);
    const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any).functions.invoke("telegram-validate-bot", {
        body: { token: trimmed, save: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Bot @${(data as any).me?.username} cadastrado!`);
      setToken("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao validar token");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(bot: TgBot) {
    const { error } = await (supabase as any)
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
    const { error } = await (supabase as any).from("telegram_bots").delete().eq("id", bot.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Bot removido");
      load();
    }
  }

  async function revalidate(bot: TgBot) {
    setRevalidating(bot.id);
    try {
      const { data, error } = await (supabase as any).functions.invoke("telegram-validate-bot", {
        body: { token: bot.bot_token, save: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Token revalidado com sucesso");
      load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao revalidar");
    } finally {
      setRevalidating(null);
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <h1 className="font-bebas text-[26px] text-foreground tracking-[2px] leading-none">
          CADASTRAR BOT
        </h1>
        <p className="font-nunito text-[12px] text-muted-foreground mt-1">
          Crie um novo bot, configurando suas informações para começar a automatizar interações e
          gerenciar mensagens de forma eficiente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form principal */}
        <div className="rounded-2xl p-6 lg:col-span-2 bg-card border border-border shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-foreground">Configurar cadastro</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Crie e gerencie tokens, tipos e configurações do bot.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground text-sm">
                Tipo<span className="text-destructive">*</span>
              </Label>
              <Select value={botType} onValueChange={setBotType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flowchat">Flow Chat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground text-sm">
                Token do bot principal<span className="text-destructive">*</span>
              </Label>
              <Input
                type="password"
                placeholder="Insira o token fornecido pelo bot father"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="font-mono"
                disabled={loading}
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Workflow className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                Você escolheu criar o bot pelo <span className="text-primary font-medium">Flow Chat</span>.
                Após a criação, acesse o Flow Chat, configure filtros para direcionar mensagens a públicos
                específicos, inclua imagens, textos, botões e mais.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar tutoriais */}
        <div className="rounded-2xl p-6 space-y-4 bg-card border border-border shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tutoriais e orientações</h2>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
              <p className="text-xs text-foreground/80 leading-relaxed">
                <span className="font-medium text-foreground">1.</span> Crie um bot no Telegram usando o{" "}
                <span className="font-medium text-foreground">BotFather</span> e copie o token gerado para
                prosseguir com a configuração.
              </p>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1.5 text-xs font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Acessar BotFather
              </a>
            </div>

            <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
              <p className="text-xs text-foreground/80 leading-relaxed">
                <span className="font-medium text-foreground">2.</span> Se for sua primeira vez criando um
                bot, assista ao nosso{" "}
                <span className="font-medium text-foreground">vídeo tutorial</span>. Ele mostra passo a passo
                como preencher as informações e garantir um bot funcional.
              </p>
              <a
                href="https://www.youtube.com/results?search_query=como+criar+bot+telegram+botfather"
                target="_blank"
                rel="noreferrer"
                className="text-destructive hover:underline inline-flex items-center gap-1.5 text-xs font-medium"
              >
                <Youtube className="w-3.5 h-3.5" /> Assistir tutorial
              </a>
            </div>

            <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-3">
              <p className="text-xs text-foreground/80 leading-relaxed">
                Se o vídeo não esclarecer todas as dúvidas, nosso suporte estará à disposição para
                ajudar com prazer.
              </p>
              <Button size="sm" className="w-full" variant="default">
                <LifeBuoy className="w-4 h-4 mr-1.5" /> Acionar suporte
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de bots conectados */}
      <div className="rounded-2xl p-6 bg-card border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bots cadastrados</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Gerencie e acompanhe seus bots ativos</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {bots.length} {bots.length === 1 ? "bot" : "bots"}
          </span>
        </div>
        {fetching ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : bots.length === 0 ? (
          <div className="text-center py-10">
            <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum bot cadastrado ainda.</p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              Preencha o formulário acima e clique em "Cadastrar bot" para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bots.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border flex-wrap gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-foreground font-medium truncate">
                        {b.first_name || "(sem nome)"}
                      </span>
                      {b.active ? (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ativo
                        </span>
                      ) : (
                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <PauseCircle className="w-3 h-3" /> pausado
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>@{b.username}</span>
                      <span>·</span>
                      <span>ID {b.bot_id}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`@${b.username}`);
                          toast.success("Username copiado");
                        }}
                        className="hover:text-foreground"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      Última validação: {formatRelative(b.last_validated_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revalidate(b)}
                    disabled={revalidating === b.id}
                  >
                    {revalidating === b.id ? "..." : "Revalidar"}
                  </Button>
                  <Link to={`/telegram/atualizar-bot?bot=${b.id}`}>
                    <Button size="sm" variant="ghost" title="Editar perfil do bot">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(b)}>
                    {b.active ? "Pausar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeBot(b)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer de ações */}
      <div className="border border-border bg-card px-6 py-4 rounded-xl flex items-center justify-between gap-3 shadow-sm">
        <button
          type="button"
          onClick={() => navigate("/telegram/dashboard")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
        >
          <Info className="w-3.5 h-3.5" /> Cancelar cadastro
        </button>
        <Button onClick={handleConnect} disabled={loading || !token.trim()} size="lg">
          <Plus className="w-4 h-4 mr-1.5" />
          {loading ? "Cadastrando..." : "Cadastrar bot"}
        </Button>
      </div>
    </div>
  );
}