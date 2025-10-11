import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MessageTemplate } from "@/hooks/useMessageTemplates";

interface MediaModelSectionProps {
  arquivoMidia: File | null;
  setArquivoMidia: (file: File | null) => void;
  legenda: string;
  setLegenda: (value: string) => void;
  modeloSelecionado: string;
  setModeloSelecionado: (value: string) => void;
  aplicarModelo: (modeloId: string) => void;
  modelosDisponiveis: MessageTemplate[];
}

const MediaModelSection = ({
  arquivoMidia,
  setArquivoMidia,
  legenda,
  setLegenda,
  modeloSelecionado,
  setModeloSelecionado,
  aplicarModelo,
  modelosDisponiveis
}: MediaModelSectionProps) => {
  const { toast } = useToast();
  
  const modeloAtual = modelosDisponiveis.find(m => m.id === modeloSelecionado);

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Anexar Mídia */}
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            Anexar Mídia
          </h4>
          <div className="space-y-3">
            <Input
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 64 * 1024 * 1024) {
                    toast({
                      title: "Arquivo muito grande",
                      description: "O arquivo deve ter no máximo 64MB",
                      variant: "destructive"
                    });
                    return;
                  }
                  setArquivoMidia(file);
                }
              }}
              className="text-sm"
            />
            {arquivoMidia && (
              <div className="bg-muted p-2 rounded text-sm">
                📎 {arquivoMidia.name} ({(arquivoMidia.size / 1024 / 1024).toFixed(1)} MB)
              </div>
            )}
            <Input
              placeholder="Legenda para mídia (opcional)"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              className="text-sm"
            />
          </div>
        </Card>

        {/* Usar Modelo */}
        <Card className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Usar Modelo
          </h4>
          <div className="space-y-3">
            <Select value={modeloSelecionado} onValueChange={setModeloSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelosDisponiveis.map((modelo) => (
                  <SelectItem key={modelo.id} value={modelo.id}>
                    <div>
                      <p className="font-medium">{modelo.name}</p>
                      <p className="text-xs text-muted-foreground">{modelo.category}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {modeloAtual && (
              <div className="bg-muted p-3 rounded text-sm space-y-2">
                <p className="font-medium text-xs text-muted-foreground">Prévia do Modelo:</p>
                <p className="whitespace-pre-wrap">{modeloAtual.content}</p>
                {modeloAtual.variables && modeloAtual.variables.length > 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Variáveis: {modeloAtual.variables.join(', ')}
                  </p>
                )}
              </div>
            )}
            
            <Button
              type="button"
              onClick={() => modeloSelecionado && aplicarModelo(modeloSelecionado)}
              disabled={!modeloSelecionado}
              variant="outline"
              className="w-full"
            >
              Aplicar ao Texto Principal
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MediaModelSection;