import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Paperclip, FileText, Eye, Check, Phone, Wifi, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MessageTemplate } from "@/hooks/useMessageTemplates";
import WhatsAppCarouselPreview from "@/components/envio/WhatsAppCarouselPreview";

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
                {!arquivoMidia.type.startsWith('image/') && !arquivoMidia.type.startsWith('video/') && !arquivoMidia.type.startsWith('audio/') && (
                  <div className="flex items-center gap-2 p-2 bg-background rounded border border-border text-sm text-muted-foreground">
                    <FileText className="w-8 h-8" />
                    <span>Documento anexado</span>
                  </div>
                )}
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
            <Select 
              value={modeloSelecionado} 
              onValueChange={(value) => {
                setModeloSelecionado(value);
                aplicarModelo(value);
                setShowPreview(true);
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={modelosDisponiveis.length === 0 ? "Nenhum modelo disponível" : "Selecione um modelo"} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-[100]">
                {modelosDisponiveis.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum modelo cadastrado
                  </div>
                ) : (
                  modelosDisponiveis.map((modelo) => (
                    <SelectItem key={modelo.id} value={modelo.id} className="bg-background hover:bg-accent">
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
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl border-0">
          <div className="flex flex-col h-[600px]">
            {/* Header WhatsApp */}
            <div className="bg-[hsl(142,70%,35%)] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">Prévia da Mensagem</p>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> online
                </p>
              </div>
            </div>

            {/* Chat area */}
            <div
              className="flex-1 p-4 space-y-2 overflow-y-auto"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 303.3 495.2'%3E%3Cpath fill='%23dfe5d7' fill-opacity='0.4' d='M7.3 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6zm18 0h6v6h-6z'/%3E%3C/svg%3E")`,
                backgroundColor: '#e5ddd5',
              }}
            >
              {modeloAtual && (
                <div className="flex justify-end">
                  <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,30%,25%)] rounded-lg rounded-tr-none max-w-[85%] shadow-sm">
                    {modeloAtual.type === 'carrossel' && modeloAtual.carouselCards?.length ? (
                      <div className="px-3 py-3 space-y-2">
                        <WhatsAppCarouselPreview
                          header={modeloAtual.header}
                          content={modeloAtual.content}
                          footer={modeloAtual.footer}
                          cards={modeloAtual.carouselCards}
                          className="max-w-full"
                        />

                        {modeloAtual.variables && modeloAtual.variables.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            📋 Variáveis: {modeloAtual.variables.join(', ')}
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-1 pt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Check className="w-3 h-3 text-blue-500" />
                          <Check className="w-3 h-3 text-blue-500 -ml-2" />
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Mídia anexada pelo usuário */}
                        {arquivoMidia && arquivoMidia.type.startsWith('image/') && (
                          <img
                            src={URL.createObjectURL(arquivoMidia)}
                            alt="Mídia anexada"
                            className="w-full rounded-t-lg object-cover max-h-48"
                          />
                        )}
                        {arquivoMidia && arquivoMidia.type.startsWith('video/') && (
                          <video
                            src={URL.createObjectURL(arquivoMidia)}
                            controls
                            className="w-full rounded-t-lg max-h-48"
                          />
                        )}
                        {arquivoMidia && arquivoMidia.type.startsWith('audio/') && (
                          <div className="px-3 pt-3">
                            <audio src={URL.createObjectURL(arquivoMidia)} controls className="w-full" />
                          </div>
                        )}
                        {arquivoMidia && !arquivoMidia.type.startsWith('image/') && !arquivoMidia.type.startsWith('video/') && !arquivoMidia.type.startsWith('audio/') && (
                          <div className="flex items-center gap-2 px-3 pt-3 text-sm text-muted-foreground">
                            <FileText className="w-6 h-6" />
                            <span>{arquivoMidia.name}</span>
                          </div>
                        )}
                        {!arquivoMidia && modeloAtual.mediaUrl && (
                          <img
                            src={modeloAtual.mediaUrl}
                            alt="Mídia do modelo"
                            className="w-full rounded-t-lg object-cover max-h-48"
                          />
                        )}

                        <div className="px-3 py-2 space-y-1">
                          {modeloAtual.header && (
                            <p className="font-bold text-sm text-foreground">{modeloAtual.header}</p>
                          )}

                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                            {modeloAtual.content}
                          </p>

                          {modeloAtual.footer && (
                            <p className="text-xs text-muted-foreground italic">{modeloAtual.footer}</p>
                          )}

                          {modeloAtual.variables && modeloAtual.variables.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              📋 Variáveis: {modeloAtual.variables.join(', ')}
                            </p>
                          )}

                          <div className="flex items-center justify-end gap-1 pt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <Check className="w-3 h-3 text-blue-500" />
                            <Check className="w-3 h-3 text-blue-500 -ml-2" />
                          </div>
                        </div>

                        {modeloAtual.buttons && modeloAtual.buttons.length > 0 && (
                          <div className="border-t border-border/30">
                            {modeloAtual.buttons.map((btn) => (
                              <div
                                key={btn.id}
                                className="text-center py-2 text-sm text-blue-600 dark:text-blue-400 font-medium border-b border-border/20 last:border-0"
                              >
                                {btn.text}
                              </div>
                            ))}
                          </div>
                        )}

                        {modeloAtual.listItems && modeloAtual.listItems.length > 0 && (
                          <div className="border-t border-border/30 px-3 py-2">
                            <div className="bg-background/50 rounded p-2 text-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                              📋 Ver opções ({modeloAtual.listItems.length})
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 border-t border-border">
              <div className="flex-1 bg-background rounded-full px-4 py-2 text-xs text-muted-foreground">
                Mensagem
              </div>
              <div className="w-8 h-8 rounded-full bg-[hsl(142,70%,35%)] flex items-center justify-center">
                <Phone className="w-4 h-4 text-white rotate-[135deg]" />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaModelSection;