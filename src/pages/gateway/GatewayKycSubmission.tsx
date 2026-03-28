import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, CreditCard, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useGatewayKyc } from "@/hooks/useGatewayKyc";

interface DocUpload {
  file: File | null;
  preview: string;
}

export default function GatewayKycSubmission({ inDialog = false }: { inDialog?: boolean }) {
  const { kyc, loading, submitKyc } = useGatewayKyc();
  const [selfie, setSelfie] = useState<DocUpload>({ file: null, preview: "" });
  const [docFront, setDocFront] = useState<DocUpload>({ file: null, preview: "" });
  const [docBack, setDocBack] = useState<DocUpload>({ file: null, preview: "" });
  const [submitting, setSubmitting] = useState(false);

  const selfieRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined, setter: (v: DocUpload) => void) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return;
    setter({ file, preview: URL.createObjectURL(file) });
  };

  const handleSubmit = async () => {
    if (!selfie.file || !docFront.file || !docBack.file) return;
    setSubmitting(true);
    try {
      await submitKyc(selfie.file, docFront.file, docBack.file);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4D2E]" />
      </div>
    );
  }

  // Already approved
  if (kyc?.status === "approved") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-[#2A2A2A] max-w-md w-full">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Conta Aprovada!</h2>
            <p className="text-sm text-muted-foreground text-center">Seus documentos foram verificados. Você já pode usar todas as funcionalidades do gateway.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted - waiting review
  if (kyc?.status === "submitted") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-[#2A2A2A] max-w-md w-full">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold">Documentos em Análise</h2>
            <p className="text-sm text-muted-foreground text-center">Seus documentos foram enviados e estão aguardando aprovação do administrador. Isso pode levar até 24 horas.</p>
            <Badge className="bg-amber-500/10 text-amber-400 border-0">Aguardando Análise</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected
  const isRejected = kyc?.status === "rejected";

  return (
    <div className={inDialog ? "space-y-4" : "max-w-2xl mx-auto space-y-6"}>
      {!inDialog && (
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verificação de Identidade (KYC)</h1>
          <p className="text-sm text-muted-foreground">Para utilizar o gateway de pagamentos, precisamos verificar sua identidade</p>
        </div>
      )}

      {isRejected && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-400 text-sm">Documentos Reprovados</p>
              <p className="text-xs text-muted-foreground mt-1">{kyc?.reject_reason || "Motivo não informado. Por favor, envie novamente."}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Selfie */}
        <Card className="border-[#2A2A2A] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#FF4D2E]" />
              Selfie com Documento
            </CardTitle>
            <CardDescription className="text-xs">Tire uma foto segurando seu documento ao lado do rosto</CardDescription>
          </CardHeader>
          <CardContent>
            <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setSelfie)} />
            {selfie.preview ? (
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#2A2A2A] mb-2">
                <img src={selfie.preview} alt="Selfie" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 cursor-pointer hover:border-[#FF4D2E]/40 transition-colors" onClick={() => selfieRef.current?.click()}>
                <Camera className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Clique para enviar</span>
              </div>
            )}
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => selfieRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1" /> {selfie.file ? "Trocar" : "Selecionar"}
            </Button>
          </CardContent>
        </Card>

        {/* Doc Frente */}
        <Card className="border-[#2A2A2A] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#FF4D2E]" />
              Documento (Frente)
            </CardTitle>
            <CardDescription className="text-xs">RG, CNH ou Passaporte — lado da foto</CardDescription>
          </CardHeader>
          <CardContent>
            <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setDocFront)} />
            {docFront.preview ? (
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#2A2A2A] mb-2">
                <img src={docFront.preview} alt="Frente" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 cursor-pointer hover:border-[#FF4D2E]/40 transition-colors" onClick={() => frontRef.current?.click()}>
                <CreditCard className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Clique para enviar</span>
              </div>
            )}
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => frontRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1" /> {docFront.file ? "Trocar" : "Selecionar"}
            </Button>
          </CardContent>
        </Card>

        {/* Doc Verso */}
        <Card className="border-[#2A2A2A] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#FF4D2E]" />
              Documento (Verso)
            </CardTitle>
            <CardDescription className="text-xs">Verso do documento com informações legíveis</CardDescription>
          </CardHeader>
          <CardContent>
            <input ref={backRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setDocBack)} />
            {docBack.preview ? (
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#2A2A2A] mb-2">
                <img src={docBack.preview} alt="Verso" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 cursor-pointer hover:border-[#FF4D2E]/40 transition-colors" onClick={() => backRef.current?.click()}>
                <CreditCard className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Clique para enviar</span>
              </div>
            )}
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => backRef.current?.click()}>
              <Upload className="w-3 h-3 mr-1" /> {docBack.file ? "Trocar" : "Selecionar"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!selfie.file || !docFront.file || !docBack.file || submitting}
          className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white px-8"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" /> Enviar Documentos</>
          )}
        </Button>
      </div>

      <Card className="border-[#2A2A2A]">
        <CardContent className="pt-4 pb-4">
          <h3 className="text-sm font-medium mb-2">📋 Requisitos dos documentos</h3>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• Selfie: Rosto visível segurando o documento ao lado</li>
            <li>• Documento aceito: RG, CNH ou Passaporte</li>
            <li>• As fotos devem estar nítidas e sem cortes</li>
            <li>• Formato: JPG ou PNG, máximo 10MB cada</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
