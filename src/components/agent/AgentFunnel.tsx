import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, User, Phone, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  phone: string;
  name: string | null;
  agent_stage?: string | null;
  updated_at?: string;
}

const STAGES = [
  { id: "triage", label: "Triagem", color: "bg-blue-500", icon: Users },
  { id: "service", label: "Atendimento", color: "bg-amber-500", icon: Calendar },
  { id: "closing", label: "Conclusão", color: "bg-emerald-500", icon: ArrowRight },
];

export const AgentFunnel = () => {
  const [counts, setCounts] = useState<Record<string, number>>({ triage: 0, service: 0, closing: 0 });
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const fetchCounts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("saved_contacts")
      .select("agent_stage")
      .eq("user_id", session.user.id);

    if (error) return;

    const newCounts: Record<string, number> = { triage: 0, service: 0, closing: 0 };
    data.forEach((contact: any) => {
      const stage = contact.agent_stage || "triage";
      if (newCounts[stage] !== undefined) {
        newCounts[stage]++;
      }
    });
    setCounts(newCounts);
  };

  const fetchLeadsForStage = async (stage: string) => {
    setLoadingLeads(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("saved_contacts")
      .select("id, phone, name, agent_stage, updated_at")
      .eq("user_id", session.user.id)
      .eq("agent_stage", stage)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setLeads(data);
    }
    setLoadingLeads(false);
  };

  useEffect(() => {
    fetchCounts();
    // Realtime subscription for updates
    const channel = supabase
      .channel("saved_contacts_stages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_contacts" },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedStage) {
      fetchLeadsForStage(selectedStage);
    }
  }, [selectedStage]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          return (
            <Card 
              key={stage.id} 
              className="cursor-pointer hover:border-primary/50 transition-all border-border/60 overflow-hidden relative group"
              onClick={() => setSelectedStage(stage.id)}
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${stage.color}`} />
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stage.label}
                </CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{counts[stage.id] || 0}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Leads nesta fase</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedStage} onOpenChange={(open) => !open && setSelectedStage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Leads em {STAGES.find(s => s.id === selectedStage)?.label}
              <Badge variant="outline">{leads.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {loadingLeads ? (
                <p className="text-center py-10 text-sm text-muted-foreground">Carregando leads...</p>
              ) : leads.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground">Nenhum lead nesta fase ainda.</p>
              ) : (
                leads.map((lead) => (
                  <div key={lead.id} className="p-3 rounded-lg border border-border/40 bg-muted/10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lead.name || "Sem Nome"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Última atualização</p>
                      <p className="text-[10px] font-medium">
                        {format(new Date(lead.updated_at || new Date()), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
