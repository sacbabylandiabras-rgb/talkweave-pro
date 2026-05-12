import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, CreditCard, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Loader2, ArrowRight, ArrowLeft, Mail, Phone, Building2, User, MapPin } from "lucide-react";
import { useGatewayKyc } from "@/hooks/useGatewayKyc";

interface DocUpload {
  file: File | null;
  preview: string;
}

interface Step1Data {
  whatsapp: string;
}

interface Step2Data {
  company_name: string;
  cnpj: string;
  owner_name: string;
  owner_cpf: string;
   mother_name?: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
}

 export default function GatewayKycSubmission({ inDialog = false }: { inDialog?: boolean }) {
   const { kyc, loading, submitKyc } = useGatewayKyc();
   const [step, setStep] = useState(1);
   const [kycType, setKycType] = useState<"pf" | "pj">("pj");

  // Step 1
  const [step1, setStep1] = useState<Step1Data>({ whatsapp: "" });

  // Step 2
  const [step2, setStep2] = useState<Step2Data>({
    company_name: "", cnpj: "", owner_name: "", owner_cpf: "",
    mother_name: "", address_zip: "", address_street: "", address_number: "",
    address_complement: "", address_neighborhood: "", address_city: "", address_state: "",
  });

  // Step 3
  const [selfie, setSelfie] = useState<DocUpload>({ file: null, preview: "" });
  const [docFront, setDocFront] = useState<DocUpload>({ file: null, preview: "" });
  const [docBack, setDocBack] = useState<DocUpload>({ file: null, preview: "" });
  const [cnpjDoc, setCnpjDoc] = useState<DocUpload>({ file: null, preview: "" });
  const [submitting, setSubmitting] = useState(false);

  const selfieRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const cnpjDocRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined, setter: (v: DocUpload) => void, allowPdf = false) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !(allowPdf && isPdf)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setter({ file, preview: isPdf ? "pdf" : URL.createObjectURL(file) });
  };

  const isStep1Valid = step1.whatsapp.trim().length >= 10;
   const isStep2Valid = kycType === "pj" 
     ? (
       step2.company_name.trim() !== "" &&
       step2.cnpj.trim().length >= 14 &&
       step2.owner_name.trim() !== "" &&
       step2.owner_cpf.trim().length >= 11 &&
       step2.mother_name?.trim() !== "" &&
       step2.address_zip.trim() !== "" &&
       step2.address_street.trim() !== "" &&
       step2.address_number.trim() !== "" &&
       step2.address_neighborhood.trim() !== "" &&
       step2.address_city.trim() !== "" &&
       step2.address_state.trim() !== ""
     ) : (
       step2.owner_name.trim() !== "" &&
       step2.owner_cpf.trim().length >= 11 &&
       step2.address_zip.trim() !== "" &&
       step2.address_street.trim() !== "" &&
       step2.address_number.trim() !== "" &&
       step2.address_neighborhood.trim() !== "" &&
       step2.address_city.trim() !== "" &&
       step2.address_state.trim() !== ""
     );

   const handleSubmit = async () => {
     if (!selfie.file || !docFront.file || !docBack.file || (kycType === "pj" && !cnpjDoc.file)) return;
     setSubmitting(true);
     try {
       await submitKyc(
         selfie.file, 
         docFront.file, 
         docBack.file, 
         step1.whatsapp, 
         { ...step2, kyc_type: kycType }, 
         kycType === "pj" ? cnpjDoc.file || undefined : undefined
       );
     } finally {
       setSubmitting(false);
     }
   };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#a78bfa]" />
      </div>
    );
  }

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

  if (kyc?.status === "submitted") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-[#2A2A2A] max-w-md w-full">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold">Documentos em Análise</h2>
            <p className="text-sm text-muted-foreground text-center">Seus documentos foram enviados e estão aguardando aprovação do administrador.</p>
            <Badge className="bg-amber-500/10 text-amber-400 border-0">Aguardando Análise</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRejected = kyc?.status === "rejected";

  return (
    <div className={inDialog ? "space-y-4" : "max-w-2xl mx-auto space-y-6"}>
      {!inDialog && (
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verificação de Identidade (KYC)</h1>
          <p className="text-sm text-muted-foreground">Complete as etapas abaixo para ativar o gateway</p>
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

      {/* Step Indicator */}
      <div className="flex items-center gap-2 justify-center">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              step === s ? "bg-[#a78bfa] text-white" : step > s ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
            }`}>
              {step > s ? "✓" : s}
            </div>
            <span className={`text-xs hidden sm:inline ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {s === 1 ? "Conta" : s === 2 ? "Empresa" : "Documentos"}
            </span>
            {s < 3 && <div className={`w-8 h-0.5 ${step > s ? "bg-emerald-500" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: WhatsApp */}
      {step === 1 && (
       <div className="space-y-4">
         <div className="flex gap-4 mb-2">
           <Button 
             variant={kycType === "pj" ? "default" : "outline"}
             className={kycType === "pj" ? "bg-[#a78bfa] hover:bg-[#8b5cf6] flex-1" : "flex-1 border-[#2A2A2A]"}
             onClick={() => setKycType("pj")}
           >
             <Building2 className="w-4 h-4 mr-2" /> Pessoa Jurídica
           </Button>
           <Button 
             variant={kycType === "pf" ? "default" : "outline"}
             className={kycType === "pf" ? "bg-[#a78bfa] hover:bg-[#8b5cf6] flex-1" : "flex-1 border-[#2A2A2A]"}
             onClick={() => setKycType("pf")}
           >
             <User className="w-4 h-4 mr-2" /> Pessoa Física
           </Button>
         </div>
 
         <Card className="border-[#2A2A2A]">
           <CardHeader>
             <CardTitle className="text-base flex items-center gap-2">
               <Phone className="w-5 h-5 text-[#a78bfa]" />
               Dados da Conta
             </CardTitle>
             <CardDescription>Informe seu WhatsApp para contato</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
               <Input
                 id="whatsapp"
                 placeholder="11999999999"
                 value={step1.whatsapp}
                 onChange={(e) => setStep1({ ...step1, whatsapp: e.target.value.replace(/\D/g, "") })}
                 maxLength={15}
               />
             </div>
             <div className="flex justify-end">
               <Button
                 onClick={() => setStep(2)}
                 disabled={!isStep1Valid}
                 className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white"
               >
                 Próximo <ArrowRight className="w-4 h-4 ml-1" />
               </Button>
             </div>
           </CardContent>
         </Card>
       </div>
      )}

      {/* Step 2: Business Data */}
      {step === 2 && (
       <Card className="border-[#2A2A2A]">
           <CardHeader>
             <CardTitle className="text-base flex items-center gap-2">
               {kycType === "pj" ? <Building2 className="w-5 h-5 text-[#a78bfa]" /> : <User className="w-5 h-5 text-[#a78bfa]" />}
               {kycType === "pj" ? "Dados da Empresa (PJ)" : "Dados Pessoais (PF)"}
             </CardTitle>
             <CardDescription>
               {kycType === "pj" ? "Informe os dados da pessoa jurídica" : "Informe seus dados de pessoa física"}
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             {kycType === "pj" && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Razão Social</Label>
                   <Input
                     placeholder="Empresa LTDA"
                     value={step2.company_name}
                     onChange={(e) => setStep2({ ...step2, company_name: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>CNPJ</Label>
                   <Input
                     placeholder="00.000.000/0000-00"
                     value={step2.cnpj}
                     onChange={(e) => setStep2({ ...step2, cnpj: e.target.value.replace(/[^\d./\-]/g, "") })}
                     maxLength={18}
                   />
                 </div>
               </div>
             )}
 
             <div className={kycType === "pj" ? "border-t border-border pt-4" : ""}>
               <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                 <User className="w-4 h-4 text-[#a78bfa]" /> {kycType === "pj" ? "Responsável Legal" : "Dados do Titular"}
               </p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Nome Completo</Label>
                   <Input
                     placeholder={kycType === "pj" ? "Nome do responsável" : "Seu nome completo"}
                     value={step2.owner_name}
                     onChange={(e) => setStep2({ ...step2, owner_name: e.target.value })}
                   />
                 </div>
                 <div className="space-y-2">
                   <Label>CPF</Label>
                   <Input
                     placeholder="000.000.000-00"
                     value={step2.owner_cpf}
                     onChange={(e) => setStep2({ ...step2, owner_cpf: e.target.value.replace(/[^\d.\-]/g, "") })}
                     maxLength={14}
                   />
                 </div>
                 {kycType === "pj" && (
                   <div className="space-y-2 md:col-span-2">
                     <Label>Nome da Mãe</Label>
                     <Input
                       placeholder="Nome completo da mãe"
                       value={step2.mother_name}
                       onChange={(e) => setStep2({ ...step2, mother_name: e.target.value })}
                     />
                   </div>
                 )}
               </div>
             </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#a78bfa]" /> Endereço
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    placeholder="00000-000"
                    value={step2.address_zip}
                    onChange={(e) => setStep2({ ...step2, address_zip: e.target.value.replace(/[^\d\-]/g, "") })}
                    maxLength={9}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rua / Avenida</Label>
                  <Input
                    placeholder="Nome da rua"
                    value={step2.address_street}
                    onChange={(e) => setStep2({ ...step2, address_street: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    placeholder="123"
                    value={step2.address_number}
                    onChange={(e) => setStep2({ ...step2, address_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input
                    placeholder="Sala 101 (opcional)"
                    value={step2.address_complement}
                    onChange={(e) => setStep2({ ...step2, address_complement: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    placeholder="Bairro"
                    value={step2.address_neighborhood}
                    onChange={(e) => setStep2({ ...step2, address_neighborhood: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    placeholder="Cidade"
                    value={step2.address_city}
                    onChange={(e) => setStep2({ ...step2, address_city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado (UF)</Label>
                  <Input
                    placeholder="SP"
                    value={step2.address_state}
                    onChange={(e) => setStep2({ ...step2, address_state: e.target.value.toUpperCase() })}
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white"
              >
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Documents */}
      {step === 3 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Selfie */}
            <Card className="border-[#2A2A2A] overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#a78bfa]" />
                  Selfie com Documento
                </CardTitle>
                <CardDescription className="text-xs">Foto segurando seu documento ao lado do rosto</CardDescription>
              </CardHeader>
              <CardContent>
                <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setSelfie)} />
                {selfie.preview ? (
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#2A2A2A] mb-2">
                    <img src={selfie.preview} alt="Selfie" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 cursor-pointer hover:border-[#a78bfa]/40 transition-colors" onClick={() => selfieRef.current?.click()}>
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
                  <CreditCard className="w-4 h-4 text-[#a78bfa]" />
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
                  <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 cursor-pointer hover:border-[#a78bfa]/40 transition-colors" onClick={() => frontRef.current?.click()}>
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
                  <CreditCard className="w-4 h-4 text-[#a78bfa]" />
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
                  <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 cursor-pointer hover:border-[#a78bfa]/40 transition-colors" onClick={() => backRef.current?.click()}>
                    <CreditCard className="w-8 h-8 text-muted-foreground/30" />
                    <span className="text-xs text-muted-foreground">Clique para enviar</span>
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => backRef.current?.click()}>
                  <Upload className="w-3 h-3 mr-1" /> {docBack.file ? "Trocar" : "Selecionar"}
                </Button>
              </CardContent>
            </Card>

           {/* Cartão CNPJ (Only for PJ) */}
             {kycType === "pj" && (
               <Card className="border-[#2A2A2A] overflow-hidden">
                 <CardHeader className="pb-2">
                   <CardTitle className="text-sm flex items-center gap-2">
                     <Building2 className="w-4 h-4 text-[#a78bfa]" />
                     Cartão CNPJ
                   </CardTitle>
                   <CardDescription className="text-xs">Foto ou PDF do cartão CNPJ da empresa</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <input ref={cnpjDocRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0], setCnpjDoc, true)} />
                   {cnpjDoc.preview ? (
                     cnpjDoc.preview === "pdf" ? (
                       <div className="aspect-[4/3] rounded-lg border border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 bg-muted/30">
                         <Building2 className="w-8 h-8 text-[#a78bfa]/60" />
                         <span className="text-xs text-muted-foreground font-medium">{cnpjDoc.file?.name}</span>
                         <Badge variant="secondary" className="text-[10px]">PDF</Badge>
                       </div>
                     ) : (
                       <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#2A2A2A] mb-2">
                         <img src={cnpjDoc.preview} alt="Cartão CNPJ" className="w-full h-full object-cover" />
                       </div>
                     )
                   ) : (
                     <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-[#2A2A2A] flex flex-col items-center justify-center gap-2 mb-2 cursor-pointer hover:border-[#a78bfa]/40 transition-colors" onClick={() => cnpjDocRef.current?.click()}>
                       <Building2 className="w-8 h-8 text-muted-foreground/30" />
                       <span className="text-xs text-muted-foreground">PDF ou Imagem</span>
                     </div>
                   )}
                   <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => cnpjDocRef.current?.click()}>
                     <Upload className="w-3 h-3 mr-1" /> {cnpjDoc.file ? "Trocar" : "Selecionar"}
                   </Button>
                 </CardContent>
               </Card>
             )}
           </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
             <Button
               onClick={handleSubmit}
               disabled={!selfie.file || !docFront.file || !docBack.file || (kycType === "pj" && !cnpjDoc.file) || submitting}
               className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white px-8"
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
                 <li>• Selfie: Rosto visível segurando o documento (frente) ao lado</li>
                 <li>• Documento aceito: RG, CNH ou Passaporte (frente e verso)</li>
                 {kycType === "pj" && <li>• Cartão CNPJ: Foto ou PDF do cartão CNPJ</li>}
                <li>• As fotos devem estar nítidas e sem cortes</li>
                <li>• Formato: JPG, PNG ou PDF, máximo 10MB cada</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
