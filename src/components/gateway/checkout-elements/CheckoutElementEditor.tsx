import { CheckoutElement, ELEMENT_DEFINITIONS } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ElementPosition } from "./types";

interface Props {
  element: CheckoutElement;
  onUpdate: (id: string, content: Record<string, any>) => void;
  onUpdatePosition: (id: string, position: ElementPosition) => void;
}

const POSITIONS: { value: ElementPosition; label: string }[] = [
  { value: "top", label: "Topo (antes de tudo)" },
  { value: "above-form", label: "Acima do formulário" },
  { value: "below-form", label: "Abaixo do formulário" },
  { value: "sidebar", label: "Sidebar (lateral)" },
  { value: "footer", label: "Rodapé" },
];

export default function CheckoutElementEditor({ element, onUpdate, onUpdatePosition }: Props) {
  const def = ELEMENT_DEFINITIONS.find(d => d.type === element.type);
  const c = element.content;
  const update = (key: string, value: any) => onUpdate(element.id, { ...c, [key]: value });

  const handleImageUpload = async (file: File, onUrl: (url: string) => void) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const fileName = `${user.id}/element-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file, { upsert: true });
    if (error) { toast.error("Erro: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
    onUrl(urlData.publicUrl);
    toast.success("Imagem enviada!");
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-[#FF4D2E]/30 bg-[#FF4D2E]/5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold" style={{ color: "#FF4D2E" }}>Editar: {def?.label}</p>
      </div>

      {/* Position selector */}
      <div>
        <Label className="text-[10px]">Posição no checkout</Label>
        <Select value={element.position} onValueChange={(v) => onUpdatePosition(element.id, v as ElementPosition)}>
          <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Type-specific editors */}
      {element.type === "text" && (
        <>
          <div>
            <Label className="text-[10px]">Texto</Label>
            <Textarea value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Tamanho</Label>
              <Input type="number" value={c.fontSize || 14} onChange={e => update("fontSize", e.target.value)} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Peso</Label>
              <Select value={c.fontWeight || "normal"} onValueChange={v => update("fontWeight", v)}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="600">Semi-Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Alinhamento</Label>
              <Select value={c.textAlign || "left"} onValueChange={v => update("textAlign", v)}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Cor do texto</Label>
            <div className="flex items-center gap-1 mt-1">
              <input type="color" value={c.color || "#000000"} onChange={e => update("color", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
              <Input value={c.color || ""} onChange={e => update("color", e.target.value)} className="text-[10px] font-mono" placeholder="Usar cor padrão" />
            </div>
          </div>
        </>
      )}

      {element.type === "image" && (
        <>
          <div>
            <Label className="text-[10px]">URL da imagem</Label>
            <Input value={c.url || ""} onChange={e => update("url", e.target.value)} className="mt-1 text-xs" placeholder="https://..." />
          </div>
          <label className="flex items-center gap-1.5 px-3 py-2 text-xs border border-dashed rounded-lg cursor-pointer hover:bg-muted">
            <Upload className="w-3.5 h-3.5" /> Enviar imagem
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, url => update("url", url)); }} />
          </label>
        </>
      )}

      {element.type === "video" && (
        <div>
          <Label className="text-[10px]">URL do vídeo (YouTube ou Vimeo)</Label>
          <Input value={c.url || ""} onChange={e => update("url", e.target.value)} className="mt-1 text-xs" placeholder="https://youtube.com/watch?v=..." />
        </div>
      )}

      {element.type === "faq" && (
        <>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" />
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="space-y-1 p-2 rounded border border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold">Pergunta {i + 1}</span>
                <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <Input value={item.question} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], question: e.target.value }; update("items", items); }} className="text-xs" placeholder="Pergunta" />
              <Textarea value={item.answer} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], answer: e.target.value }; update("items", items); }} className="text-xs" rows={2} placeholder="Resposta" />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("items", [...(c.items || []), { question: "", answer: "" }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar pergunta
          </Button>
        </>
      )}

      {element.type === "benefits" && (
        <>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" />
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={item.icon} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], icon: e.target.value }; update("items", items); }} className="w-12 text-xs text-center" />
              <Input value={item.text} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], text: e.target.value }; update("items", items); }} className="flex-1 text-xs" />
              <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("items", [...(c.items || []), { icon: "✅", text: "" }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar item
          </Button>
        </>
      )}

      {element.type === "seal" && (
        <div>
          <Label className="text-[10px]">Texto do selo</Label>
          <Input value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" />
        </div>
      )}

      {element.type === "testimonial" && (
        <>
          {(c.items || []).map((t: any, i: number) => (
            <div key={i} className="space-y-1 p-2 rounded border border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold">Depoimento {i + 1}</span>
                <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <Input value={t.name} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], name: e.target.value }; update("items", items); }} className="text-xs" placeholder="Nome" />
              <Textarea value={t.text} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], text: e.target.value }; update("items", items); }} className="text-xs" rows={2} placeholder="Depoimento" />
              <div className="flex items-center gap-2">
                <Label className="text-[10px]">Nota:</Label>
                <Select value={String(t.rating || 5)} onValueChange={v => { const items = [...(c.items || [])]; items[i] = { ...items[i], rating: parseInt(v) }; update("items", items); }}>
                  <SelectTrigger className="w-16 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{"⭐".repeat(n)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("items", [...(c.items || []), { name: "", text: "", rating: 5, avatar: "" }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar depoimento
          </Button>
        </>
      )}

      {element.type === "reviews" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Média</Label>
            <Input type="number" step="0.1" value={c.average || 4.8} onChange={e => update("average", parseFloat(e.target.value))} className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Total avaliações</Label>
            <Input type="number" value={c.total || 0} onChange={e => update("total", parseInt(e.target.value))} className="mt-1 text-xs" />
          </div>
        </div>
      )}

      {element.type === "guarantee" && (
        <>
          <div>
            <Label className="text-[10px]">Dias de garantia</Label>
            <Input type="number" value={c.days || 7} onChange={e => update("days", parseInt(e.target.value))} className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Texto (use {"{days}"} para o número)</Label>
            <Textarea value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" rows={2} />
          </div>
        </>
      )}

      {element.type === "countdown" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Minutos</Label>
              <Input type="number" value={c.minutes || 15} onChange={e => update("minutes", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Texto</Label>
              <Input value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Cor de fundo</Label>
              <div className="flex items-center gap-1 mt-1">
                <input type="color" value={c.bgColor || "#EF4444"} onChange={e => update("bgColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                <Input value={c.bgColor || "#EF4444"} onChange={e => update("bgColor", e.target.value)} className="text-[10px] font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Cor do texto</Label>
              <div className="flex items-center gap-1 mt-1">
                <input type="color" value={c.textColor || "#FFFFFF"} onChange={e => update("textColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                <Input value={c.textColor || "#FFFFFF"} onChange={e => update("textColor", e.target.value)} className="text-[10px] font-mono" />
              </div>
            </div>
          </div>
        </>
      )}

      {element.type === "list" && (
        <>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" />
          </div>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={item.icon} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], icon: e.target.value }; update("items", items); }} className="w-12 text-xs text-center" />
              <Input value={item.text} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], text: e.target.value }; update("items", items); }} className="flex-1 text-xs" />
              <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("items", [...(c.items || []), { icon: "✅", text: "" }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar item
          </Button>
        </>
      )}

      {element.type === "progress" && (
        <>
          <div>
            <Label className="text-[10px]">Porcentagem</Label>
            <Input type="number" value={c.percentage || 73} onChange={e => update("percentage", parseInt(e.target.value))} className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Texto</Label>
            <Input value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Cor da barra</Label>
            <div className="flex items-center gap-1 mt-1">
              <input type="color" value={c.color || "#EF4444"} onChange={e => update("color", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
              <Input value={c.color || ""} onChange={e => update("color", e.target.value)} className="text-[10px] font-mono" />
            </div>
          </div>
        </>
      )}

      {element.type === "sales" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Contagem inicial</Label>
              <Input type="number" value={c.count || 0} onChange={e => update("count", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Intervalo (seg)</Label>
              <Input type="number" value={c.interval || 30} onChange={e => update("interval", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Texto (use {"{count}"})</Label>
            <Input value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[10px]">Animação de incremento</Label>
            <Switch checked={c.showAnimation || false} onCheckedChange={v => update("showAnimation", v)} />
          </div>
        </>
      )}

      {element.type === "gallery" && (
        <>
          <div>
            <Label className="text-[10px]">Colunas</Label>
            <Select value={String(c.columns || 2)} onValueChange={v => update("columns", parseInt(v))}>
              <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 colunas</SelectItem>
                <SelectItem value="3">3 colunas</SelectItem>
                <SelectItem value="4">4 colunas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            {(c.images || []).map((url: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={url} onChange={e => { const imgs = [...(c.images || [])]; imgs[i] = e.target.value; update("images", imgs); }} className="flex-1 text-xs" placeholder="URL da imagem" />
                <button onClick={() => { const imgs = [...(c.images || [])]; imgs.splice(i, 1); update("images", imgs); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => update("images", [...(c.images || []), ""])}>
              <Plus className="w-3 h-3 mr-1" /> URL
            </Button>
            <label className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                <span><Upload className="w-3 h-3 mr-1" /> Upload</span>
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, url => update("images", [...(c.images || []), url])); }} />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
