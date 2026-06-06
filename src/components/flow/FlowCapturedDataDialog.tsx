import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Trash2, RefreshCw, Database, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CapturedRow {
  id: string;
  flow_id: string | null;
  flow_name: string | null;
  phone: string;
  nome: string | null;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  captured_data?: any;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId?: string | null;
  flowName?: string | null;
}

export default function FlowCapturedDataDialog({ open, onOpenChange, flowId, flowName }: Props) {
  const [rows, setRows] = useState<CapturedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      let query = supabase
        .from("flow_captured_data" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (flowId) query = query.eq("flow_id", flowId);
      const { data, error } = await query;
      if (error) throw error;
      setRows((data || []) as unknown as CapturedRow[]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar dados capturados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flowId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.nome, r.whatsapp, r.email, r.cpf, r.phone, r.flow_name].some(
        v => (v || "").toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.info("Nenhum dado para exportar");
      return;
    }
    const header = ["Fluxo", "Nome", "WhatsApp", "Email", "CPF", "Telefone Origem", "Data", "Hora"];
    const lines = [header.join(",")];
    filtered.forEach(r => {
      const dt = new Date(r.updated_at);
      const data = dt.toLocaleDateString("pt-BR");
      const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const cells = [
        r.flow_name || "",
        r.nome || "",
        r.whatsapp || "",
        r.email || "",
        r.cpf || "",
        r.phone || "",
        data,
        hora,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados-capturados-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    const { error } = await supabase.from("flow_captured_data" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
    toast.success("Registro excluído");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Dados Capturados
            <Badge variant="secondary">{filtered.length}</Badge>
          </DialogTitle>
          <DialogDescription>
            {flowName
              ? `Leads capturados pelo fluxo "${flowName}"`
              : "Todos os leads capturados pelos seus fluxos visuais"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone, email..."
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                {!flowId && <TableHead>Fluxo</TableHead>}
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Comprovante</TableHead>
                <TableHead>Telefone Origem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={flowId ? 6 : 7} className="text-center text-muted-foreground py-12">
                    {loading ? "Carregando..." : "Nenhum dado capturado ainda"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(r => (
                  <TableRow key={r.id}>
                    {!flowId && (
                      <TableCell className="text-xs text-muted-foreground">{r.flow_name || "—"}</TableCell>
                    )}
                    <TableCell className="font-medium">{r.nome || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.whatsapp || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.email || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r.cpf || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {r.captured_data?.proof_url ? (
                        <a 
                          href={r.captured_data.proof_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> Ver
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.phone}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}