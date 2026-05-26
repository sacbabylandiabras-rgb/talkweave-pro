import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileSpreadsheet, UserPlus, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contacts: Array<{ phone: string; name?: string }>) => void;
}

export function ImportContactsDialog({ open, onOpenChange, onImport }: ImportContactsDialogProps) {
  const { toast } = useToast();
  const [manualText, setManualText] = useState("");
  const [fileData, setFileData] = useState<Array<{ phone: string; name?: string }> | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanPhone = (phone: string) => {
    return phone.replace(/\D/g, "");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const contacts = jsonData
          .map((row) => {
            const phoneStr = String(row.phone || row.telefone || row.celular || Object.values(row)[0] || "");
            const nameStr = String(row.name || row.nome || Object.values(row)[1] || "");
            const phone = cleanPhone(phoneStr);
            return phone.length >= 8 ? { phone, name: nameStr } : null;
          })
          .filter(Boolean) as Array<{ phone: string; name?: string }>;

        if (contacts.length === 0) {
          throw new Error("Nenhum contato válido encontrado na planilha. Certifique-se de ter uma coluna 'phone' ou 'telefone'.");
        }

        setFileData(contacts);
        toast({
          title: "Planilha processada",
          description: `${contacts.length} contatos encontrados.`,
        });
      } catch (error: any) {
        toast({
          title: "Erro ao ler arquivo",
          description: error.message || "Certifique-se de que é um arquivo Excel válido.",
          variant: "destructive",
        });
        setFileData(null);
        setFileName(null);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleManualImport = () => {
    if (!manualText.trim()) return;

    const lines = manualText.split("\n");
    const contacts = lines
      .map((line) => {
        // Formatos aceitos: "5511999999999" ou "5511999999999, Nome"
        const parts = line.split(/[;,]/);
        const phone = cleanPhone(parts[0]);
        const name = parts[1]?.trim();
        return phone.length >= 8 ? { phone, name } : null;
      })
      .filter(Boolean) as Array<{ phone: string; name?: string }>;

    if (contacts.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum contato válido encontrado. Use o formato: número ou número, nome",
        variant: "destructive",
      });
      return;
    }

    onImport(contacts);
    setManualText("");
    onOpenChange(false);
  };

  const handleFileImport = () => {
    if (fileData) {
      onImport(fileData);
      setFileData(null);
      setFileName(null);
      onOpenChange(false);
    }
  };

  const clearFile = () => {
    setFileData(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Adicionar Contatos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Upload Section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Upar Planilha (Excel/CSV)</Label>
            {!fileData ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-primary/20 rounded-lg p-8 flex flex-col items-center justify-center gap-3 hover:bg-primary/5 cursor-pointer transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Clique para selecionar</p>
                      <p className="text-xs text-muted-foreground mt-1">Colunas recomendadas: phone, name</p>
                    </div>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleFileUpload} 
                />
              </div>
            ) : (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">{fileName}</p>
                    <p className="text-xs text-muted-foreground">{fileData.length} contatos prontos</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {fileData && (
              <Button className="w-full mt-2" onClick={handleFileImport}>
                Importar da Planilha
              </Button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

          {/* Manual Section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Inserir Manualmente</Label>
            <Textarea
              placeholder={"Exemplos:\n5511999999999\n5511888888888, João Silva"}
              rows={5}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              className="resize-none font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Insira um número por linha. Opcionalmente use vírgula para o nome.
            </p>
            <Button 
              className="w-full" 
              variant="outline" 
              disabled={!manualText.trim()} 
              onClick={handleManualImport}
            >
              Adicionar Manualmente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
