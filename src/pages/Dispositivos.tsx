import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Wifi, WifiOff, Plus, Settings } from "lucide-react";

const Dispositivos = () => {
  const dispositivos = [
    {
      id: 1,
      nome: "WhatsApp Principal",
      numero: "+55 11 99999-9999",
      status: "online",
      mensagensEnviadas: 1250,
      ultima_atividade: "Agora"
    },
    {
      id: 2,
      nome: "WhatsApp Suporte",
      numero: "+55 11 88888-8888",
      status: "offline",
      mensagensEnviadas: 845,
      ultima_atividade: "Há 2 horas"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dispositivos</h1>
          <p className="text-muted-foreground">Gerencie seus dispositivos WhatsApp conectados</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Conectar Dispositivo
        </Button>
      </div>

      <div className="grid gap-4">
        {dispositivos.map((dispositivo) => (
          <Card key={dispositivo.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-8 h-8 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{dispositivo.nome}</CardTitle>
                    <CardDescription>{dispositivo.numero}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={dispositivo.status === 'online' ? 'default' : 'secondary'}>
                    {dispositivo.status === 'online' ? (
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
                  <p className="text-muted-foreground">Mensagens Enviadas</p>
                  <p className="font-semibold">{dispositivo.mensagensEnviadas.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Última Atividade</p>
                  <p className="font-semibold">{dispositivo.ultima_atividade}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dispositivos;