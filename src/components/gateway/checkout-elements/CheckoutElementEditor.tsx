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
    <div className="space-y-4 p-4 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold" style={{ color: "#a78bfa" }}>Editar: {def?.label}</p>
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
            <Upload className="w-3.5 h-3.5" /> Enviar imagem (até 2MB)
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, url => update("url", url)); }} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Alt text</Label>
              <Input value={c.alt || ""} onChange={e => update("alt", e.target.value)} className="mt-1 text-xs" placeholder="Descrição" />
            </div>
            <div>
              <Label className="text-[10px]">Border radius</Label>
              <Input type="number" value={c.borderRadius || 8} onChange={e => update("borderRadius", e.target.value)} className="mt-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Largura</Label>
            <Input value={c.width || "100%"} onChange={e => update("width", e.target.value)} className="mt-1 text-xs" placeholder="100% ou 300px" />
          </div>
        </>
      )}

      {element.type === "video" && (
        <div>
          <Label className="text-[10px]">URL do vídeo (YouTube ou Vturb)</Label>
          <Input value={c.url || ""} onChange={e => update("url", e.target.value)} className="mt-1 text-xs" placeholder="https://youtube.com/watch?v=... ou Vturb" />
          <p className="text-[9px] text-muted-foreground mt-1">Aceita: YouTube (watch, shorts, embed), Vturb, Vimeo</p>
        </div>
      )}

      {element.type === "faq" && (
        <>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" placeholder="Perguntas Frequentes" />
          </div>
          <div>
            <Label className="text-[10px]">Descrição</Label>
            <Input value={c.description || ""} onChange={e => update("description", e.target.value)} className="mt-1 text-xs" placeholder="FAQ" />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground">Perguntas e Respostas</p>
          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="space-y-2 p-3 rounded-lg border border-border bg-background">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold">Pergunta {i + 1}</span>
                <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div>
                <Label className="text-[10px]">Pergunta</Label>
                <Input value={item.question} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], question: e.target.value }; update("items", items); }} className="mt-1 text-xs" placeholder="Nova Pergunta" />
              </div>
              <div>
                <Label className="text-[10px]">Resposta</Label>
                <Textarea value={item.answer} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], answer: e.target.value }; update("items", items); }} className="mt-1 text-xs" rows={3} placeholder="Nova Resposta" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("items", [...(c.items || []), { question: "Nova Pergunta", answer: "Nova Resposta" }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar Pergunta
          </Button>
        </>
      )}

      {element.type === "benefits" && (
        <>
          <div>
            <Label className="text-[10px]">Título (não exibido, apenas referência)</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" />
          </div>

          <p className="text-[10px] font-semibold text-muted-foreground mt-2">Lista de Benefícios</p>
          <Button variant="outline" size="sm" className="text-xs mb-2" onClick={() => update("items", [...(c.items || []), { icon: "CheckCircle", title: "Novo Benefício", description: "" }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar Benefício
          </Button>

          {(c.items || []).map((item: any, i: number) => (
            <div key={i} className="space-y-2 p-3 rounded-lg border border-border bg-background">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold">Benefício {i + 1}</span>
                <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Ícone</Label>
                  <Select value={item.icon || "CheckCircle"} onValueChange={v => { const items = [...(c.items || [])]; items[i] = { ...items[i], icon: v }; update("items", items); }}>
                    <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Truck","Shield","Clock","Star","Package","CreditCard","Heart","Award","Zap","Gift","ShoppingCart","RefreshCw","Headphones","CheckCircle","ThumbsUp"].map(ic => (
                        <SelectItem key={ic} value={ic}>{ic === "Truck" ? "Caminhão" : ic === "Shield" ? "Escudo" : ic === "Clock" ? "Relógio" : ic === "Star" ? "Estrela" : ic === "Package" ? "Pacote" : ic === "CreditCard" ? "Cartão" : ic === "Heart" ? "Coração" : ic === "Award" ? "Prêmio" : ic === "Zap" ? "Raio" : ic === "Gift" ? "Presente" : ic === "ShoppingCart" ? "Carrinho" : ic === "RefreshCw" ? "Troca" : ic === "Headphones" ? "Suporte" : ic === "CheckCircle" ? "Check" : "Positivo"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Título</Label>
                  <Input value={item.title || item.text || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], title: e.target.value }; update("items", items); }} className="mt-1 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-[10px]">Descrição</Label>
                <Textarea value={item.description || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], description: e.target.value }; update("items", items); }} className="mt-1 text-xs" rows={2} />
              </div>
            </div>
          ))}

          <div className="border-t border-border pt-3 mt-3 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Tamanho do Título</p>
            <Input type="number" value={c.titleSize || 16} onChange={e => update("titleSize", Number(e.target.value))} className="text-xs" />

            <p className="text-[10px] font-semibold text-muted-foreground">Tamanho da Descrição</p>
            <Input type="number" value={c.descSize || 14} onChange={e => update("descSize", Number(e.target.value))} className="text-xs" />
          </div>

          <div className="border-t border-border pt-3 mt-1 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Layout e Espaçamento</p>
            <div>
              <Label className="text-[10px]">Tipo de Layout</Label>
              <Select value={c.layout || "grid"} onValueChange={v => update("layout", v)}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grade (Grid)</SelectItem>
                  <SelectItem value="list">Lista (Vertical)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Espaçamento (Gap)</Label>
              <Input type="number" value={c.gap || 24} onChange={e => update("gap", Number(e.target.value))} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Alinhamento</Label>
              <Select value={c.align || "left"} onValueChange={v => update("align", v)}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-1 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Aparência</p>
            <div>
              <Label className="text-[10px]">Cor do Texto</Label>
              <Input type="color" value={c.textColor || "#000000"} onChange={e => update("textColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Fundo</Label>
              <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
          </div>
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
            <div key={i} className="space-y-2 p-3 rounded-lg border border-border bg-background">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold">Depoimento {i + 1}</span>
                <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>

              {/* Avatar upload */}
              <div>
                <Label className="text-[10px]">Foto do autor</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-border shrink-0 flex items-center justify-center bg-muted">
                    {t.avatar ? (
                      <img src={t.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.name?.[0] || "?"}</span>
                    )}
                  </div>
                  <label className="flex items-center gap-1 px-2 py-1.5 text-[10px] border border-dashed rounded-lg cursor-pointer hover:bg-muted flex-1">
                    <Upload className="w-3 h-3" /> {t.avatar ? "Trocar foto" : "Enviar foto"}
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f, url => {
                        const items = [...(c.items || [])];
                        items[i] = { ...items[i], avatar: url };
                        update("items", items);
                      });
                    }} />
                  </label>
                  {t.avatar && (
                    <button onClick={() => { const items = [...(c.items || [])]; items[i] = { ...items[i], avatar: "" }; update("items", items); }} className="text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <Label className="text-[10px]">Nome</Label>
                <Input value={t.name} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], name: e.target.value }; update("items", items); }} className="mt-1 text-xs" placeholder="Ex: Maria Silva" />
              </div>

              {/* Star rating - clickable stars */}
              <div>
                <Label className="text-[10px]">Estrelas</Label>
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { const items = [...(c.items || [])]; items[i] = { ...items[i], rating: n }; update("items", items); }}
                      className="transition-transform hover:scale-110"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill={n <= (t.rating || 5) ? "#FACC15" : "#D1D5DB"} stroke={n <= (t.rating || 5) ? "#FACC15" : "#D1D5DB"}>
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">{t.rating || 5}/5</span>
                </div>
              </div>

              {/* Testimonial text */}
              <div>
                <Label className="text-[10px]">Depoimento</Label>
                <Textarea value={t.text} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], text: e.target.value }; update("items", items); }} className="mt-1 text-xs" rows={3} placeholder="Texto do depoimento..." />
              </div>

              {/* Time ago */}
              <div>
                <Label className="text-[10px]">Tempo (ex: há 3 dias)</Label>
                <Input value={t.timeAgo || ""} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], timeAgo: e.target.value }; update("items", items); }} className="mt-1 text-xs" placeholder="há 3 dias" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("items", [...(c.items || []), { name: "", text: "", rating: 5, avatar: "", timeAgo: "há 3 dias" }])}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar depoimento
          </Button>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Cores</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Cor do Nome</Label>
                <Input type="color" value={c.nameColor || "#000000"} onChange={e => update("nameColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor do Texto</Label>
                <Input type="color" value={c.textColor || "#666666"} onChange={e => update("textColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor das Estrelas</Label>
                <Input type="color" value={c.starColor || "#FACC15"} onChange={e => update("starColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor do Fundo</Label>
                <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor da Borda</Label>
                <Input type="color" value={c.borderColor || "#e5e7eb"} onChange={e => update("borderColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor do Tempo</Label>
                <Input type="color" value={c.timeColor || "#999999"} onChange={e => update("timeColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
            </div>
          </div>
        </>
      )}

      {element.type === "reviews" && (
        <>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" placeholder="Avaliação dos Clientes" />
          </div>
          <div>
            <Label className="text-[10px]">Estilo</Label>
            <Select value={c.style || "card_avatars"} onValueChange={v => update("style", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="card_avatars">Card com Avatares</SelectItem>
                <SelectItem value="simple">Simples (sem avatares)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Nota Média</Label>
              <Select value={String(c.average || 4.8)} onValueChange={v => update("average", parseFloat(v))}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5.0, 4.9, 4.8, 4.7, 4.6, 4.5, 4.0, 3.5, 3.0].map(v => (
                    <SelectItem key={v} value={String(v)}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Total de Avaliações</Label>
              <Input type="number" value={c.total || 0} onChange={e => update("total", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Tamanho das Estrelas</Label>
            <Select value={c.starSize || "md"} onValueChange={v => update("starSize", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno (14px)</SelectItem>
                <SelectItem value="md">Médio (18px)</SelectItem>
                <SelectItem value="lg">Grande (24px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Tamanho do Título</Label>
            <Select value={c.titleSize || "md"} onValueChange={v => update("titleSize", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno (14px)</SelectItem>
                <SelectItem value="md">Médio (18px)</SelectItem>
                <SelectItem value="lg">Grande (24px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Tamanho da Nota</Label>
            <Select value={c.ratingSize || "md"} onValueChange={v => update("ratingSize", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno (20px)</SelectItem>
                <SelectItem value="md">Médio (30px)</SelectItem>
                <SelectItem value="lg">Grande (40px)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Tamanho do Texto de Reviews</Label>
            <Select value={c.reviewTextSize || "sm"} onValueChange={v => update("reviewTextSize", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xs">Pequeno (12px)</SelectItem>
                <SelectItem value="sm">Normal (14px)</SelectItem>
                <SelectItem value="md">Médio (16px)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(c.style || "card_avatars") === "card_avatars" && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground mt-2">Avatares</p>
              <p className="text-[10px] text-muted-foreground">Use URLs ou faça upload das fotos dos clientes.</p>
              {(c.avatars || []).map((url: string, i: number) => (
                <div key={i} className="space-y-1 p-2 rounded-lg border border-border bg-background">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold">Avatar {i + 1}</span>
                    <button onClick={() => { const avatars = [...(c.avatars || [])]; avatars.splice(i, 1); update("avatars", avatars); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <img src={url} alt="" className="w-8 h-8 rounded-full object-cover border" onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                    <div className="flex-1 flex items-center gap-1">
                      <Input value={url} onChange={e => { const avatars = [...(c.avatars || [])]; avatars[i] = e.target.value; update("avatars", avatars); }} className="text-[10px] flex-1" placeholder="URL da imagem" />
                      <label className="shrink-0 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          const fileName = `${user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
                          const { error } = await supabase.storage.from("product-images").upload(fileName, file, { upsert: true });
                          if (error) { toast.error("Erro: " + error.message); return; }
                          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
                          const avatars = [...(c.avatars || [])]; avatars[i] = urlData.publicUrl; update("avatars", avatars);
                          toast.success("Avatar enviado!");
                        }} />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("avatars", [...(c.avatars || []), ""])}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar Avatar
              </Button>
            </>
          )}

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Cores</p>
            <div>
              <Label className="text-[10px]">Cor das Estrelas</Label>
              <Input type="color" value={c.starColor || "#FACC15"} onChange={e => update("starColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Texto</Label>
              <Input type="color" value={c.textColor || "#000000"} onChange={e => update("textColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Fundo</Label>
              <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
          </div>
        </>
      )}

      {element.type === "guarantee" && (
        <>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" placeholder="Garantia de Satisfação" />
          </div>
          <div>
            <Label className="text-[10px]">Descrição</Label>
            <Textarea value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" rows={3} />
          </div>
          <div>
            <Label className="text-[10px]">Dias de Garantia</Label>
            <Input type="number" value={c.days || 30} onChange={e => update("days", parseInt(e.target.value))} className="mt-1 text-xs" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-[10px]">Mostrar Ícone</Label>
            <Switch checked={c.showIcon !== false} onCheckedChange={v => update("showIcon", v)} />
          </div>
          {c.showIcon !== false && (
            <div>
              <Label className="text-[10px]">Tipo de Ícone</Label>
              <Select value={c.iconType || "shield"} onValueChange={v => update("iconType", v)}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shield">Escudo</SelectItem>
                  <SelectItem value="clock">Relógio</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="award">Prêmio</SelectItem>
                  <SelectItem value="heart">Coração</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Cores</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Cor do Título</Label>
                <Input type="color" value={c.titleColor || "#000000"} onChange={e => update("titleColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor da Descrição</Label>
                <Input type="color" value={c.descColor || "#666666"} onChange={e => update("descColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor do Ícone</Label>
                <Input type="color" value={c.iconColor || "#16A34A"} onChange={e => update("iconColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
              <div>
                <Label className="text-[10px]">Cor do Fundo</Label>
                <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Espaçamento e Fundo da Seção</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Espaçamento Superior</Label>
                <Input type="number" value={c.paddingTop || 0} onChange={e => update("paddingTop", parseInt(e.target.value))} className="mt-1 text-xs" placeholder="0px" />
              </div>
              <div>
                <Label className="text-[10px]">Espaçamento Inferior</Label>
                <Input type="number" value={c.paddingBottom || 0} onChange={e => update("paddingBottom", parseInt(e.target.value))} className="mt-1 text-xs" placeholder="0px" />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Cor de Fundo da Seção</Label>
              <Input type="color" value={c.sectionBgColor || "#ffffff"} onChange={e => update("sectionBgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
          </div>
        </>
      )}

      {element.type === "countdown" && (
        <>
          <p className="text-[10px] font-semibold text-muted-foreground">Configuração do Cronômetro</p>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.text || ""} onChange={e => update("text", e.target.value)} className="mt-1 text-xs" placeholder="Oferta termina em:" />
          </div>
          <div>
            <Label className="text-[10px]">Tipo de Cronômetro</Label>
            <Select value={c.timerType || "fixed"} onValueChange={v => update("timerType", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Tempo Fixo (Reinicia sempre)</SelectItem>
                <SelectItem value="once">Contagem única</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Tempo Fixo (minutos)</Label>
            <Select value={String(c.minutes || 10)} onValueChange={v => update("minutes", parseInt(v))}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 30, 45, 60].map(v => (
                  <SelectItem key={v} value={String(v)}>{v} minutos</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(c.timerType || "fixed") === "fixed" && (
              <p className="text-[10px] text-muted-foreground mt-1">O cronômetro reiniciará sempre que a página for carregada.</p>
            )}
          </div>
          <div>
            <Label className="text-[10px]">Estilo do Timer</Label>
            <Select value={c.style || "cards"} onValueChange={v => update("style", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cards">Padrão (Cards)</SelectItem>
                <SelectItem value="banner">Banner (Linha)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Tipografia</p>
            <div>
              <Label className="text-[10px]">Tamanho do título</Label>
              <div className="flex items-center gap-1 mt-1">
                <Input type="number" value={c.titleSize || 14} onChange={e => update("titleSize", parseInt(e.target.value))} className="text-xs flex-1" />
                <span className="text-[10px] text-muted-foreground">px</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Tamanho dos números</Label>
              <div className="flex items-center gap-1 mt-1">
                <Input type="number" value={c.numberSize || 24} onChange={e => update("numberSize", parseInt(e.target.value))} className="text-xs flex-1" />
                <span className="text-[10px] text-muted-foreground">px</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Aparência</p>
            <div>
              <Label className="text-[10px]">Cor do Título</Label>
              <p className="text-[9px] text-muted-foreground">Cor do texto &quot;Oferta termina em:&quot;</p>
              <Input type="color" value={c.titleColor || "#333333"} onChange={e => update("titleColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor dos Números</Label>
              <p className="text-[9px] text-muted-foreground">Cor dos números do cronômetro</p>
              <Input type="color" value={c.numberColor || "#111111"} onChange={e => update("numberColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Fundo dos Números</Label>
              <p className="text-[9px] text-muted-foreground">Cor de fundo dos blocos/cápsulas dos números</p>
              <Input type="color" value={c.numberBgColor || "#F3F4F6"} onChange={e => update("numberBgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor dos Rótulos</Label>
              <p className="text-[9px] text-muted-foreground">Cor dos textos &quot;Horas&quot;, &quot;Minutos&quot; e &quot;Segundos&quot;</p>
              <Input type="color" value={c.labelColor || "#999999"} onChange={e => update("labelColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor de Destaque</Label>
              <p className="text-[9px] text-muted-foreground">Usada em bordas, separadores e detalhes visuais</p>
              <Input type="color" value={c.accentColor || "#E5E7EB"} onChange={e => update("accentColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Fundo</Label>
              <p className="text-[9px] text-muted-foreground">Cor de fundo do cronômetro</p>
              <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
          </div>
        </>
      )}

      {element.type === "list" && (
        <>
          <p className="text-[10px] font-semibold text-muted-foreground">Configuração da Lista</p>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" placeholder="Principais Benefícios" />
          </div>
          <div>
            <Label className="text-[10px]">Estilo do ícone</Label>
            <Select value={c.iconStyle || "check"} onValueChange={v => update("iconStyle", v)}>
              <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check">✓ Check simples</SelectItem>
                <SelectItem value="circle-check">☑ Check circular</SelectItem>
                <SelectItem value="emoji">😀 Emoji personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground">Itens</p>
            {(c.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                {(c.iconStyle || "check") === "emoji" && (
                  <Input value={item.icon} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], icon: e.target.value }; update("items", items); }} className="w-12 text-xs text-center" />
                )}
                <Input value={item.text} onChange={e => { const items = [...(c.items || [])]; items[i] = { ...items[i], text: e.target.value }; update("items", items); }} className="flex-1 text-xs" />
                <button onClick={() => { const items = [...(c.items || [])]; items.splice(i, 1); update("items", items); }} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => update("items", [...(c.items || []), { icon: "✅", text: "" }])}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar item
            </Button>
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Tipografia</p>
            <div>
              <Label className="text-[10px]">Tamanho do título</Label>
              <div className="flex items-center gap-1 mt-1">
                <Input type="number" value={c.titleSize || 16} onChange={e => update("titleSize", parseInt(e.target.value))} className="text-xs flex-1" />
                <span className="text-[10px] text-muted-foreground">px</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Tamanho dos itens</Label>
              <div className="flex items-center gap-1 mt-1">
                <Input type="number" value={c.itemSize || 14} onChange={e => update("itemSize", parseInt(e.target.value))} className="text-xs flex-1" />
                <span className="text-[10px] text-muted-foreground">px</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Cores</p>
            <div>
              <Label className="text-[10px]">Cor do Título</Label>
              <Input type="color" value={c.titleColor || "#333333"} onChange={e => update("titleColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor dos Itens</Label>
              <Input type="color" value={c.itemColor || "#333333"} onChange={e => update("itemColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Ícone</Label>
              <Input type="color" value={c.iconColor || "#16A34A"} onChange={e => update("iconColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Fundo</Label>
              <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor da Borda</Label>
              <Input type="color" value={c.borderColor || "#E5E7EB"} onChange={e => update("borderColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
          </div>
        </>
      )}

      {element.type === "progress" && (
        <>
          <p className="text-[10px] font-semibold text-muted-foreground">Configuração do Progresso</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Valor Atual</Label>
              <Input type="number" value={c.percentage || 40} onChange={e => update("percentage", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Valor Máximo</Label>
              <Input type="number" value={c.maxValue || 100} onChange={e => update("maxValue", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" placeholder="Etapas do Processo" />
          </div>
          <div>
            <Label className="text-[10px]">Descrição</Label>
            <Input value={c.description || ""} onChange={e => update("description", e.target.value)} className="mt-1 text-xs" placeholder="Ex: Complete os dados para prosseguir" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[10px]">Mostrar Valor</Label>
              <p className="text-[9px] text-muted-foreground">Exibir o valor atual</p>
            </div>
            <Switch checked={c.showValue || false} onCheckedChange={v => update("showValue", v)} />
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Aparência</p>
            <div>
              <Label className="text-[10px]">Altura</Label>
              <Select value={c.barHeight || "md"} onValueChange={v => update("barHeight", v)}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Pequena (8px)</SelectItem>
                  <SelectItem value="md">Média (16px)</SelectItem>
                  <SelectItem value="lg">Grande (24px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Estilo da Barra</Label>
              <Select value={c.barStyle || "solid"} onValueChange={v => update("barStyle", v)}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Sólido</SelectItem>
                  <SelectItem value="gradient">Gradiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Cor da Barra</Label>
              <Input type="color" value={c.color || "#3B82F6"} onChange={e => update("color", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Texto</Label>
              <Input type="color" value={c.textColor || "#333333"} onChange={e => update("textColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Fundo</Label>
              <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
          </div>
        </>
      )}

      {element.type === "sales" && (
        <>
          <p className="text-[10px] font-semibold text-muted-foreground">Configuração de Vendas</p>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" placeholder="Atenção" />
          </div>
          <div>
            <Label className="text-[10px]">Descrição</Label>
            <Input value={c.description || ""} onChange={e => update("description", e.target.value)} className="mt-1 text-xs" placeholder="Não perca essa oportunidade!" />
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Valores</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Valor Inicial</Label>
                <Input type="number" value={c.count || 50} onChange={e => update("count", parseInt(e.target.value))} className="mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Valor Mínimo</Label>
                <Input type="number" value={c.minValue || 600} onChange={e => update("minValue", parseInt(e.target.value))} className="mt-1 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Valor Máximo</Label>
                <Input type="number" value={c.maxValue || 1000} onChange={e => update("maxValue", parseInt(e.target.value))} className="mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Incremento</Label>
                <Input type="number" value={c.increment || 1} onChange={e => update("increment", parseInt(e.target.value))} className="mt-1 text-xs" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[10px]">Incremento Aleatório</Label>
                <p className="text-[9px] text-muted-foreground">Usar valores aleatórios para incremento</p>
              </div>
              <Switch checked={c.randomIncrement || false} onCheckedChange={v => update("randomIncrement", v)} />
            </div>
            {c.randomIncrement && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Incremento Mínimo</Label>
                  <Input type="number" value={c.incrementMin || 1} onChange={e => update("incrementMin", parseInt(e.target.value))} className="mt-1 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Incremento Máximo</Label>
                  <Input type="number" value={c.incrementMax || 5} onChange={e => update("incrementMax", parseInt(e.target.value))} className="mt-1 text-xs" />
                </div>
              </div>
            )}
            <div>
              <Label className="text-[10px]">Intervalo (ms)</Label>
              <Input type="number" value={c.interval || 800} onChange={e => update("interval", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Configurações</p>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[10px]">Mostrar Ícone</Label>
                <p className="text-[9px] text-muted-foreground">Exibir ícone de vendas</p>
              </div>
              <Switch checked={c.showIcon !== false} onCheckedChange={v => update("showIcon", v)} />
            </div>
            {c.showIcon !== false && (
              <div>
                <Label className="text-[10px]">Posição do Ícone</Label>
                <Select value={c.iconPosition || "left"} onValueChange={v => update("iconPosition", v)}>
                  <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Esquerda</SelectItem>
                    <SelectItem value="right">Direita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-[10px]">Formato</Label>
              <Select value={c.format || "default"} onValueChange={v => update("format", v)}>
                <SelectTrigger className="mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {c.format === "custom" && (
              <div>
                <Label className="text-[10px]">Formato Personalizado</Label>
                <Input value={c.customFormat || "{value} Compras"} onChange={e => update("customFormat", e.target.value)} className="mt-1 text-xs" placeholder="{value} Compras" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[10px]">Animação</Label>
                <p className="text-[9px] text-muted-foreground">Animar mudanças de valor</p>
              </div>
              <Switch checked={c.showAnimation || false} onCheckedChange={v => update("showAnimation", v)} />
            </div>
            {c.showAnimation && (
              <div>
                <Label className="text-[10px]">Duração da Animação (ms)</Label>
                <Input type="number" value={c.animationDuration || 1000} onChange={e => update("animationDuration", parseInt(e.target.value))} className="mt-1 text-xs" />
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Tipografia</p>
            <div>
              <Label className="text-[10px]">Tamanho do Título</Label>
              <Input type="number" value={c.titleSize || 18} onChange={e => update("titleSize", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Tamanho da Descrição</Label>
              <Input type="number" value={c.descSize || 14} onChange={e => update("descSize", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Tamanho do Valor</Label>
              <Input type="number" value={c.valueSize || 30} onChange={e => update("valueSize", parseInt(e.target.value))} className="mt-1 text-xs" />
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-2 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Cores</p>
            <div>
              <Label className="text-[10px]">Cor do Valor</Label>
              <Input type="color" value={c.valueColor || "#16A34A"} onChange={e => update("valueColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Ícone</Label>
              <Input type="color" value={c.iconColor || "#16A34A"} onChange={e => update("iconColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Texto</Label>
              <Input type="color" value={c.textColor || "#333333"} onChange={e => update("textColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor do Fundo</Label>
              <Input type="color" value={c.bgColor || "#ffffff"} onChange={e => update("bgColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
            <div>
              <Label className="text-[10px]">Cor da Borda</Label>
              <Input type="color" value={c.borderColor || "#E5E7EB"} onChange={e => update("borderColor", e.target.value)} className="mt-1 h-8 w-full" />
            </div>
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

      {element.type === "upsell" && (
        <>
          <div>
            <Label className="text-[10px]">Nome do produto</Label>
            <Input value={c.productName || ""} onChange={e => update("productName", e.target.value)} className="mt-1 text-xs" placeholder="Produto Extra" />
          </div>
          <div>
            <Label className="text-[10px]">Título</Label>
            <Input value={c.title || ""} onChange={e => update("title", e.target.value)} className="mt-1 text-xs" placeholder="Oferta Especial!" />
          </div>
          <div>
            <Label className="text-[10px]">Descrição</Label>
            <Textarea value={c.description || ""} onChange={e => update("description", e.target.value)} className="mt-1 text-xs" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Preço original (R$)</Label>
              <Input type="number" value={c.originalPrice || 0} onChange={e => update("originalPrice", Number(e.target.value))} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Preço com desconto (R$)</Label>
              <Input type="number" value={c.price || 0} onChange={e => update("price", Number(e.target.value))} className="mt-1 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Imagem do produto</Label>
            <Input value={c.image || ""} onChange={e => update("image", e.target.value)} className="mt-1 text-xs" placeholder="https://..." />
            <label className="flex items-center gap-1.5 px-3 py-2 mt-1 text-xs border border-dashed rounded-lg cursor-pointer hover:bg-muted">
              <Upload className="w-3.5 h-3.5" /> Enviar imagem
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, url => update("image", url)); }} />
            </label>
          </div>
          <div>
            <Label className="text-[10px]">Texto do botão</Label>
            <Input value={c.buttonText || ""} onChange={e => update("buttonText", e.target.value)} className="mt-1 text-xs" placeholder="Adicionar ao pedido" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={c.showBadge !== false} onCheckedChange={v => update("showBadge", v)} />
            <Label className="text-[10px]">Mostrar badge</Label>
          </div>
          {c.showBadge !== false && (
            <div>
              <Label className="text-[10px]">Texto do badge</Label>
              <Input value={c.badgeText || ""} onChange={e => update("badgeText", e.target.value)} className="mt-1 text-xs" placeholder="OFERTA ÚNICA" />
            </div>
          )}
          <div className="border-t border-border pt-3 mt-1 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground">Cores</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Cor do botão</Label>
                <div className="flex items-center gap-1 mt-1">
                  <input type="color" value={c.buttonColor || "#EF4444"} onChange={e => update("buttonColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                  <Input value={c.buttonColor || ""} onChange={e => update("buttonColor", e.target.value)} className="text-[10px] font-mono" placeholder="Padrão" />
                </div>
              </div>
              <div>
                <Label className="text-[10px]">Cor do preço</Label>
                <div className="flex items-center gap-1 mt-1">
                  <input type="color" value={c.priceColor || "#EF4444"} onChange={e => update("priceColor", e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                  <Input value={c.priceColor || ""} onChange={e => update("priceColor", e.target.value)} className="text-[10px] font-mono" placeholder="Padrão" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
