import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Globe, KeyRound } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";

export function UazapiConnectDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess?: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const { refetch } = useZapiInstances();

  const handleConnect = async () => {
    if (!name.trim() || !url.trim() || !key.trim()) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome, URL e API Key da Uazapi.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Adiciona como uma instância zapi_instances com provider uazapi
      const { error } = await supabase.from("zapi_instances").insert({
        user_id: user.id,
        instance_name: name.trim(),
        zapi_instance_id: `uazapi-${Date.now()}`,
        evolution_api_url: url.trim(),
        evolution_api_key: key.trim(),
        api_provider: "uazapi",
        instance_type: "web",
        is_active: true,
        is_default: false
      });

      if (error) throw error;

      toast({ title: "✅ Uazapi Conectada", description: "Instância adicionada com sucesso para extração de membros." });
      setName("");
      setUrl("");
      setKey("");
      refetch();
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Conectar Uazapi
          </DialogTitle>
          <DialogDescription>
            Configure sua instância Uazapi para habilitar a extração forçada de membros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome da Instância</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Ex: Minha Uazapi 01" 
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" />
              API URL
            </Label>
            <Input 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="https://api..." 
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5" />
              API Key / Token
            </Label>
            <Input 
              value={key} 
              onChange={(e) => setKey(e.target.value)} 
              placeholder="Sua API Key" 
              type="password"
              disabled={loading}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleConnect} 
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Conectar Instância
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
