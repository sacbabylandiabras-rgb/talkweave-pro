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
import { CalendarIcon, Plus, Trash2, Star, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAdminZapiInstances } from "@/hooks/useZapiInstances";
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

  const { instances, loading: instancesLoading, addInstance, updateInstance, deleteInstance } = useAdminZapiInstances(user?.id);

  // Add instance form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingInstance, setAddingInstance] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceId, setNewInstanceId] = useState('');
  const [newInstanceToken, setNewInstanceToken] = useState('');
  const [newClientToken, setNewClientToken] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
   const [newProvider, setNewProvider] = useState<'zapi' | 'uazapi'>('zapi');
   const [newEvolutionUrl, setNewEvolutionUrl] = useState('');
   const [newEvolutionKey, setNewEvolutionKey] = useState('');
  const [newInstanceType, setNewInstanceType] = useState<'web' | 'mobile'>('web');

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
      const { error } = await supabase.from("profiles").update({
        subscription_status: subscriptionStatus,
        subscription_expires_at: expiresAt?.toISOString() || null,
        max_instances: Number.isFinite(maxInstances) && maxInstances >= 0 ? maxInstances : 1,
        plan_id: (planId === 'none' || planId === 'custom') ? null : planId,
        custom_plan_value:
          planId === 'custom' && customPlanValue
            ? Math.round(parseFloat(customPlanValue.replace(',', '.')) * 100)
            : null,
      } as any).eq("id", user.id);
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
  };

   const handleAddInstance = async () => {
     if (!user) return;
    if (newProvider === 'zapi') {
      if (!newInstanceName.trim() || !newInstanceId.trim() || !newInstanceToken.trim() || !newClientToken.trim()) {
        toast({ title: "Campos obrigatórios", description: "Preencha todos os campos da instância Z-API.", variant: "destructive" });
        return;
      }
    } else {
      if (!newInstanceName.trim() || !newEvolutionUrl.trim() || !newEvolutionKey.trim()) {
        toast({ title: "Campos obrigatórios", description: "Preencha nome, URL e API Key para UAZAPI.", variant: "destructive" });
        return;
      }
    }
     setAddingInstance(true);
     const ok = await addInstance(user.id, {
       instance_name: newInstanceName.trim(),
       zapi_instance_id: newProvider === 'zapi' ? newInstanceId.trim() : '',
       zapi_token: newProvider === 'zapi' ? newInstanceToken.trim() : '',
       zapi_client_token: newProvider === 'zapi' ? newClientToken.trim() : '',
       evolution_api_url: newProvider === 'uazapi' ? newEvolutionUrl.trim() : '',
       evolution_api_key: newProvider === 'uazapi' ? newEvolutionKey.trim() : '',
       is_default: newIsDefault,
       api_provider: newProvider,
       instance_type: newInstanceType,
     });
     setAddingInstance(false);
     if (ok) {
       resetAddForm();
       setShowAddForm(false);
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
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Instâncias WhatsApp ({instances.length}/{maxInstances})</h3>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm((v) => !v)}>
                  <Plus className="w-3 h-3 mr-1" />
                  {showAddForm ? "Fechar" : "Adicionar Instância"}
                </Button>
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="max-instances">Limite de instâncias permitidas</Label>
              <Input
                id="max-instances"
                type="number"
                min={0}
                max={20}
                value={maxInstances}
                onChange={(e) => setMaxInstances(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              />
              <p className="text-xs text-muted-foreground">
                Define quantas instâncias este usuário pode criar (0 a 20). Aplicado ao salvar.
              </p>
            </div>

            {instances.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma instância configurada.</p>
            )}

            {showAddForm && (
              <Card className="mb-3 border-primary/40">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <h4 className="font-medium text-sm">Nova instância</h4>
                  <div className="space-y-2">
                    <Label>Tipo de instância</Label>
                    <Select value={newInstanceType} onValueChange={(v) => setNewInstanceType(v as 'web' | 'mobile')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="web">Web (QR Code)</SelectItem>
                        <SelectItem value="mobile">Mobile (Emulador — conectar número)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Use "Mobile" para instâncias dedicadas ao Emulador Mobile (registro por número).
                    </p>
                  </div>
                   <div className="space-y-2">
                     <Label>Nome da instância</Label>
                     <Input value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} placeholder="Ex: Atendimento" />
                   </div>
                   <div className="space-y-2">
                     <Label>Instance ID</Label>
                     <Input value={newInstanceId} onChange={(e) => setNewInstanceId(e.target.value)} placeholder="ID da instância Z-API" />
                   </div>
                   <div className="space-y-2">
                     <Label>Instance Token</Label>
                     <Input value={newInstanceToken} onChange={(e) => setNewInstanceToken(e.target.value)} placeholder="Token da instância" type="password" />
                   </div>
                   <div className="space-y-2">
                     <Label>Client Token (Account Security)</Label>
                     <Input value={newClientToken} onChange={(e) => setNewClientToken(e.target.value)} placeholder="Client Token" type="password" />
                   </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={newIsDefault} onChange={(e) => setNewIsDefault(e.target.checked)} />
                    Definir como padrão
                  </label>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => { resetAddForm(); setShowAddForm(false); }}>Cancelar</Button>
                    <Button size="sm" onClick={handleAddInstance} disabled={addingInstance}>
                      {addingInstance ? "Adicionando..." : "Adicionar instância"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {instances.map((inst) => (
                <Card key={inst.id} className={cn("border", inst.is_default && "border-primary")}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{inst.instance_name}</span>
                           <Badge variant="outline" className="text-xs uppercase">Z-API</Badge>
                          <Badge variant="outline" className="text-xs uppercase">
                            {(inst as any).instance_type === 'mobile' ? 'Mobile' : 'Web'}
                          </Badge>
                          {inst.is_default && <Badge variant="default" className="text-xs">Padrão</Badge>}
                          {!inst.is_active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                        </div>
                         <p className="text-xs text-muted-foreground mt-1 truncate">ID: {inst.zapi_instance_id}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!inst.is_default && (
                          <Button size="sm" variant="ghost" title="Definir como padrão" onClick={() => updateInstance(inst.id, user.id, { is_default: true })}>
                            <Star className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" title="Remover instância" onClick={() => {
                          if (confirm('Remover esta instância?')) deleteInstance(inst.id, user.id);
                        }}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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