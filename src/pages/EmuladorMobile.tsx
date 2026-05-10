import { MobileEmulator } from "@/components/dispositivos/MobileEmulator";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone } from "lucide-react";

const EmuladorMobile = () => {
  const { instances, loading } = useZapiInstances();
  const mobileInstances = instances.filter((i: any) => i.instance_type === 'mobile');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Emulador Mobile</h1>
        <p className="text-sm text-muted-foreground">
          Conecte um número diretamente como dispositivo principal, sem precisar escanear QR Code.
        </p>
      </div>

      {mobileInstances.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma instância Mobile configurada</h3>
            <p className="text-muted-foreground">
              Peça ao administrador para adicionar uma instância do tipo "Mobile" na sua conta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <MobileEmulator instances={mobileInstances} />
      )}
    </div>
  );
};

export default EmuladorMobile;