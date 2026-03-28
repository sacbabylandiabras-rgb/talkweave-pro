import { Clock, CheckCircle, XCircle, FileSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockCompanies, getStatusBadge } from "./mock-data";

const kycQueue = mockCompanies.filter(c => c.status === "kyc_pending");

export default function AdminKYC() {
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
                <TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>Data Envio</TableHead><TableHead>Documentos</TableHead><TableHead>Prioridade</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kycQueue.map(c => (
                <TableRow key={c.id} className="border-[#2A2A2A]">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.cnpj}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.createdAt}</TableCell>
                  <TableCell><span className="text-amber-400 text-xs">4/6</span></TableCell>
                  <TableCell><span className="px-2 py-0.5 rounded-full text-[10px] text-amber-400 bg-amber-400/10">Normal</span></TableCell>
                  <TableCell>
                    <Button size="sm" className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full text-xs h-7">Analisar</Button>
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
    </div>
  );
}
