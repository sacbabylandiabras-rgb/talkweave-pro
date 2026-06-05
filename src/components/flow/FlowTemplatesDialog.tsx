import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText } from "lucide-react";
import { getTemplatesForMode, type FlowTemplate } from "./flowTemplates";

interface FlowTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "contacts" | "groups" | "meta";
  onSelect: (template: FlowTemplate) => void;
  onStartBlank: () => void;
}

export function FlowTemplatesDialog({
  open,
  onOpenChange,
  mode,
  onSelect,
  onStartBlank,
}: FlowTemplatesDialogProps) {
  const templates = getTemplatesForMode(mode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Modelos prontos de fluxo
          </DialogTitle>
          <DialogDescription>
            Comece com um modelo pronto e personalize do seu jeito, ou crie do zero.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="grid gap-3 sm:grid-cols-2 pb-2">
            {/* Em branco */}
            <Card
              onClick={onStartBlank}
              className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all border-dashed"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1">Começar em branco</h3>
                  <p className="text-xs text-muted-foreground">
                    Monte seu fluxo do zero, do seu jeito.
                  </p>
                </div>
              </div>
            </Card>

            {templates.sort((a, b) => (b.isSpecial ? 1 : 0) - (a.isSpecial ? 1 : 0)).map((tpl) => (
              <Card
                key={tpl.id}
                onClick={() => onSelect(tpl)}
                className={`p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all ${tpl.isSpecial ? 'border-primary/40 bg-primary/5' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${tpl.isSpecial ? 'bg-primary/20' : 'bg-primary/10'} flex items-center justify-center shrink-0`}>
                    <tpl.icon className={`h-5 w-5 ${tpl.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{tpl.name}</h3>
                      {tpl.isSpecial && <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full uppercase font-bold">Novo</span>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {tpl.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {tpl.nodes.length} blocos
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}