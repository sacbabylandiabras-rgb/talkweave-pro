import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Clock } from "lucide-react";

export function DelayEditor({
  data,
  onChange,
}: {
  data: any;
  onChange: (patch: any) => void;
}) {
  const totalSeconds = useMemo(() => {
    const raw = Number(data?.delaySeconds ?? data?.actionConfig ?? 0);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  }, [data?.delaySeconds, data?.actionConfig]);

  const minutes = Math.min(60, Math.floor(totalSeconds / 60));
  const seconds = Math.min(60, totalSeconds % 60);

  const apply = (m: number, s: number) => {
    const total = m * 60 + s;
    onChange({
      actionType: "delay",
      delaySeconds: total,
      actionConfig: String(total),
    });
  };

  const formatLabel = () => {
    if (totalSeconds <= 0) return "Sem espera";
    const parts: string[] = [];
    if (minutes > 0) parts.push(`${minutes} min`);
    if (seconds > 0) parts.push(`${seconds} seg`);
    return parts.join(" e ");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">Delay</span>
      </div>

      <div className="space-y-2">
        <Label className="text-[12px]">Minutos: {minutes}</Label>
        <Slider
          min={0}
          max={60}
          step={1}
          value={[minutes]}
          onValueChange={(v) => apply(v[0] ?? 0, seconds)}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span>30</span>
          <span>60</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[12px]">Segundos: {seconds}</Label>
        <Slider
          min={0}
          max={60}
          step={1}
          value={[seconds]}
          onValueChange={(v) => apply(minutes, v[0] ?? 0)}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0</span>
          <span>30</span>
          <span>60</span>
        </div>
      </div>

      <div className="text-center text-[13px] font-medium text-foreground pt-1 border-t border-border/60">
        Tempo de espera: <span className="text-primary">{formatLabel()}</span>
      </div>
    </div>
  );
}