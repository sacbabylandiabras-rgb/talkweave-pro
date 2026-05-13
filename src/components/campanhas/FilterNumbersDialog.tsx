import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
 import { CheckCircle2, XCircle, Upload, Loader2, Download, Copy, FileSpreadsheet, Smartphone, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

 export function FilterNumbersDialog({ open, onOpenChange, removeDuplicates, onRemoveDuplicatesChange }: Props & { removeDuplicates?: boolean; onRemoveDuplicatesChange?: (v: boolean) => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState("manual");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: string[]; invalid: string[]; total: number; checked: number } | null>(null);
  const { instances, activeInstance, selectInstance } = useZapiInstances();
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setResult(null);
  };

  // Extrai apenas valores que parecem números de telefone (8+ dígitos)
  const extractPhones = (values: any[]): string[] => {
    const out: string[] = [];
    for (const v of values) {
      const s = String(v ?? "").trim().replace(/^["']+|["']+$/g, "");
      if (!s) continue;
      const digits = s.replace(/\D+/g, "");
      if (digits.length >= 8 && digits.length <= 15) out.push(digits);
    }
    return Array.from(new Set(out));
  };

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let raw: any[] = [];
      if (ext === "csv" || ext === "txt") {
        const txt = await file.text();
        const parsed = Papa.parse<string[]>(txt, { skipEmptyLines: true });
        raw = (parsed.data as any[]).flat();
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        raw = rows.flat();
      } else {
        toast({ title: "Formato não suportado", description: "Use CSV, XLSX ou TXT", variant: "destructive" });
        return;
      }
      const phones = extractPhones(raw);
      setText(phones.join("\n"));
      toast({ title: "Planilha carregada", description: `${phones.length} número(s) detectado(s)` });
    } catch (e: any) {
      toast({ title: "Erro ao ler arquivo", description: e.message, variant: "destructive" });
    }
  };

   const validate = async () => {
     let phones = extractPhones(text.split(/[\s,;\n\r\t]+/));
     
     if (removeDuplicates) {
       phones = Array.from(new Set(phones));
     }
    if (!phones.length) {
      toast({ title: "Adicione números", description: "Cole ou importe ao menos 1 número.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-whatsapp-numbers", {
        body: { 
          phones,
          instanceId: activeInstance?.id 
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({
        valid: (data as any).valid || [],
        invalid: (data as any).invalid || [],
        total: (data as any).total || phones.length,
        checked: (data as any).checked || 0,
      });
      toast({ title: "Validação concluída", description: `${(data as any).valid?.length || 0} válidos / ${(data as any).invalid?.length || 0} inválidos` });
    } catch (e: any) {
      toast({ title: "Erro ao validar", description: e.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (rows: string[], name: string) => {
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyList = async (rows: string[]) => {
    await navigator.clipboard.writeText(rows.join("\n"));
    toast({ title: "Copiado!", description: `${rows.length} números na área de transferência` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Filtrar Números Válidos
          </DialogTitle>
          <DialogDescription>
            Verifica em tempo real quais números possuem WhatsApp ativo. Aceita planilha (CSV/XLSX) ou lista manual.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="file">Planilha</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-3">
            <Textarea
              placeholder={"Cole os números, um por linha:\n11999999999\n5511988887777"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[180px] font-mono text-sm"
            />
          </TabsContent>

          <TabsContent value="file" className="space-y-3">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Clique para enviar planilha</p>
              <p className="text-xs text-muted-foreground">CSV, XLSX, XLS ou TXT</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
            {text && (
              <div className="text-xs text-muted-foreground">
                {text.split(/\s+/).filter(Boolean).length} número(s) carregado(s)
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          {instances.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Instância para validação
              </label>
              <Select value={activeInstance?.id} onValueChange={selectInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.instance_name} {inst.is_default ? "(Padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

           {onRemoveDuplicatesChange && (
             <div className="flex items-center justify-between p-2 bg-accent/30 rounded-lg border border-border/50 mb-2">
               <div className="flex items-center gap-2">
                 <Filter className="w-4 h-4 text-primary" />
                 <div>
                   <p className="text-xs font-medium">Remover Duplicados</p>
                   <p className="text-[10px] text-muted-foreground">Filtra números repetidos antes da validação</p>
                 </div>
               </div>
               <input 
                 type="checkbox"
                 className="w-4 h-4 accent-primary cursor-pointer"
                 checked={removeDuplicates} 
                 onChange={(e) => onRemoveDuplicatesChange(e.target.checked)} 
               />
             </div>
           )}

           <div className="flex gap-2">
           <Button onClick={validate} disabled={loading || !text.trim()} className="flex-1">
             {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Validando...</> : "Validar Números"}
           </Button>
            {(text || result) && (
              <Button variant="outline" onClick={reset} disabled={loading}>Limpar</Button>
            )}
          </div>
        </div>

        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{result.total}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-500/40">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Válidos</p>
                  <p className="text-2xl font-bold text-emerald-500">{result.valid.length}</p>
                </CardContent>
              </Card>
              <Card className="border-destructive/40">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Inválidos</p>
                  <p className="text-2xl font-bold text-destructive">{result.invalid.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-500/90">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Válidos ({result.valid.length})
                    </Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copyList(result.valid)} disabled={!result.valid.length}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadCsv(result.valid, "validos.csv")} disabled={!result.valid.length}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-48 border rounded p-2">
                    {result.valid.length ? (
                      <ul className="text-xs font-mono space-y-1">
                        {result.valid.map((p) => <li key={p}>{p}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-8">Nenhum número válido</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3 mr-1" />Inválidos ({result.invalid.length})
                    </Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copyList(result.invalid)} disabled={!result.invalid.length}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadCsv(result.invalid, "invalidos.csv")} disabled={!result.invalid.length}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-48 border rounded p-2">
                    {result.invalid.length ? (
                      <ul className="text-xs font-mono space-y-1">
                        {result.invalid.map((p, i) => <li key={`${p}-${i}`}>{p}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-8">Nenhum número inválido</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
