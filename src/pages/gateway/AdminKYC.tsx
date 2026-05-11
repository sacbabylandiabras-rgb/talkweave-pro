import { useState, useEffect, useCallback } from "react";
import { Clock, CheckCircle, XCircle, FileSearch, Camera, CreditCard, User, Eye, ZoomIn, ThumbsUp, ThumbsDown, RefreshCw, Loader2, FileText, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAdminKycQueue, KycData } from "@/hooks/useGatewayKyc";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const getDocStatusBadge = (status: string) => {
  switch (status) {
    case "approved": return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Aprovado</Badge>;
    case "rejected": return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Reprovado</Badge>;
    case "submitted": return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Pendente</Badge>;
    case "pending": return <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Não enviado</Badge>;
    default: return null;
  }
};

type EnrichedKyc = KycData & { email?: string; full_name?: string; whatsapp_profile?: string; whatsapp?: string };

export default function AdminKYC() {
  const { queue, loading, approveKyc, rejectKyc, refetch } = useAdminKycQueue();
  const [selectedKyc, setSelectedKyc] = useState<EnrichedKyc | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Generate signed URLs when a KYC record is selected
  useEffect(() => {
    if (!selectedKyc) {
      setSignedUrls({});
      return;
    }

    const cnpjUrl = (selectedKyc.business_data as any)?.cnpj_doc_url as string | undefined;
    const urls = [selectedKyc.selfie_url, selectedKyc.doc_front_url, selectedKyc.doc_back_url, cnpjUrl].filter(Boolean) as string[];
    if (urls.length === 0) return;

    const generateSignedUrls = async () => {
      const newSignedUrls: Record<string, string> = {};
      for (const url of urls) {
        // Extract file path from the stored URL (format: .../kyc-documents/userId/file.ext)
        const match = url.match(/kyc-documents\/(.+)$/);
        if (match) {
          const filePath = decodeURIComponent(match[1]);
          const { data } = await supabase.storage
            .from("kyc-documents")
            .createSignedUrl(filePath, 3600);
          if (data?.signedUrl) {
            newSignedUrls[url] = data.signedUrl;
          }
        }
      }
      setSignedUrls(newSignedUrls);
    };
    generateSignedUrls();
  }, [selectedKyc]);

  const getSignedUrl = useCallback((originalUrl: string | null | undefined) => {
    if (!originalUrl) return null;
    return signedUrls[originalUrl] || null;
  }, [signedUrls]);

  const submittedQueue = queue.filter(k => k.status === "submitted");
  const approvedToday = queue.filter(k => k.status === "approved" && k.reviewed_at && new Date(k.reviewed_at).toDateString() === new Date().toDateString());
  const rejectedToday = queue.filter(k => k.status === "rejected" && k.reviewed_at && new Date(k.reviewed_at).toDateString() === new Date().toDateString());

  const handleApprove = async () => {
    if (!selectedKyc) return;
    setProcessing(true);
    await approveKyc(selectedKyc.id);
    setSelectedKyc(null);
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedKyc || !rejectReason.trim()) return;
    setProcessing(true);
    await rejectKyc(selectedKyc.id, rejectReason);
    setSelectedKyc(null);
    setRejectReason("");
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#a78bfa]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de KYC</h1>
          <p className="text-sm text-muted-foreground">Análise e aprovação de documentos</p>
        </div>
        <Button size="sm" variant="outline" onClick={refetch} className="border-[#2A2A2A]">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Aguardando Análise", value: submittedQueue.length.toString(), icon: Clock, color: "text-amber-400" },
          { label: "Aprovados Hoje", value: approvedToday.length.toString(), icon: CheckCircle, color: "text-emerald-400" },
          { label: "Reprovados Hoje", value: rejectedToday.length.toString(), icon: XCircle, color: "text-red-400" },
          { label: "Total Registros", value: queue.length.toString(), icon: FileSearch, color: "text-blue-400" },
        ].map(c => (
          <Card key={c.label} className="border-[#2A2A2A]">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase">{c.label}</span>
              </div>
              <p className="text-xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Fila de Análise</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Usuário</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Data Envio</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map(k => (
                <TableRow key={k.id} className="border-[#2A2A2A]">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{k.full_name || "Sem nome"}</span>
                      <span className="text-xs text-muted-foreground">{k.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {(k as any).whatsapp_profile || k.whatsapp || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.submitted_at ? format(new Date(k.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Camera className={`w-3 h-3 ${k.selfie_url ? "text-emerald-400" : "text-muted-foreground/40"}`} />
                      <CreditCard className={`w-3 h-3 ${k.doc_front_url ? "text-emerald-400" : "text-muted-foreground/40"}`} />
                      <CreditCard className={`w-3 h-3 ${k.doc_back_url ? "text-emerald-400" : "text-muted-foreground/40"}`} />
                      <span className="text-xs ml-1">
                        {[k.selfie_url, k.doc_front_url, k.doc_back_url].filter(Boolean).length}/3
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getDocStatusBadge(k.status)}</TableCell>
                  <TableCell>
                    {k.status === "submitted" ? (
                      <Button
                        size="sm"
                        className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full text-xs h-7"
                        onClick={() => { setSelectedKyc(k); setRejectReason(""); }}
                      >
                        <Eye className="w-3 h-3 mr-1" /> Analisar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => { setSelectedKyc(k); setRejectReason(""); }}
                      >
                        <Eye className="w-3 h-3 mr-1" /> Ver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {queue.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhum registro de KYC</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Análise */}
      <Dialog open={!!selectedKyc} onOpenChange={(open) => !open && setSelectedKyc(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Análise KYC — {selectedKyc?.full_name || selectedKyc?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Card className="border-[#2A2A2A]">
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">E-mail:</span> {selectedKyc?.email}</div>
                  <div><span className="text-muted-foreground">Data Envio:</span> {selectedKyc?.submitted_at ? format(new Date(selectedKyc.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</div>
                </div>
              </CardContent>
            </Card>

            <h3 className="font-semibold text-sm">Documentos Enviados</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Selfie com Documento", icon: Camera, url: selectedKyc?.selfie_url },
                { label: "Documento (Frente)", icon: CreditCard, url: selectedKyc?.doc_front_url },
                { label: "Documento (Verso)", icon: CreditCard, url: selectedKyc?.doc_back_url },
                { label: "Cartão CNPJ", icon: Building2, url: (selectedKyc?.business_data as any)?.cnpj_doc_url as string | undefined },
              ].map((doc) => {
                const signed = getSignedUrl(doc.url);
                const isPdf = !!doc.url && /\.pdf($|\?)/i.test(doc.url);
                return (
                  <Card key={doc.label} className="border-[#2A2A2A] overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative aspect-[4/3] bg-muted/30 flex items-center justify-center">
                        {signed ? (
                          isPdf ? (
                            <a
                              href={signed}
                              target="_blank"
                              rel="noreferrer"
                              className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-4"
                            >
                              <FileText className="w-10 h-10 text-[#a78bfa]" />
                              <span className="text-xs font-medium">Abrir PDF</span>
                            </a>
                          ) : (
                            <>
                              <img src={signed} alt={doc.label} className="w-full h-full object-cover" />
                              <button
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                                onClick={() => setZoomImage(signed)}
                              >
                                <ZoomIn className="w-3.5 h-3.5 text-white" />
                              </button>
                            </>
                          )
                        ) : doc.url ? (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-xs">Carregando...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <doc.icon className="w-8 h-8 opacity-30" />
                            <span className="text-xs">Não enviado</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <span className="text-xs font-medium">{doc.label}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Ações de aprovação/rejeição */}
            {selectedKyc?.status === "submitted" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-red-400">Motivo da Reprovação (obrigatório para reprovar)</label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Descreva o motivo da reprovação..."
                    className="border-[#2A2A2A] min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#2A2A2A]">
                  <Button variant="outline" onClick={() => setSelectedKyc(null)}>Fechar</Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={!rejectReason.trim() || processing}
                    onClick={handleReject}
                  >
                    <ThumbsDown className="w-4 h-4 mr-1" /> Reprovar
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={processing}
                    onClick={handleApprove}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" /> Aprovar
                  </Button>
                </div>
              </>
            )}

            {selectedKyc?.status !== "submitted" && (
              <div className="flex justify-between items-center pt-2 border-t border-[#2A2A2A]">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getDocStatusBadge(selectedKyc?.status || "")}
                </div>
                <Button variant="outline" onClick={() => setSelectedKyc(null)}>Fechar</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom */}
      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent className="max-w-2xl p-1">
          {zoomImage && <img src={zoomImage} alt="Documento ampliado" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
