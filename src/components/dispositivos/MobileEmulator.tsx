import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Loader2, ShieldCheck, MessageSquare, Mail, Trash2 } from "lucide-react";
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
  const [waitInfo, setWaitInfo] = useState<{ sms?: number; voice?: number; waOld?: number; waOldEligible?: boolean } | null>(null);
  const [appealToken, setAppealToken] = useState<string | null>(null);
  const [unbanDescription, setUnbanDescription] = useState("");
  const [unbanStatus, setUnbanStatus] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<{ email?: string; hasEmail?: boolean; verified?: boolean } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [newPin, setNewPin] = useState("");

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
    setWaitInfo(null);
    setAppealToken(null);
    setUnbanDescription("");
    setUnbanStatus(null);
  };

  const handleAvailable = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    if (!phone) return toast({ title: "Informe o telefone", variant: "destructive" });
    setLoading(true);
    try {
      const res = await call("registration-available", { ddi: onlyDigits(ddi), phone: onlyDigits(phone) });
      if (res?.blocked) {
        setAppealToken(res?.appealToken || null);
        toast({ title: "Número bloqueado", description: "Solicite o desbanimento.", variant: "destructive" });
        setInfo(`Número bloqueado pelo WhatsApp.${res?.reason ? ` Motivo: ${res.reason}` : ""}`);
        return;
      }
      if (!res?.available) {
        toast({ title: "Indisponível", description: "Número indisponível para registro.", variant: "destructive" });
        return;
      }
      setWaitInfo({
        sms: res?.smsWaitSeconds,
        voice: res?.voiceWaitSeconds,
        waOld: res?.waOldWaitSeconds,
        waOldEligible: res?.waOldEligible,
      });
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
      if (res?.blocked) {
        const wait = res?.retryAfter ? ` Tente novamente em ${res.retryAfter}s.` : "";
        toast({ title: "Bloqueado temporariamente", description: `Muitas tentativas.${wait}`, variant: "destructive" });
        setInfo(`Solicitação bloqueada.${wait}`);
        return;
      }
      if (res?.captcha) {
        const img = String(res.captcha).startsWith("data:") ? res.captcha : `data:image/png;base64,${res.captcha}`;
        setCaptchaImg(img);
        setStep("captcha");
        toast({ title: "Captcha necessário", description: "Resolva o captcha para continuar." });
        return;
      }
      if (res?.success === false) {
        toast({ title: "Falha ao solicitar código", description: "Tente outro método de envio.", variant: "destructive" });
        return;
      }
      setStep("code");
      const usedMethod = res?.method || method;
      toast({ title: "📨 Código enviado", description: `Aguarde o código via ${String(usedMethod).toUpperCase()}.` });
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

  const handleForgotPin = async () => {
    setLoading(true);
    try {
      await call("forgot-security-code", {});
      toast({ title: "📨 Recuperação de PIN solicitada", description: "Siga as instruções recebidas." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGetEmail = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    setLoading(true);
    try {
      const res = await call("get-account-email", {});
      setAccountEmail({ email: res?.email, hasEmail: res?.hasEmail, verified: res?.verified });
      toast({
        title: res?.hasEmail ? "✅ E-mail da conta" : "Sem e-mail vinculado",
        description: res?.hasEmail ? `${res?.email || ""}${res?.verified ? " (verificado)" : ""}` : "Nenhum e-mail cadastrado.",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetEmail = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    if (!newEmail) return toast({ title: "Informe um e-mail", variant: "destructive" });
    setLoading(true);
    try {
      const res = await call("set-account-email", { email: newEmail });
      toast({ title: "✅ E-mail cadastrado", description: res?.message || "E-mail vinculado à conta." });
      setNewEmail("");
      handleGetEmail();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    if (!verificationCode) return toast({ title: "Informe o código de verificação", variant: "destructive" });
    setLoading(true);
    try {
      await call("verify-account-email", { verificationCode });
      toast({ title: "✅ E-mail verificado", description: "O e-mail da conta foi verificado." });
      setVerificationCode("");
      handleGetEmail();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmail = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    setLoading(true);
    try {
      await call("remove-account-email", {});
      toast({ title: "✅ E-mail removido", description: "O e-mail foi desvinculado da conta." });
      setAccountEmail({ hasEmail: false });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckHasPin = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    setLoading(true);
    try {
      const res = await call("get-has-security-code", {});
      setHasPin(!!res?.hasCode);
      toast({
        title: res?.hasCode ? "🔒 PIN configurado" : "Sem PIN",
        description: res?.hasCode ? "Esta conta possui código PIN ativo." : "Esta conta não possui código PIN.",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    if (!newPin || newPin.length < 4) return toast({ title: "Informe um PIN válido (mín. 4 dígitos)", variant: "destructive" });
    setLoading(true);
    try {
      await call("set-security-code", { code: newPin });
      toast({ title: "✅ PIN cadastrado", description: "O código PIN foi configurado na conta." });
      setNewPin("");
      setHasPin(true);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    if (!instanceDbId) return toast({ title: "Selecione uma conexão", variant: "destructive" });
    setLoading(true);
    try {
      await call("remove-security-code", {});
      toast({ title: "✅ PIN removido", description: "O código PIN foi removido da conta." });
      setHasPin(false);
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

  const handleRequestUnbanning = async () => {
    if (!appealToken) return;
    setLoading(true);
    try {
      const res = await call("request-unbanning", { appealToken, description: unbanDescription });
      setUnbanStatus(res?.status || "Solicitação enviada");
      toast({ title: "✅ Desbanimento solicitado", description: res?.status || "Aguarde análise." });
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
                  <SelectItem key={i.id} value={i.id}>{i.instance_name || i.zapi_instance_id}</SelectItem>
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
          <Button onClick={handleGetEmail} variant="outline" size="sm" disabled={loading || !instanceDbId}>
            <Mail className="w-4 h-4 mr-2" /> Ver e-mail da conta
          </Button>
          <Button onClick={handleCheckHasPin} variant="outline" size="sm" disabled={loading || !instanceDbId}>
            <ShieldCheck className="w-4 h-4 mr-2" /> Verificar PIN
          </Button>
        </div>

        {hasPin !== null && (
          <p className="text-xs text-muted-foreground">
            {hasPin ? "🔒 Conta possui código PIN ativo." : "🔓 Conta sem código PIN."}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Cadastrar código PIN (2FA)</Label>
            <Input
              value={newPin}
              onChange={(e) => setNewPin(onlyDigits(e.target.value))}
              placeholder="Ex: 1234"
              maxLength={8}
              className="h-9 w-[180px]"
            />
          </div>
          <Button onClick={handleSetPin} disabled={loading || !newPin || !instanceDbId} variant="outline" size="sm">
            <ShieldCheck className="w-4 h-4 mr-2" /> Salvar PIN
          </Button>
          <Button onClick={handleRemovePin} disabled={loading || !instanceDbId} variant="outline" size="sm">
            <Trash2 className="w-4 h-4 mr-2" /> Remover PIN
          </Button>
        </div>

        {accountEmail && (
          <p className="text-xs text-muted-foreground">
            {accountEmail.hasEmail
              ? <>📧 E-mail: <span className="font-mono">{accountEmail.email}</span> {accountEmail.verified ? "(verificado)" : "(não verificado)"}</>
              : "Nenhum e-mail vinculado à conta."}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Cadastrar/atualizar e-mail da conta</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="h-9 w-[260px]"
            />
          </div>
          <Button onClick={handleSetEmail} disabled={loading || !newEmail || !instanceDbId} variant="outline" size="sm">
            <Mail className="w-4 h-4 mr-2" /> Salvar e-mail
          </Button>
          <Button onClick={handleRemoveEmail} disabled={loading || !instanceDbId} variant="outline" size="sm">
            <Trash2 className="w-4 h-4 mr-2" /> Remover e-mail
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Código de verificação do e-mail</Label>
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Código recebido por e-mail"
              className="h-9 w-[260px]"
            />
          </div>
          <Button onClick={handleVerifyEmail} disabled={loading || !verificationCode || !instanceDbId} variant="outline" size="sm">
            <ShieldCheck className="w-4 h-4 mr-2" /> Verificar e-mail
          </Button>
        </div>

        {info && <p className="text-xs text-muted-foreground">{info}</p>}
        {waitInfo && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {typeof waitInfo.sms === "number" && <div>⏱ SMS: aguardar {waitInfo.sms}s</div>}
            {typeof waitInfo.voice === "number" && <div>⏱ Voz: aguardar {waitInfo.voice}s</div>}
            {typeof waitInfo.waOld === "number" && (
              <div>⏱ Pop-up WhatsApp: aguardar {waitInfo.waOld}s {waitInfo.waOldEligible ? "(elegível)" : "(não elegível)"}</div>
            )}
          </div>
        )}
        {appealToken && (
          <div className="border border-destructive/30 rounded-lg p-3 space-y-2 bg-destructive/5">
            <Label className="text-xs flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Solicitar desbanimento
            </Label>
            <p className="text-[11px] text-muted-foreground break-all">Token: {appealToken}</p>
            <Input
              value={unbanDescription}
              onChange={(e) => setUnbanDescription(e.target.value)}
              placeholder="Descreva o motivo do uso do número"
              className="h-9"
            />
            <Button onClick={handleRequestUnbanning} disabled={loading || !unbanDescription} size="sm" variant="destructive">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enviar solicitação
            </Button>
            {unbanStatus && <p className="text-xs text-emerald-600">Status: {unbanStatus}</p>}
          </div>
        )}

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
                  <Button onClick={handleForgotPin} variant="outline" disabled={loading}>Esqueci o PIN</Button>
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