import { useState, useEffect } from "react";
import { Users, UserPlus, Search, DollarSign, TrendingUp, Loader2, Check, X, Shield, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AffiliateData {
  id: string;
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  product: {
    id: string;
    name: string;
  };
  affiliate: {
    id: string;
    email: string;
    full_name: string;
  };
}

export default function PayAffiliates() {
  const [affiliates, setAffiliates] = useState<AffiliateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchAffiliates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Primeiro pegamos os produtos do usuário
      const { data: products } = await supabase
        .from("gateway_products")
        .select("id")
        .eq("user_id", user.id);

      if (!products || products.length === 0) {
        setAffiliates([]);
        setLoading(false);
        return;
      }

      const productIds = products.map(p => p.id);

      // Agora pegamos as afiliações para esses produtos
      const { data, error } = await supabase
        .from("gateway_affiliates" as any)
        .select(`
          id,
          status,
          created_at,
          product:gateway_products (id, name),
          affiliate:profiles (id, email, full_name)
        `)
        .in("product_id", productIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAffiliates(data as any[] || []);
    } catch (error: any) {
      console.error("Error fetching affiliates:", error);
      toast.error("Erro ao carregar afiliados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from("gateway_affiliates" as any)
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(newStatus === 'approved' ? "Afiliação aprovada!" : "Afiliação recusada.");
      fetchAffiliates();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredAffiliates = affiliates.filter(aff => 
    aff.affiliate?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    aff.affiliate?.email?.toLowerCase().includes(search.toLowerCase()) ||
    aff.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingAffiliates = filteredAffiliates.filter(a => a.status === 'pending');
  const activeAffiliates = filteredAffiliates.filter(a => a.status === 'approved');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando seus parceiros...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Afiliados
          </h1>
          <p className="text-muted-foreground">
            Aprove solicitações e gerencie seus parceiros de vendas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Afiliados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAffiliates.length}</div>
            <p className="text-xs text-muted-foreground">Afiliados ativos atualmente</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Aguardando Aprovação</CardTitle>
            <ShieldAlert className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{pendingAffiliates.length}</div>
            <p className="text-xs text-yellow-600/80">Solicitações pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desempenho Geral</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">Volume total de vendas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              Ativos
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                {activeAffiliates.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              Solicitações
              {pendingAffiliates.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-yellow-600 hover:bg-yellow-600">
                  {pendingAffiliates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, e-mail ou produto..." 
              className="pl-10" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Data de Início</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAffiliates.length > 0 ? (
                  activeAffiliates.map((aff) => (
                    <TableRow key={aff.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{aff.affiliate?.full_name || "N/A"}</span>
                          <span className="text-xs text-muted-foreground">{aff.affiliate?.email || "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{aff.product?.name || "N/A"}</TableCell>
                      <TableCell>{new Date(aff.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleUpdateStatus(aff.id, 'rejected')}
                          disabled={processingId === aff.id}
                        >
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      Nenhum afiliado ativo encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidato</TableHead>
                  <TableHead>Produto Solicitado</TableHead>
                  <TableHead>Data da Solicitação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAffiliates.length > 0 ? (
                  pendingAffiliates.map((aff) => (
                    <TableRow key={aff.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{aff.affiliate?.full_name || "N/A"}</span>
                          <span className="text-xs text-muted-foreground">{aff.affiliate?.email || "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{aff.product?.name || "N/A"}</TableCell>
                      <TableCell>{new Date(aff.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => handleUpdateStatus(aff.id, 'approved')}
                            disabled={processingId === aff.id}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => handleUpdateStatus(aff.id, 'rejected')}
                            disabled={processingId === aff.id}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Recusar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      Nenhuma solicitação pendente no momento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}