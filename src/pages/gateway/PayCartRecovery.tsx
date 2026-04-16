import { useEffect, useState } from "react";
import { ShoppingCart, Loader2, Search, Mail, MessageCircle, Clock, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AbandonedCart {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number;
  status: string;
  created_at: string;
  metadata: any;
}

const formatCurrency = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
};

export default function PayCartRecovery() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Abandoned = pending or expired transactions older than 30min
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("gateway_transactions")
        .select("id, customer_name, customer_email, customer_phone, amount, status, created_at, metadata")
        .eq("user_id", user.id)
        .in("status", ["pending", "expired"])
        .lte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) toast.error("Erro ao carregar carrinhos");
      setCarts(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = carts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.customer_name?.toLowerCase().includes(q) ||
      c.customer_email?.toLowerCase().includes(q) ||
      c.customer_phone?.includes(q)
    );
  });

  const totalValue = filtered.reduce((s, c) => s + (c.amount || 0), 0);
  const withContact = filtered.filter((c) => c.customer_phone || c.customer_email).length;

  const sendRecoveryWhatsApp = (phone: string | null, name: string | null) => {
    if (!phone) { toast.error("Sem telefone"); return; }
    const clean = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá ${name || ""}! Notamos que você não finalizou sua compra. Posso te ajudar?`);
    window.open(`https://wa.me/${clean}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-6 h-6 text-[#FF4D2E]" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recuperação de Carrinhos</h1>
          <p className="text-xs text-muted-foreground">Carrinhos abandonados há mais de 30 minutos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground uppercase">Carrinhos Abandonados</span>
              <ShoppingCart className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground uppercase">Valor a Recuperar</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground uppercase">Com Contato</span>
              <MessageCircle className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold">{withContact}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Carrinhos Pendentes</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhum carrinho abandonado encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="border-border">
                    <TableCell className="font-medium">{c.customer_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.customer_phone || c.customer_email || "—"}
                    </TableCell>
                    <TableCell className="font-mono">{formatCurrency(c.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "expired" ? "destructive" : "secondary"} className="text-[10px]">
                        {c.status === "expired" ? "Expirado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(c.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => sendRecoveryWhatsApp(c.customer_phone, c.customer_name)}
                        disabled={!c.customer_phone}
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Recuperar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
