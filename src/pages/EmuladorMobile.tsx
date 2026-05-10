import { MobileEmulator } from "@/components/dispositivos/MobileEmulator";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone } from "lucide-react";

const EmuladorMobile = () => {
  const { instances, loading } = useZapiInstances();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Emulador Mobile</h1>
        <p className="text-sm text-muted-foreground">
          Conecte um número diretamente como dispositivo principal, sem precisar escanear QR Code.
        </p>
      </div>

      {instances.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma conexão configurada</h3>
            <p className="text-muted-foreground">
              Crie uma conexão na página de Dispositivos antes de usar o emulador.
            </p>
          </CardContent>
        </Card>
      ) : (
        <MobileEmulator instances={instances} />
      )}
    </div>
  );
};

export default EmuladorMobile;