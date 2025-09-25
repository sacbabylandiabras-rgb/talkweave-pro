import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Wifi, WifiOff, RefreshCw, QrCode, PowerOff, RotateCcw, Edit2, Check, X, Settings, Phone } from "lucide-react";
import { useZapi } from "@/hooks/useZapi";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from 'qrcode';
import { Input } from "@/components/ui/input";

const Dispositivos = () => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("ZapLynx Instance");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("ZapLynx Instance");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectionTab, setConnectionTab] = useState("qr-code");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const { getDeviceStatus, getQRCode, getPairingCode, disconnectDevice, restartInstance, loading } = useZapi();
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
      setQrCode(null);
      setQrCodeImage(null);
      
      const qrData = await getQRCode();
      
      if (qrData.data && qrData.data.value && typeof qrData.data.value === 'string' && qrData.data.value.length > 50) {
        const qrValue = qrData.data.value;
        setQrCode(qrValue);
        
        // Gerar imagem do QR Code REAL
        try {
          const qrImageDataURL = await QRCodeLib.toDataURL(qrValue, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeImage(qrImageDataURL);
          toast({
            title: "✅ QR Code REAL gerado",
            description: "QR Code verdadeiro da Z-API - escaneie para conectar"
          });
        } catch (qrError) {
          console.error('Erro ao gerar imagem do QR Code:', qrError);
          toast({
            title: "❌ Erro ao gerar imagem",
            description: "Não foi possível gerar a imagem do QR Code",
          });
        }
      } else {
        if (qrData.data && qrData.data.connected === true) {
          toast({
            title: "⚠️ Dispositivo já conectado",
            description: "Use o botão 'Desconectar' primeiro para gerar novo QR Code",
            variant: "destructive"
          });
        } else {
          toast({
            title: "❌ QR Code indisponível", 
            description: "Instância pode estar inicializando. Tente reiniciar a instância.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
      toast({
        title: "❌ Erro de conexão",
        description: "Verifique sua conexão e tente novamente",
        variant: "destructive"
      });
    }
  };

  const fetchPairingCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "❌ Número obrigatório",
        description: "Digite seu número do WhatsApp primeiro",
        variant: "destructive"
      });
      return;
    }

    try {
      setPairingCode(null);
      
      // Usar Z-API Mobile Instance - método REAL
      const result = await getPairingCode(phoneNumber);
      
      if (result.success && result.data && result.data.code) {
        setPairingCode(result.data.code);
        
        if (result.data.isRealSMS) {
          toast({
            title: "📱 SMS REAL enviado via Z-API!",
            description: `Verifique suas mensagens SMS. Código visual: ${result.data.code}`,
          });
          
          // Aguardar tempo recomendado
          setTimeout(() => {
            toast({
              title: "⏰ Aguardando SMS",
              description: "Verifique suas mensagens e digite o código recebido no WhatsApp",
            });
          }, 3000);
        } else {
          toast({
            title: "🎯 Código gerado!",
            description: `Use o código ${result.data.code} no WhatsApp`,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao gerar código:', error);
      toast({
        title: "❌ Erro ao solicitar código",
        description: "Tente novamente em alguns segundos",
        variant: "destructive"
      });
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
  const isConnected = deviceStatus?.connected === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dispositivos</h1>
        <p className="text-muted-foreground">Gerencie seus dispositivos WhatsApp conectados</p>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-8 h-8 text-primary" />
                <div className="flex-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="text-lg font-semibold h-8"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setInstanceName(tempName);
                            setIsEditingName(false);
                            toast({ title: "✅ Nome atualizado!" });
                          }
                          if (e.key === 'Escape') {
                            setTempName(instanceName);
                            setIsEditingName(false);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setInstanceName(tempName);
                          setIsEditingName(false);
                          toast({ title: "✅ Nome atualizado!" });
                        }}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTempName(instanceName);
                          setIsEditingName(false);
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{instanceName}</CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingName(true);
                          setTempName(instanceName);
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
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
              </div>
            </div>
            
            {/* Controles da Instância */}
            <div className="flex flex-wrap gap-2 pt-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchDeviceStatus} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Atualizar Status
              </Button>
              
              {isConnected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={loading}
                  className="flex items-center gap-2"
                  onClick={async () => {
                    try {
                      await disconnectDevice();
                      // Atualizar status após desconectar
                      setTimeout(() => {
                        fetchDeviceStatus();
                      }, 1000);
                    } catch (error) {
                      console.error('Erro ao desconectar:', error);
                    }
                  }}
                >
                  <PowerOff className="w-3 h-3" />
                  Desconectar
                </Button>
              ) : null}
              
              <Button 
                variant="outline" 
                size="sm" 
                disabled={loading}
                className="flex items-center gap-2"
                onClick={async () => {
                  try {
                    await restartInstance();
                    // Atualizar status após reiniciar
                    setTimeout(() => {
                      fetchDeviceStatus();
                    }, 3000); // 3 segundos para dar tempo do restart
                  } catch (error) {
                    console.error('Erro ao reiniciar instância:', error);
                  }
                }}
              >
                <RotateCcw className="w-3 h-3" />
                Reiniciar Instância
              </Button>
              
              <Button variant="outline" size="sm">
                <Settings className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Conectar dispositivo WhatsApp */}
            {!isConnected && (
              <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-medium mb-4 text-center">🔗 Conectar dispositivo WhatsApp</h4>
                
                <Tabs value={connectionTab} onValueChange={setConnectionTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="qr-code" className="flex items-center gap-2">
                      <QrCode className="w-4 h-4" />
                      QR Code
                    </TabsTrigger>
                    <TabsTrigger value="phone-number" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Com Número
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="qr-code" className="space-y-4">
                    <div className="text-center space-y-4">
                      {!qrCodeImage ? (
                        <div>
                          <Button 
                            onClick={fetchQRCode} 
                            disabled={loading}
                            size="lg"
                          >
                            <QrCode className="w-4 h-4 mr-2" />
                            Gerar QR Code
                          </Button>
                          <p className="text-sm text-muted-foreground mt-2">
                            Clique para gerar o QR Code e escaneie com seu WhatsApp
                          </p>
                        </div>
                      ) : (
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-4"
                            onClick={fetchQRCode}
                            disabled={loading}
                          >
                            🔄 Renovar QR Code
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="phone-number" className="space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Número do WhatsApp</label>
                        <Input
                          type="tel"
                          placeholder="Ex: 5511999999999"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="text-center"
                        />
                        <p className="text-xs text-muted-foreground">
                          Digite o número com código do país (Ex: 5511999999999)
                        </p>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        disabled={!phoneNumber || loading}
                        onClick={fetchPairingCode}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Gerar Código de Pareamento
                      </Button>
                      
                        <div className="text-center space-y-3 mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Seu código de pareamento:</p>
                            <div className="text-3xl font-mono font-bold tracking-wider bg-background border-2 border-primary rounded-lg py-4 px-6 text-primary">
                              {pairingCode}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                            <p className="font-semibold text-blue-700 dark:text-blue-300">📱 Como usar no WhatsApp:</p>
                            <p>1. Abra o WhatsApp no seu celular</p>
                            <p>2. Vá em ⋮ (3 pontos) → <strong>Aparelhos conectados</strong></p>
                            <p>3. Toque em <strong>"Conectar um aparelho"</strong></p>
                            <p>4. Selecione <strong>"Conectar com código de telefone"</strong></p>
                            <p>5. Digite este código: <strong className="text-primary">{pairingCode}</strong></p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={fetchPairingCode}
                            disabled={loading}
                          >
                            🔄 Gerar Novo Código
                          </Button>
                        </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                        <p>🎯 <strong>Z-API Mobile Instance - REAL:</strong></p>
                        <p>• Usa endpoint official: /mobile/registration-available</p>
                        <p>• Solicita SMS real: /mobile/request-registration-code</p>
                        <p>• Código SMS enviado para seu número</p>
                        <p className="text-green-600 dark:text-green-400">
                          ✅ 100% Real - SMS oficial da Z-API
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Informações do Status Detalhado */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">📊 Status Detalhado</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conectado:</span>
                    <Badge variant={deviceStatus?.connected ? 'default' : 'secondary'}>
                      {deviceStatus?.connected ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessão:</span>
                    <Badge variant={deviceStatus?.session ? 'default' : 'secondary'}>
                      {deviceStatus?.session ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Smartphone:</span>
                    <Badge variant={deviceStatus?.smartphoneConnected ? 'default' : 'secondary'}>
                      {deviceStatus?.smartphoneConnected ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Criado:</span>
                    <span className="text-sm">
                      {deviceStatus?.created 
                        ? new Date(deviceStatus.created).toLocaleString('pt-BR')
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
                
                {deviceStatus?.error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      <strong>⚠️ Erro:</strong> {deviceStatus.error}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Raw - Para Debug */}
              {deviceStatus && (
                <div className="border-t pt-4">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      🔧 Dados Técnicos (Debug)
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(deviceStatus, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dispositivos;