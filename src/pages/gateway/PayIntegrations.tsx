import { useState, useEffect } from "react";
import { Link2, CheckCircle, XCircle, Settings, ShoppingBag, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PayIntegrations() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    const { data, error } = await supabase.from("gateway_integrations").select("*").order("created_at", { ascending: false });
    if (!error && data) setIntegrations(data);
    setLoading(false);
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("gateway_integrations").update({ active: !active }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(active ? "Integração desativada" : "Integração ativada");
    fetchIntegrations();
  };

  const deleteIntegration = async (id: string) => {
    const { error } = await supabase.from("gateway_integrations").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Integração removida");
    fetchIntegrations();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground">Suas integrações do gateway ({integrations.length} cadastradas)</p>
        </div>
      </div>

      {integrations.length === 0 ? (
        <Card className="border-[#2A2A2A]">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada ainda.</p>
            <p className="text-xs text-muted-foreground">Vá em Gateway → Integrações para criar uma.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(int => (
            <Card key={int.id} className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{int.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">{int.method} • {int.webhook_url.slice(0, 30)}...</p>
                    </div>
                  </div>
                  {int.active ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]"><CheckCircle className="w-3 h-3 mr-1" /> Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]"><XCircle className="w-3 h-3 mr-1" /> Inativo</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {int.last_tested_at ? `Testado: ${new Date(int.last_tested_at).toLocaleDateString("pt-BR")}` : "Nunca testado"}
                  {int.last_test_status && ` — ${int.last_test_status}`}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => toggleActive(int.id, int.active)}>
                    {int.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => deleteIntegration(int.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}