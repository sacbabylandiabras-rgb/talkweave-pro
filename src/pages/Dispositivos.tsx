import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Smartphone, Wifi, WifiOff, RefreshCw, QrCode, PowerOff, RotateCcw, Edit2, Check, X, Phone, Send, Plus, Loader2, Search, Trash2, User, Upload, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useZapi, setZapiInstanceOverride } from "@/hooks/useZapi";
import { useZapiInstances, ZapiInstance } from "@/hooks/useZapiInstances";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from 'qrcode';
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FunctionsHttpError } from "@supabase/supabase-js";

const getInvokeErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      return payload?.message || payload?.error || fallback;
    } catch {
      return fallback;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const normalizeQrImageValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image")) return trimmed;
  if (trimmed.startsWith("iVBOR")) return `data:image/png;base64,${trimmed}`;
  if (trimmed.startsWith("/9j/")) return `data:image/jpeg;base64,${trimmed}`;
  if (trimmed.startsWith("R0lGOD")) return `data:image/gif;base64,${trimmed}`;
  if (trimmed.startsWith("UklGR")) return `data:image/webp;base64,${trimmed}`;
  if (trimmed.startsWith("PHN2Zy")) return `data:image/svg+xml;base64,${trimmed}`;
  return trimmed;
};

const DeviceCard = ({ instance, onDeleted }: { instance: ZapiInstance; onDeleted?: () => void }) => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState(instance.instance_name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(instance.instance_name);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [connectionTab, setConnectionTab] = useState("qr-code");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [prevConnected, setPrevConnected] = useState<boolean | null>(null);
  const { disconnectDevice, restartInstance, loading } = useZapi();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Set instance override only for operations that still use the shared hook state
  const withInstance = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setZapiInstanceOverride(instance);
    try {
      return await fn();
    } finally {
      setZapiInstanceOverride(null);
    }
  };

  const statusErrorShownRef = useRef(false);

  const fetchDeviceStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-device-status', {
        body: { instanceId: instance.id },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data?.message || data?.error || 'Erro ao buscar status do dispositivo');
      }

      setDeviceStatus(data?.data ?? null);
      statusErrorShownRef.current = false;
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      // Set offline status gracefully instead of blocking
      setDeviceStatus({ connected: false, session: false, smartphoneConnected: false });
      // Only show toast once per error streak
      if (!statusErrorShownRef.current) {
        statusErrorShownRef.current = true;
        const message = await getInvokeErrorMessage(error, 'Erro ao buscar status do dispositivo');
        toast({
          title: 'Erro ao buscar status',
          description: message,
          variant: 'destructive',
        });
      }
    }
  };

  // Fetch connected phone number separately
  const fetchConnectedPhone = async () => {
    if (connectedPhone) return;
    let foundPhone: string | null = null;

    {
      // Z-API
      const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
      const hdrs: Record<string, string> = { "Client-Token": instance.zapi_client_token, "Content-Type": "application/json" };

      try {
        const res = await fetch(`${baseUrl}/device`, { headers: hdrs });
        if (res.ok) {
          const d = await res.json();
          const num = d?.phone || d?.phoneNumber || d?.wid?.user || d?.me?.user || null;
          if (num) foundPhone = num;
          const pic = d?.imgUrl || d?.profilePictureUrl || d?.picture || null;
          if (pic) setProfilePicUrl(pic);
        }
      } catch {}

      if (!foundPhone) {
        try {
          const res = await fetch(`${baseUrl}/host-device`, { headers: hdrs });
          if (res.ok) {
            const d = await res.json();
            const num = d?.phone || d?.phoneNumber || d?.wid?.user || d?.id?.replace?.("@c.us", "") || null;
            if (num) foundPhone = num;
          }
        } catch {}
      }
    }

    if (foundPhone) {
      setConnectedPhone(foundPhone);
    }
  };

  const fetchQRCode = async () => {
    try {
      setQrCode(null);
      setQrCodeImage(null);

      const { data, error } = await supabase.functions.invoke('get-qr-code', {
        body: { instanceId: instance.id },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data?.message || data?.error || 'Erro ao buscar QR Code');
      }

      const rawQrValue = data?.data?.value ?? data?.data?.qrCode ?? data?.data?.qrcode ?? data?.data?.raw?.qrCode ?? data?.data?.raw?.qrcode ?? null;
      const qrValue = normalizeQrImageValue(rawQrValue);

      if (typeof qrValue === 'string' && qrValue.startsWith('data:image')) {
        setQrCodeImage(qrValue);
        setQrCode(qrValue);
        toast({ title: "✅ QR Code gerado", description: "Escaneie para conectar" });
        return;
      }

      if (typeof qrValue === 'string' && qrValue.length > 50) {
        setQrCode(qrValue);

        try {
          const qrImageDataURL = await QRCodeLib.toDataURL(qrValue, {
            width: 256,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          setQrCodeImage(qrImageDataURL);
          toast({ title: "✅ QR Code gerado", description: "Escaneie para conectar" });
        } catch {
          toast({ title: "❌ Erro ao gerar imagem", variant: "destructive" });
        }
        return;
      }

      if (data?.data?.connected === true) {
        toast({ title: "⚠️ Dispositivo já conectado", variant: "destructive" });
      } else {
        toast({ title: "❌ QR Code indisponível", description: "Tente reiniciar a instância.", variant: "destructive" });
      }
    } catch (error) {
      const message = await getInvokeErrorMessage(error, 'Erro ao buscar QR Code');
      toast({ title: "❌ Erro de conexão", description: message, variant: "destructive" });
    }
  };

  const fetchPairingCode = async () => {
    if (!phoneNumber) {
      toast({ title: "❌ Número obrigatório", variant: "destructive" });
      return;
    }
    try {
      setPairingCode(null);

      let cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

      const { data, error } = await supabase.functions.invoke('get-pairing-code', {
        body: {
          phoneNumber: cleanPhone,
          instanceId: instance.id,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.data) {
        throw new Error(data?.message || data?.error || 'Falha ao gerar código de pareamento');
      }

      if (data.data.pairingCode) {
        setPairingCode(data.data.pairingCode);
      } else if (data.data.qrCode) {
        const qr = data.data.qrCode;
        const isBase64Image = typeof qr === 'string' && qr.startsWith('data:image');
        setPairingCode(isBase64Image ? qr : data.data.code || null);
        toast({ title: "ℹ️ Código de pareamento indisponível", description: "Sua instância Evolution não suporta pairing code. Use o QR Code abaixo ou recrie a instância com pairingCode habilitado." });
      } else if (data.data.code) {
        setPairingCode(data.data.code);
      }
    } catch (error) {
      const message = await getInvokeErrorMessage(error, 'Erro ao solicitar código');
      toast({ title: "❌ Erro ao solicitar código", description: message, variant: "destructive" });
    }
  };

  const pauseActiveCampaigns = async () => {
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
        await supabase.from('campaigns').update({ status: 'paused' }).eq('status', 'active');
        toast({
          title: "⏸️ Campanhas Pausadas",
          description: `${activeCampaigns.length} campanha(s) pausada(s) automaticamente para preservar os números pendentes.`,
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Erro ao pausar campanhas:', error);
    }
  };

  useEffect(() => {
    fetchDeviceStatus();
    // Poll faster when connect dialog is open
    const interval = showConnect ? 3000 : 10000;
    const statusInterval = setInterval(fetchDeviceStatus, interval);
    return () => clearInterval(statusInterval);
  }, [instance.id, showConnect]);

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
      // Auto-close connect dialog
      if (showConnect) {
        setShowConnect(false);
        toast({ title: "✅ WhatsApp conectado!" });
      }
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
    
    if (prevConnected === true && deviceStatus?.connected === false && deviceStatus?.smartphoneConnected === false) {
      pauseActiveCampaigns();
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
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/30 transition-all min-h-[280px]">
        {/* Profile picture + name */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {profilePicUrl ? (
              <img
                src={profilePicUrl}
                alt="Perfil"
                className="w-14 h-14 rounded-full object-cover border-2 border-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                <Smartphone className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
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
            <p className="text-[11px] text-muted-foreground font-mono truncate mt-1">
              ID: {instance.zapi_instance_id}
            </p>
            {connectedPhone && (
              <div className="flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">+{connectedPhone}</span>
              </div>
            )}
          </div>
          <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px] shrink-0">
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
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
                  localStorage.removeItem('readConversations');
                  toast({ title: "🔌 Instância desconectada", description: "O histórico e os envios da campanha foram preservados." });
                  setTimeout(fetchDeviceStatus, 1000);
                } catch {}
              }}>
              <PowerOff className="w-3 h-3 mr-1" /> Desconectar
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={loading} className="h-7 text-[11px] px-2"
            onClick={async () => {
              try {
                toast({ title: "🔄 Reiniciando...", description: "Aguarde alguns segundos." });
                const { data, error } = await supabase.functions.invoke('restart-instance', {
                  body: { instanceId: instance.id },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.message || data.error);
                toast({ title: "✅ Instância reiniciada", description: data?.message || "Escaneie o QR Code para conectar." });
                setTimeout(fetchDeviceStatus, 3000);
              } catch (err) {
                const message = await getInvokeErrorMessage(err, 'Erro ao reiniciar');
                toast({ title: "❌ Erro ao reiniciar", description: message, variant: "destructive" });
              }
            }}>
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
                    {pairingCode.startsWith('data:image') ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">
                          Código de pareamento não disponível nesta versão da Evolution API. Use o QR Code abaixo:
                        </p>
                        <div className="flex justify-center">
                          <img src={pairingCode} alt="QR Code" className="w-64 h-64 rounded-lg" />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">Seu código de pareamento:</p>
                        <div className="text-3xl font-mono font-bold tracking-wider bg-background border-2 border-primary rounded-lg py-4 px-6 text-primary">
                          {pairingCode}
                        </div>
                      </>
                    )}
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


const BulkProfileUpdate = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [profileName, setProfileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [updating, setUpdating] = useState(false);

  const updateAllInstances = async (type: "name" | "picture", value: string) => {
    setUpdating(true);
    let success = 0;
    let failed = 0;

    for (const inst of instances) {
      try {
        const { error } = await supabase.functions.invoke("update-profile", {
          body: {
            type,
            value,
            instanceId: inst.zapi_instance_id,
            token: inst.zapi_token,
            clientToken: inst.zapi_client_token,
          },
        });
        if (error) throw error;
        success++;
      } catch {
        failed++;
      }
    }

    setUpdating(false);
    toast({
      title: success > 0 ? "✅ Perfil atualizado" : "❌ Erro",
      description: `${success} instância(s) atualizada(s)${failed > 0 ? `, ${failed} com erro` : ""}`,
      variant: failed === instances.length ? "destructive" : "default",
    });
  };

  const handleUpdateName = () => {
    if (!profileName.trim()) return;
    updateAllInstances("name", profileName.trim()).then(() => setProfileName(""));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx 5MB)", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpdatePictureFile = async () => {
    if (!imageFile) return;
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = imageFile.name.split(".").pop() || "jpg";
      const filePath = `profile-pictures/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("template-media").upload(filePath, imageFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("template-media").getPublicUrl(filePath);
      await updateAllInstances("picture", pub.publicUrl);
      setImageFile(null);
      setPreviewUrl("");
    } catch (err) {
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePictureUrl = () => {
    if (!imageUrl.trim()) return;
    updateAllInstances("picture", imageUrl.trim()).then(() => setImageUrl(""));
  };

  if (instances.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Perfil do WhatsApp</DialogTitle>
          <p className="text-sm text-muted-foreground">Altere o nome e foto de perfil de todas as instâncias de uma vez</p>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome do Perfil</Label>
            <div className="flex gap-2">
              <Input placeholder="Novo nome para todas as instâncias" value={profileName} onChange={(e) => setProfileName(e.target.value)} disabled={updating} />
              <Button onClick={handleUpdateName} disabled={updating || !profileName.trim()} className="shrink-0">
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <Label>Foto de Perfil (Upload)</Label>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={updating} className="cursor-pointer" />
                <p className="text-xs text-muted-foreground">JPG, PNG, GIF (máx. 5MB)</p>
              </div>
              {previewUrl && <img src={previewUrl} alt="Prévia" className="w-12 h-12 rounded-full object-cover border" />}
            </div>
            {imageFile && (
              <Button onClick={handleUpdatePictureFile} disabled={updating} size="sm">
                {updating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Enviando...</> : <><Upload className="w-3 h-3 mr-1" /> Aplicar foto a todas</>}
              </Button>
            )}
          </div>

          {/* Photo URL */}
          <div className="space-y-2">
            <Label>Foto de Perfil (URL)</Label>
            <div className="flex gap-2">
              <Input type="url" placeholder="https://exemplo.com/foto.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={updating} />
              <Button onClick={handleUpdatePictureUrl} disabled={updating || !imageUrl.trim()} className="shrink-0">
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImageIcon className="w-4 h-4 mr-1" /> Aplicar</>}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


const Dispositivos = () => {
  const { instances, loading, refetch } = useZapiInstances();
  const { toast } = useToast();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Dispositivos ({instances.length})</h1>
        <div className="flex items-center gap-2">
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(true)}>
              <User className="w-4 h-4 mr-1" />
              Perfil WhatsApp
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {instances.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma instância configurada</h3>
            <p className="text-muted-foreground">
              As instâncias são gerenciadas pelo administrador.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {instances.map((instance) => (
          <DeviceCard key={instance.id} instance={instance} onDeleted={refetch} />
        ))}
      </div>

      {/* Bulk Profile Update Dialog */}
      <BulkProfileUpdate instances={instances} open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />

      {/* Planos */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">📋 Planos e Assinaturas</CardTitle>
          <CardDescription>Escolha o plano ideal para suas necessidades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Plano Start", price: "R$100/mês", features: ["Mensagens ilimitadas", "1 instância", "Suporte básico"], link: "https://pay.zaplynxpro.online/pay/plano-start-704549" },
              { name: "Plano Pro", price: "R$300/mês", features: ["Mensagens ilimitadas", "3 instâncias", "Suporte prioritário"], link: "https://pay.zaplynxpro.online/pay/plano-pro-716484", popular: true },
              { name: "Plano Scale", price: "R$897/mês", features: ["Mensagens ilimitadas", "10 instâncias", "Suporte VIP"], link: "https://pay.zaplynxpro.online/pay/plano-scale-731140" },
            ].map((plan, i) => (
              <a
                key={i}
                href={plan.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col p-5 rounded-xl border transition-all hover:-translate-y-1 hover:shadow-lg ${
                  plan.popular
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-foreground">{plan.name}</p>
                  {plan.popular && (
                    <Badge className="text-[10px] bg-primary text-primary-foreground">POPULAR</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold text-primary mb-3">{plan.price}</p>
                <ul className="text-xs text-muted-foreground space-y-1.5 mb-4 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-1.5">
                      <span className="text-primary">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.popular ? "default" : "outline"} size="sm" className="w-full">
                  Assinar →
                </Button>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dispositivos;
