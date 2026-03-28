import { useState } from "react";
import { Clock, CheckCircle, XCircle, FileSearch, Camera, CreditCard, User, Eye, X, ZoomIn, Download, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { mockCompanies, getStatusBadge } from "./mock-data";

const kycQueue = mockCompanies.filter(c => c.status === "kyc_pending");

interface KycDocument {
  type: "selfie" | "doc_front" | "doc_back";
  label: string;
  icon: typeof Camera;
  status: "pending" | "approved" | "rejected" | "missing";
  imageUrl?: string;
}

const mockDocuments: KycDocument[] = [
  { type: "selfie", label: "Selfie com Documento", icon: Camera, status: "pending", imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop" },
  { type: "doc_front", label: "Documento (Frente)", icon: CreditCard, status: "pending", imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop" },
  { type: "doc_back", label: "Documento (Verso)", icon: CreditCard, status: "missing" },
];

const getDocStatusBadge = (status: string) => {
  switch (status) {
    case "approved": return <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]">Aprovado</Badge>;
    case "rejected": return <Badge className="bg-red-500/10 text-red-400 border-0 text-[10px]">Reprovado</Badge>;
    case "pending": return <Badge className="bg-amber-500/10 text-amber-400 border-0 text-[10px]">Pendente</Badge>;
    case "missing": return <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">Não enviado</Badge>;
    default: return null;
  }
};

export default function AdminKYC() {
  const [selectedCompany, setSelectedCompany] = useState<typeof mockCompanies[0] | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [documents, setDocuments] = useState<KycDocument[]>(mockDocuments);

  const handleApproveDoc = (type: string) => {
    setDocuments(prev => prev.map(d => d.type === type ? { ...d, status: "approved" as const } : d));
  };

  const handleRejectDoc = (type: string) => {
    setDocuments(prev => prev.map(d => d.type === type ? { ...d, status: "rejected" as const } : d));
  };

  const allApproved = documents.every(d => d.status === "approved");
  const hasRejected = documents.some(d => d.status === "rejected");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de KYC</h1>
        <p className="text-sm text-muted-foreground">Análise e aprovação de documentos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Aguardando Análise", value: "8", icon: Clock, color: "text-amber-400" },
          { label: "Aprovados Hoje", value: "2", icon: CheckCircle, color: "text-emerald-400" },
          { label: "Reprovados Hoje", value: "1", icon: XCircle, color: "text-red-400" },
          { label: "Tempo Médio", value: "4h 23m", icon: FileSearch, color: "text-blue-400" },
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
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Data Envio</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kycQueue.map(c => (
                <TableRow key={c.id} className="border-[#2A2A2A]">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.cnpj}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.createdAt}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Camera className="w-3 h-3 text-amber-400" />
                      <CreditCard className="w-3 h-3 text-emerald-400" />
                      <CreditCard className="w-3 h-3 text-muted-foreground/40" />
                      <span className="text-amber-400 text-xs ml-1">2/3</span>
                    </div>
                  </TableCell>
                  <TableCell><span className="px-2 py-0.5 rounded-full text-[10px] text-amber-400 bg-amber-400/10">Normal</span></TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full text-xs h-7"
                      onClick={() => { setSelectedCompany(c); setDocuments(mockDocuments); setRejectReason(""); }}
                    >
                      <Eye className="w-3 h-3 mr-1" /> Analisar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {kycQueue.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhuma empresa na fila</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Análise KYC */}
      <Dialog open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Análise KYC — {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info do solicitante */}
            <Card className="border-[#2A2A2A]">
              <CardContent className="pt-4 pb-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-mono">{selectedCompany?.cnpj}</span></div>
                  <div><span className="text-muted-foreground">Data Envio:</span> {selectedCompany?.createdAt}</div>
                </div>
              </CardContent>
            </Card>

            {/* Documentos */}
            <h3 className="font-semibold text-sm">Documentos Enviados</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <Card key={doc.type} className="border-[#2A2A2A] overflow-hidden">
                  <CardContent className="p-0">
                    {/* Imagem ou placeholder */}
                    <div className="relative aspect-[4/3] bg-muted/30 flex items-center justify-center">
                      {doc.imageUrl ? (
                        <>
                          <img src={doc.imageUrl} alt={doc.label} className="w-full h-full object-cover" />
                          <button 
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                            onClick={() => setZoomImage(doc.imageUrl!)}
                          >
                            <ZoomIn className="w-3.5 h-3.5 text-white" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <doc.icon className="w-8 h-8 opacity-30" />
                          <span className="text-xs">Não enviado</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Info e ações */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{doc.label}</span>
                        {getDocStatusBadge(doc.status)}
                      </div>
                      
                      {doc.imageUrl && doc.status === "pending" && (
                        <div className="flex gap-1.5">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => handleApproveDoc(doc.type)}
                          >
                            <ThumbsUp className="w-3 h-3 mr-1" /> Aprovar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => handleRejectDoc(doc.type)}
                          >
                            <ThumbsDown className="w-3 h-3 mr-1" /> Reprovar
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Motivo rejeição */}
            {hasRejected && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-red-400">Motivo da Reprovação</label>
                <Textarea 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)} 
                  placeholder="Descreva o motivo da reprovação dos documentos..."
                  className="border-[#2A2A2A] min-h-[80px]"
                />
              </div>
            )}

            {/* Ações finais */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#2A2A2A]">
              <Button variant="outline" onClick={() => setSelectedCompany(null)}>Fechar</Button>
              {allApproved && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-1" /> Aprovar KYC
                </Button>
              )}
              {hasRejected && (
                <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={!rejectReason.trim()}>
                  <XCircle className="w-4 h-4 mr-1" /> Reprovar KYC
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zoom da imagem */}
      <Dialog open={!!zoomImage} onOpenChange={(open) => !open && setZoomImage(null)}>
        <DialogContent className="max-w-2xl p-1">
          {zoomImage && <img src={zoomImage} alt="Documento ampliado" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
