import { useDeviceType } from "@/hooks/useDeviceType";
import { Monitor } from "lucide-react";

export function MobileRestricted({ children }: { children: React.ReactNode }) {
  const { isNative } = useDeviceType();

  if (!isNative) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center gap-4 min-h-[60vh]">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Monitor className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        Disponível apenas no Desktop
      </h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Esta funcionalidade está disponível apenas na versão desktop. Acesse pelo computador para utilizar.
      </p>
    </div>
  );
}
