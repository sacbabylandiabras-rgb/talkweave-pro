import { Plus, Instagram, Trash2, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useInstagramAutomations } from "@/hooks/useInstagramAutomations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampanhasInstagram() {
  const navigate = useNavigate();
  const { automations, isLoading, updateAutomation, deleteAutomation } = useInstagramAutomations();

  if (isLoading) {
    return (
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Campanhas Instagram</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus fluxos de automação de comentários</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Campanhas Instagram</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie seus fluxos de automação de comentários</p>
        </div>
        <Button onClick={() => navigate("/instagram/automacao")} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Fluxo
        </Button>
      </div>

      {automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Instagram className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-base font-medium">Nenhum fluxo criado ainda</p>
          <p className="text-sm mt-1">Crie seu primeiro fluxo de automação para começar</p>
          <Button onClick={() => navigate("/instagram/automacao")} className="gap-2 mt-4">
            <Plus className="w-4 h-4" />
            Criar Primeiro Fluxo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(auto => (
            <Card key={auto.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{auto.name || "Sem nome"}</h3>
                      <Badge variant={auto.active ? "default" : "secondary"} className="text-[10px]">
                        {auto.active ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {auto.keyword.split(",").filter(Boolean).map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{kw.trim()}</Badge>
                      ))}
                    </div>
                    {auto.reply_comment && (
                      <p className="text-xs text-muted-foreground mt-2 truncate max-w-md">
                        💬 {auto.reply_comment}
                      </p>
                    )}
                    {auto.dm_message && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                        ✉️ {auto.dm_message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={auto.active}
                      onCheckedChange={(checked) => updateAutomation.mutate({ id: auto.id, active: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigate(`/instagram/automacao?id=${auto.id}`)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteAutomation.mutate(auto.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
