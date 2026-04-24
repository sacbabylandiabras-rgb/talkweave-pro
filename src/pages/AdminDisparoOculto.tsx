import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface HiddenInstance {
  id: string;
  name: string;
  api_provider: string;
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  is_active: boolean;
  created_at: string;
}

const empty = {
  name: "",
  api_provider: "zapi" as "zapi" | "uazapi",
  zapi_instance_id: "",
  zapi_token: "",
  zapi_client_token: "",
  evolution_api_url: "",
  evolution_api_key: "",
};

export default function AdminDisparoOculto() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | undefined>();
  const { isAdmin, loading: roleLoading } = useUserRole(userId);
  const [items, setItems] = useState<HiddenInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("hidden_dispatch_instances")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setItems((data || []) as HiddenInstance[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchItems(); }, [isAdmin]);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      api_provider: form.api_provider,
      zapi_instance_id: form.zapi_instance_id.trim(),
      zapi_token: form.zapi_token.trim(),
      zapi_client_token: form.zapi_client_token.trim(),
      evolution_api_url: form.evolution_api_url.trim() || null,
      evolution_api_key: form.evolution_api_key.trim() || null,
      created_by: userId,
    };
    const { error } = await (supabase as any).from("hidden_dispatch_instances").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Instância adicionada" });
    setForm(empty);
    fetchItems();
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await (supabase as any)
      .from("hidden_dispatch_instances")
      .update({ is_active: active })
      .eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchItems();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover essa instância?")) return;
    const { error } = await (supabase as any).from("hidden_dispatch_instances").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchItems();
  };

  if (roleLoading) return <div className="p-6">Carregando...</div>;
  if (!isAdmin) return <div className="p-6">Acesso restrito.</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Disparo Oculto — Instâncias (Admin)</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre as instâncias Z-API/UAZAPI usadas em <code>/disparo-oculto</code>. Visíveis para todos os usuários logados.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Adicionar instância</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Instância principal" />
              </div>
              <div>
                <Label>Provedor</Label>
                <Select value={form.api_provider} onValueChange={(v) => setForm({ ...form, api_provider: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zapi">Z-API</SelectItem>
                    <SelectItem value="uazapi">UAZAPI / Evolution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.api_provider === "zapi" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Instance ID</Label>
                  <Input value={form.zapi_instance_id} onChange={(e) => setForm({ ...form, zapi_instance_id: e.target.value })} />
                </div>
                <div>
                  <Label>Token</Label>
                  <Input value={form.zapi_token} onChange={(e) => setForm({ ...form, zapi_token: e.target.value })} />
                </div>
                <div>
                  <Label>Client Token</Label>
                  <Input value={form.zapi_client_token} onChange={(e) => setForm({ ...form, zapi_client_token: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>API URL</Label>
                  <Input value={form.evolution_api_url} onChange={(e) => setForm({ ...form, evolution_api_url: e.target.value })} placeholder="https://meu-uazapi.com" />
                </div>
                <div>
                  <Label>API Token</Label>
                  <Input value={form.evolution_api_key} onChange={(e) => setForm({ ...form, evolution_api_key: e.target.value })} />
                </div>
              </div>
            )}

            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Instâncias cadastradas</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma instância.</p>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex-1">
                      <div className="font-medium">{it.name} <span className="text-xs text-muted-foreground">({it.api_provider})</span></div>
                      <div className="text-xs text-muted-foreground">
                        {it.api_provider === "zapi"
                          ? `Instance: ${it.zapi_instance_id || "—"}`
                          : `URL: ${it.evolution_api_url || "—"}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={it.is_active} onCheckedChange={(v) => toggleActive(it.id, v)} />
                        <span className="text-xs">{it.is_active ? "Ativa" : "Inativa"}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}