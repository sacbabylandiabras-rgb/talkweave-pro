import { Flag } from "lucide-react";

type Props = {
  data: any;
  onChange: (patch: any) => void;
};

export function FimFluxoEditor({ data, onChange }: Props) {
  // ensure actionType is set
  if (data?.actionType !== "end_flow") {
    setTimeout(() => onChange({ actionType: "end_flow" }), 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-red-500/15 text-red-500 flex items-center justify-center">
          <Flag className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold">Fim do Fluxo</h3>
      </div>

      <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs text-foreground/90">
        Este bloco marca o ponto final do fluxo de processamento. Quando o fluxo
        chega aqui, o processamento é encerrado.
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold mb-2">Como funciona:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>O processamento do fluxo é interrompido neste ponto</li>
          <li>Nenhuma ação adicional é executada</li>
          <li>Diferente de "Finalizar Atendimento", não encerra o chat</li>
          <li>Útil para encerrar ramos de fluxos condicionais</li>
        </ul>
      </div>
    </div>
  );
}