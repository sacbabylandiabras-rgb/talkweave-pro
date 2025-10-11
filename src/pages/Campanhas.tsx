import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCampaigns } from "@/hooks/useCampaigns";
import { Play, Pause, Trash2, Copy, Users, Calendar, FileText, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Campanhas = () => {
  const { 
    campaigns, 
    loading, 
    pauseCampaign, 
    resumeCampaign, 
    deleteCampaign, 
    duplicateCampaign,
    getCampaignStats 
  } = useCampaigns();
  
  const [campaignStats, setCampaignStats] = useState<Record<string, any>>({});

  const loadStats = async (campaignId: string) => {
    const stats = await getCampaignStats(campaignId);
    setCampaignStats(prev => ({ ...prev, [campaignId]: stats }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativa</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500">Pausada</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Concluída</Badge>;
      case 'draft':
        return <Badge variant="outline">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handlePauseCampaign = async (id: string) => {
    await pauseCampaign(id);
  };

  const handleResumeCampaign = async (id: string) => {
    await resumeCampaign(id);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta campanha?")) {
      await deleteCampaign(id);
    }
  };

  const handleDuplicateCampaign = async (campaign: any) => {
    await duplicateCampaign(campaign);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando campanhas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
        <p className="text-muted-foreground">Gerencie suas campanhas de mensagens</p>
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma campanha criada ainda. Crie sua primeira campanha na página de Modelos!
              </p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {getStatusBadge(campaign.status)}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(campaign.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePauseCampaign(campaign.id)}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pausar
                      </Button>
                    ) : campaign.status === 'paused' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResumeCampaign(campaign.id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Retomar
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateCampaign(campaign)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaign.description && (
                  <p className="text-sm text-muted-foreground">{campaign.description}</p>
                )}

                {campaign.template && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Modelo: {campaign.template.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {campaign.template.content}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadStats(campaign.id)}
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Ver Estatísticas
                  </Button>
                </div>

                {campaignStats[campaign.id] && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 bg-muted/30 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{campaignStats[campaign.id].total}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{campaignStats[campaign.id].pending}</div>
                      <div className="text-xs text-muted-foreground">Pendentes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{campaignStats[campaign.id].sent}</div>
                      <div className="text-xs text-muted-foreground">Enviadas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{campaignStats[campaign.id].delivered}</div>
                      <div className="text-xs text-muted-foreground">Entregues</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{campaignStats[campaign.id].failed}</div>
                      <div className="text-xs text-muted-foreground">Falhas</div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>Tipo: {campaign.schedule_type === 'immediate' ? 'Imediato' : campaign.schedule_type === 'scheduled' ? 'Agendado' : 'Recorrente'}</span>
                  {campaign.scheduled_at && (
                    <>
                      <span>•</span>
                      <span>Agendado para: {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Campanhas;
