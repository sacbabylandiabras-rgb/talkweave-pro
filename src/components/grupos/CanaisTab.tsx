import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, Plus, Hash, Image, Upload, Loader2, Trash2, Pencil, Settings, UserPlus, UserMinus, Search, Volume2, VolumeX, Heart, HeartOff, UserCheck } from "lucide-react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Newsletter {
  id: string;
  name?: string;
  description?: string;
  raw?: Record<string, unknown>;
}

export default function CanaisTab() {
  const { instances, activeInstance } = useZapiInstances();
  const [instanceId, setInstanceId] = useState<string>("");
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPhotoUrl, setCreatePhotoUrl] = useState("");
  const createPhotoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!instanceId && activeInstance?.id) setInstanceId(activeInstance.id);
  }, [activeInstance, instanceId]);

  const invokeNewsletter = async (action: string, payload: Record<string, unknown> = {}) => {
    const inst = instances.find((i) => i.id === instanceId);
    const { data, error } = await supabase.functions.invoke("manage-newsletters", {
      body: { action, instanceId: inst?.zapi_instance_id, instanceToken: inst?.zapi_token, instanceClientToken: inst?.zapi_client_token, ...payload },
    });
    if (error) throw new Error(error.message || "Erro ao chamar Z-API");
    if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
      throw new Error(String((data as { error: string }).error));
    }
    return data;
  };

  const loadNewsletters = async () => {
    setLoading(true);
    try {
      const data = await invokeNewsletter("list-newsletters");
      const list: Newsletter[] = Array.isArray(data) ? data.map((n: any) => ({
        id: String(n.newsletterId || n.id || ""),
        name: n.name || n.subject || "Canal",
        description: n.description || "",
        raw: n
      })) : [];
      setNewsletters(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (err) {
      console.error(err);
      setNewsletters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instanceId) loadNewsletters();
  }, [instanceId]);

  const uploadPhotoFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const fileName = `${user.id}/newsletter-photos/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("template-media").upload(fileName, file, { contentType: file.type });
    if (error) throw new Error("Erro no upload: " + error.message);
    const { data: urlData } = supabase.storage.from("template-media").getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadPhotoFile(file);
      setter(url);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return toast.error("Nome obrigatório");
    setActionLoading("create");
    try {
      await invokeNewsletter("create-newsletter", { name: createName, description: createDescription, imageUrl: createPhotoUrl });
      toast.success("Canal criado!");
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreatePhotoUrl("");
      await loadNewsletters();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Hash className="w-5 h-5 text-primary" /> Canais</CardTitle>
        <CardDescription>Gerencie seus canais (newsletters)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo Canal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Canal</DialogTitle>
                <DialogDescription>Preencha os dados do novo canal.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div onClick={() => createPhotoFileRef.current?.click()} className="cursor-pointer border-2 border-dashed h-24 flex items-center justify-center rounded-lg">
                  {createPhotoUrl ? <img src={createPhotoUrl} className="h-full object-cover" /> : <Upload />}
                </div>
                <input ref={createPhotoFileRef} type="file" className="hidden" onChange={(e) => handlePhotoFileChange(e, setCreatePhotoUrl)} />
                <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Nome do canal" />
                <Textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Descrição" />
                <Button onClick={handleCreate} disabled={actionLoading === "create"}>Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2">
          {newsletters.map(n => (
            <div key={n.id} className="p-3 rounded-lg border bg-card flex justify-between items-center">
              <div>
                <p className="font-semibold">{n.name}</p>
                <p className="text-sm text-muted-foreground">{n.description}</p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedId(n.id)}>Gerenciar</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
