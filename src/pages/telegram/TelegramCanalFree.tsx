import { useEffect, useState } from "react";
import { readCanalFree, writeCanalFree } from "@/hooks/useTelegramGroups";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  RefreshCw,
  HelpCircle,
  Save,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function TelegramCanalFree() {
  const [channelName, setChannelName] = useState("");

  useEffect(() => {
    const stored = readCanalFree();
    if (stored) setChannelName(stored.title);
  }, []);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isConfigured = !!channelName;

  function refresh() {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast.error(
        "Não foi possível encontrar o canal. Verifique se o bot está como admin.",
      );
    }, 1200);
  }

  function save() {
    if (!isConfigured) {
      toast.error("Configure primeiro o canal antes de salvar.");
      return;
    }
    if (!welcomeMessage.trim()) {
      toast.error("Informe a mensagem de boas-vindas.");
      return;
    }
    const secs = Number(delaySeconds);
    if (!Number.isFinite(secs) || secs < 1) {
      toast.error("Informe um tempo válido em segundos.");
      return;
    }
    writeCanalFree({
      id: "canal_free",
      title: channelName,
      group_id: "free",
      kind: "free",
    });
    toast.success("Configurações salvas!");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Canal Free</h1>
        <p className="text-sm text-muted-foreground mt-1">Canal Free</p>
      </div>

      {/* Status Banner */}
      <Card
        className={`p-5 border-l-4 ${
          isConfigured
            ? "border-l-emerald-500 bg-emerald-500/5"
            : "border-l-destructive bg-destructive/5"
        }`}
      >
        <div className="flex items-start gap-3">
          {isConfigured ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          )}
          <div>
            <h3 className="font-semibold text-foreground">
              Status da configuração
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isConfigured
                ? `Canal "${channelName}" conectado com sucesso.`
                : "O bot não conseguiu encontrar o canal free. Pode ser necessário remover e adicionar ele ao canal para aparecer aqui!"}
            </p>
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-6 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Canal</Label>
            <button
              type="button"
              onClick={refresh}
              className="text-primary hover:text-primary/80"
              title="Atualizar canal"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div
            className={`rounded-md border bg-muted/40 px-4 py-3 text-sm ${
              isConfigured ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {channelName ||
              "Não encontrado, adicione o bot no canal ou clique no ícone acima para procurar seu canal"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="welcome">Mensagem de boas-vindas</Label>
          <Textarea
            id="welcome"
            placeholder="Ex: Olá, seja bem-vindo! Daqui a pouco você será aceito no canal."
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {welcomeMessage.length}/500
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delay">
            Tempo para aceitar a solicitação (em segundos)
          </Label>
          <Input
            id="delay"
            type="number"
            min={1}
            placeholder="Ex: 10"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            3600 segundos = 1 hora.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button onClick={save}>
            <Save className="w-4 h-4 mr-1.5" />
            Salvar Configurações
          </Button>
          <Button variant="outline" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="w-4 h-4 mr-1.5" />
            Como funciona?
          </Button>
        </div>
      </Card>

      {/* Help Modal */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como funciona?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm text-foreground">
            <p className="flex items-start gap-2">
              <span>⚠️</span>
              <span>
                Esse recurso só pode ser usado em canais privados com links de
                aprovação.
              </span>
              <span>⚠️</span>
            </p>

            <div className="space-y-3">
              <h4 className="font-semibold">
                Checklist para utilizar esse recurso incrível:
              </h4>
              <ol className="list-decimal pl-5 space-y-3 text-muted-foreground">
                <li>Adicione seu bot como administrador do seu canal FREE;</li>
                <li>
                  Acesse sua conta na plataforma e vá para "Canal FREE". Clique
                  no ícone "atualizar" e, quando o nome do seu canal FREE
                  aparecer, confirme clicando em "sim";
                </li>
                <li>
                  Defina uma mensagem de boas-vindas atraente e estratégica:
                  <div className="mt-2 rounded-md bg-muted/50 p-3 text-foreground">
                    <strong>Exemplo:</strong> "Oiiii... Percebi que você
                    solicitou entrar no meu Canal FREE, mas só lembrando que a
                    promoção do meu canal VIP está prestes a encerrar!
                    Aproveita agora, pois em poucos minutos o valor vai
                    dobrar... Venha!";
                  </div>
                </li>
                <li>
                  Defina o tempo em segundos para que o bot aceite as
                  solicitações de entrada no canal gratuito;
                  <div className="mt-2 rounded-md bg-muted/50 p-3 text-foreground">
                    <strong>Exemplo:</strong> 3600 (pois 3600 segundos
                    equivalem a 1 hora).
                  </div>
                </li>
                <li>Crie um link de "aprovação" no seu canal FREE.</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">
                🤔 Como criar um link de aprovação?
              </h4>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>No seu canal gratuito, vá para "link de convite";</li>
                <li>Clique em "criar novo link";</li>
                <li>Ative a opção "pedir aprovação dos administradores";</li>
                <li>Pronto! Se precisar, leia novamente!</li>
              </ol>
            </div>

            <div className="rounded-md bg-primary/5 border border-primary/20 p-4 space-y-3 text-muted-foreground">
              <p>
                <strong className="text-foreground">
                  Entenda o funcionamento:
                </strong>{" "}
                O bot irá aprovar automaticamente todos os usuários que
                solicitarem entrar no canal gratuito, sendo aceitos após o
                período em segundos configurado.
              </p>
              <p>
                Ao divulgar esse link do seu canal gratuito, todos que
                solicitarem entrada receberão uma mensagem do seu bot no chat
                privado, convidando-os para o VIP e, além disso, eles serão
                adicionados instantaneamente à sua lista de transmissão do bot!
              </p>
              <p>
                Esse recurso é simplesmente incrível, podemos garantir, pois já
                realizamos vários testes!
              </p>
              <p className="text-foreground font-medium">
                Aproveite! Em caso de dúvidas, entre em contato com o suporte!
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
