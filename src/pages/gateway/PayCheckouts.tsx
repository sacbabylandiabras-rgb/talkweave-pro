import { useState, useEffect } from "react";
import { Plus, Copy, Eye, Trash2, Edit, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Checkout {
  id: string;
  name: string;
  format: string;
  status: boolean;
  slug: string | null;
  visits: number;
  initiated: number;
  approved: number;
  product_id: string | null;
  product_name?: string;
}

export default function PayCheckouts() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", format: "one_step", product_id: "", slug: "" });

  const fetchData = async () => {
    const [ckRes, prodRes] = await Promise.all([
      supabase.from("gateway_checkouts" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("gateway_products" as any).select("id, name").order("name"),
    ]);
    const prods = (prodRes.data || []) as any[];
    const cks = ((ckRes.data || []) as any[]).map((ck: any) => ({
      ...ck,
      product_name: prods.find((p: any) => p.id === ck.product_id)?.name || "—",
    }));
    setCheckouts(cks);
    setProducts(prods);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("gateway_checkouts" as any).insert({
      user_id: user.id,
      name: form.name,
      format: form.format,
      product_id: form.product_id || null,
      slug: form.slug || null,
    } as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Checkout criado!");
    setDialogOpen(false);
    setForm({ name: "", format: "one_step", product_id: "", slug: "" });
    fetchData();
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await supabase.from("gateway_checkouts" as any).update({ status: !current } as any).eq("id", id);
    fetchData();
  };

  const deleteCheckout = async (id: string) => {
    await supabase.from("gateway_checkouts" as any).delete().eq("id", id);
    toast.success("Checkout removido");
    fetchData();
  };

  const totalVisits = checkouts.reduce((a, c) => a + c.visits, 0);
  const totalApproved = checkouts.reduce((a, c) => a + c.approved, 0);
  const avgConversion = totalVisits > 0 ? ((totalApproved / totalVisits) * 100).toFixed(1) : "0";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Checkouts</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie seus checkouts de pagamento</p>
        </div>
        <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full px-6" onClick={() => navigate("/gateway-checkout/checkouts/new")}>
              <Plus className="w-4 h-4 mr-2" /> Novo Checkout
            </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Checkouts", value: String(checkouts.length) },
          { label: "Visitas Totais", value: totalVisits.toLocaleString("pt-BR") },
          { label: "Conversão Média", value: `${avgConversion}%` },
        ].map(c => (
          <Card key={c.label} className="border-[#2A2A2A]">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {checkouts.length === 0 ? (
        <Card className="border-[#2A2A2A]">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Nenhum checkout criado ainda. Clique em "Novo Checkout" para começar.</p>
          </CardContent>
        </Card>
      ) : (
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
                {checkouts.map(ck => {
                  const conversion = ck.visits > 0 ? ((ck.approved / ck.visits) * 100).toFixed(1) : "0.0";
                  return (
                    <TableRow key={ck.id} className="border-[#2A2A2A]">
                      <TableCell className="font-medium">{ck.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{ck.product_name}</TableCell>
                      <TableCell className="text-sm">{ck.format === "one_step" ? "One Step" : ck.format === "multi_step" ? "Multi Step" : "Página Completa"}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${parseFloat(conversion) > 40 ? 'text-emerald-400' : 'text-amber-400'}`}>{conversion}%</span>
                      </TableCell>
                      <TableCell><Switch checked={ck.status} onCheckedChange={() => toggleStatus(ck.id, ck.status)} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(`https://pay.zaplynx.com/${ck.slug || ck.id}`); toast.success("Link copiado!"); }}><Copy className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteCheckout(ck.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}