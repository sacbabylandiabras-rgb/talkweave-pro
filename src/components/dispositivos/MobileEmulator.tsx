import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Loader2, ShieldCheck, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ZapiInstance } from "@/hooks/useZapiInstances";

type Step = "available" | "captcha" | "code" | "pin" | "done";

interface Props {
  instances: ZapiInstance[];
}

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export const MobileEmulator = ({ instances }: Props) => {
  const { toast } = useToast();
  const [instanceDbId, setInstanceDbId] = useState<string>(instances[0]?.id || "");
  const [ddi, setDdi] = useState("55");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"sms" | "voice" | "wa_old">("sms");
  const [captchaImg, setCaptchaImg] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("available");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const call = async (action: string, payload: any) => {
    const { data, error } = await supabase.functions.invoke("zapi-mobile", {
      body: { action, instanceDbId, payload },
    });
    if (error) throw new Error(error.message || "Falha na requisição");
    if (data?.error) throw new Error(data.error);
    return data?.data;
  };

  const reset = () => {
    setStep("available");
    setCaptchaImg(null);
    setCaptcha("");
    setCode("");
    setPin("");
    setInfo(null);
  };

  const handleAvailable = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    if (!phone) return toast({ title: "Informe o telefone", variant: "destructive" });
    setLoading(true);
    try {
      const res = await call("registration-available", { ddi: onlyDigits(ddi), phone: onlyDigits(phone) });
      if (res?.blocked) {
        toast({ title: "Número bloqueado", description: "Solicite o desbanimento.", variant: "destructive" });
        setInfo("Número bloqueado pelo WhatsApp.");
        return;
      }
      if (!res?.available) {
        toast({ title: "Indisponível", description: "Número indisponível para registro.", variant: "destructive" });
        return;
      }
      toast({ title: "✅ Número disponível", description: "Solicite o código de confirmação." });
      setInfo("Número disponível. Escolha o método e solicite o código.");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async () => {
    setLoading(true);
    try {
      const res = await call("request-code", { ddi: onlyDigits(ddi), phone: onlyDigits(phone), method });
      if (res?.captcha) {
        const img = String(res.captcha).startsWith("data:") ? res.captcha : `data:image/png;base64,${res.captcha}`;
        setCaptchaImg(img);
        setStep("captcha");
        toast({ title: "Captcha necessário", description: "Resolva o captcha para continuar." });
        return;
      }
      setStep("code");
      toast({ title: "📨 Código enviado", description: `Aguarde o código via ${method.toUpperCase()}.` });
    } catch (e: any) {
      toast({ title: "Erro ao solicitar código", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCaptcha = async () => {
    setLoading(true);
    try {
      await call("captcha-confirm", { captcha });
      toast({ title: "✅ Captcha confirmado" });
      setCaptchaImg(null);
      setCaptcha("");
      setStep("code");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async () => {
    setLoading(true);
    try {
      const res = await call("confirm-code", { code });
      if (res?.confirmSecurityCode) {
        setStep("pin");
        toast({ title: "PIN necessário", description: "Informe o PIN da verificação em duas etapas." });
        return;
      }
      if (res?.deviceConfirm) {
        setInfo("Confirme a transferência no aparelho onde o número está registrado e clique em 'Confirmar transferência'.");
        return;
      }
      setStep("done");
      toast({ title: "🎉 Conectado!", description: "Número registrado na instância." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPin = async () => {
    setLoading(true);
    try {
      await call("confirm-security-code", { code: pin });
      setStep("done");
      toast({ title: "🎉 Conectado!", description: "Número registrado com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceTransfer = async () => {
    setLoading(true);
    try {
      await call("device-transfer-confirmed", {});
      setStep("done");
      toast({ title: "🎉 Transferência confirmada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" /> Emulador Mobile — Conectar número
        </CardTitle>
        <CardDescription>
          Registre um número diretamente como dispositivo principal, sem precisar escanear QR Code.
          O fluxo simula o cadastro do WhatsApp: disponibilidade → código → (PIN se houver) → conectado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5 md:col-span-1">
            <Label className="text-xs">Conexão</Label>
            <Select value={instanceDbId} onValueChange={setInstanceDbId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {instances.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name || i.zapi_instance_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">DDI</Label>
            <Input className="h-9" value={ddi} onChange={(e) => setDdi(onlyDigits(e.target.value))} placeholder="55" maxLength={4} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número (DDD + telefone)</Label>
            <Input className="h-9" value={phone} onChange={(e) => setPhone(onlyDigits(e.target.value))} placeholder="11999999999" />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Método de envio</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="voice">Chamada de voz</SelectItem>
                <SelectItem value="wa_old">Pop-up no WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAvailable} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            1. Verificar disponibilidade
          </Button>
          <Button onClick={handleRequestCode} disabled={loading || !phone}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
            2. Solicitar código
          </Button>
          <Button onClick={reset} variant="ghost" size="sm">Limpar</Button>
        </div>

        {info && <p className="text-xs text-muted-foreground">{info}</p>}

        {step === "captcha" && captchaImg && (
          <div className="border border-border rounded-lg p-4 space-y-2">
            <Label className="text-xs">Resolva o captcha</Label>
            <img src={captchaImg} alt="Captcha" className="border border-border rounded bg-white p-2" />
            <div className="flex gap-2">
              <Input value={captcha} onChange={(e) => setCaptcha(e.target.value)} placeholder="Digite o captcha" className="h-9 max-w-[200px]" />
              <Button onClick={handleCaptcha} disabled={loading || !captcha}>Confirmar captcha</Button>
            </div>
          </div>
        )}

        {(step === "code" || step === "pin") && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            {step === "code" && (
              <div className="space-y-2">
                <Label className="text-xs">Código de confirmação recebido</Label>
                <div className="flex gap-2">
                  <Input value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} placeholder="123456" className="h-9 max-w-[200px]" maxLength={8} />
                  <Button onClick={handleConfirmCode} disabled={loading || !code}>3. Confirmar código</Button>
                  <Button onClick={handleDeviceTransfer} variant="outline" disabled={loading}>Confirmar transferência</Button>
                </div>
              </div>
            )}
            {step === "pin" && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> PIN de segurança (verificação em 2 etapas)</Label>
                <div className="flex gap-2">
                  <Input value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} placeholder="PIN" className="h-9 max-w-[200px]" maxLength={8} />
                  <Button onClick={handleConfirmPin} disabled={loading || !pin}>4. Confirmar PIN</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <Badge className="bg-emerald-500 text-white">Número conectado com sucesso</Badge>
        )}
      </CardContent>
    </Card>
  );
};

export default MobileEmulator;