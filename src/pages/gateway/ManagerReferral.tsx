import { Copy, QrCode, Share2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const referralLink = "https://zaplynxpay.com/register?ref=CARLOS_M2025";

export default function ManagerReferral() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Indicar Novo Cliente</h1>
        <p className="text-sm text-muted-foreground">Indique empresas e ganhe comissão sobre o volume</p>
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Meu Link de Indicação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={referralLink} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(referralLink); toast.success("Link copiado!"); }}><Copy className="w-4 h-4" /></Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full text-xs"><QrCode className="w-3.5 h-3.5 mr-1.5" /> QR Code</Button>
            <Button variant="outline" className="rounded-full text-xs"><Share2 className="w-3.5 h-3.5 mr-1.5" /> Compartilhar</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Indicação Manual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-xs">Nome da Empresa</Label><Input placeholder="Ex: Loja ABC" className="mt-1" /></div>
            <div><Label className="text-xs">Responsável</Label><Input placeholder="Nome completo" className="mt-1" /></div>
            <div><Label className="text-xs">E-mail</Label><Input type="email" placeholder="contato@empresa.com" className="mt-1" /></div>
            <div><Label className="text-xs">Telefone</Label><Input placeholder="(11) 99999-9999" className="mt-1" /></div>
            <div><Label className="text-xs">Segmento</Label><Input placeholder="E-commerce" className="mt-1" /></div>
            <div><Label className="text-xs">Faturamento Estimado</Label><Input placeholder="R$ 50.000/mês" className="mt-1" /></div>
          </div>
          <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-6" onClick={() => toast.success("Indicação enviada!")}><Send className="w-4 h-4 mr-2" /> Enviar Indicação</Button>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Minhas Indicações</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Empresa</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead>Volume Gerado</TableHead><TableHead>Comissão Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-[#2A2A2A]">
                <TableCell className="font-medium">Tech Academy</TableCell>
                <TableCell className="text-xs text-muted-foreground">05/02/2025</TableCell>
                <TableCell><span className="px-2 py-0.5 rounded-full text-xs text-emerald-400 bg-emerald-500/10">Ativo</span></TableCell>
                <TableCell>R$ 89.400,00</TableCell>
                <TableCell className="text-emerald-400">R$ 894,00</TableCell>
              </TableRow>
              <TableRow className="border-[#2A2A2A]">
                <TableCell className="font-medium">Pet Shop Online</TableCell>
                <TableCell className="text-xs text-muted-foreground">20/03/2025</TableCell>
                <TableCell><span className="px-2 py-0.5 rounded-full text-xs text-blue-400 bg-blue-500/10">Análise KYC</span></TableCell>
                <TableCell>—</TableCell>
                <TableCell>—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
