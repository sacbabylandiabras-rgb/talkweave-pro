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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  const [zapiInstanceId, setZapiInstanceId] = useState(user?.zapi_instance_id || '');
  const [zapiToken, setZapiToken] = useState(user?.zapi_token || '');
  const [zapiClientToken, setZapiClientToken] = useState(user?.zapi_client_token || '');

  // Atualizar estados quando o usuário mudar
  useEffect(() => {
    if (user) {
      setSubscriptionStatus(user.subscription_status);
      setExpiresAt(user.subscription_expires_at ? new Date(user.subscription_expires_at) : undefined);
      setZapiInstanceId(user.zapi_instance_id || '');
      setZapiToken(user.zapi_token || '');
      setZapiClientToken(user.zapi_client_token || '');
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
          zapi_instance_id: zapiInstanceId || null,
          zapi_token: zapiToken || null,
          zapi_client_token: zapiClientToken || null,
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

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Gerenciar assinatura e configurações Z-API de {user.email}
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

          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-4">Configurações Z-API</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instance">Instance ID</Label>
                <Input
                  id="instance"
                  value={zapiInstanceId}
                  onChange={(e) => setZapiInstanceId(e.target.value)}
                  placeholder="Ex: 3C12345678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Input
                  id="token"
                  value={zapiToken}
                  onChange={(e) => setZapiToken(e.target.value)}
                  placeholder="Token Z-API"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientToken">Client Token</Label>
                <Input
                  id="clientToken"
                  value={zapiClientToken}
                  onChange={(e) => setZapiClientToken(e.target.value)}
                  placeholder="Client Token Z-API"
                />
              </div>
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
