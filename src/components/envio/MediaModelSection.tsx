import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Paperclip, FileText, Eye, Phone, Wifi, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MessageTemplate } from "@/hooks/useMessageTemplates";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";

interface MediaModelSectionProps {
  arquivoMidia: File | null;
  setArquivoMidia: (file: File | null) => void;
  legenda: string;
  setLegenda: (value: string) => void;
  modeloSelecionado: string;
  setModeloSelecionado: (value: string) => void;
  aplicarModelo: (modeloId: string) => void;
  modelosDisponiveis: MessageTemplate[];
  viewOnce?: boolean;
  setViewOnce?: (value: boolean) => void;
  isPtv?: boolean;
  setIsPtv?: (value: boolean) => void;
}

const MediaModelSection = ({
  arquivoMidia,
  setArquivoMidia,
  legenda,
  setLegenda,
  modeloSelecionado,
  setModeloSelecionado,
  aplicarModelo,
  modelosDisponiveis,
  viewOnce,
  setViewOnce,
  isPtv,
  setIsPtv,
}: MediaModelSectionProps) => {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  
  const isVideoFile = arquivoMidia?.type?.startsWith('video/') || false;
  
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
              accept="image/*,video/*,audio/*,.webp,image/gif"
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
              <div className="bg-muted p-3 rounded space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  📎 {arquivoMidia.name} ({(arquivoMidia.size / 1024 / 1024).toFixed(1)} MB)
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => setArquivoMidia(null)}
                  >
                    ✕
                  </Button>
                </div>
                {arquivoMidia.type.startsWith('image/') && (
                  <div className="rounded overflow-hidden border border-border">
                    <img
                      src={URL.createObjectURL(arquivoMidia)}
                      alt="Prévia"
                      className="max-h-48 w-full object-contain bg-background"
                    />
                  </div>
                )}
                {arquivoMidia.type.startsWith('video/') && (
                  <div className="rounded overflow-hidden border border-border">
                    <video
                      src={URL.createObjectURL(arquivoMidia)}
                      controls
                      className="max-h-48 w-full bg-background"
                    />
                  </div>
                )}
                {arquivoMidia.type.startsWith('audio/') && (
                  <audio
                    src={URL.createObjectURL(arquivoMidia)}
                    controls
                    className="w-full"
                  />
                )}
                {isVideoFile && (setViewOnce || setIsPtv) && (
                  <div className="space-y-2">
                    {setViewOnce && (
                      <div className="flex items-center justify-between p-2 bg-accent/50 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-base">👁</span>
                          <div>
                            <Label className="text-sm font-medium cursor-pointer" htmlFor="viewOnce-toggle">
                              Visualização Única
                            </Label>
                            <p className="text-[10px] text-muted-foreground">
                              Vídeo que só pode ser visto uma vez
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="viewOnce-toggle"
                          checked={viewOnce || false}
                          onCheckedChange={(v) => { setViewOnce(v); if (v && setIsPtv) setIsPtv(false); }}
                        />
                      </div>
                    )}
                    {setIsPtv && (
                      <div className="flex items-center justify-between p-2 bg-accent/50 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4 text-primary" />
                          <div>
                            <Label className="text-sm font-medium cursor-pointer" htmlFor="ptv-toggle">
                              Vídeo Instantâneo (PTV)
                            </Label>
                            <p className="text-[10px] text-muted-foreground">
                              Vídeo circular instantâneo
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="ptv-toggle"
                          checked={isPtv || false}
                          onCheckedChange={(v) => { setIsPtv(v); if (v && setViewOnce) setViewOnce(false); }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <Input
              placeholder="Legenda para mídia (opcional)"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              className="text-sm text-black"
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
            <Select 
              value={modeloSelecionado} 
              onValueChange={(value) => {
                setModeloSelecionado(value);
                aplicarModelo(value);
                setShowPreview(true);
              }}
            >
              <SelectTrigger className="bg-background text-foreground">
                <SelectValue placeholder={modelosDisponiveis.length === 0 ? "Nenhum modelo disponível" : "Selecione um modelo"} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-[100]">
                {modelosDisponiveis.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum modelo cadastrado
                  </div>
                ) : (
                  modelosDisponiveis.map((modelo) => (
                    <SelectItem key={modelo.id} value={modelo.id} className="bg-background hover:bg-accent cursor-pointer">
                      <div>
                        <p className="font-medium">{modelo.name}</p>
                        <p className="text-xs text-muted-foreground">{modelo.category}</p>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            {modeloAtual && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="w-4 h-4" />
                Ver prévia no WhatsApp
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Dialog de prévia WhatsApp */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl border-0 bg-transparent shadow-none">
          <div className="flex flex-col">
            {modeloAtual && (
              <WhatsAppPreview template={modeloAtual} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaModelSection;
