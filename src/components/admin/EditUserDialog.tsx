import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserProfile } from "@/hooks/useAdminUsers";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Star, StarOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAdminZapiInstances, ZapiInstance } from "@/hooks/useZapiInstances";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

interface EditUserDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditUserDialog = ({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'pending' | 'expired' | 'cancelled'>(
    user?.subscription_status || 'pending'
  );
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(
    user?.subscription_expires_at ? new Date(user.subscription_expires_at) : undefined
  );

  // New instance form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApiProvider, setNewApiProvider] = useState<'zapi' | 'evolution'>('zapi');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceId, setNewInstanceId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newClientToken, setNewClientToken] = useState('');
  const [newEvolutionUrl, setNewEvolutionUrl] = useState('');
  const [newEvolutionKey, setNewEvolutionKey] = useState('');
  const [evolutionInstances, setEvolutionInstances] = useState<Array<{instanceName: string; status: string; apikey: string}>>([]);
  const [loadingEvoInstances, setLoadingEvoInstances] = useState(false);
  const [selectedEvoInstance, setSelectedEvoInstance] = useState('');

  const { instances, loading: instancesLoading, addInstance, updateInstance, deleteInstance, fetchUserInstances } = useAdminZapiInstances(user?.id);

  useEffect(() => {
    if (user) {
      setSubscriptionStatus(user.subscription_status);
      setExpiresAt(user.subscription_expires_at ? new Date(user.subscription_expires_at) : undefined);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_status: subscriptionStatus,
          subscription_expires_at: expiresAt?.toISOString() || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Usuário atualizado",
        description: "As informações do usuário foram atualizadas com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvolutionInstances = async () => {
    if (!newEvolutionUrl || !newEvolutionKey) {
      toast({ title: "Preencha URL e API Key primeiro", variant: "destructive" });
      return;
    }
    setLoadingEvoInstances(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke('fetch-evolution-instances', {
        body: { evolution_api_url: newEvolutionUrl, evolution_api_key: newEvolutionKey },
      });
      if (error) throw new Error(error.message || 'Erro ao buscar instâncias');
      if (responseData?.error) throw new Error(responseData.error);
      const data = responseData;
      const list = (Array.isArray(data) ? data : []).map((item: any) => ({
        instanceName: item?.instance?.instanceName || 'unknown',
        status: item?.instance?.status || 'unknown',
        apikey: item?.instance?.apikey || '',
      }));
      setEvolutionInstances(list);
      if (list.length === 0) {
        toast({ title: "Nenhuma instância encontrada no servidor", variant: "destructive" });
      } else {
        toast({ title: `✅ ${list.length} instância(s) encontrada(s)` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar instâncias", description: err.message, variant: "destructive" });
      setEvolutionInstances([]);
    } finally {
      setLoadingEvoInstances(false);
    }
  };

  const handleAddInstance = async () => {
    if (!user) return;

    if (newApiProvider === 'zapi') {
      if (!newInstanceId || !newToken || !newClientToken) {
        toast({ title: "Preencha todos os campos da Z-API", variant: "destructive" });
        return;
      }
    } else {
      if (!newEvolutionUrl || !newEvolutionKey || !selectedEvoInstance) {
        toast({ title: "Preencha URL, API Key e selecione uma instância", variant: "destructive" });
        return;
      }
    }

    const evoInstanceName = newApiProvider === 'evolution' ? selectedEvoInstance : '';
    const evoInstanceApiKey = newApiProvider === 'evolution'
      ? (evolutionInstances.find(i => i.instanceName === selectedEvoInstance)?.apikey || newEvolutionKey)
      : '';

    const success = await addInstance(user.id, {
      instance_name: newApiProvider === 'evolution' ? evoInstanceName : (newInstanceName || 'Nova Instância'),
      zapi_instance_id: newApiProvider === 'zapi' ? newInstanceId : evoInstanceName,
      zapi_token: newApiProvider === 'zapi' ? newToken : 'evolution',
      zapi_client_token: newApiProvider === 'zapi' ? newClientToken : 'evolution',
      api_provider: newApiProvider,
      evolution_api_url: newApiProvider === 'evolution' ? newEvolutionUrl : undefined,
      evolution_api_key: newApiProvider === 'evolution' ? evoInstanceApiKey : undefined,
    });

    if (success) {
      setShowAddForm(false);
      setNewApiProvider('zapi');
      setNewInstanceName('');
      setNewInstanceId('');
      setNewToken('');
      setNewClientToken('');
      setNewEvolutionUrl('');
      setNewEvolutionKey('');
      setEvolutionInstances([]);
      setSelectedEvoInstance('');
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Gerenciar assinatura e instâncias Z-API de {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subscription">Status da Assinatura</Label>
            <Select 
              value={subscriptionStatus} 
              onValueChange={(value) => setSubscriptionStatus(value as 'active' | 'pending' | 'expired' | 'cancelled')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo (Pago)</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de Expiração</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiresAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={setExpiresAt}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Instâncias WhatsApp */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Instâncias WhatsApp ({instances.length}/5)</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(!showAddForm)}
                disabled={instances.length >= 5}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>

            {/* Add form */}
            {showAddForm && (
              <Card className="mb-4">
                <CardContent className="pt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Provedor da API</Label>
                    <Select value={newApiProvider} onValueChange={(v) => setNewApiProvider(v as 'zapi' | 'evolution')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zapi">Z-API</SelectItem>
                        <SelectItem value="evolution">Evolution API</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value)}
                      placeholder="Ex: WhatsApp Vendas"
                    />
                  </div>

                  {newApiProvider === 'evolution' && (
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      💡 Preencha a URL e API Key (Global) do servidor Evolution, depois clique em "Buscar Instâncias" para selecionar.
                    </p>
                  )}

                  {newApiProvider === 'zapi' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Instance ID *</Label>
                        <Input
                          value={newInstanceId}
                          onChange={(e) => setNewInstanceId(e.target.value)}
                          placeholder="Ex: 3C12345678"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Token *</Label>
                        <Input
                          value={newToken}
                          onChange={(e) => setNewToken(e.target.value)}
                          placeholder="Token Z-API"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Client Token *</Label>
                        <Input
                          value={newClientToken}
                          onChange={(e) => setNewClientToken(e.target.value)}
                          placeholder="Client Token Z-API"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>URL da Evolution API *</Label>
                        <Input
                          value={newEvolutionUrl}
                          onChange={(e) => setNewEvolutionUrl(e.target.value)}
                          placeholder="http://seu-servidor:8080"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Key Global *</Label>
                        <Input
                          value={newEvolutionKey}
                          onChange={(e) => setNewEvolutionKey(e.target.value)}
                          placeholder="API Key global do servidor Evolution"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={fetchEvolutionInstances}
                        disabled={loadingEvoInstances || !newEvolutionUrl || !newEvolutionKey}
                        className="w-full"
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${loadingEvoInstances ? 'animate-spin' : ''}`} />
                        Buscar Instâncias do Servidor
                      </Button>
                      {evolutionInstances.length > 0 && (
                        <div className="space-y-2">
                          <Label>Selecionar Instância *</Label>
                          <Select value={selectedEvoInstance} onValueChange={setSelectedEvoInstance}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma instância" />
                            </SelectTrigger>
                            <SelectContent>
                              {evolutionInstances.map((inst) => (
                                <SelectItem key={inst.instanceName} value={inst.instanceName}>
                                  <div className="flex items-center gap-2">
                                    {inst.status === 'open' ? (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <XCircle className="w-3 h-3 text-red-500" />
                                    )}
                                    {inst.instanceName}
                                    <span className="text-xs text-muted-foreground">({inst.status})</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddInstance}>Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instances list */}
            {instances.length === 0 && !showAddForm && (
              <p className="text-sm text-muted-foreground">Nenhuma instância configurada.</p>
            )}

            <div className="space-y-2">
              {instances.map((inst) => (
                <Card key={inst.id} className={cn("border", inst.is_default && "border-primary")}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{inst.instance_name}</span>
                          {inst.is_default && <Badge variant="default" className="text-xs">Padrão</Badge>}
                          {!inst.is_active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                          <Badge variant="outline" className="text-xs">
                            {inst.api_provider === 'evolution' ? 'Evolution' : 'Z-API'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {inst.api_provider === 'evolution'
                            ? `URL: ${inst.evolution_api_url || '-'}`
                            : `ID: ${inst.zapi_instance_id}`
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!inst.is_default && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Definir como padrão"
                            onClick={() => updateInstance(inst.id, user.id, { is_default: true })}
                          >
                            <Star className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Remover instância"
                          onClick={() => {
                            if (confirm('Remover esta instância?')) {
                              deleteInstance(inst.id, user.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
