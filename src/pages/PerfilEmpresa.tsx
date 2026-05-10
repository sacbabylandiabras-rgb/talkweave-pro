import { useEffect, useState } from "react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Mail, MapPin, Globe, Clock, LayoutGrid, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BusinessProfile {
  description?: string;
  address?: string;
  email?: string;
  websites?: string[];
  categories?: { id: string; label: string }[];
  businessHours?: any;
}

const PerfilEmpresa = () => {
  const { instances, loading: loadingInstances } = useZapiInstances();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    if (selectedInstanceId) {
      fetchProfile(selectedInstanceId);
    }
  }, [selectedInstanceId]);

  const fetchProfile = async (instanceId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: "business-profile", instanceDbId: instanceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error?.message || data.error);
      
      setProfile(data?.data || null);
    } catch (err: any) {
      console.error("Erro ao buscar perfil:", err);
      toast({
        title: "Erro ao carregar perfil",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingInstances) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Perfil de Negócios</h1>
          <p className="text-muted-foreground">Visualize as informações comerciais configuradas no WhatsApp Business.</p>
        </div>
        
        <div className="flex items-center gap-2 min-w-[250px]">
          <Label className="whitespace-nowrap">Instância:</Label>
          <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma instância" />
            </SelectTrigger>
            <SelectContent>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.instance_name || inst.zapi_instance_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => fetchProfile(selectedInstanceId)} 
            disabled={loading || !selectedInstanceId}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : profile ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações Básicas */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Sobre a Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="text-sm leading-relaxed">{profile.description || "Sem descrição definida"}</p>
              </div>
              
              <div className="flex items-start gap-2 pt-2">
                <LayoutGrid className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Categorias</Label>
                  <div className="flex flex-wrap gap-1">
                    {profile.categories && profile.categories.length > 0 ? (
                      profile.categories.map((cat: any) => (
                        <Badge key={cat.id || cat.label} variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
                          {cat.label || cat.id}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm italic">Nenhuma categoria</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contato e Endereço */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Contato e Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <p className="text-sm">{profile.email || "Não informado"}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Endereço</Label>
                  <p className="text-sm">{profile.address || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Websites</Label>
                  {profile.websites && profile.websites.length > 0 ? (
                    <div className="space-y-1">
                      {profile.websites.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url.startsWith('http') ? url : `https://${url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline block break-all"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm">Não informado</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horários */}
          <Card className="md:col-span-2 border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Horário de Funcionamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.businessHours ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Simplified display for now as businessHours structure can vary */}
                  <div className="col-span-full">
                    <p className="text-sm font-medium">
                      {profile.businessHours.mode === 'open24h' ? 'Aberto 24 horas' : 
                       profile.businessHours.mode === 'appointmentOnly' ? 'Apenas com hora marcada' : 
                       'Horário específico'}
                    </p>
                  </div>
                  {profile.businessHours.days && profile.businessHours.days.map((day: any) => (
                    <div key={day.dayOfWeek} className="p-3 rounded-md bg-muted/40 border border-border/30">
                      <p className="text-xs font-bold uppercase text-muted-foreground tracking-tighter mb-1">{day.dayOfWeek}</p>
                      <p className="text-sm font-mono">{day.openTime} - {day.closeTime}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">Nenhum horário configurado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-xl font-semibold mb-1">Nenhum dado encontrado</h2>
          <p className="text-muted-foreground max-w-xs">Não foi possível carregar as informações desta instância.</p>
        </div>
      )}
    </div>
  );
};

export default PerfilEmpresa;