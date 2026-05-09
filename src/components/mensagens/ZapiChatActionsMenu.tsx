import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Pin,
  BellOff,
  Archive,
  CheckCheck,
  Eraser,
  Trash2,
  Timer,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  phone: string;
  instanceDbId?: string;
}

export default function ZapiChatActionsMenu({ phone, instanceDbId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (action: string, payload?: any, label?: string) => {
    setLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action, phone, instanceDbId, payload },
      });
      if (error || (data as any)?.error) {
        const raw = (data as any)?.error;
        const status = (data as any)?.status;
        let msg = raw?.message || raw?.error || raw;
        if (typeof msg !== "string") msg = JSON.stringify(msg);
        if (status) msg = `[${status}] ${msg}`;
        throw new Error(msg || error?.message || "Falha na ação");
      }
      toast({ title: label || "Ação realizada", description: "Operação concluída com sucesso." });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível executar a ação.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Mais ações">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ações da Conversa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run("read", undefined, "Marcado como lido")}>
          <CheckCheck className="w-4 h-4 mr-2" /> Marcar como lido
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <BellOff className="w-4 h-4 mr-2" /> Silenciar
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => run("mute", { muteFor: 28800 }, "Silenciado por 8h")}>
              8 horas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("mute", { muteFor: 604800 }, "Silenciado por 7 dias")}>
              7 dias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("mute", { muteFor: 31536000 }, "Silenciado por 1 ano")}>
              1 ano
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => run("unmute", undefined, "Som ativado")}>
              Reativar som
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Timer className="w-4 h-4 mr-2" /> Mensagens temporárias
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => run("expiration", { expiration: 0 }, "Expiração desativada")}>
              Desativado
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("expiration", { expiration: 86400 }, "Expiração 24h")}>
              24 horas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("expiration", { expiration: 604800 }, "Expiração 7 dias")}>
              7 dias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("expiration", { expiration: 7776000 }, "Expiração 90 dias")}>
              90 dias
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (confirm("Limpar todas as mensagens desta conversa?")) {
              run("clear", undefined, "Conversa limpa");
            }
          }}
        >
          <Eraser className="w-4 h-4 mr-2" /> Limpar mensagens
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            if (confirm("Excluir esta conversa do WhatsApp?")) {
              run("delete", undefined, "Conversa excluída");
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Excluir conversa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}