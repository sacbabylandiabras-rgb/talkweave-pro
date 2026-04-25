import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Flame, Loader2, Phone, Server } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

// Tabela criada via migration; o tipo gerado ainda não a conhece, então usamos cast.
const donorTable = () => (supabase as any).from("warmup_donor_numbers");
import { toast } from "sonner";

interface DonorNumber {
  id: string;
  phone: string;
  label: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

const normalize = (raw: string) => raw.replace(/\D/g, "");

const parseBulk = (raw: string) =>
  raw
    .split(/[\n,;\s]+/)
    .map(normalize)
    .filter((p) => p.length >= 8);

export default function AdminAquecimento() {
  const [donors, setDonors] = useState<DonorNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [bulk, setBulk] = useState("");
  const [instOpen, setInstOpen] = useState(false);
  const [instName, setInstName] = useState("");
  const [creatingInst, setCreatingInst] = useState(false);

  const createInstance = async () => {
    const name = instName.trim();
    if (!name) {
      toast.error("Informe um nome para a instância");
      return;
    }
    setCreatingInst(true);
    const { data, error } = await supabase.functions.invoke("uazapi-create-instance", {
      body: { instanceName: name, systemName: "zaplynx" },
    });
    setCreatingInst(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return;
    }
    toast.success("Instância UAZAPI criada");
    setInstName("");
    setInstOpen(false);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await donorTable()
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setDonors((data as DonorNumber[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addOne = async () => {
    const p = normalize(phone);
    if (p.length < 8) {
      toast.error("Telefone inválido");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await donorTable().insert({
      phone: p,
      label: label.trim() || null,
      notes: notes.trim() || null,
      created_by: userData.user?.id || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Número adicionado");
    setPhone("");
    setLabel("");
    setNotes("");
    load();
  };

  const addBulk = async () => {
    const phones = parseBulk(bulk);
    if (!phones.length) {
      toast.error("Cole pelo menos um número válido");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const rows = phones.map((p) => ({
      phone: p,
      created_by: userData.user?.id || null,
    }));
    const { error } = await donorTable()
      .upsert(rows, { onConflict: "phone", ignoreDuplicates: true });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${phones.length} número(s) processado(s)`);
    setBulk("");
    load();
  };

  const toggleActive = async (id: string, next: boolean) => {
    const { error } = await donorTable()
      .update({ active: next })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDonors((prev) => prev.map((d) => (d.id === id ? { ...d, active: next } : d)));
  };

  const remove = async (id: string) => {
    const { error } = await donorTable().delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDonors((prev) => prev.filter((d) => d.id !== id));
    toast.success("Removido");
  };

  const activeCount = donors.filter((d) => d.active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Flame className="w-6 h-6 text-primary" />
          Admin · Pool de Aquecimento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Números doadores que enviam mensagens para os números ativos no aquecimento. Apenas administradores enxergam esta página.
        </p>
      </div>

      <div className="flex justify-end">
        <Dialog open={instOpen} onOpenChange={setInstOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Server className="w-4 h-4 mr-1" />
              Criar instância UAZAPI
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova instância UAZAPI</DialogTitle>
              <DialogDescription>
                Provisiona uma nova instância no servidor UAZAPI vinculada à sua conta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">Nome da instância</Label>
              <Input
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                placeholder="aquecimento-01"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setInstOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={createInstance} disabled={creatingInst}>
                {creatingInst ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{donors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inativos</p>
            <p className="text-2xl font-bold">{donors.length - activeCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar número</CardTitle>
          <CardDescription>Inclua um doador individual com rótulo e observação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Telefone (DDI+DDD)</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511999990001"
              />
            </div>
            <div>
              <Label className="text-xs">Rótulo</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Chip 01" />
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <Button onClick={addOne} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Importar em lote</CardTitle>
          <CardDescription>Cole múltiplos números (um por linha)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={5}
            placeholder="5511999990001&#10;5511999990002&#10;5511999990003"
          />
          <Button onClick={addBulk} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Importar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pool de doadores</CardTitle>
          <CardDescription>Ative/desative ou remova números</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : donors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum número cadastrado</p>
          ) : (
            <div className="space-y-2">
              {donors.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/20"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{d.phone}</span>
                        {d.label && <Badge variant="outline" className="text-[10px]">{d.label}</Badge>}
                        <Badge variant={d.active ? "default" : "secondary"} className="text-[10px]">
                          {d.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {d.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{d.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.active} onCheckedChange={(v) => toggleActive(d.id, v)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => remove(d.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}