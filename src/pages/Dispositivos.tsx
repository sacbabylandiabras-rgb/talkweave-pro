import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Wifi, WifiOff, Plus, Settings, RefreshCw } from "lucide-react";
import { useZapi } from "@/hooks/useZapi";

const Dispositivos = () => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const { getDeviceStatus, loading } = useZapi();

  const fetchDeviceStatus = async () => {
    try {
      const status = await getDeviceStatus();
      setDeviceStatus(status.data);
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  };

  useEffect(() => {
    fetchDeviceStatus();
  }, []);

  const isOnline = deviceStatus?.connected === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dispositivos</h1>
          <p className="text-muted-foreground">Gerencie seus dispositivos WhatsApp conectados</p>
        </div>
        <Button className="flex items-center gap-2" onClick={fetchDeviceStatus} disabled={loading}>
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Atualizar Status
        </Button>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-8 h-8 text-primary" />
                <div>
                  <CardTitle className="text-lg">ZapLynx Instance</CardTitle>
                  <CardDescription>
                    {deviceStatus?.phone || 'Aguardando conexão...'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isOnline ? 'default' : 'secondary'}>
                  {isOnline ? (
                    <><Wifi className="w-3 h-3 mr-1" /> Online</>
                  ) : (
                    <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
                  )}
                </Badge>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status da Instância</p>
                <p className="font-semibold capitalize">
                  {deviceStatus?.status || 'Desconhecido'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Bateria</p>
                <p className="font-semibold">
                  {deviceStatus?.battery || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Conexão</p>
                <p className="font-semibold">
                  {isOnline ? 'Conectado' : 'Desconectado'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Última Verificação</p>
                <p className="font-semibold">
                  {new Date().toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            
            {deviceStatus && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Informações Detalhadas:</h4>
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {JSON.stringify(deviceStatus, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dispositivos;