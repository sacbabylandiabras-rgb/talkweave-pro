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
import { CalendarIcon, Plus, Trash2, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAdminZapiInstances } from "@/hooks/useZapiInstances";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceId, setNewInstanceId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newClientToken, setNewClientToken] = useState('');

  const { instances, loading: instancesLoading, addInstance, updateInstance, deleteInstance } = useAdminZapiInstances(user?.id);

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
      const { error } = await supabase.from("profiles").update({
        subscription_status: subscriptionStatus,
        subscription_expires_at: expiresAt?.toISOString() || null,
      }).eq("id", user.id);
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

  const handleAddInstance = async () => {
    if (!user) return;
    if (!newInstanceId || !newToken || !newClientToken) {
      toast({ title: "Preencha todos os campos da Z-API", variant: "destructive" });
      return;
    }

    const success = await addInstance(user.id, {
      instance_name: newInstanceName || 'Nova Instância',
      zapi_instance_id: newInstanceId,
      zapi_token: newToken,
      zapi_client_token: newClientToken,
    });

    if (success) {
      setShowAddForm(false);
      setNewInstanceName('');
      setNewInstanceId('');
      setNewToken('');
      setNewClientToken('');
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>Gerenciar assinatura e instâncias Z-API de {user.email}</DialogDescription>
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
              <h3 className="font-semibold">Instâncias Z-API ({instances.length}/5)</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)} disabled={instances.length >= 5}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>

            {showAddForm && (
              <Card className="mb-4">
                <CardContent className="pt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)} placeholder="Ex: WhatsApp Vendas" />
                  </div>
                  <div className="space-y-2">
                    <Label>Instance ID *</Label>
                    <Input value={newInstanceId} onChange={(e) => setNewInstanceId(e.target.value)} placeholder="Ex: 3C12345678" />
                  </div>
                  <div className="space-y-2">
                    <Label>Token *</Label>
                    <Input value={newToken} onChange={(e) => setNewToken(e.target.value)} placeholder="Token Z-API" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Token *</Label>
                    <Input value={newClientToken} onChange={(e) => setNewClientToken(e.target.value)} placeholder="Client Token Z-API" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddInstance}>Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">ID: {inst.zapi_instance_id}</p>
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