import { useState, useEffect } from "react";
import { Plus, Save, Trash2, MessageCircle, Send, Clock, Variable, ArrowLeft, Link, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useInstagramAutomations } from "@/hooks/useInstagramAutomations";

interface FlowBlock {
  id: string;
  type: "trigger" | "reply_comment" | "send_direct";
  data: Record<string, any>;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function AutomacaoComentarios() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const { automations, createAutomation, updateAutomation } = useInstagramAutomations();

  const [flowName, setFlowName] = useState("Novo Fluxo");
  const [isActive, setIsActive] = useState(false);
  const [blocks, setBlocks] = useState<FlowBlock[]>([
    { id: generateId(), type: "trigger", data: { keywords: "", matchType: "any" } },
    { id: generateId(), type: "reply_comment", data: { message: "" } },
    { id: generateId(), type: "send_direct", data: { message: "", delayValue: 0, delayUnit: "minutes", buttons: [] as { title: string; url: string }[] } },
  ]);

  // Load existing automation if editing
  useEffect(() => {
    if (editId && automations.length > 0) {
      const existing = automations.find(a => a.id === editId);
      if (existing) {
        setFlowName(existing.name);
        setIsActive(existing.active);

        // Parse dm_message — may be JSON with buttons
        let dmText = existing.dm_message || "";
        let dmButtons: { title: string; url: string }[] = [];
        try {
          const parsed = JSON.parse(dmText);
          if (parsed.text !== undefined) {
            dmText = parsed.text || "";
            dmButtons = parsed.buttons || [];
          }
        } catch { /* plain text */ }

        setBlocks([
          { id: generateId(), type: "trigger", data: { keywords: existing.keyword, matchType: "any" } },
          { id: generateId(), type: "reply_comment", data: { message: existing.reply_comment || "" } },
          { id: generateId(), type: "send_direct", data: { message: dmText, delayValue: 0, delayUnit: "minutes", buttons: dmButtons } },
        ]);
      }
    }
  }, [editId, automations]);

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

  const handleSave = async () => {
    const triggerBlock = blocks.find(b => b.type === "trigger");
    const replyBlock = blocks.find(b => b.type === "reply_comment");
    const dmBlock = blocks.find(b => b.type === "send_direct");

    // Encode buttons into dm_message as JSON if buttons exist
    const dmButtons = dmBlock?.data.buttons || [];
    const dmText = dmBlock?.data.message || "";
    const dmMessage = dmButtons.length > 0
      ? JSON.stringify({ text: dmText, buttons: dmButtons })
      : dmText;

    const payload = {
      name: flowName,
      keyword: triggerBlock?.data.keywords || "",
      reply_comment: replyBlock?.data.message || "",
      dm_message: dmMessage,
      active: isActive,
    };

    if (editId) {
      updateAutomation.mutate({ id: editId, ...payload }, {
        onSuccess: () => navigate("/instagram/campanhas"),
      });
    } else {
      createAutomation.mutate(payload, {
        onSuccess: () => navigate("/instagram/campanhas"),
      });
    }
  };

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/instagram/campanhas")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {editId ? "Editar Fluxo" : "Automação de Comentários"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Construa fluxos de resposta automática para comentários do Instagram</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{isActive ? "Ativo" : "Pausado"}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <Button onClick={handleSave} className="gap-2" disabled={createAutomation.isPending || updateAutomation.isPending}>
            <Save className="w-4 h-4" />
            Salvar Fluxo
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="pt-4 pb-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">Nome do Fluxo</label>
          <Input value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Ex: Promoção Black Friday" />
        </CardContent>
      </Card>

      <div className="relative space-y-0">
        {blocks.map((block, index) => (
          <div key={block.id} className="relative">
            {index > 0 && (
              <div className="flex justify-center py-2">
                <div className="w-px h-6 bg-primary/40" />
                <div className="absolute w-2 h-2 border-r-2 border-b-2 border-primary/40 transform rotate-45 translate-y-4" />
              </div>
            )}

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
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <MessageCircle className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    Responder Comentário
                  </CardTitle>
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
