import { useState, useCallback } from "react";
import { Plus, Save, Trash2, GripVertical, MessageCircle, Send, Clock, Variable } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface FlowBlock {
  id: string;
  type: "trigger" | "reply_comment" | "send_direct";
  data: Record<string, any>;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function AutomacaoComentarios() {
  const [flowName, setFlowName] = useState("Novo Fluxo");
  const [isActive, setIsActive] = useState(false);
  const [blocks, setBlocks] = useState<FlowBlock[]>([
    { id: generateId(), type: "trigger", data: { keywords: "", matchType: "any" } },
    { id: generateId(), type: "reply_comment", data: { message: "" } },
    { id: generateId(), type: "send_direct", data: { message: "", delayValue: 0, delayUnit: "minutes" } },
  ]);

  const addDirectBlock = () => {
    setBlocks(prev => [...prev, {
      id: generateId(),
      type: "send_direct",
      data: { message: "", delayValue: 5, delayUnit: "minutes" },
    }]);
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, data: Record<string, any>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b));
  };

  const insertVariable = (blockId: string, variable: string) => {
    setBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      return { ...b, data: { ...b.data, message: (b.data.message || "") + `{{${variable}}}` } };
    }));
  };

  const handleSave = () => {
    toast.success("Fluxo salvo com sucesso!");
  };

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Automação de Comentários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Construa fluxos de resposta automática para comentários do Instagram</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{isActive ? "Ativo" : "Pausado"}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Salvar Fluxo
          </Button>
        </div>
      </div>

      {/* Flow Name */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">Nome do Fluxo</label>
          <Input value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Ex: Promoção Black Friday" />
        </CardContent>
      </Card>

      {/* Flow Blocks */}
      <div className="relative space-y-0">
        {blocks.map((block, index) => (
          <div key={block.id} className="relative">
            {/* Connector Arrow */}
            {index > 0 && (
              <div className="flex justify-center py-2">
                <div className="w-px h-6 bg-primary/40" />
                <div className="absolute w-2 h-2 border-r-2 border-b-2 border-primary/40 transform rotate-45 translate-y-4" />
              </div>
            )}

            {/* Block */}
            {block.type === "trigger" && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                    </div>
                    Gatilho — Palavras-chave
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Palavras-chave (separadas por vírgula)</label>
                    <Input
                      value={block.data.keywords}
                      onChange={e => updateBlock(block.id, { keywords: e.target.value })}
                      placeholder="quero, info, link, preço"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Tipo de correspondência</label>
                    <Select value={block.data.matchType} onValueChange={v => updateBlock(block.id, { matchType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer palavra</SelectItem>
                        <SelectItem value="exact">Frase exata</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {block.data.keywords && (
                    <div className="flex flex-wrap gap-1">
                      {block.data.keywords.split(",").map((kw: string, i: number) => kw.trim() && (
                        <Badge key={i} variant="secondary" className="text-[10px]">{kw.trim()}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {block.type === "reply_comment" && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <MessageCircle className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      Responder Comentário
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Resposta pública no comentário</label>
                  <Textarea
                    value={block.data.message}
                    onChange={e => updateBlock(block.id, { message: e.target.value })}
                    placeholder='Ex: "Te mandei no direct! 📩"'
                    rows={2}
                  />
                </CardContent>
              </Card>
            )}

            {block.type === "send_direct" && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Send className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      Enviar Direct
                    </CardTitle>
                    {blocks.filter(b => b.type === "send_direct").length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBlock(block.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Mensagem</label>
                    <Textarea
                      value={block.data.message}
                      onChange={e => updateBlock(block.id, { message: e.target.value })}
                      placeholder="Olá {{nome_usuario}}! Vi que você comentou no nosso post..."
                      rows={3}
                    />
                    <div className="flex gap-1 mt-2">
                      {["nome_usuario", "comentario", "post_url"].map(v => (
                        <Button key={v} variant="outline" size="sm" className="text-[10px] h-6 px-2 gap-1" onClick={() => insertVariable(block.id, v)}>
                          <Variable className="w-3 h-3" />
                          {v}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Delay
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={block.data.delayValue}
                        onChange={e => updateBlock(block.id, { delayValue: Number(e.target.value) })}
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-muted-foreground mb-1.5 block">&nbsp;</label>
                      <Select value={block.data.delayUnit} onValueChange={v => updateBlock(block.id, { delayUnit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutos</SelectItem>
                          <SelectItem value="hours">Horas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ))}

        {/* Add block button */}
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={addDirectBlock} className="gap-2 border-dashed">
            <Plus className="w-4 h-4" />
            Adicionar Envio de Direct
          </Button>
        </div>
      </div>
    </div>
  );
}
