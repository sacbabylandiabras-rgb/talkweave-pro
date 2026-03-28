import { Plus, Copy, Eye, Trash2, Edit, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { mockCheckouts } from "./mock-data";
import { toast } from "sonner";

export default function PayCheckouts() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Checkouts</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie seus checkouts de pagamento</p>
        </div>
        <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full px-6">
          <Plus className="w-4 h-4 mr-2" /> Novo Checkout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Checkouts", value: "3" },
          { label: "Visitas Totais", value: "2.436" },
          { label: "Conversão Média", value: "40,1%" },
        ].map(c => (
          <Card key={c.label} className="border-[#2A2A2A]">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#2A2A2A]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Nome</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Conversão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCheckouts.map(ck => (
                <TableRow key={ck.id} className="border-[#2A2A2A]">
                  <TableCell className="font-medium">{ck.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{ck.product}</TableCell>
                  <TableCell className="text-sm">{ck.format}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${ck.conversion > 40 ? 'text-emerald-400' : 'text-amber-400'}`}>{ck.conversion}%</span>
                  </TableCell>
                  <TableCell><Switch checked={ck.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(`https://pay.zaplynx.com/${ck.id}`); toast.success("Link copiado!"); }}><Copy className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
