import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Smartphone, Wifi, WifiOff, RefreshCw, QrCode, PowerOff, RotateCcw, Edit2, Check, X, Phone, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useZapi, setZapiInstanceOverride } from "@/hooks/useZapi";
import { useZapiInstances, ZapiInstance } from "@/hooks/useZapiInstances";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from 'qrcode';
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DeviceCard = ({ instance }: { instance: ZapiInstance }) => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState(instance.instance_name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(instance.instance_name);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [connectionTab, setConnectionTab] = useState("qr-code");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [prevConnected, setPrevConnected] = useState<boolean | null>(null);
  const { getDeviceStatus, getQRCode, getPairingCode, disconnectDevice, restartInstance, loading } = useZapi();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Set instance override for this card's operations
  const withInstance = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setZapiInstanceOverride(instance);
    try {
      return await fn();
    } finally {
      setZapiInstanceOverride(null);
    }
  };

  const fetchDeviceStatus = async () => {
    try {
      const status = await withInstance(() => getDeviceStatus());
      setDeviceStatus(status.data);
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  };

  // Fetch connected phone number separately
  const fetchConnectedPhone = async () => {
    if (connectedPhone) return;
    const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
    const hdrs: Record<string, string> = { "Client-Token": instance.zapi_client_token, "Content-Type": "application/json" };
    
    try {
      const res = await fetch(`${baseUrl}/device`, { headers: hdrs });
      if (res.ok) {
        const d = await res.json();
        const num = d?.phone || d?.phoneNumber || d?.wid?.user || d?.me?.user || null;
        if (num) { setConnectedPhone(num); return; }
      }
    } catch {}

    try {
      const res = await fetch(`${baseUrl}/host-device`, { headers: hdrs });
      if (res.ok) {
        const d = await res.json();
        const num = d?.phone || d?.phoneNumber || d?.wid?.user || d?.id?.replace?.("@c.us", "") || null;
        if (num) { setConnectedPhone(num); return; }
      }
    } catch {}
  };

  const fetchQRCode = async () => {
    try {
      setQrCode(null);
      setQrCodeImage(null);
      
      const qrData = await withInstance(() => getQRCode());
      
      if (qrData.data && qrData.data.value && typeof qrData.data.value === 'string' && qrData.data.value.length > 50) {
        const qrValue = qrData.data.value;
        setQrCode(qrValue);
        
        try {
          const qrImageDataURL = await QRCodeLib.toDataURL(qrValue, {
            width: 256,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          setQrCodeImage(qrImageDataURL);
          toast({ title: "✅ QR Code gerado", description: "Escaneie para conectar" });
        } catch (qrError) {
          toast({ title: "❌ Erro ao gerar imagem", variant: "destructive" });
        }
      } else {
        if (qrData.data?.connected === true) {
          toast({ title: "⚠️ Dispositivo já conectado", variant: "destructive" });
        } else {
          toast({ title: "❌ QR Code indisponível", description: "Tente reiniciar a instância.", variant: "destructive" });
        }
      }
    } catch (error) {
      toast({ title: "❌ Erro de conexão", variant: "destructive" });
    }
  };

  const fetchPairingCode = async () => {
    if (!phoneNumber) {
      toast({ title: "❌ Número obrigatório", variant: "destructive" });
      return;
    }
    try {
      setPairingCode(null);
      const result = await withInstance(() => getPairingCode(phoneNumber));
      if (result.success && result.data?.code) {
        setPairingCode(result.data.code);
      }
    } catch (error) {
      toast({ title: "❌ Erro ao solicitar código", variant: "destructive" });
    }
  };

  const cancelActiveCampaigns = async () => {
    try {
      const { data: activeCampaigns, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'active');
      if (error) throw error;
      if (activeCampaigns && activeCampaigns.length > 0) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            await supabase.functions.invoke('clear-zapi-queue', {
              headers: { Authorization: `Bearer ${token}` },
              body: { clearAllActive: true },
            });
          }
        } catch {}
        await supabase.from('campaigns').update({ status: 'cancelled' }).eq('status', 'active');
        toast({
          title: "❌ Campanhas Canceladas",
          description: `${activeCampaigns.length} campanha(s) cancelada(s) automaticamente.`,
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Erro ao cancelar campanhas:', error);
    }
  };

  useEffect(() => {
    fetchDeviceStatus();
    const statusInterval = setInterval(fetchDeviceStatus, 10000);
    return () => clearInterval(statusInterval);
  }, [instance.id]);

  // Fetch phone when connected
  useEffect(() => {
    if (deviceStatus?.connected === true && !connectedPhone) {
      fetchConnectedPhone();
    }
  }, [deviceStatus?.connected]);

  // Auto-sync history when device transitions from disconnected to connected
  useEffect(() => {
    const isConnectedNow = deviceStatus?.connected === true;
    
    if (prevConnected === false && isConnectedNow && !hasSynced) {
      setHasSynced(true);
      setTimeout(() => {
        toast({ title: "📥 Sincronizando contatos...", description: "Importando conversas desta instância." });
        supabase.functions.invoke('sync-zapi-history', {
          body: { instanceId: instance.zapi_instance_id, maxChats: 100 }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Erro ao sincronizar:', error);
            toast({ title: "❌ Erro ao sincronizar", description: "Não foi possível importar os contatos.", variant: "destructive" });
          } else if (data?.error === 'disconnected') {
            toast({ title: "⚠️ WhatsApp desconectado", description: "Reconecte sua instância na página de Dispositivos.", variant: "destructive" });
          } else {
            toast({ 
              title: "✅ Contatos importados!", 
              description: `${data?.importedContacts || 0} contatos e ${data?.importedChats || 0} conversas importadas.`,
              duration: 6000,
            });
          }
        });
      }, 3000);
    }
    
    if (deviceStatus?.connected === false && deviceStatus?.smartphoneConnected === false) {
      cancelActiveCampaigns();
    }
    if (deviceStatus?.connected === false) {
      fetchQRCode();
    }
    
    setPrevConnected(deviceStatus?.connected ?? null);
  }, [deviceStatus?.connected, deviceStatus?.smartphoneConnected]);

  const isOnline = deviceStatus?.connected === true && deviceStatus?.session === true;
  const isConnected = deviceStatus?.connected === true;

  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:shadow-md hover:border-primary/30 transition-all">
        {/* Header: number + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`} />
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="h-7 text-sm w-28"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { setInstanceName(tempName); setIsEditingName(false); }
                    if (e.key === 'Escape') { setTempName(instanceName); setIsEditingName(false); }
                  }}
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setInstanceName(tempName); setIsEditingName(false); }}>
                  <Check className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setTempName(instanceName); setIsEditingName(false); }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <span className="font-semibold text-sm truncate">{instanceName}</span>
            )}
            {instance.is_default && <Badge variant="default" className="text-[10px] px-1.5 py-0">Padrão</Badge>}
            {!isEditingName && (
              <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => { setIsEditingName(true); setTempName(instanceName); }}>
                <Edit2 className="w-2.5 h-2.5" />
              </Button>
            )}
          </div>
          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px] shrink-0">
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {/* Info */}
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground font-mono truncate">{instance.zapi_instance_id}</p>
          {connectedPhone && (
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-primary">+{connectedPhone}</span>
            </div>
          )}
        </div>

        {/* Status dots */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${deviceStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            Conectado
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${deviceStatus?.session ? 'bg-emerald-500' : 'bg-red-500'}`} />
            Sessão
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${deviceStatus?.smartphoneConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            Celular
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button variant="outline" size="sm" onClick={fetchDeviceStatus} disabled={loading} className="h-7 text-[11px] px-2">
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Status
          </Button>
          {isConnected && (
            <Button variant="outline" size="sm" disabled={loading} className="h-7 text-[11px] px-2"
              onClick={async () => {
                try {
                  await withInstance(() => disconnectDevice());
                  try {
                    await supabase.from('message_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    await supabase.from('campaign_sends').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    localStorage.removeItem('readConversations');
                    toast({ title: "🗑️ Histórico limpo" });
                  } catch {}
                  setTimeout(fetchDeviceStatus, 1000);
                } catch {}
              }}>
              <PowerOff className="w-3 h-3 mr-1" /> Desconectar
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={loading} className="h-7 text-[11px] px-2"
            onClick={async () => { try { await withInstance(() => restartInstance()); setTimeout(fetchDeviceStatus, 3000); } catch {} }}>
            <RotateCcw className="w-3 h-3 mr-1" /> Reiniciar
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => navigate('/enviar-mensagem')}>
            <Send className="w-3 h-3 mr-1" /> Enviar
          </Button>
          {!isConnected && (
            <Button size="sm" className="h-7 text-[11px] px-2" onClick={() => setShowConnect(!showConnect)}>
              <Wifi className="w-3 h-3 mr-1" /> Conectar
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 ml-auto" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Ocultar' : 'Detalhes'}
          </Button>
        </div>

        {/* Expandable details */}
        {showDetails && deviceStatus && (
          <div className="border-t border-border pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Smartphone:</span>
                <Badge variant={deviceStatus?.smartphoneConnected ? 'default' : 'secondary'} className="text-[10px]">
                  {deviceStatus?.smartphoneConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado:</span>
                <span>{deviceStatus?.created ? new Date(deviceStatus.created).toLocaleString('pt-BR') : 'N/A'}</span>
              </div>
            </div>
            <details className="text-[10px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">🔧 Debug</summary>
              <pre className="mt-1 p-2 bg-muted rounded overflow-auto max-h-32">{JSON.stringify(deviceStatus, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>

      {/* Connection Dialog */}
      <Dialog open={!isConnected && showConnect} onOpenChange={setShowConnect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">🔗 Conectar dispositivo</DialogTitle>
          </DialogHeader>
          <Tabs value={connectionTab} onValueChange={setConnectionTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qr-code" className="flex items-center gap-2"><QrCode className="w-4 h-4" /> QR Code</TabsTrigger>
              <TabsTrigger value="phone-number" className="flex items-center gap-2"><Phone className="w-4 h-4" /> Com Número</TabsTrigger>
            </TabsList>
            <TabsContent value="qr-code" className="space-y-4">
              <div className="text-center space-y-4">
                {!qrCodeImage ? (
                  <div>
                    <Button onClick={fetchQRCode} disabled={loading} size="lg">
                      <QrCode className="w-4 h-4 mr-2" /> Gerar QR Code
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">Clique para gerar o QR Code</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-center mb-4">
                      <img src={qrCodeImage} alt="QR Code" className="w-64 h-64 border rounded-lg" />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>1. Abra o WhatsApp</p>
                      <p>2. Vá em ⋮ → <strong>Aparelhos conectados</strong></p>
                      <p>3. Toque em <strong>"Conectar um aparelho"</strong></p>
                      <p>4. Escaneie este código</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-4" onClick={fetchQRCode} disabled={loading}>
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
                  <Input type="tel" placeholder="Ex: 5511999999999" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="text-center" />
                </div>
                <Button className="w-full" disabled={!phoneNumber || loading} onClick={fetchPairingCode}>
                  <Phone className="w-4 h-4 mr-2" /> Gerar Código de Pareamento
                </Button>
                {pairingCode && (
                  <div className="text-center space-y-3 mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Seu código de pareamento:</p>
                    <div className="text-3xl font-mono font-bold tracking-wider bg-background border-2 border-primary rounded-lg py-4 px-6 text-primary">
                      {pairingCode}
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchPairingCode} disabled={loading}>🔄 Gerar Novo Código</Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Dispositivos = () => {
  const { instances, loading, refetch } = useZapiInstances();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Dispositivos ({instances.length}/5)</h1>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {instances.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma instância configurada</h3>
            <p className="text-muted-foreground">
              Peça ao administrador para configurar suas instâncias Z-API no painel de administração.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {instances.map((instance) => (
          <DeviceCard key={instance.id} instance={instance} />
        ))}
      </div>
    </div>
  );
};

export default Dispositivos;
