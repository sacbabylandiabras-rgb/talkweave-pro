import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const defaultFees = [
  { method: "Cartão Crédito 1x", percent: "2,49", fixed: "0,00", term: "D+30" },
  { method: "Cartão Crédito 2x–6x", percent: "2,99", fixed: "0,00", term: "D+30" },
  { method: "Cartão Crédito 7x–12x", percent: "3,49", fixed: "0,00", term: "D+30" },
  { method: "Cartão Débito", percent: "1,99", fixed: "0,00", term: "D+1" },
  { method: "PIX", percent: "0,99", fixed: "0,50", term: "D+1" },
  { method: "Boleto", percent: "0,00", fixed: "3,50", term: "D+3" },
];

export default function AdminFees() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Taxas & Tarifas</h1>
        <p className="text-sm text-muted-foreground">Configure as taxas padrão da plataforma</p>
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Taxas Padrão</CardTitle>
          <Button size="sm" className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full text-xs" onClick={() => toast.success("Taxas salvas!")}><Save className="w-3.5 h-3.5 mr-1" /> Salvar</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Método</TableHead><TableHead>Taxa (%)</TableHead><TableHead>Taxa Fixa (R$)</TableHead><TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaultFees.map(f => (
                <TableRow key={f.method} className="border-[#2A2A2A]">
                  <TableCell className="font-medium">{f.method}</TableCell>
                  <TableCell><Input defaultValue={f.percent} className="w-20 h-8 text-center text-xs" /></TableCell>
                  <TableCell><Input defaultValue={f.fixed} className="w-20 h-8 text-center text-xs" /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.term}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Antecipação de Recebíveis</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Habilitar antecipação</span>
            <Switch />
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div><p className="text-xs text-muted-foreground">Taxa ao dia (%)</p><Input defaultValue="0,05" className="h-8 text-xs mt-1" /></div>
            <div><p className="text-xs text-muted-foreground">Taxa mensal (%)</p><Input defaultValue="1,50" className="h-8 text-xs mt-1" /></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Básico", "Pro", "Enterprise"].map((plan, i) => (
          <Card key={plan} className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">{plan}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><p className="text-xs text-muted-foreground">Taxa mensal</p><Input defaultValue={["R$ 49,90", "R$ 149,90", "R$ 499,90"][i]} className="h-8 text-xs mt-1" /></div>
              <div><p className="text-xs text-muted-foreground">Desconto sobre taxas (%)</p><Input defaultValue={["0", "10", "25"][i]} className="h-8 text-xs mt-1" /></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
