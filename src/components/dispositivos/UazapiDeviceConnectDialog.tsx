import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, QrCode, Phone, RotateCcw, Smartphone, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from 'qrcode';

interface Props {
  instanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UazapiDeviceConnectDialog({ instanceId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connectionTab, setConnectionTab] = useState("qr-code");
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");

  const fetchQRCode = async () => {
    setLoading(true);
    setQrCodeImage(null);
    try {
      const { data, error } = await supabase.functions.invoke('get-qr-code', {
        body: { instanceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);

      const qrValue = data?.data?.value || data?.data?.qrCode || data?.data?.qrcode;
      
      if (qrValue) {
        if (qrValue.startsWith('data:image')) {
          setQrCodeImage(qrValue);
        } else {
          const qrDataURL = await QRCodeLib.toDataURL(qrValue, { width: 256, margin: 2 });
          setQrCodeImage(qrDataURL);
        }
        toast({ title: "✅ QR Code gerado" });
      } else if (data?.data?.connected) {
        toast({ title: "✅ Dispositivo já conectado" });
        onOpenChange(false);
      } else {
        throw new Error("QR Code não disponível. Tente novamente.");
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar QR Code", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPairingCode = async () => {
    if (!phoneNumber) return;
    setLoading(true);
    setPairingCode(null);
    try {
      let cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

      const { data, error } = await supabase.functions.invoke('get-pairing-code', {
        body: { phoneNumber: cleanPhone, instanceId },
      });

      if (error) throw error;
      if (!data?.success || !data?.data) throw new Error(data?.message || 'Falha ao gerar código');

      setPairingCode(data.data.pairingCode || data.data.code);
      toast({ title: "✅ Código gerado" });
    } catch (err: any) {
      toast({ title: "Erro ao gerar código", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && connectionTab === "qr-code" && !qrCodeImage) {
      fetchQRCode();
    }
  }, [open, connectionTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">🔗 Conectar WhatsApp</DialogTitle>
          <DialogDescription>Conecte seu aparelho para habilitar a extração de membros.</DialogDescription>
        </DialogHeader>
        
        <Tabs value={connectionTab} onValueChange={setConnectionTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr-code" className="flex items-center gap-2"><QrCode className="w-4 h-4" /> QR Code</TabsTrigger>
            <TabsTrigger value="phone-number" className="flex items-center gap-2"><Phone className="w-4 h-4" /> Com Número</TabsTrigger>
          </TabsList>

          <TabsContent value="qr-code" className="space-y-4 pt-4">
            <div className="flex flex-col items-center text-center space-y-4">
              {loading && !qrCodeImage ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Gerando código...</p>
                </div>
              ) : qrCodeImage ? (
                <>
                  <div className="bg-white p-4 rounded-lg border">
                    <img src={qrCodeImage} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>1. Abra o WhatsApp no seu celular</p>
                    <p>2. Vá em Aparelhos Conectados</p>
                    <p>3. Escaneie este código</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchQRCode} disabled={loading}>
                    <RotateCcw className="w-3.5 h-3.5 mr-2" /> Renovar QR Code
                  </Button>
                </>
              ) : (
                <Button onClick={fetchQRCode} disabled={loading}>Gerar QR Code</Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="phone-number" className="space-y-4 pt-4">
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
              </div>
              <Button className="w-full" disabled={!phoneNumber || loading} onClick={fetchPairingCode}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
                Gerar Código de Pareamento
              </Button>

              {pairingCode && (
                <div className="mt-4 p-6 bg-primary/5 border border-primary/20 rounded-xl text-center">
                  <p className="text-sm text-muted-foreground mb-3">Seu código de pareamento:</p>
                  <div className="text-4xl font-mono font-bold tracking-widest text-primary">
                    {pairingCode}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
