import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Wifi, WifiOff, Plus, Settings, RefreshCw, QrCode } from "lucide-react";
import { useZapi } from "@/hooks/useZapi";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from 'qrcode';

const Dispositivos = () => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(true);
  const { getDeviceStatus, getQRCode, loading } = useZapi();
  const { toast } = useToast();

  const fetchDeviceStatus = async () => {
    try {
      const status = await getDeviceStatus();
      setDeviceStatus(status.data);
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  };

  const fetchQRCode = async () => {
    try {
      const qrData = await getQRCode();
      console.log('QR Data recebido:', qrData);
      
      if (qrData.data && qrData.data.value) {
        setQrCode(qrData.data.value);
        
        // Gerar imagem do QR Code a partir da string
        try {
          const qrImageDataURL = await QRCodeLib.toDataURL(qrData.data.value, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeImage(qrImageDataURL);
          console.log('QR Code gerado como imagem:', qrImageDataURL.substring(0, 50) + '...');
        } catch (qrError) {
          console.error('Erro ao gerar QR Code:', qrError);
        }
      } else {
        console.log('Estrutura inesperada da resposta:', qrData);
      }
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
    }
  };

  useEffect(() => {
    fetchDeviceStatus();
    // Se o dispositivo não estiver conectado, buscar QR Code automaticamente
    if (deviceStatus?.connected === false) {
      fetchQRCode();
    }
  }, [deviceStatus?.connected]);

  const isOnline = deviceStatus?.connected === true && deviceStatus?.session === true;
  const needsConnection = !deviceStatus?.session || deviceStatus?.error?.includes("not connected");

  console.log('=== DEBUG STATUS ===');
  console.log('deviceStatus:', deviceStatus);
  console.log('isOnline:', isOnline);
  console.log('needsConnection:', needsConnection);
  console.log('==================');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dispositivos</h1>
          <p className="text-muted-foreground">Gerencie seus dispositivos WhatsApp conectados</p>
        </div>
        <div className="flex gap-2">
          <Button className="flex items-center gap-2" onClick={fetchDeviceStatus} disabled={loading}>
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Atualizar Status
          </Button>
          {needsConnection && (
            <Button variant="outline" className="flex items-center gap-2" onClick={fetchQRCode} disabled={loading}>
              <QrCode className="w-4 h-4" />
              Gerar QR Code
            </Button>
          )}
        </div>
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

            {needsConnection && qrCodeImage && (
              <div className="mt-4 p-4 bg-background border rounded-lg text-center">
                <h4 className="font-medium mb-4">📱 Escolha como conectar:</h4>
                
                {/* Abas para QR Code e Código */}
                <div className="flex justify-center mb-4">
                  <div className="flex bg-muted rounded-lg p-1">
                    <Button
                      variant={showQRCode ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setShowQRCode(true)}
                      className="text-xs"
                    >
                      📱 QR Code
                    </Button>
                    <Button
                      variant={!showQRCode ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setShowQRCode(false)}
                      className="text-xs"
                    >
                      🔢 Código
                    </Button>
                  </div>
                </div>

                {showQRCode ? (
                  /* QR Code */
                  <div>
                    <div className="flex justify-center mb-4">
                      <img 
                        src={qrCodeImage} 
                        alt="QR Code para conectar WhatsApp" 
                        className="w-64 h-64 border rounded-lg"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>1. Abra o WhatsApp no seu celular</p>
                      <p>2. Vá em ⋮ (3 pontos) → <strong>Aparelhos conectados</strong></p>
                      <p>3. Toque em <strong>"Conectar um aparelho"</strong></p>
                      <p>4. Escaneie este código</p>
                    </div>
                  </div>
                ) : (
                  /* Código de Pareamento */
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ou digite este código no WhatsApp:
                    </p>
                    <div className="bg-muted p-4 rounded-lg mb-4">
                      <code className="text-lg font-mono tracking-wider">
                        {qrCode ? qrCode.split(',')[0].substring(2, 12) : 'Gerando...'}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2"
                        onClick={() => {
                          const code = qrCode ? qrCode.split(',')[0].substring(2, 12) : '';
                          navigator.clipboard.writeText(code);
                          toast({
                            title: "✅ Código copiado!",
                            description: "Cole no WhatsApp para conectar",
                          });
                        }}
                      >
                        📋 Copiar
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>1. Abra o WhatsApp no seu celular</p>
                      <p>2. Vá em ⋮ (3 pontos) → <strong>Aparelhos conectados</strong></p>
                      <p>3. Toque em <strong>"Conectar um aparelho"</strong></p>
                      <p>4. Escolha <strong>"Conectar com código"</strong></p>
                      <p>5. Digite ou cole o código acima</p>
                    </div>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={fetchQRCode}
                  disabled={loading}
                >
                  🔄 Renovar {showQRCode ? 'QR Code' : 'Código'}
                </Button>
              </div>
            )}

            {needsConnection && !qrCodeImage && qrCode && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  QR Code recebido, gerando imagem...
                </p>
                <code className="text-xs break-all">{qrCode.substring(0, 100)}...</code>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dispositivos;