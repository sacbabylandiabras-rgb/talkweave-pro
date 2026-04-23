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

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newInstanceId, setNewInstanceId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newClientToken, setNewClientToken] = useState('');
  const [newProvider, setNewProvider] = useState<'zapi' | 'uazapi'>('uazapi');
  const [newUazapiUrl, setNewUazapiUrl] = useState('');
  const [newUazapiToken, setNewUazapiToken] = useState('');

  // Uazapi credentials
  const [uazapiUrl, setUazapiUrl] = useState('');
  const [uazapiToken, setUazapiToken] = useState('');
  const [uazapiSaving, setUazapiSaving] = useState(false);

  const { instances, loading: instancesLoading, addInstance, updateInstance, deleteInstance } = useAdminZapiInstances(user?.id);

  useEffect(() => {
    if (user) {
      setSubscriptionStatus(user.subscription_status);
      setExpiresAt(user.subscription_expires_at ? new Date(user.subscription_expires_at) : undefined);
      // Load uazapi credentials
      if (user.id) {
        supabase.from("profiles").select("uazapi_url, uazapi_token").eq("id", user.id).single().then(({ data }) => {
          setUazapiUrl((data as any)?.uazapi_url || '');
          setUazapiToken((data as any)?.uazapi_token || '');
        });
      }
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

  const handleSaveUazapi = async () => {
    if (!user) return;
    setUazapiSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        uazapi_url: uazapiUrl.trim() || null,
        uazapi_token: uazapiToken.trim() || null,
      } as any).eq("id", user.id);
      if (error) throw error;
      toast({ title: "Credenciais salvas", description: "O usuário poderá extrair membros de comunidades." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setUazapiSaving(false);
    }
  };

  const resetInstanceForm = () => {
    setEditingInstanceId(null);
    setShowAddForm(false);
    setNewInstanceName('');
    setNewInstanceId('');
    setNewToken('');
    setNewClientToken('');
    setNewProvider('uazapi');
    setNewUazapiUrl('');
    setNewUazapiToken('');
  };

  const handleEditInstance = (instance: typeof instances[number]) => {
    setEditingInstanceId(instance.id);
    setShowAddForm(true);
    setNewInstanceName(instance.instance_name || '');
    setNewInstanceId(instance.zapi_instance_id || '');
    setNewToken(instance.zapi_token || '');
    setNewClientToken(instance.zapi_client_token || '');
    setNewProvider('uazapi');
    setNewUazapiUrl((instance as any).evolution_api_url || '');
    setNewUazapiToken((instance as any).evolution_api_key || '');
  };

  const handleAddInstance = async () => {
    if (!user) return;

    if (newProvider === 'zapi') {
      if (!newInstanceId || !newToken || !newClientToken) {
        toast({ title: "Preencha todos os campos da instância Z-API", variant: "destructive" });
        return;
      }
    } else {
      if (!newUazapiUrl.trim() || !newUazapiToken.trim()) {
        toast({ title: "Preencha URL e Token da UAZAPI", variant: "destructive" });
        return;
      }
    }

    const payload = {
      instance_name: newInstanceName || 'Nova Instância',
      api_provider: newProvider,
      // Z-API fields (kept for backward compat; for uazapi use token as identifier)
      zapi_instance_id: newProvider === 'zapi' ? newInstanceId : newUazapiToken.trim().substring(0, 32),
      zapi_token: newProvider === 'zapi' ? newToken : newUazapiToken.trim(),
      zapi_client_token: newProvider === 'zapi' ? newClientToken : 'uazapi',
      // UAZAPI fields stored in evolution_* columns
      evolution_api_url: newProvider === 'uazapi' ? newUazapiUrl.trim() : null,
      evolution_api_key: newProvider === 'uazapi' ? newUazapiToken.trim() : null,
    };

    const success = editingInstanceId
      ? await updateInstance(editingInstanceId, user.id, payload)
      : await addInstance(user.id, payload);

    if (success) {
      resetInstanceForm();
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
                <h3 className="font-semibold">Instâncias WhatsApp ({instances.length}/20)</h3>
                <Button size="sm" variant="outline" onClick={() => {
                  if (showAddForm) {
                    resetInstanceForm();
                    return;
                  }
                  setEditingInstanceId(null);
                  setShowAddForm(true);
                }} disabled={instances.length >= 20 && !editingInstanceId}>
                <Plus className="w-3 h-3 mr-1" /> {editingInstanceId ? 'Editando' : 'Adicionar'}
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
                    <Label>Provedor *</Label>
                    <Select value={newProvider} onValueChange={(v) => setNewProvider(v as 'zapi' | 'uazapi')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zapi">Z-API</SelectItem>
                        <SelectItem value="uazapi">UAZAPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newProvider === 'zapi' ? (
                    <>
                      <div className="space-y-2">
                        <Label>Instance ID *</Label>
                        <Input value={newInstanceId} onChange={(e) => setNewInstanceId(e.target.value)} placeholder="Ex: 3C12345678" />
                      </div>
                      <div className="space-y-2">
                        <Label>Token *</Label>
                        <Input value={newToken} onChange={(e) => setNewToken(e.target.value)} placeholder="Token da instância" />
                      </div>
                      <div className="space-y-2">
                        <Label>Client Token *</Label>
                        <Input value={newClientToken} onChange={(e) => setNewClientToken(e.target.value)} placeholder="Client Token" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>URL da API *</Label>
                        <Input value={newUazapiUrl} onChange={(e) => setNewUazapiUrl(e.target.value)} placeholder="https://seudominio.uazapi.com" type="url" />
                      </div>
                      <div className="space-y-2">
                        <Label>Token da Instância *</Label>
                        <Input value={newUazapiToken} onChange={(e) => setNewUazapiToken(e.target.value)} placeholder="Token da instância UAZAPI" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Consulte a documentação em{" "}
                        <a href="https://docs.uazapi.com/" target="_blank" rel="noreferrer" className="underline text-primary">
                          docs.uazapi.com
                        </a>
                      </p>
                    </>
                  )}

                  <div className="flex gap-2">
                     <Button size="sm" onClick={handleAddInstance}>{editingInstanceId ? 'Atualizar' : 'Salvar'}</Button>
                     <Button size="sm" variant="outline" onClick={resetInstanceForm}>Cancelar</Button>
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
                          <Badge variant="outline" className="text-xs uppercase">
                            {inst.api_provider === 'uazapi' ? 'UAZAPI' : 'Z-API'}
                          </Badge>
                          {inst.is_default && <Badge variant="default" className="text-xs">Padrão</Badge>}
                          {!inst.is_active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {inst.api_provider === 'uazapi'
                            ? `URL: ${(inst as any).evolution_api_url || '—'}`
                            : `ID: ${inst.zapi_instance_id}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" title="Editar instância" onClick={() => handleEditInstance(inst)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
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

          {/* Uazapi Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Extração de Comunidades</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>URL da API</Label>
                <Input value={uazapiUrl} onChange={(e) => setUazapiUrl(e.target.value)} placeholder="https://seudominio.com" type="url" />
              </div>
              <div className="space-y-2">
                <Label>Token da Instância</Label>
                <Input value={uazapiToken} onChange={(e) => setUazapiToken(e.target.value)} placeholder="Token da instância" type="password" />
              </div>
              <Button size="sm" onClick={handleSaveUazapi} disabled={uazapiSaving}>
                {uazapiSaving ? "Salvando..." : "Salvar Credenciais"}
              </Button>
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