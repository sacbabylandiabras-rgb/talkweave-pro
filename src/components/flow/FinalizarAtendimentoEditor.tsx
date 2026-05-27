import { LogOut } from "lucide-react";

type Props = {
  data: any;
  onChange: (patch: any) => void;
};

export function FinalizarAtendimentoEditor({ data, onChange }: Props) {
  if (data?.actionType !== "end_attendance") {
    setTimeout(() => onChange({ actionType: "end_attendance" }), 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-red-500/15 text-red-500 flex items-center justify-center">
          <LogOut className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold">Finalizar Atendimento</h3>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs text-foreground/90">
        Ao chegar neste bloco, o atendimento será finalizado automaticamente. O
        lead será desconectado da conversa e o atendimento será encerrado.
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold mb-2">Como funciona:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>O atendimento é encerrado imediatamente</li>
          <li>O lead é removido da fila de atendimento</li>
          <li>Nenhuma mensagem adicional é enviada</li>
          <li>O fluxo é finalizado neste ponto</li>
        </ul>
      </div>
    </div>
  );
}