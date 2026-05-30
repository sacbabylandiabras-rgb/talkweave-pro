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
import { CalendarIcon, Plus, Trash2, Star, Pencil, Smartphone, Flame, UserPlus, ArrowRightLeft, Gift } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
 import { isMobileZapiInstance, useAdminZapiInstances, ZapiInstance } from "@/hooks/useZapiInstances";
 import { useAdminWebInstances } from "@/hooks/useAdminWebInstances";
 
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe } from "lucide-react";

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

  const [maxInstances, setMaxInstances] = useState<number>(1);

  // Plans
  const [plans, setPlans] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [planId, setPlanId] = useState<string>('none');
  const [customPlanValue, setCustomPlanValue] = useState<string>('');

   const { 
     instances, 
     loading: instancesLoading, 
     addInstance, 
     updateInstance, 
     deleteInstance,
     fetchUserInstances
   } = useAdminZapiInstances(user?.id);
 
 

   const {
     addWebInstance,
     addingWeb
   } = useAdminWebInstances(user?.id, instances, () => user?.id && fetchUserInstances(user.id));

  // Add instance form
    const [showAddForm, setShowAddForm] = useState<'zapi' | 'uazapi' | null>(null);
  const [addingInstance, setAddingInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceId, setNewInstanceId] = useState('');
  const [newInstanceToken, setNewInstanceToken] = useState('');
  const [newClientToken, setNewClientToken] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
   const [newProvider, setNewProvider] = useState<'zapi' | 'uazapi'>('zapi');
   const [newEvolutionUrl, setNewEvolutionUrl] = useState('');
   const [newEvolutionKey, setNewEvolutionKey] = useState('');
     const [newInstanceType, setNewInstanceType] = useState<'web'>('web');
     const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setSubscriptionStatus(user.subscription_status);
      setExpiresAt(user.subscription_expires_at ? new Date(user.subscription_expires_at) : undefined);
      setPlanId(user.plan_id || (user.custom_plan_value ? 'custom' : 'none'));
      setCustomPlanValue(
        user.custom_plan_value != null ? (user.custom_plan_value / 100).toFixed(2) : ''
      );
       // Load max instances
       if (user.id) {
         supabase.from("profiles").select("max_instances").eq("id", user.id).single().then(({ data }) => {
           setMaxInstances(Number((data as any)?.max_instances ?? 1));
         });
       }
    }
  }, [user]);

  useEffect(() => {
    (supabase as any).from('subscription_plans').select('id, name, price').eq('active', true).order('price').then(({ data }: any) => {
      setPlans(data || []);
    });
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-update-profile", {
        body: {
          userId: user.id,
          patch: {
            subscription_status: subscriptionStatus,
            subscription_expires_at: expiresAt?.toISOString() || null,
            max_instances: Number.isFinite(maxInstances) && maxInstances >= 0 ? maxInstances : 1,
            plan_id: (planId === 'none' || planId === 'custom') ? null : planId,
            custom_plan_value:
              planId === 'custom' && customPlanValue
                ? Math.round(parseFloat(customPlanValue.replace(',', '.')) * 100)
                : null,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Usuário atualizado", description: "As informações do usuário foram atualizadas com sucesso." });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

   const resetAddForm = () => {
     setNewInstanceName('');
     setNewInstanceId('');
     setNewInstanceToken('');
     setNewClientToken('');
     setNewIsDefault(false);
     setNewProvider('zapi');
     setNewEvolutionUrl('');
     setNewEvolutionKey('');
     setNewInstanceType('web');
     setEditingInstanceId(null);
   };

   const handleEditClick = (inst: ZapiInstance) => {
     setNewInstanceName(inst.instance_name || '');
     setNewInstanceId(inst.zapi_instance_id || '');
     setNewInstanceToken(inst.zapi_token || '');
     setNewClientToken(inst.zapi_client_token || '');
     setNewIsDefault(inst.is_default || false);
     setNewProvider(inst.api_provider as any || 'zapi');
     setNewEvolutionUrl((inst as any).evolution_api_url || '');
     setNewEvolutionKey((inst as any).evolution_api_key || '');
     setEditingInstanceId(inst.id);
     setShowAddForm(inst.api_provider as any || 'zapi');
   };

        const handleAddZapiInstance = async (type: 'web', provider: 'zapi' | 'uazapi' = 'zapi') => {
         if (!user) return;
         if (provider === 'zapi') {
           if (!newInstanceName.trim() || !newInstanceId.trim() || !newInstanceToken.trim() || !newClientToken.trim()) {
             toast({ title: "Campos obrigatórios", description: "Preencha todos os campos da instância Z-API.", variant: "destructive" });
             return;
           }
         } else if (provider === 'uazapi') {
           if (!newInstanceName.trim() || !newEvolutionUrl.trim() || !newEvolutionKey.trim()) {
             toast({ title: "Campos obrigatórios", description: "Preencha nome, URL e API Key.", variant: "destructive" });
             return;
           }
         }
   
         let ok = false;
         if (editingInstanceId) {
           ok = await updateInstance(editingInstanceId, user.id, {
             instance_name: newInstanceName.trim(),
             zapi_instance_id: provider === 'zapi' ? newInstanceId.trim() : `uazapi-${Date.now()}`,
             zapi_token: provider === 'zapi' ? newInstanceToken.trim() : null,
             zapi_client_token: provider === 'zapi' ? newClientToken.trim() : null,
             evolution_api_url: provider === 'uazapi' ? newEvolutionUrl.trim() : null,
             evolution_api_key: provider === 'uazapi' ? newEvolutionKey.trim() : null,
             is_default: newIsDefault,
             instance_type: type,
             api_provider: provider as any
           });
         } else {
           ok = await addInstance(user.id, {
             instance_name: newInstanceName.trim(),
             zapi_instance_id: provider === 'zapi' ? newInstanceId.trim() : `uazapi-${Date.now()}`,
             zapi_token: provider === 'zapi' ? newInstanceToken.trim() : null,
             zapi_client_token: provider === 'zapi' ? newClientToken.trim() : null,
             evolution_api_url: provider === 'uazapi' ? newEvolutionUrl.trim() : null,
             evolution_api_key: provider === 'uazapi' ? newEvolutionKey.trim() : null,
             is_default: newIsDefault,
             instance_type: type,
             api_provider: provider as any
           });
         }
         
         if (ok) {
           resetAddForm();
           setShowAddForm(null);
         }
       };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>Gerenciar assinatura e instâncias de {user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subscription">Status da Assinatura</Label>
            <Select value={subscriptionStatus} onValueChange={(value) => setSubscriptionStatus(value as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo (Pago)</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plano contratado</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem plano</SelectItem>
                {plans.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — R$ {(p.price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Plano personalizado</SelectItem>
              </SelectContent>
            </Select>
            {planId === 'custom' && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="custom-value">Valor do plano personalizado (R$)</Label>
                <Input
                  id="custom-value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 199.90"
                  value={customPlanValue}
                  onChange={(e) => setCustomPlanValue(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data de Expiração</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiresAt && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiresAt ? format(expiresAt, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={expiresAt} onSelect={setExpiresAt} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground">
              A assinatura expira automaticamente nesta data — o acesso do usuário será bloqueado.
            </p>
          </div>

          {/* Teste Grátis */}
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-emerald-400">
                    <Gift className="w-4 h-4" />
                    Teste Grátis
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Libera acesso completo por <strong>2 dias</strong>. Após esse período, a assinatura
                    expira automaticamente e o acesso é bloqueado.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    setSubscriptionStatus('active');
                    setPlanId('none');
                    setCustomPlanValue('');
                    setExpiresAt(d);
                  }}
                >
                  <Gift className="w-3 h-3 mr-1" />
                  Ativar 2 dias grátis
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="border-t pt-4 mt-4 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="max-instances">Limite de instâncias Z-API Web</Label>
              <Input
                id="max-instances"
                type="number"
                min={0}
                max={20}
                value={maxInstances}
                onChange={(e) => setMaxInstances(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              />
              <p className="text-xs text-muted-foreground">
                Define quantas instâncias de uso (Web) este usuário pode ter. Outros tipos não possuem limite.
              </p>
            </div>


             <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="font-semibold text-emerald-500 flex items-center gap-2">
                   <Globe className="w-4 h-4" />
                   Instâncias de Uso (Web)
                 </h3>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setNewProvider('zapi');
                      setShowAddForm(showAddForm === 'zapi' ? null : 'zapi');
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {showAddForm === 'zapi' ? "Fechar" : "Adicionar Z-API"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="ml-2"
                    onClick={() => {
                      setNewProvider('uazapi');
                      setShowAddForm(showAddForm === 'uazapi' ? null : 'uazapi');
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {showAddForm === 'uazapi' ? "Fechar" : "Adicionar Extrair Membro"}
                  </Button>
               </div>
 
                {showAddForm === 'zapi' && (
                  <Card className="border-emerald-500/40">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <DialogDescription className="text-xs font-semibold uppercase text-emerald-500">
                        {editingInstanceId ? "Editar Instância Z-API" : "Nova Instância Z-API"}
                      </DialogDescription>
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-2">
                         <Label>Nome</Label>
                         <Input value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} placeholder="Ex: Instância 01" />
                       </div>
                       <div className="space-y-2">
                         <Label>Tipo</Label>
                         <Input value="Web (QR Code)" disabled className="bg-muted" />
                       </div>
                     </div>
                     <div className="space-y-2">
                       <Label>Instance ID</Label>
                       <Input value={newInstanceId} onChange={(e) => setNewInstanceId(e.target.value)} placeholder="ID Z-API" />
                     </div>
                     <div className="space-y-2">
                       <Label>Instance Token</Label>
                       <Input value={newInstanceToken} onChange={(e) => setNewInstanceToken(e.target.value)} placeholder="Token" type="password" />
                     </div>
                     <div className="space-y-2">
                       <Label>Client Token</Label>
                       <Input value={newClientToken} onChange={(e) => setNewClientToken(e.target.value)} placeholder="Client Token" type="password" />
                     </div>
                       <div className="flex gap-2 justify-end pt-2">
                         <Button size="sm" variant="ghost" onClick={() => { resetAddForm(); setShowAddForm(null); }}>Cancelar</Button>
                            <Button size="sm" onClick={() => handleAddZapiInstance('web', 'zapi')} disabled={instancesLoading}>
                              {instancesLoading ? "Salvando..." : editingInstanceId ? "Salvar Alterações" : "Salvar Z-API"}
                            </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showAddForm === 'uazapi' && (
                  <Card className="border-emerald-500/40">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <DialogDescription className="text-xs font-semibold uppercase text-emerald-500">
                        {editingInstanceId ? "Editar Instância" : "Nova Instância (Extrair Membros)"}
                      </DialogDescription>
                     <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-2">
                         <Label>Nome</Label>
                         <Input value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} placeholder="Ex: Uazapi 01" />
                       </div>
                        <div className="space-y-2">
                          <Label>Finalidade</Label>
                          <Input value="Extrair Membros" disabled className="bg-muted" />
                        </div>
                     </div>
                     <div className="space-y-2">
                       <Label>API URL</Label>
                       <Input value={newEvolutionUrl} onChange={(e) => setNewEvolutionUrl(e.target.value)} placeholder="https://api..." />
                     </div>
                     <div className="space-y-2">
                       <Label>API Key / Token</Label>
                       <Input value={newEvolutionKey} onChange={(e) => setNewEvolutionKey(e.target.value)} placeholder="Key" type="password" />
                     </div>
                       <div className="flex gap-2 justify-end pt-2">
                         <Button size="sm" variant="ghost" onClick={() => { resetAddForm(); setShowAddForm(null); }}>Cancelar</Button>
                            <Button size="sm" onClick={() => handleAddZapiInstance('web', 'uazapi')} disabled={instancesLoading}>
                              {instancesLoading ? "Salvando..." : editingInstanceId ? "Salvar Alterações" : "Salvar Configuração"}
                            </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
 
               <div className="space-y-2">
                  {instances.filter(i => ['zapi', 'uazapi'].includes((i.api_provider || 'zapi').toLowerCase()) && (i.instance_type === 'web' || !i.instance_type) && !isMobileZapiInstance(i)).map((inst) => {
                    const provider = (inst.api_provider || 'zapi').toLowerCase();
                    const isExtrairMembro = provider === 'uazapi';
                    return (
                   <Card key={inst.id} className={cn("border", inst.is_default && "border-emerald-500")}>
                     <CardContent className="pt-3 pb-3 flex items-center justify-between">
                       <div className="min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="font-medium text-sm block truncate">{inst.instance_name}</span>
                           {inst.is_default && <Badge variant="default" className="bg-emerald-500 text-[10px] h-4">Padrão</Badge>}
                           {isExtrairMembro && <Badge variant="outline" className="text-[10px] h-4 border-emerald-500/50 text-emerald-500">Extrair Membro</Badge>}
                         </div>
                         <p className="text-xs text-muted-foreground truncate">ID: {inst.zapi_instance_id}</p>
                       </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" title="Editar dados" onClick={() => handleEditClick(inst)}>
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </Button>
                          {!inst.is_default && !isExtrairMembro && (
                           <Button size="sm" variant="ghost" title="Tornar padrão" onClick={() => updateInstance(inst.id, user.id, { is_default: true })}>
                             <Star className="w-3 h-3" />
                           </Button>
                         )}
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm('Remover instância?')) deleteInstance(inst.id, user.id, inst.zapi_instance_id); }}>
                           <Trash2 className="w-3 h-3 text-destructive" />
                         </Button>
                       </div>
                     </CardContent>
                   </Card>
                    );
                  })}
               </div>
              </div>
            </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};