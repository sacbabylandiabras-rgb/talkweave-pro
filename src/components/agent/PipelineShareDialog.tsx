import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePipelines, type Pipeline, type PipelineMember } from "@/hooks/usePipelines";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipeline: Pipeline | null;
}

export const PipelineShareDialog = ({ open, onOpenChange, pipeline }: Props) => {
  const { toast } = useToast();
  const { listMembers, addMemberByEmail, removeMember } = usePipelines();
  const [members, setMembers] = useState<PipelineMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("editor");
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    if (!pipeline) return;
    setLoading(true);
    try {
      setMembers(await listMembers(pipeline.id));
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Não foi possível carregar membros.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open, pipeline?.id]);

  const handleAdd = async () => {
    if (!pipeline) return;
    setAdding(true);
    try {
      await addMemberByEmail(pipeline.id, email, role);
      setEmail("");
      toast({ title: "Membro adicionado" });
      refresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao adicionar.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (uid: string) => {
    if (!pipeline) return;
    if (!window.confirm("Remover acesso deste membro?")) return;
    try {
      await removeMember(pipeline.id, uid);
      toast({ title: "Membro removido" });
      refresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao remover.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Compartilhar “{pipeline?.name}”
          </DialogTitle>
          <DialogDescription className="text-xs">
            Convide membros pelo e-mail. Eles poderão visualizar ou editar este funil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Adicionar membro</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              />
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Visualizar</SelectItem>
                  <SelectItem value="editor">Editar</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-9 gap-1" onClick={handleAdd} disabled={adding || !email.trim()}>
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Membros atuais</Label>
            <div className="border border-border rounded-md divide-y divide-border max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Carregando…
                </div>
              ) : members.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum membro convidado ainda.
                </div>
              ) : (
                members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between p-2 gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{m.full_name || m.email || m.user_id}</div>
                      {m.full_name && m.email && <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{m.role === "editor" ? "Editar" : "Visualizar"}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(m.user_id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};