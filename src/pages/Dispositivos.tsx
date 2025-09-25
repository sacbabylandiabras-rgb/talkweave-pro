import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Wifi, WifiOff, Plus, Settings, RefreshCw, QrCode, Power, PowerOff, RotateCcw, Edit2, Check, X, Phone } from "lucide-react";
import { useZapi } from "@/hooks/useZapi";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from 'qrcode';

const Dispositivos = () => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [showQRCode, setShowQRCode] = useState(true);
  const [showConnectOptions, setShowConnectOptions] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [instanceName, setInstanceName] = useState("ZapLynx Instance");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("ZapLynx Instance");
  const { getDeviceStatus, getQRCode, disconnectDevice, restartInstance, loading } = useZapi();
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
      // Limpar QR Code anterior
      setQrCode(null);
      setQrCodeImage(null);
      
      const qrData = await getQRCode();
      console.log('QR Data recebido:', qrData);
      
      if (qrData.data && qrData.data.value && typeof qrData.data.value === 'string' && qrData.data.value.length > 50) {
        const qrValue = qrData.data.value;
        setQrCode(qrValue);
        
        // Debug: Ver o formato do QR Code
        console.log('=== QR CODE DEBUG ===');
        console.log('QR Code completo:', qrValue);
        console.log('Primeiros 100 chars:', qrValue.substring(0, 100));
        console.log('Tamanho:', qrValue.length);
        console.log('====================');
        
        // Gerar imagem do QR Code a partir da string
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
          console.log('QR Code gerado como imagem:', qrImageDataURL.substring(0, 50) + '...');
          toast({
            title: "✅ QR Code gerado",
            description: "Escaneie com seu WhatsApp para conectar"
          });
        } catch (qrError) {
          console.error('Erro ao gerar QR Code:', qrError);
          toast({
            title: "❌ Erro ao gerar QR Code",
            description: "Tente novamente em alguns segundos",
            variant: "destructive"
          });
        }
      } else if (qrData.data && qrData.data.connected === true) {
        // Dispositivo conectado - não há QR Code
        console.log('Dispositivo conectado, sem QR Code disponível');
        toast({
          title: "⚠️ Dispositivo já conectado",
          description: "Use o botão 'Desconectar' primeiro se quiser gerar novo QR Code",
          variant: "destructive"
        });
      } else {
        // Resposta inesperada ou inválida
        console.log('Resposta inválida da API:', qrData);
        toast({
          title: "❌ QR Code indisponível", 
          description: "Tente reiniciar a instância ou aguarde alguns segundos",
          variant: "destructive"
        });
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

  useEffect(() => {
    fetchDeviceStatus();
    // Se o dispositivo não estiver conectado, buscar QR Code automaticamente
    if (deviceStatus?.connected === false) {
      fetchQRCode();
    }
  }, [deviceStatus?.connected]);

  const isOnline = deviceStatus?.connected === true && deviceStatus?.session === true;
  const isConnected = deviceStatus?.connected === true;
  const needsQRCode = !deviceStatus?.session || deviceStatus?.error?.includes("not connected");

  console.log('=== DEBUG STATUS ===');
  console.log('deviceStatus:', deviceStatus);
  console.log('isOnline:', isOnline);
  console.log('isConnected:', isConnected);
  console.log('needsQRCode:', needsQRCode);
  console.log('==================');

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
            {/* Opções de Conexão - Na parte de cima quando desconectado */}
            {!isConnected && (
              <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-medium mb-4 text-center">🔗 Conectar dispositivo WhatsApp</h4>
                
                {/* Abas de escolha */}
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
                      📞 Com Número
                    </Button>
                  </div>
                </div>

                {showQRCode ? (
                  /* Conectar via QR Code */
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
                      /* QR Code Gerado */
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
                ) : (
                  /* Conectar via Número */
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phoneNumber">Número do WhatsApp</Label>
                      <div className="flex gap-2">
                        <Input
                          id="phoneNumber"
                          placeholder="Ex: 5511999999999"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => {
                            if (phoneNumber.length >= 10) {
                              toast({
                                title: "📱 Número verificado",
                                description: "Gerando código de pareamento para o número " + phoneNumber,
                              });
                              // Gerar QR Code e automaticamente mostrar o código
                              fetchQRCode().then(() => {
                                // Aguardar um pouco e mostrar o código
                                setTimeout(() => {
                                  if (qrCode && qrCode.length > 50) {
                                    toast({
                                      title: "✅ Código de pareamento gerado",
                                      description: "Use o código abaixo no WhatsApp deste número: " + phoneNumber,
                                    });
                                  }
                                }, 1500);
                              });
                            } else {
                              toast({
                                title: "❌ Número inválido",
                                description: "Digite um número válido com DDD (Ex: 5511999999999)",
                                variant: "destructive"
                              });
                            }
                          }}
                          disabled={loading || phoneNumber.length < 10}
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Gerar Código
                        </Button>
                      </div>
                    </div>

                    {/* Código de Pareamento Visual - quando há QR Code */}
                    {qrCode && qrCode.length > 20 && !qrCode.includes('"connected"') && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                          📱 Código de pareamento para {phoneNumber}:
                        </p>
                        <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg text-center">
                          <code className="text-2xl font-mono tracking-widest font-bold text-primary">
                            {(() => {
                              try {
                                const parts = qrCode.split(',');
                                if (parts[0] && parts[0].includes('@')) {
                                  const afterAt = parts[0].split('@')[1];
                                  if (afterAt && afterAt.length >= 8) {
                                    return afterAt.substring(0, 8).toUpperCase();
                                  }
                                }
                                const match = qrCode.match(/[A-Z0-9]{8,}/);
                                return match ? match[0].substring(0, 8) : 'PROCESSANDO...';
                              } catch (e) {
                                return 'GERANDO...';
                              }
                            })()}
                          </code>
                          <div className="mt-4">
                            <Button
                              variant="outline"
                              onClick={() => {
                                const code = (() => {
                                  try {
                                    const parts = qrCode.split(',');
                                    if (parts[0] && parts[0].includes('@')) {
                                      const afterAt = parts[0].split('@')[1];
                                      if (afterAt && afterAt.length >= 8) {
                                        return afterAt.substring(0, 8).toUpperCase();
                                      }
                                    }
                                    const match = qrCode.match(/[A-Z0-9]{8,}/);
                                    return match ? match[0].substring(0, 8) : '';
                                  } catch (e) {
                                    return '';
                                  }
                                })();
                                
                                if (code && code !== 'PROCESSANDO...' && code !== 'GERANDO...') {
                                  navigator.clipboard.writeText(code);
                                  toast({
                                    title: "✅ Código copiado!",
                                    description: "Cole no WhatsApp do número " + phoneNumber,
                                  });
                                }
                              }}
                            >
                              📋 Copiar Código
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-4 space-y-1 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                          <p className="font-medium">Como usar no WhatsApp ({phoneNumber}):</p>
                          <p>1. Abra o WhatsApp neste número</p>
                          <p>2. Vá em ⋮ (3 pontos) → <strong>Aparelhos conectados</strong></p>
                          <p>3. Toque em <strong>"Conectar um aparelho"</strong></p>
                          <p>4. Escolha <strong>"Conectar com código"</strong></p>
                          <p>5. Digite o código acima</p>
                        </div>
                      </div>
                    )}

                    {/* Aguardando código */}
                    {!qrCode && loading && (
                      <div className="mt-4 pt-4 border-t text-center">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Gerando código para {phoneNumber}...</span>
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                      <p className="font-medium mb-1">ℹ️ Como funciona:</p>
                      <p>1. Digite o número que será usado nesta instância</p>
                      <p>2. Clique em "Gerar Código" para criar o código de pareamento</p>
                      <p>3. Use o código gerado no WhatsApp deste número</p>
                      <p>4. Vá em Aparelhos conectados → Conectar com código</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Informações técnicas embaixo */}
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