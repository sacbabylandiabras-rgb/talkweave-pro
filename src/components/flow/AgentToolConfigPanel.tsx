import { useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { findAgentToolBlock } from "./agentToolBlocks";
import { SocialProofManager } from "./SocialProofManager";
import { DeliverablesManager } from "./DeliverablesManager";
import {
  Info,
  Package,
  ShieldCheck,
  Receipt,
  Paperclip,
  Tag,
  Users,
  CheckCircle2,
  CalendarClock,
  Brain,
  Globe,
  Link2,
  ClipboardList,
  Briefcase,
  Search,
  Plug,
  Clock,
  AlertTriangle,
  X,
  History,
  SlidersHorizontal,
  Lightbulb,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Bot, Sparkles, BookOpen, ArrowRightLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CLAUDE_MODELS = [
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", in: "3,00", out: "15,00", cache: "0,30" },
  { value: "claude-opus-4-1", label: "Claude Opus 4.1", in: "15,00", out: "75,00", cache: "1,50" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", in: "3,00", out: "15,00", cache: "0,30" },
  { value: "claude-3-5-haiku", label: "Claude 3.5 Haiku", in: "0,80", out: "4,00", cache: "0,08" },
];

function ProductsPreview({ node, setNode }: Props) {
  const [items, setItems] = useState<Array<{ id: string; name: string; price: number; image_url: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const selectedIds: string[] = Array.isArray(node.data?.selectedProductIds) ? node.data.selectedProductIds : [];
  const useAll: boolean = node.data?.useAllProducts !== false && selectedIds.length === 0;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("agent_products")
        .select("id,name,price,image_url")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(500);
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setData(node, setNode, { selectedProductIds: next, useAllProducts: false });
  };

  const filtered = items.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Produtos disponíveis</Label>
        <span className="text-[11px] text-muted-foreground">
          {useAll ? `Todos (${items.length})` : `${selectedIds.length} selecionado(s)`}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-md border p-2">
        <Checkbox
          id="use-all-products"
          checked={useAll}
          onCheckedChange={(c) =>
            setData(node, setNode, { useAllProducts: !!c, selectedProductIds: c ? [] : selectedIds })
          }
        />
        <Label htmlFor="use-all-products" className="cursor-pointer text-xs">
          Usar todos os produtos
        </Label>
      </div>

      {!useAll && (
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8"
        />
      )}

      <div className="rounded-md border bg-muted/30 max-h-56 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground p-3">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">
            {items.length === 0 ? "Nenhum produto cadastrado ainda." : "Nenhum produto encontrado."}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((p) => {
              const checked = useAll || selectedIds.includes(p.id);
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 p-2 ${useAll ? "" : "cursor-pointer hover:bg-muted/50"}`}
                  onClick={() => !useAll && toggle(p.id)}
                >
                  <Checkbox checked={checked} disabled={useAll} onCheckedChange={() => toggle(p.id)} />
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      R$ {Number(p.price || 0).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {useAll
          ? "O agente terá acesso a todos os produtos ativos."
          : "O agente usará apenas os produtos selecionados acima."}
      </p>
    </div>
  );
}

function PoliciesManager() {
  const [items, setItems] = useState<Array<{ id: string; title: string | null; content: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("agent_knowledge")
      .select("id,title,content")
      .eq("user_id", user.id)
      .eq("type", "policy")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!title.trim() && !content.trim()) {
      toast({ title: "Preencha título ou conteúdo", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("agent_knowledge").insert({
      user_id: user.id,
      type: "policy",
      title: title.trim() || null,
      content: content.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Política adicionada" });
    setTitle(""); setContent(""); setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("agent_knowledge").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Políticas e regras cadastradas ({items.length})</Label>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <ShieldCheck className="h-3 w-3 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="rounded-md border bg-muted/30 max-h-56 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-muted-foreground p-3">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">Nenhuma política cadastrada ainda.</p>
        ) : (
          <ul className="divide-y">
            {items.map((p) => (
              <li key={p.id} className="flex items-start gap-2 p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.title || "Sem título"}</p>
                  {p.content && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{p.content}</p>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(p.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Nova política / regra
            </DialogTitle>
            <DialogDescription>
              Adicione uma informação que o agente poderá consultar (ex: horário, política de troca).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Horário de atendimento" />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Descreva a regra ou política..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModelSelectClaude({ node, setNode }: Props) {
  const value = node.data?.aiModel && CLAUDE_MODELS.some(m => m.value === node.data.aiModel)
    ? node.data.aiModel
    : "claude-sonnet-4-5";
  const current = CLAUDE_MODELS.find(m => m.value === value)!;
  return (
    <div className="space-y-2">
      <Label>Modelo de IA</Label>
      <Select value={value} onValueChange={(v) => setData(node, setNode, { aiModel: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {CLAUDE_MODELS.map(m => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground">
        Tokens de entrada: {current.in}$/Milhão · Tokens de saída: {current.out}$/Milhão · Cache: {current.cache}$/Milhão
      </p>
    </div>
  );
}

function AdvancedDialog({ node, setNode, open, onOpenChange }: Props & { open: boolean; onOpenChange: (b: boolean) => void }) {
  const temperature = node.data?.temperature ?? 0.7;
  const maxTokens = node.data?.maxTokens ?? 2048;
  const topP = node.data?.topP ?? 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Configurações Avançadas</DialogTitle>
          <DialogDescription>Ajuste os parâmetros do modelo de IA para este sub-agente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Temperature: {temperature.toFixed(2)}</Label>
            <Slider min={0} max={1} step={0.05} value={[temperature]} onValueChange={(v) => setData(node, setNode, { temperature: v[0] })} className="mt-2" />
            <p className="text-[11px] text-muted-foreground mt-1">Controla a criatividade. Valores baixos = mais determinístico.</p>
          </div>
          <div>
            <Label>Top P: {topP.toFixed(2)}</Label>
            <Slider min={0} max={1} step={0.05} value={[topP]} onValueChange={(v) => setData(node, setNode, { topP: v[0] })} className="mt-2" />
          </div>
          <div>
            <Label>Máximo de tokens de saída</Label>
            <Input type="number" min={1} max={8192} value={maxTokens} onChange={(e) => setData(node, setNode, { maxTokens: Number(e.target.value) || 0 })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromptHistoryDialog({ node, setNode, open, onOpenChange }: Props & { open: boolean; onOpenChange: (b: boolean) => void }) {
  const history: Array<{ prompt: string; savedAt: string }> = Array.isArray(node.data?.promptHistory) ? node.data.promptHistory : [];
  const current: string = node.data?.systemPrompt || "";
  const save = () => {
    if (!current.trim()) {
      toast({ title: "Prompt vazio", description: "Escreva um system prompt antes de salvar.", variant: "destructive" });
      return;
    }
    const next = [{ prompt: current, savedAt: new Date().toISOString() }, ...history].slice(0, 20);
    setData(node, setNode, { promptHistory: next });
    toast({ title: "Prompt salvo no histórico" });
  };
  const restore = (p: string) => {
    setData(node, setNode, { systemPrompt: p });
    toast({ title: "Prompt restaurado" });
    onOpenChange(false);
  };
  const remove = (i: number) => {
    const next = history.filter((_, idx) => idx !== i);
    setData(node, setNode, { promptHistory: next });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico de Prompts</DialogTitle>
          <DialogDescription>Salve versões do system prompt e restaure quando quiser.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          <Button variant="outline" size="sm" onClick={save} className="w-full">
            + Salvar prompt atual no histórico
          </Button>
          {history.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic text-center py-4">Nenhum prompt salvo ainda.</p>
          ) : history.map((h, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{new Date(h.savedAt).toLocaleString("pt-BR")}</span>
                <button onClick={() => remove(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </div>
              <p className="text-[12px] line-clamp-3 whitespace-pre-wrap">{h.prompt}</p>
              <Button size="sm" variant="outline" onClick={() => restore(h.prompt)} className="w-full h-7 text-[11px]">Restaurar este prompt</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkSkillsDialog({ node, setNode, open, onOpenChange }: Props & { open: boolean; onOpenChange: (b: boolean) => void }) {
  const [folders, setFolders] = useState<Array<{ id: string; name: string; description: string | null; color: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const linked: string[] = Array.isArray(node.data?.linkedSkillIds) ? node.data.linkedSkillIds : [];
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).from("skill_folders").select("id, name, description, color").order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Erro ao carregar skills", description: error.message, variant: "destructive" });
      } else {
        setFolders(data || []);
      }
      setLoading(false);
    })();
  }, [open]);
  const toggle = (id: string) => {
    const next = linked.includes(id) ? linked.filter(x => x !== id) : [...linked, id];
    setData(node, setNode, { linkedSkillIds: next });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Vincular Skills</DialogTitle>
          <DialogDescription>Selecione as skills que este sub-agente deve usar como contexto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <p className="text-[12px] text-muted-foreground text-center py-4">Carregando…</p>
          ) : folders.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic text-center py-4">Nenhuma skill cadastrada. Acesse /skills para criar.</p>
          ) : folders.map(f => {
            const checked = linked.includes(f.id);
            return (
              <label key={f.id} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={checked} onCheckedChange={() => toggle(f.id)} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {f.color && <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />}
                    <span className="text-sm font-medium truncate">{f.name}</span>
                  </div>
                  {f.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{f.description}</p>}
                </div>
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubAgentExtras({ node, setNode }: Props) {
  const [advOpen, setAdvOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const linked: string[] = Array.isArray(node.data?.linkedSkillIds) ? node.data.linkedSkillIds : [];
  const [linkedNames, setLinkedNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (linked.length === 0) return;
    (async () => {
      const { data } = await (supabase as any).from("skill_folders").select("id, name").in("id", linked);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.id] = r.name; });
      setLinkedNames(map);
    })();
  }, [linked.join(",")]);
  return {
    headerButtons: (
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setAdvOpen(true)}>Avançado</Button>
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setHistOpen(true)}>HISTÓRICO DE PROMPTS</Button>
      </div>
    ),
    skillsBlock: (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Skills</Label>
          <Button variant="outline" size="sm" onClick={() => setSkillsOpen(true)}>+ Vincular Skill</Button>
        </div>
        {linked.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Nenhuma skill vinculada</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {linked.map(id => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]">
                <Lightbulb className="h-3 w-3" />
                {linkedNames[id] || id.slice(0, 6)}
                <button
                  onClick={() => setData(node, setNode, { linkedSkillIds: linked.filter(x => x !== id) })}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    ),
    dialogs: (
      <>
        <AdvancedDialog node={node} setNode={setNode} open={advOpen} onOpenChange={setAdvOpen} />
        <PromptHistoryDialog node={node} setNode={setNode} open={histOpen} onOpenChange={setHistOpen} />
        <LinkSkillsDialog node={node} setNode={setNode} open={skillsOpen} onOpenChange={setSkillsOpen} />
      </>
    ),
  };
}

function RagControls({ node, setNode }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; title: string | null; content: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const linked: string[] = Array.isArray(node.data?.ragEntryIds) ? node.data.ragEntryIds : [];
  const [linkedLabels, setLinkedLabels] = useState<Record<string, string>>({});

  const loadItems = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from("agent_knowledge")
      .select("id, title, content")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (linkOpen) loadItems();
  }, [linkOpen]);

  useEffect(() => {
    if (linked.length === 0) { setLinkedLabels({}); return; }
    (async () => {
      const { data } = await (supabase as any).from("agent_knowledge").select("id, title").in("id", linked);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.id] = r.title || "Sem título"; });
      setLinkedLabels(map);
    })();
  }, [linked.join(",")]);

  const saveEntry = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const { data, error } = await (supabase as any)
      .from("agent_knowledge")
      .insert({ user_id: session.user.id, title: title.trim(), content: content.trim(), type: "rag", active: true })
      .select("id, title")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    const next = [...linked, data.id];
    setData(node, setNode, { ragEntryIds: next });
    setTitle(""); setContent(""); setAddOpen(false);
    toast({ title: "Informação adicionada e vinculada" });
  };

  const toggle = (id: string) => {
    const next = linked.includes(id) ? linked.filter(x => x !== id) : [...linked, id];
    setData(node, setNode, { ragEntryIds: next });
  };

  return {
    openAdd: () => setAddOpen(true),
    openLink: () => setLinkOpen(true),
    linkedBlock: (
      <div className="space-y-1">
        <Label className="text-[11px]">Vinculados ({linked.length})</Label>
        {linked.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Nenhuma base de conhecimento vinculada.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {linked.map(id => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]">
                <BookOpen className="h-3 w-3" />
                {linkedLabels[id] || id.slice(0, 6)}
                <button onClick={() => toggle(id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    ),
    dialogs: (
      <>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Adicionar informação ao RAG</DialogTitle>
              <DialogDescription>Crie uma nova entrada na base de conhecimento e vincule a este bloco.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Política de trocas" />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Texto completo que o agente deve consultar..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={saveEntry} disabled={saving}>{saving ? "Salvando..." : "Salvar e vincular"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Vincular RAG existente</DialogTitle>
              <DialogDescription>Selecione as bases de conhecimento que este bloco deve consultar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loading ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">Carregando…</p>
              ) : items.length === 0 ? (
                <p className="text-[12px] text-muted-foreground italic text-center py-4">Nenhuma informação cadastrada ainda.</p>
              ) : items.map(it => {
                const checked = linked.includes(it.id);
                return (
                  <label key={it.id} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(it.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.title || "Sem título"}</div>
                      {it.content && <p className="text-[11px] text-muted-foreground line-clamp-2">{it.content}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
            <DialogFooter>
              <Button onClick={() => setLinkOpen(false)}>Concluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    ),
  };
}

interface Props {
  node: any;
  setNode: (n: any) => void;
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/10 dark:bg-primary/5 p-3 text-[12px] leading-relaxed text-foreground/90 space-y-1">
      {children}
    </div>
  );
}

function DescField({
  node,
  setNode,
  label,
  placeholder = "Descreva quando o agente deve usar esta ferramenta...",
}: Props & { label: string; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea
        value={node.data?.description || ""}
        onChange={(e) =>
          setNode({ ...node, data: { ...node.data, description: e.target.value } })
        }
        placeholder={placeholder}
        rows={3}
      />
    </div>
  );
}

function FuncList({ items }: { items: { name: string; desc: string }[] }) {
  return (
    <InfoBlock>
      <div className="font-semibold text-[11px] uppercase tracking-wider text-primary mb-1">
        Funções disponíveis
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.name} className="text-[11px]">
            <code className="font-mono text-primary">{it.name}</code>: {it.desc}
          </li>
        ))}
      </ul>
    </InfoBlock>
  );
}

function setData(node: any, setNode: (n: any) => void, patch: Record<string, any>) {
  setNode({ ...node, data: { ...node.data, ...patch } });
}

type KV = { key: string; value: string; desc?: string; required?: boolean };

function ParamRows({
  rows,
  onChange,
  showDesc,
  showRequired,
  keyPlaceholder = "nome",
  valuePlaceholder = "valor",
}: {
  rows: KV[];
  onChange: (rows: KV[]) => void;
  showDesc?: boolean;
  showRequired?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (i: number, patch: Partial<KV>) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: "", value: "" }]);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="space-y-1 rounded-md border border-border p-2">
          <div className="flex gap-2">
            <Input
              value={r.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder={keyPlaceholder}
              className="h-8 flex-1"
            />
            {!showDesc && (
              <Input
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={valuePlaceholder}
                className="h-8 flex-1"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => remove(i)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {showDesc && (
            <Input
              value={r.desc || ""}
              onChange={(e) => update(i, { desc: e.target.value })}
              placeholder="Descrição (o que a IA deve preencher)"
              className="h-8"
            />
          )}
          {showRequired && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Checkbox
                checked={!!r.required}
                onCheckedChange={(c) => update(i, { required: !!c })}
              />
              Obrigatório
            </label>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        + Adicionar
      </Button>
    </div>
  );
}

function ConsultaApiPanel({
  node,
  setNode,
  Header,
}: {
  node: any;
  setNode: (n: any) => void;
  Header: ReactNode;
}) {
  const aiParams: KV[] = Array.isArray(node.data?.aiParams) ? node.data.aiParams : [];
  const headers: KV[] = Array.isArray(node.data?.headers) ? node.data.headers : [];
  const bodyParams: KV[] = Array.isArray(node.data?.bodyParams) ? node.data.bodyParams : [];
  const queryParams: KV[] = Array.isArray(node.data?.queryParams) ? node.data.queryParams : [];
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Debounced auto-save to agent_tools_config.config so the agent executor can use it
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setSaving(true);
        const config = {
          apiUrl: node.data?.apiUrl || "",
          httpMethod: node.data?.httpMethod || "GET",
          description: node.data?.description || "",
          aiParams,
          headers,
          bodyParams,
          queryParams,
        };
        await (supabase as any)
          .from("agent_tools_config")
          .upsert(
            { user_id: session.user.id, tool_name: "consulta_api_ia", enabled: true, config },
            { onConflict: "user_id,tool_name" }
          );
        setSavedAt(Date.now());
      } catch (e) {
        console.error("save consulta_api config", e);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    node.data?.apiUrl,
    node.data?.httpMethod,
    node.data?.description,
    JSON.stringify(aiParams),
    JSON.stringify(headers),
    JSON.stringify(bodyParams),
    JSON.stringify(queryParams),
  ]);

  return (
    <>
      {Header}
      <DescField
        node={node}
        setNode={setNode}
        label="Descrição da ferramenta — Requisição API"
        placeholder="Descreva em detalhes quando e como esta API deve ser utilizada pelo agente IA"
      />
      <div className="space-y-2">
        <Label>Endpoint da API</Label>
        <div className="flex gap-2">
          <Select
            value={node.data?.httpMethod || "GET"}
            onValueChange={(v) => setData(node, setNode, { httpMethod: v })}
          >
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={node.data?.apiUrl || ""}
            onChange={(e) => setData(node, setNode, { apiUrl: e.target.value })}
            placeholder="https://api.exemplo.com/endpoint"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Use variáveis dinâmicas: <code>{"{{ai.campo}}"}</code>, <code>{"{{lead.campo}}"}</code>, <code>{"{{phone}}"}</code>
        </p>
        <p className="text-[10px] text-muted-foreground">
          {saving ? "Salvando…" : savedAt ? "Configuração salva ✓" : "Edite para salvar automaticamente"}
        </p>
      </div>
      <Accordion type="multiple" className="w-full" defaultValue={["ai"]}>
        <AccordionItem value="ai">
          <AccordionTrigger className="text-sm">Parâmetros da IA</AccordionTrigger>
          <AccordionContent>
            <p className="text-[11px] text-muted-foreground mb-2">
              Campos que o agente IA deve preencher ao acionar esta tool. Referencie-os com{" "}
              <code>{"{{ai.nome}}"}</code> na URL, headers, body ou query.
            </p>
            <ParamRows
              rows={aiParams}
              onChange={(rows) => setData(node, setNode, { aiParams: rows })}
              showDesc
              showRequired
              keyPlaceholder="nome_do_campo"
            />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="headers">
          <AccordionTrigger className="text-sm">Parâmetros Headers</AccordionTrigger>
          <AccordionContent>
            <p className="text-[11px] text-muted-foreground mb-2">
              Cabeçalhos HTTP enviados nesta requisição.
            </p>
            <ParamRows
              rows={headers}
              onChange={(rows) => setData(node, setNode, { headers: rows })}
              keyPlaceholder="Authorization"
              valuePlaceholder="Bearer xxx"
            />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="body">
          <AccordionTrigger className="text-sm">Parâmetros Body</AccordionTrigger>
          <AccordionContent>
            <p className="text-[11px] text-muted-foreground mb-2">
              Campos do corpo (POST, PUT, PATCH). Enviado como JSON.
            </p>
            <ParamRows
              rows={bodyParams}
              onChange={(rows) => setData(node, setNode, { bodyParams: rows })}
            />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="query">
          <AccordionTrigger className="text-sm">Parâmetros Query</AccordionTrigger>
          <AccordionContent>
            <p className="text-[11px] text-muted-foreground mb-2">
              Parâmetros acrescentados à query string da URL.
            </p>
            <ParamRows
              rows={queryParams}
              onChange={(rows) => setData(node, setNode, { queryParams: rows })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

export function AgentToolConfigPanel({ node, setNode }: Props) {
  // placeholder marker
  return <AgentToolConfigPanelInner node={node} setNode={setNode} />;
}

type McpTool = { name: string; description?: string; inputSchema?: any; enabled?: boolean };

function McpPanel({ node, setNode, Header }: { node: any; setNode: (n: any) => void; Header: ReactNode }) {
  const mcpUrl: string = node.data?.mcpUrl || "";
  const mcpHeaders: KV[] = Array.isArray(node.data?.mcpHeaders) ? node.data.mcpHeaders : [];
  const mcpTools: McpTool[] = Array.isArray(node.data?.mcpTools) ? node.data.mcpTools : [];
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setSaving(true);
        const config = {
          description: node.data?.description || "",
          mcpUrl,
          mcpHeaders,
          mcpTools,
        };
        await (supabase as any)
          .from("agent_tools_config")
          .upsert(
            { user_id: session.user.id, tool_name: "mcp_connect", enabled: true, config },
            { onConflict: "user_id,tool_name" }
          );
        setSavedAt(Date.now());
      } catch (e) {
        console.error("save mcp config", e);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.data?.description, mcpUrl, JSON.stringify(mcpHeaders), JSON.stringify(mcpTools)]);

  const fetchTools = async () => {
    if (!mcpUrl) {
      toast({ title: "Informe o endpoint do MCP", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-mcp-list", {
        body: { url: mcpUrl, headers: mcpHeaders },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao listar tools");
      const previous = new Map(mcpTools.map((t) => [t.name, t.enabled]));
      const next: McpTool[] = (data.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        enabled: previous.get(t.name) ?? true,
      }));
      setData(node, setNode, { mcpTools: next });
      toast({ title: `${next.length} tool(s) encontradas` });
    } catch (e: any) {
      toast({ title: "Erro ao conectar no MCP", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (name: string, enabled: boolean) => {
    setData(node, setNode, {
      mcpTools: mcpTools.map((t) => (t.name === name ? { ...t, enabled } : t)),
    });
  };

  const activeCount = mcpTools.filter((t) => t.enabled).length;

  return (
    <>
      {Header}
      <DescField
        node={node}
        setNode={setNode}
        label="Descrição da ferramenta — MCP (Model Context Protocol)"
        placeholder="Descreva quando o agente deve usar esta ferramenta..."
      />
      <div className="space-y-2">
        <Label>Endpoint do MCP</Label>
        <Input
          value={mcpUrl}
          onChange={(e) => setData(node, setNode, { mcpUrl: e.target.value })}
          placeholder="https://mcp.exemplo.com/endpoint"
        />
        <p className="text-[11px] text-muted-foreground">
          Use variáveis dinâmicas: <code>{"{{global.campo}}"}</code>, <code>{"{{project.campo}}"}</code>
        </p>
        <p className="text-[10px] text-muted-foreground">
          {saving ? "Salvando…" : savedAt ? "Configuração salva ✓" : "Edite para salvar automaticamente"}
        </p>
      </div>
      <Accordion type="single" collapsible defaultValue="headers">
        <AccordionItem value="headers">
          <AccordionTrigger className="text-sm">Parâmetros Headers</AccordionTrigger>
          <AccordionContent>
            <p className="text-[11px] text-muted-foreground mb-2">
              Cabeçalhos HTTP enviados na requisição ao MCP (ex.: <code>Authorization: Bearer ...</code>).
            </p>
            <ParamRows
              rows={mcpHeaders}
              onChange={(rows) => setData(node, setNode, { mcpHeaders: rows })}
              keyPlaceholder="Header"
              valuePlaceholder="valor"
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Button variant="outline" className="w-full" onClick={fetchTools} disabled={loading}>
        <Plug className="h-4 w-4 mr-2" />
        {loading ? "Conectando..." : "Ativar tools do MCP"}
      </Button>
      {mcpTools.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center italic">
          Nenhuma tool está ativa no momento
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {activeCount} de {mcpTools.length} tool(s) ativas
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {mcpTools.map((t) => (
              <div key={t.name} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-mono truncate">{t.name}</div>
                  {t.description && (
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</div>
                  )}
                </div>
                <Switch
                  checked={!!t.enabled}
                  onCheckedChange={(c) => toggleTool(t.name, !!c)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AgentToolConfigPanelInner({ node, setNode }: Props) {
  return <AgentToolConfigPanelInnerImpl node={node} setNode={setNode} />;
}

type Dept = { id: string; name: string; color?: string | null };

function TransferirFilaPanel({ node, setNode, Header }: { node: any; setNode: (n: any) => void; Header: ReactNode }) {
  const departmentIds: string[] = Array.isArray(node.data?.departmentIds) ? node.data.departmentIds : [];
  const queueRandom = !!node.data?.queueRandom;
  const queueEndFlow = !!node.data?.queueEndFlow;
  const [allDepts, setAllDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await (supabase as any)
          .from("departments")
          .select("id, name, color")
          .eq("user_id", session.user.id)
          .order("name", { ascending: true });
        setAllDepts(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-save config so the executor can pick it up
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setSaving(true);
        const config = {
          description: node.data?.description || "",
          departmentIds,
          queueRandom,
          queueEndFlow,
        };
        await (supabase as any)
          .from("agent_tools_config")
          .upsert(
            { user_id: session.user.id, tool_name: "transferir_fila", enabled: true, config },
            { onConflict: "user_id,tool_name" }
          );
        setSavedAt(Date.now());
      } catch (e) {
        console.error("save transferir_fila", e);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.data?.description, JSON.stringify(departmentIds), queueRandom, queueEndFlow]);

  const toggle = (id: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...departmentIds, id]))
      : departmentIds.filter((x) => x !== id);
    setData(node, setNode, { departmentIds: next });
  };

  return (
    <>
      {Header}
      <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Transferir para Fila" />
      <div className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
        <div>
          <Label htmlFor="queue-random" className="cursor-pointer">Modo Random</Label>
          <p className="text-[11px] text-muted-foreground">
            Alterna entre os departamentos selecionados aleatoriamente.
          </p>
        </div>
        <Switch
          id="queue-random"
          checked={queueRandom}
          onCheckedChange={(c) => setData(node, setNode, { queueRandom: !!c })}
        />
      </div>
      <div className="space-y-2">
        <Label>Departamentos disponíveis</Label>
        {loading ? (
          <p className="text-[11px] text-muted-foreground italic">Carregando...</p>
        ) : allDepts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Nenhum departamento criado. Cadastre em Configurações &gt; Departamentos.
          </p>
        ) : (
          <div className="space-y-1 max-h-56 overflow-y-auto rounded-md border border-border p-2">
            {allDepts.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                <Checkbox
                  checked={departmentIds.includes(d.id)}
                  onCheckedChange={(c) => toggle(d.id, !!c)}
                />
                {d.color && (
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                )}
                <span className="flex-1">{d.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {saving ? "Salvando…" : savedAt ? "Configuração salva ✓" : "Selecione para salvar automaticamente"}
        </p>
      </div>
      <div className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
        <div>
          <Label htmlFor="queue-end" className="cursor-pointer">Encerrar fluxo após a transferência</Label>
          <p className="text-[11px] text-muted-foreground">
            Não gera nova mensagem do agente nem segue para o próximo nó do grafo — útil quando a fila já responde ao cliente.
          </p>
        </div>
        <Switch
          id="queue-end"
          checked={queueEndFlow}
          onCheckedChange={(c) => setData(node, setNode, { queueEndFlow: !!c })}
        />
      </div>
    </>
  );
}

// ============================================================================
// MemoriaAtendimentoPanel — Atualizar Memória de Atendimento (JSON Schema)
// ============================================================================
type MemoryField = {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  default: string;
  description: string;
};

const MEMORY_TYPES: { value: MemoryField["type"]; label: string }[] = [
  { value: "string", label: "Texto (string)" },
  { value: "number", label: "Número (number)" },
  { value: "boolean", label: "Booleano (boolean)" },
  { value: "object", label: "Objeto (object)" },
  { value: "array", label: "Array (array)" },
];

function buildMemoryPreview(fields: MemoryField[]) {
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    const key = f.name?.trim() || "campo";
    let val: unknown = "";
    switch (f.type) {
      case "number":
        val = f.default !== "" ? Number(f.default) || 0 : 0;
        break;
      case "boolean":
        val = f.default === "true";
        break;
      case "object":
        val = {};
        break;
      case "array":
        val = [];
        break;
      default:
        val = f.default ?? "";
    }
    obj[key] = val;
  }
  return JSON.stringify(obj, null, 2);
}

function MemoryEnabledFields({
  node,
  setNode,
  stored,
}: {
  node: any;
  setNode: (updater: (prev: any) => any) => void;
  stored: MemoryField[];
}) {
  const enabled: string[] = Array.isArray(node.data?.memoryEnabledFields)
    ? node.data.memoryEnabledFields
    : [];
  const [open, setOpen] = useState(false);

  const available = stored.filter((f) => f.name && !enabled.includes(f.name));
  const enabledFields = enabled
    .map((n) => stored.find((f) => f.name === n))
    .filter((f): f is MemoryField => !!f);

  const toggle = (name: string, on: boolean) => {
    const next = on
      ? Array.from(new Set([...enabled, name]))
      : enabled.filter((n) => n !== name);
    setData(node, setNode, { memoryEnabledFields: next });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Campos que a IA pode Atualizar</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={stored.length === 0}
        >
          + Adicionar Campo
        </Button>
      </div>

      {stored.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
          Defina primeiro a Estrutura da Memória acima para liberar campos.
        </div>
      ) : enabledFields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
          Nenhum campo habilitado. Use "Adicionar Campo" para selecionar campos que a IA poderá
          atualizar.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {enabledFields.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
            >
              <span className="text-[12px]">
                <code className="font-mono text-foreground">{f.name}</code>{" "}
                <span className="text-muted-foreground">
                  {f.type === "string" && "texto (string)"}
                  {f.type === "number" && "número (number)"}
                  {f.type === "boolean" && "booleano (boolean)"}
                  {f.type === "object" && "objeto (object)"}
                  {f.type === "array" && "array (array)"}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => toggle(f.name, false)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Campo</DialogTitle>
            <DialogDescription>
              Selecione um campo da estrutura para permitir que a IA atualize.
            </DialogDescription>
          </DialogHeader>
          {available.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
              Todos os campos já foram adicionados.
            </div>
          ) : (
            <ul className="space-y-1 max-h-[40vh] overflow-y-auto">
              {available.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    onClick={() => {
                      toggle(f.name, true);
                      setOpen(false);
                    }}
                    className="w-full flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 hover:bg-muted/40 text-left"
                  >
                    <span className="text-[12px]">
                      <code className="font-mono">{f.name}</code>{" "}
                      <span className="text-muted-foreground">({f.type})</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemoriaAtendimentoPanel({
  node,
  setNode,
  Header,
}: {
  node: any;
  setNode: (updater: (prev: any) => any) => void;
  Header: ReactNode;
}) {
  const stored: MemoryField[] = Array.isArray(node.data?.memoryStructure)
    ? node.data.memoryStructure
    : [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MemoryField[]>(
    stored.length > 0
      ? stored
      : [
          { name: "campo_1", type: "string", default: "", description: "" },
          { name: "campo_2", type: "string", default: "", description: "" },
        ]
  );

  useEffect(() => {
    if (open) {
      setDraft(
        stored.length > 0
          ? stored
          : [
              { name: "campo_1", type: "string", default: "", description: "" },
              { name: "campo_2", type: "string", default: "", description: "" },
            ]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateField = (idx: number, patch: Partial<MemoryField>) =>
    setDraft((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const removeField = (idx: number) =>
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  const addField = () =>
    setDraft((prev) => [
      ...prev,
      {
        name: `campo_${prev.length + 1}`,
        type: "string",
        default: "",
        description: "",
      },
    ]);

  const save = () => {
    setData(node, setNode, { memoryStructure: draft });
    setOpen(false);
  };

  return (
    <>
      {Header}
      <DescField
        node={node}
        setNode={setNode}
        label="Descrição da ferramenta — Atualizar Memória Atendimento"
      />

      <div className="space-y-2">
        <Label>Estrutura da Memória</Label>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setOpen(true)}
        >
          <Brain className="h-4 w-4 mr-2" /> Editar Estrutura da Memória de Atendimento
        </Button>
        {stored.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
            Estrutura não definida — Clique em "Editar Estrutura" para definir os campos da memória.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] text-muted-foreground mb-2">Preview da estrutura</div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap text-foreground">
              {buildMemoryPreview(stored)}
            </pre>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px]">
        <strong>Diferença do operador "Salvar Memória":</strong> No operador, você define o valor
        fixo (ex: <code>{"{{sale_ai_output_plan}}"}</code>). Aqui na tool, a IA decide
        dinamicamente quando e com qual valor atualizar cada campo, baseado na conversa.
      </div>

      <MemoryEnabledFields node={node} setNode={setNode} stored={stored} />

      <Accordion type="single" collapsible>
        <AccordionItem value="how">
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Como funciona
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-[12px] mb-2">
              Esta tool é registrada dinamicamente no agente com os campos que você selecionar
              acima. A IA recebe:
            </p>
            <ul className="list-disc pl-4 text-[11px] space-y-0.5">
              <li>Nome do campo como nome do parâmetro</li>
              <li>Tipo do schema (string, number, array, object...) como tipo do parâmetro</li>
              <li>Descrição do schema como description do parâmetro</li>
              <li>
                Quando a IA chamar a tool, os valores serão salvos na memória do atendimento em{" "}
                <code>{"{{memory.campo}}"}</code>.
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Estrutura da Memória de Atendimento</DialogTitle>
          </DialogHeader>

          <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-[12px]">
            Esta estrutura é compartilhada entre <strong>todos os leads e atendimentos</strong> deste
            projeto. Cada node <strong>Salvar Memória Projeto</strong> poderá modificar campos
            específicos desta estrutura.
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium">Estrutura de Dados (JSON Schema)</span>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {draft.map((f, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] gap-2 items-center"
                >
                  <Input
                    value={f.name}
                    onChange={(e) => updateField(idx, { name: e.target.value })}
                    placeholder="campo"
                    className="h-9"
                  />
                  <Select
                    value={f.type}
                    onValueChange={(v) => updateField(idx, { type: v as MemoryField["type"] })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={f.default}
                    onChange={(e) => updateField(idx, { default: e.target.value })}
                    placeholder="Valor padrão"
                    className="h-9"
                  />
                  <Input
                    value={f.description}
                    onChange={(e) => updateField(idx, { description: e.target.value })}
                    placeholder="Descrição"
                    className="h-9"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeField(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addField}
              className="w-full rounded-md border border-dashed border-border py-2 text-[12px] text-muted-foreground hover:bg-muted/30 flex items-center justify-center gap-2"
            >
              <span className="text-base leading-none">+</span> Clique aqui para adicionar um campo na estrutura da memória
            </button>

            <div className="space-y-2">
              <div className="text-[12px] font-medium">Preview da estrutura:</div>
              <pre className="rounded-md border border-border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap">
                {buildMemoryPreview(draft)}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              CANCELAR
            </Button>
            <Button onClick={save}>SALVAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransferirEstrategiaPanel({ node, setNode, Header }: { node: any; setNode: (n: any) => void; Header: ReactNode }) {
  const [flows, setFlows] = useState<Array<{ id: string; name: string; active: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const targetFlowId: string = node.data?.targetFlowId || "";
  const endFlow: boolean = !!node.data?.endFlow;

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await (supabase as any)
          .from("flow_automations")
          .select("id,name,active")
          .eq("user_id", session.user.id)
          .order("name");
        setFlows(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setSaving(true);
        const target = flows.find((f) => f.id === targetFlowId);
        const config = {
          description: node.data?.description || "",
          targetFlowId,
          targetFlowName: target?.name || "",
          endFlow,
        };
        await (supabase as any)
          .from("agent_tools_config")
          .upsert(
            { user_id: session.user.id, tool_name: "transferir_estrategia", enabled: true, config },
            { onConflict: "user_id,tool_name" }
          );
        setSavedAt(Date.now());
      } catch (e) {
        console.error("save transferir_estrategia", e);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.data?.description, targetFlowId, endFlow]);

  const selected = flows.find((f) => f.id === targetFlowId);

  return (
    <>
      {Header}
      <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Transferir para Estratégia" />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Estratégia de destino (Agente IA)</Label>
        </div>
        {loading ? (
          <p className="text-[11px] text-muted-foreground italic">Carregando estratégias...</p>
        ) : flows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Nenhuma estratégia criada. Crie uma estratégia no Fluxo Visual primeiro.
          </p>
        ) : (
          <Select
            value={targetFlowId || undefined}
            onValueChange={(v) => setData(node, setNode, { targetFlowId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar estratégia..." />
            </SelectTrigger>
            <SelectContent>
              {flows.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} {f.active ? "" : "(inativa)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!selected && !loading && flows.length > 0 && (
          <p className="text-[11px] text-muted-foreground italic">Nenhuma estratégia definida</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {saving ? "Salvando…" : savedAt ? "Configuração salva ✓" : "Selecione para salvar automaticamente"}
        </p>
      </div>
      <div className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
        <div>
          <Label htmlFor="transfer-end" className="cursor-pointer">Encerrar fluxo atual após transferência</Label>
          <p className="text-[11px] text-muted-foreground">
            Interrompe o agente atual assim que a transferência for executada.
          </p>
        </div>
        <Switch
          id="transfer-end"
          checked={endFlow}
          onCheckedChange={(c) => setData(node, setNode, { endFlow: !!c })}
        />
      </div>
    </>
  );
}

type TeamMember = { id: string; name: string; email: string };

const DEFAULT_TAGS = [
  "abandonou-carrinho","abmex","active-campaign","aguardando-pagamento","appmax","ativo-whatsapp",
  "b4you","braip","calendly","cancelado","cartao-credito","cartpanda","compra-realizada","custom",
  "digital_guru","disputando","doppus","eduzz","email","email-cold","email-hot","email-warm",
  "estornou","evermart","facebook","form","gerou-boleto","gerou-pix","greenn","grupo-whats",
  "grupo-whatsapp","herospark","hotmart","hotwebinar","importado-csv","import-contact",
  "iniciou-pagamento-cartao","irroba","iset","kirvano","kiwify","lastlink","leadster",
  "loja_integrada","manychat","melldin","monetizze","neemo","notazz","nuvemshop","pagarme",
  "payt","pepper","perfect-pay","proaluno","rd_station_marketing","sacoleiroapp","sellflux",
  "sellfront","shopify","telefone","ticto","tictov2","tray","unbounce","vnda","voomp","wbuy",
  "wix","woocommerce","wordpress","yampi",
];

function AdicionarTagPanel({ node, setNode, Header }: { node: any; setNode: (n: any) => void; Header: ReactNode }) {
  const selected: string[] = Array.isArray(node.data?.tags) ? node.data.tags : [];
  const custom: string[] = Array.isArray(node.data?.customTags) ? node.data.customTags : [];
  const all = Array.from(new Set([...DEFAULT_TAGS, ...custom])).sort();
  const [query, setQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = all.filter((t) => t.toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = (t: string) => {
    const next = selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t];
    setData(node, setNode, { tags: next });
  };

  const addNew = () => {
    const v = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!v) return;
    const nextCustom = custom.includes(v) || DEFAULT_TAGS.includes(v) ? custom : [...custom, v];
    const nextSelected = selected.includes(v) ? selected : [...selected, v];
    setData(node, setNode, { customTags: nextCustom, tags: nextSelected });
    setNewTag("");
    setShowNew(false);
  };

  return (
    <>
      {Header}
      <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Adicionar tag" />
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-1 flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm text-left"
              >
                <span className="flex items-center gap-2 truncate">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  {selected.length === 0 ? (
                    <span className="text-muted-foreground">Selecionar tags</span>
                  ) : (
                    <span className="truncate">{selected.length} tag(s) selecionada(s)</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar tags..."
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="p-1">
                  {filtered.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tag</p>
                  )}
                  {filtered.map((t) => (
                    <label
                      key={t}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox checked={selected.includes(t)} onCheckedChange={() => toggle(t)} />
                      <span className="truncate">{t}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowNew((v) => !v)}
            className="gap-1"
          >
            + Nova
          </Button>
        </div>

        {showNew && (
          <div className="flex gap-2">
            <Input
              autoFocus
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nome da nova tag"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addNew(); }
              }}
            />
            <Button type="button" size="sm" onClick={addNew}>Adicionar</Button>
          </div>
        )}

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {selected.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]">
                <Tag className="h-3 w-3" /> {t}
                <button
                  type="button"
                  className="ml-1 hover:text-destructive"
                  onClick={() => toggle(t)}
                >×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const DEFAULT_EXTRACT_FIELDS = [
  { key: "name", label: "name", desc: "Campo padrão" },
  { key: "phone", label: "phone", desc: "Campo padrão" },
  { key: "email", label: "email", desc: "Campo padrão" },
  { key: "origem", label: "origem", desc: "Origem" },
];

const EXTRACT_TYPES = [
  { value: "string", label: "Texto (string)" },
  { value: "number", label: "Número (number)" },
  { value: "boolean", label: "Booleano (boolean)" },
  { value: "date", label: "Data (date)" },
  { value: "array", label: "Lista (array)" },
  { value: "object", label: "Objeto (object)" },
];

function ExtrairDadosPanel({ node, setNode, Header }: { node: any; setNode: (n: any) => void; Header: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const field: string = node.data?.extractField || "";
  const type: string = node.data?.extractType || "string";

  const filtered = DEFAULT_EXTRACT_FIELDS.filter((f) =>
    f.label.toLowerCase().includes(query.trim().toLowerCase()) ||
    f.desc.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <>
      {Header}
      <DescField
        node={node}
        setNode={setNode}
        label="Descrição da ferramenta — Extração de Dados"
        placeholder="Ex: quando o cliente informar um dado que deve ser salvo no cadastro..."
      />
      <div className="space-y-2">
        <Label className="text-[12px]">Selecione o dado que deseja extrair:</Label>
        <div className="grid grid-cols-[1fr_180px] gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Selecionar</Label>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="w-full h-10 flex items-center justify-between rounded-md border border-border bg-background px-3 text-sm text-left"
            >
              <span className={field ? "" : "text-muted-foreground"}>
                {field || "Selecione..."}
              </span>
              <ChevronRight className="h-4 w-4 rotate-90 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Tipo</Label>
            <Select value={type} onValueChange={(v) => setData(node, setNode, { extractType: v })}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXTRACT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Selecionar dado para extrair</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por chave ou rótulo..."
                className="pl-7 h-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="max-h-72">
            <div className="p-2 pt-0 space-y-1">
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum campo encontrado</p>
              )}
              {filtered.map((f) => {
                const selected = field === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => {
                      setData(node, setNode, { extractField: f.key });
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                      selected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-accent"
                    }`}
                  >
                    <span className="h-6 w-6 shrink-0 rounded-md bg-muted text-muted-foreground flex items-center justify-center text-[11px] font-semibold uppercase">
                      {f.label.charAt(0)}
                    </span>
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- AGENDA PANEL ---
type AgendaRule = {
  id: string;
  validity: "weekdays" | "specific";
  days: number[]; // 0=Dom..6=Sab
  description?: string;
  startTime: string;
  endTime: string;
  modality: "hora_marcada" | "ordem_chegada" | "grupo";
  duration: number; // minutes
  advance: number;
  advanceUnit: "min" | "hour" | "day";
};
type AgendaCalendar = {
  id: string;
  name: string;
  rules: AgendaRule[];
};
type AgendaTeamMember = {
  id: string;
  name: string;
  email: string;
  calendars: AgendaCalendar[];
};

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MODALITY_LABELS: Record<AgendaRule["modality"], string> = {
  hora_marcada: "Hora marcada",
  ordem_chegada: "Ordem de chegada",
  grupo: "Grupo",
};

function ruleSummary(rule: AgendaRule) {
  const days = rule.days.length === 7 ? "Todos os dias" : rule.days.sort().map((d) => DAY_LABELS[d]).join(", ");
  return `${days} das ${rule.startTime} às ${rule.endTime}`;
}

function newRule(): AgendaRule {
  return {
    id: crypto.randomUUID(),
    validity: "weekdays",
    days: [1, 2, 3, 4, 5],
    description: "",
    startTime: "09:00",
    endTime: "17:00",
    modality: "hora_marcada",
    duration: 60,
    advance: 1,
    advanceUnit: "hour",
  };
}

function AgendaPanel({ node, setNode, Header, id }: { node: any; setNode: (n: any) => void; Header: ReactNode; id: string }) {
  const team: AgendaTeamMember[] = Array.isArray(node.data?.agendaTeam) ? node.data.agendaTeam : [];
  const selectedIds: string[] = Array.isArray(node.data?.agendaSelected) ? node.data.agendaSelected : [];
  const allCalendars: Array<{ cal: AgendaCalendar; memberName: string }> = team.flatMap((m) =>
    (m.calendars || []).map((c) => ({ cal: c, memberName: m.name })),
  );
  const selectedCalendars = allCalendars.filter((x) => selectedIds.includes(x.cal.id));

  const [pickOpen, setPickOpen] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState("");
  const [memberOpen, setMemberOpen] = useState<string | null>(null);
  const [ruleEdit, setRuleEdit] = useState<{ memberId: string; rule: AgendaRule } | null>(null);

  const [profiles, setProfiles] = useState<TeamMember[]>([]);
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: self } = await supabase.from("profiles").select("id,email,full_name").eq("id", uid).maybeSingle();
      const list: TeamMember[] = [];
      if (self) list.push({ id: self.id, name: self.full_name || "Sem nome", email: self.email || "" });
      try {
        const { data: pipelines } = await supabase.from("pipelines").select("id").eq("owner_id", uid);
        const pipelineIds = (pipelines || []).map((p: any) => p.id);
        if (pipelineIds.length) {
          const { data: mems } = await supabase.from("pipeline_members").select("user_id").in("pipeline_id", pipelineIds);
          const userIds = Array.from(new Set((mems || []).map((m: any) => m.user_id))).filter((x) => x !== uid);
          if (userIds.length) {
            const { data: profs } = await supabase.from("profiles").select("id,email,full_name").in("id", userIds);
            (profs || []).forEach((p: any) => list.push({ id: p.id, name: p.full_name || "Sem nome", email: p.email || "" }));
          }
        }
      } catch {}
      setProfiles(list);
    })();
  }, []);

  const ensureMemberInTeam = (m: TeamMember): AgendaTeamMember => {
    const existing = team.find((x) => x.id === m.id);
    if (existing) return existing;
    const created: AgendaTeamMember = { id: m.id, name: m.name, email: m.email, calendars: [] };
    setData(node, setNode, { agendaTeam: [...team, created] });
    return created;
  };

  const updateMember = (memberId: string, patch: Partial<AgendaTeamMember>) => {
    const next = team.map((m) => (m.id === memberId ? { ...m, ...patch } : m));
    setData(node, setNode, { agendaTeam: next });
  };

  const saveRule = (memberId: string, rule: AgendaRule) => {
    const member = team.find((m) => m.id === memberId);
    if (!member) return;
    const cals = member.calendars || [];
    // Each rule lives inside its own calendar entry for simplicity
    const existingCal = cals.find((c) => c.rules.some((r) => r.id === rule.id));
    let nextCals: AgendaCalendar[];
    if (existingCal) {
      nextCals = cals.map((c) => ({
        ...c,
        rules: c.rules.map((r) => (r.id === rule.id ? rule : r)),
      }));
    } else {
      nextCals = [
        ...cals,
        { id: crypto.randomUUID(), name: `Agenda ${member.name}`, rules: [rule] },
      ];
    }
    updateMember(memberId, { calendars: nextCals });
  };

  const deleteRule = (memberId: string, ruleId: string) => {
    const member = team.find((m) => m.id === memberId);
    if (!member) return;
    const nextCals = (member.calendars || [])
      .map((c) => ({ ...c, rules: c.rules.filter((r) => r.id !== ruleId) }))
      .filter((c) => c.rules.length > 0);
    updateMember(memberId, { calendars: nextCals });
  };

  const toggleCalSelected = (calId: string) => {
    const next = selectedIds.includes(calId) ? selectedIds.filter((x) => x !== calId) : [...selectedIds, calId];
    setData(node, setNode, { agendaSelected: next });
  };

  const filteredCalendars = allCalendars.filter(({ cal }) =>
    cal.name.toLowerCase().includes(pickQuery.trim().toLowerCase()),
  );
  const filteredProfiles = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(teamQuery.trim().toLowerCase()) ||
      p.email.toLowerCase().includes(teamQuery.trim().toLowerCase()),
  );
  const activeMember = team.find((m) => m.id === memberOpen) || null;
  const activeMemberRules: Array<{ rule: AgendaRule; calName: string }> = activeMember
    ? (activeMember.calendars || []).flatMap((c) => c.rules.map((r) => ({ rule: r, calName: c.name })))
    : [];

  return (
    <>
      {Header}
      <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Agenda" />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Agendas selecionadas
          </Label>
          <Button variant="ghost" size="sm" onClick={() => setPickOpen(true)}>+ Adicionar</Button>
        </div>
        {selectedCalendars.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Nenhuma agenda selecionada</p>
        ) : (
          <ul className="space-y-1">
            {selectedCalendars.map(({ cal, memberName }) => {
              const first = cal.rules[0];
              return (
                <li key={cal.id} className="rounded-md border border-border p-2 text-[12px] flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{cal.name}</span>
                      {first && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {MODALITY_LABELS[first.modality]}
                        </span>
                      )}
                    </div>
                    {first && <div className="text-[11px] text-muted-foreground">{ruleSummary(first)}</div>}
                    <div className="text-[10px] text-muted-foreground">{memberName}</div>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => toggleCalSelected(cal.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={() => setTeamOpen(true)}>
          <Users className="h-4 w-4 mr-2" /> Gerenciar Equipe
        </Button>
      </div>

      <InfoBlock>
        <div className="font-semibold text-[11px] uppercase tracking-wider text-primary mb-1">
          Modalidades de agendamento
        </div>
        <ul className="space-y-1 text-[11px]">
          <li><strong>Hora marcada:</strong> um lead por horário, igual a uma reunião tradicional.</li>
          <li><strong>Ordem de chegada:</strong> janela diária com fila — vários leads compartilham o mesmo período até atingir o limite configurado.</li>
          <li><strong>Grupo:</strong> mesmo horário ocupado por vários leads (até o limite), criando um único evento compartilhado.</li>
        </ul>
      </InfoBlock>

      <FuncList
        items={[
          { name: `agenda_${id}_list_calendars`, desc: "lista os calendários disponíveis para agendamento, com regras de horário e responsáveis." },
          { name: `agenda_${id}_list_available_time_slots`, desc: "lista os próximos horários livres, com suporte a filtro por calendário e paginação." },
          { name: `agenda_${id}_list_future_appointments`, desc: "lista compromissos futuros do cliente em qualquer calendário." },
          { name: `agenda_${id}_add_appointment`, desc: "cria um novo compromisso para o lead na agenda selecionada." },
          { name: `agenda_${id}_cancel_appointment`, desc: "cancela um compromisso existente do lead." },
          { name: `agenda_${id}_reschedule_appointment`, desc: "remarca um compromisso, criando o novo horário e cancelando o antigo." },
        ]}
      />

      {/* Selecionar agendas */}
      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Selecionar agendas selecionadas</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="Buscar agenda..."
                className="pl-7 h-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="max-h-72">
            <div className="p-2 pt-0 space-y-1">
              {filteredCalendars.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhuma agenda. Crie uma em "Gerenciar Equipe".
                </p>
              )}
              {filteredCalendars.map(({ cal, memberName }) => {
                const isSel = selectedIds.includes(cal.id);
                const first = cal.rules[0];
                return (
                  <button
                    key={cal.id}
                    type="button"
                    onClick={() => toggleCalSelected(cal.id)}
                    className={`w-full flex items-start gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                      isSel ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-accent"
                    }`}
                  >
                    <CalendarClock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{cal.name}</span>
                        {first && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {MODALITY_LABELS[first.modality]}
                          </span>
                        )}
                      </div>
                      {first && <div className="text-[11px] text-muted-foreground">{ruleSummary(first)}</div>}
                      <div className="text-[10px] text-muted-foreground">{memberName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Equipe */}
      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Equipe</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={teamQuery}
                onChange={(e) => setTeamQuery(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="pl-7 h-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="max-h-72">
            <div className="p-2 pt-0 space-y-1">
              {filteredProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    ensureMemberInTeam(p);
                    setMemberOpen(p.id);
                    setTeamOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left"
                >
                  <span className="h-7 w-7 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[11px] font-semibold uppercase">
                    {(p.name || p.email || "?").charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Regras do membro */}
      <Dialog open={!!memberOpen} onOpenChange={(o) => !o && setMemberOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regras de agendamento</DialogTitle>
            <DialogDescription>
              {activeMember?.email}
              <br />
              Configure quando o robô pode marcar agendamentos na agenda deste membro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Regras de agendamento</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => activeMember && setRuleEdit({ memberId: activeMember.id, rule: newRule() })}
              >
                + Adicionar
              </Button>
            </div>
            {activeMemberRules.length === 0 ? (
              <p className="text-[12px] text-muted-foreground italic">Nenhuma regra configurada</p>
            ) : (
              <ul className="space-y-1">
                {activeMemberRules.map(({ rule }) => (
                  <li key={rule.id} className="flex items-center justify-between rounded-md border border-border p-2 text-[12px]">
                    <div className="min-w-0">
                      <div className="font-medium">{ruleSummary(rule)}</div>
                      <div className="text-[11px] text-muted-foreground">{MODALITY_LABELS[rule.modality]}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground p-1"
                        onClick={() => activeMember && setRuleEdit({ memberId: activeMember.id, rule })}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive p-1"
                        onClick={() => activeMember && deleteRule(activeMember.id, rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova/Editar regra */}
      <Dialog open={!!ruleEdit} onOpenChange={(o) => !o && setRuleEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova regra de agendamento</DialogTitle>
            <DialogDescription>Configure quando o robô pode marcar agendamentos</DialogDescription>
          </DialogHeader>
          {ruleEdit && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px]">Quando esta regra é válida</Label>
                <Select
                  value={ruleEdit.rule.validity}
                  onValueChange={(v: any) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, validity: v } })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekdays">Dias da semana</SelectItem>
                    <SelectItem value="specific">Datas específicas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[12px]">Dias da semana</Label>
                <div className="flex gap-1">
                  {DAY_LABELS.map((d, idx) => {
                    const on = ruleEdit.rule.days.includes(idx);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? ruleEdit.rule.days.filter((x) => x !== idx)
                            : [...ruleEdit.rule.days, idx];
                          setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, days: next } });
                        }}
                        className={`flex-1 h-8 rounded-md text-[11px] font-medium border transition-colors ${
                          on
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Textarea
                  value={ruleEdit.rule.description || ""}
                  onChange={(e) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, description: e.target.value } })}
                  placeholder="Descrição do agendamento (opcional)"
                  rows={2}
                />
              </div>

              <div>
                <Label className="text-[12px]">Horários</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Início</Label>
                    <Input
                      type="time"
                      value={ruleEdit.rule.startTime}
                      onChange={(e) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, startTime: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Término</Label>
                    <Input
                      type="time"
                      value={ruleEdit.rule.endTime}
                      onChange={(e) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, endTime: e.target.value } })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[12px]">Modalidade do atendimento</Label>
                <Select
                  value={ruleEdit.rule.modality}
                  onValueChange={(v: any) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, modality: v } })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hora_marcada">Hora marcada</SelectItem>
                    <SelectItem value="ordem_chegada">Ordem de chegada</SelectItem>
                    <SelectItem value="grupo">Grupo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Hora marcada: slots por duração. Ordem de chegada: uma fila por dia na janela. Grupo: vários atendidos no mesmo horário até o limite.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px]">Duração padrão do Agendamento</Label>
                  <span className="text-[11px] text-muted-foreground">{ruleEdit.rule.duration} min</span>
                </div>
                <Slider
                  min={5}
                  max={240}
                  step={5}
                  value={[ruleEdit.rule.duration]}
                  onValueChange={([v]) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, duration: v } })}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px]">Antecedência Mínima para Agendamento</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{ruleEdit.rule.advance}</span>
                    <Select
                      value={ruleEdit.rule.advanceUnit}
                      onValueChange={(v: any) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, advanceUnit: v } })}
                    >
                      <SelectTrigger className="h-7 w-[90px] text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="min">Minutos</SelectItem>
                        <SelectItem value="hour">Horas</SelectItem>
                        <SelectItem value="day">Dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Slider
                  min={0}
                  max={ruleEdit.rule.advanceUnit === "min" ? 120 : ruleEdit.rule.advanceUnit === "hour" ? 48 : 30}
                  step={1}
                  value={[ruleEdit.rule.advance]}
                  onValueChange={([v]) => setRuleEdit({ ...ruleEdit, rule: { ...ruleEdit.rule, advance: v } })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Tempo mínimo necessário antes do início do evento
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleEdit(null)}>Fechar</Button>
            <Button
              onClick={() => {
                if (!ruleEdit) return;
                saveRule(ruleEdit.memberId, ruleEdit.rule);
                setRuleEdit(null);
              }}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ListarEquipePanel({ node, setNode, Header, id }: { node: any; setNode: (n: any) => void; Header: ReactNode; id: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const scope: string = node.data?.teamScope || "all";
  const selectedIds: string[] = Array.isArray(node.data?.teamSelectedIds) ? node.data.teamSelectedIds : [];

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const collected = new Map<string, TeamMember>();
        const { data: self } = await (supabase as any)
          .from("profiles").select("id,full_name,email").eq("id", user.id).maybeSingle();
        if (self) collected.set(self.id, { id: self.id, name: self.full_name || self.email, email: self.email });
        const { data: pipes } = await (supabase as any)
          .from("pipelines").select("id").eq("owner_id", user.id);
        const pipeIds = (pipes || []).map((p: any) => p.id);
        if (pipeIds.length) {
          const { data: pm } = await (supabase as any)
            .from("pipeline_members").select("user_id").in("pipeline_id", pipeIds);
          const memberIds = Array.from(new Set((pm || []).map((m: any) => m.user_id))).filter((u) => u !== user.id);
          if (memberIds.length) {
            const { data: profs } = await (supabase as any)
              .from("profiles").select("id,full_name,email").in("id", memberIds);
            (profs || []).forEach((p: any) =>
              collected.set(p.id, { id: p.id, name: p.full_name || p.email, email: p.email })
            );
          }
        }
        setMembers(Array.from(collected.values()));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setSaving(true);
        const config = {
          description: node.data?.description || "",
          scope,
          selectedIds: scope === "selected" ? selectedIds : [],
        };
        await (supabase as any)
          .from("agent_tools_config")
          .upsert(
            { user_id: session.user.id, tool_name: "listar_equipe", enabled: true, config },
            { onConflict: "user_id,tool_name" }
          );
        setSavedAt(Date.now());
      } catch (e) {
        console.error("save listar_equipe", e);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.data?.description, scope, JSON.stringify(selectedIds)]);

  const toggle = (mid: string, checked: boolean) => {
    const next = checked ? Array.from(new Set([...selectedIds, mid])) : selectedIds.filter((x) => x !== mid);
    setData(node, setNode, { teamSelectedIds: next });
  };

  return (
    <>
      {Header}
      <DescField
        node={node}
        setNode={setNode}
        label="Descrição da ferramenta — Listar usuários da equipe (IDs)"
      />
      <div className="rounded-lg border border-border p-3 flex gap-2">
        <Users className="h-4 w-4 mt-0.5 text-primary" />
        <div>
          <div className="text-sm font-medium">Usuários da equipe (IDs)</div>
          <p className="text-[11px] text-muted-foreground">
            A IA pode consultar a lista para obter user_id (mesmo identificador usado em
            owner_user_id em tickets e tarefas).
          </p>
        </div>
      </div>
      <div>
        <Label className="mb-2 block">Escopo da listagem</Label>
        <RadioGroup
          value={scope}
          onValueChange={(v) => setData(node, setNode, { teamScope: v })}
          className="space-y-1"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem id="team-all" value="all" />
            <Label htmlFor="team-all" className="cursor-pointer font-normal">
              Todos os usuários ativos da equipe do projeto
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem id="team-selected" value="selected" />
            <Label htmlFor="team-selected" className="cursor-pointer font-normal">
              Somente usuários selecionados abaixo
            </Label>
          </div>
        </RadioGroup>
      </div>
      {scope === "selected" && (
        <div className="space-y-2">
          <Label className="text-[12px]">Usuários disponíveis</Label>
          {loading ? (
            <p className="text-[11px] text-muted-foreground italic">Carregando equipe...</p>
          ) : members.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhum usuário encontrado.</p>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto rounded-md border border-border p-2">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                  <Checkbox
                    checked={selectedIds.includes(m.id)}
                    onCheckedChange={(c) => toggle(m.id, !!c)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <InfoBlock>
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Uso com tickets e tarefas</div>
            Conecte este bloco ao agente/expert pela alça de tools. O nome da função segue o
            padrão <code>task_users_list_tool_{id}</code>. Campos retornados:
            <code> user_id, name, email</code>.
          </div>
        </div>
      </InfoBlock>
      <p className="text-[10px] text-muted-foreground text-right">
        {saving ? "Salvando…" : savedAt ? "Configuração salva ✓" : "Edite para salvar automaticamente"}
      </p>
    </>
  );
}

type Pipeline = { id: string; name: string; stages: any };
function GerenciarTicketCrmPanel({ node, setNode, Header }: { node: any; setNode: (n: any) => void; Header: ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showKanban, setShowKanban] = useState(false);

  const crmEnabled: boolean = node.data?.crmEnabled !== false;
  const pipelineId: string = node.data?.crmPipelineId || "";
  const columns: string[] = Array.isArray(node.data?.crmColumns) ? node.data.crmColumns : [];
  const perms: Record<string, boolean> = node.data?.crmPerms || {};
  const customFields: Array<{ name: string; description: string }> = Array.isArray(node.data?.crmCustomFields)
    ? node.data.crmCustomFields
    : [];

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await (supabase as any)
          .from("pipelines")
          .select("id,name,stages")
          .eq("owner_id", user.id)
          .order("name");
        setPipelines((data as Pipeline[]) || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setSaving(true);
        const config = {
          description: node.data?.description || "",
          crmEnabled,
          pipelineId,
          columns,
          perms: { list: true, ...perms },
          customFields,
        };
        await (supabase as any)
          .from("agent_tools_config")
          .upsert(
            { user_id: session.user.id, tool_name: "gerenciar_ticket_crm", enabled: crmEnabled, config },
            { onConflict: "user_id,tool_name" }
          );
        setSavedAt(Date.now());
      } catch (e) {
        console.error("save gerenciar_ticket_crm", e);
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    node.data?.description,
    crmEnabled,
    pipelineId,
    JSON.stringify(columns),
    JSON.stringify(perms),
    JSON.stringify(customFields),
  ]);

  const selectedPipeline = pipelines.find((p) => p.id === pipelineId);
  const stageList: Array<{ id: string; name: string }> = (() => {
    const s = selectedPipeline?.stages;
    if (!Array.isArray(s)) return [];
    return s.map((st: any, i: number) => ({
      id: String(st?.id ?? st?.name ?? i),
      name: String(st?.name ?? st?.title ?? st?.label ?? `Coluna ${i + 1}`),
    }));
  })();

  const setPerm = (k: string, v: boolean) =>
    setData(node, setNode, { crmPerms: { ...perms, [k]: v } });

  const toggleColumn = (id: string, checked: boolean) => {
    const next = checked ? Array.from(new Set([...columns, id])) : columns.filter((c) => c !== id);
    setData(node, setNode, { crmColumns: next });
  };

  const addCustomField = () =>
    setData(node, setNode, { crmCustomFields: [...customFields, { name: "", description: "" }] });

  const updateCustomField = (i: number, patch: Partial<{ name: string; description: string }>) => {
    const next = customFields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    setData(node, setNode, { crmCustomFields: next });
  };

  const removeCustomField = (i: number) =>
    setData(node, setNode, { crmCustomFields: customFields.filter((_, idx) => idx !== i) });

  const scopeReady = !!pipelineId && columns.length > 0;

  const perm = (k: string, locked = false) => (locked ? true : !!perms[k]);

  const PERMS: Array<{ k: string; label: string; icon: any; desc: string; locked?: boolean; requiresScope?: boolean }> = [
    { k: "list", label: "Listar tickets", icon: ClipboardList, desc: "Consultar tickets dentro do escopo. Ativará assim que você definir pipeline e ao menos uma coluna em escopo.", locked: true },
    { k: "move", label: "Mover entre colunas", icon: ArrowRightLeft, desc: "Transfere o ticket para outra coluna deste mesmo pipeline. A lista de destinos permitidos aparece na descrição desta ferramenta para o modelo saber onde pode enviar." },
    { k: "edit", label: "Editar título e descrição", icon: Lightbulb, desc: "Altera o assunto (título) e o texto principal do ticket quando o modelo precisar corrigir ou complementar informações." },
    { k: "notes", label: "Registrar observações", icon: History, desc: "Grava observações/comentários no histórico do ticket, visível para a equipe no CRM." },
    { k: "email", label: "E-mail do ticket", icon: Briefcase, desc: "Defina pipeline e colunas em escopo na etapa 1 para validar o ticket antes de buscar o e-mail do ticket.", requiresScope: true },
    { k: "create", label: "Criar novo ticket", icon: CheckCircle2, desc: "Defina ao menos uma coluna em escopo na etapa 1 para habilitar a criação de tickets.", requiresScope: true },
  ];

  const activeCount = PERMS.filter((p) => perm(p.k, p.locked)).length;

  return (
    <>
      {Header}
      <DescField
        node={node}
        setNode={setNode}
        label="Descrição da ferramenta — Gerenciar Ticket CRM"
        placeholder="Ex: use os IDs da listagem; confirme com o cliente antes de mudar coluna..."
      />

      <div className="rounded-lg border border-border p-3 space-y-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="crm-main"
            checked={crmEnabled}
            onCheckedChange={(c) => setData(node, setNode, { crmEnabled: !!c })}
          />
          <ClipboardList className="h-4 w-4" />
          <Label htmlFor="crm-main" className="cursor-pointer font-semibold">
            Gerenciar Ticket (CRM / Suporte)
          </Label>
        </div>
        <p className="text-[11px] text-muted-foreground pl-6">
          Configure em três etapas: escopo no quadro, permissões da IA e campos extras permitidos.
        </p>
      </div>

      {/* Etapa 1 */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="text-[12px] font-semibold">1. Onde esta IA atua</div>
        <p className="text-[11px] text-muted-foreground">
          Somente tickets desta pipeline e que estiverem em pelo menos uma das colunas abaixo entram no escopo desta ferramenta.
        </p>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[12px] font-medium">Pipeline de tickets</Label>
          <Button variant="ghost" size="sm" className="text-primary h-7" onClick={() => setShowKanban((v) => !v)}>
            + Adicionar kanban
          </Button>
        </div>
        {loading ? (
          <p className="text-[11px] text-muted-foreground italic">Carregando pipelines...</p>
        ) : pipelines.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Nenhuma pipeline encontrada. Crie uma em CRM &gt; Pipelines.
          </p>
        ) : (
          <Select
            value={pipelineId || undefined}
            onValueChange={(v) =>
              setData(node, setNode, { crmPipelineId: v, crmColumns: [] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar pipeline..." />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {pipelineId ? (
          stageList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Esta pipeline não possui colunas.</p>
          ) : (
            <div className="space-y-1 rounded-md border border-border p-2 max-h-48 overflow-y-auto">
              {stageList.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-[12px] cursor-pointer hover:bg-accent rounded px-1 py-0.5">
                  <Checkbox
                    checked={columns.includes(s.id)}
                    onCheckedChange={(c) => toggleColumn(s.id, !!c)}
                  />
                  <span className="flex-1">{s.name}</span>
                </label>
              ))}
            </div>
          )
        ) : (
          <p className="text-[11px] text-muted-foreground italic">Nenhum kanban selecionado</p>
        )}
      </div>

      {/* Etapa 2 */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold">2. O que a IA pode fazer</div>
          <span className="text-[10px] text-muted-foreground">{activeCount} ativa(s)</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Conclua a etapa 1 (pipeline e ao menos uma coluna em escopo) para liberar a listagem e poder ativar mais ações.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PERMS.map((p) => {
            const disabled = (p as any).requiresScope ? !scopeReady : false;
            const checked = p.locked ? true : !!perms[p.k];
            const Icon = p.icon;
            return (
              <label
                key={p.k}
                className={`flex gap-2 items-start rounded-md border p-2 cursor-pointer transition-colors ${
                  checked ? "border-primary/40 bg-primary/5" : "border-border"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={p.locked || disabled}
                  onCheckedChange={(c) => setPerm(p.k, !!c)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[12px] font-medium truncate">{p.label}</span>
                    {p.locked && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-semibold">
                        sempre ativo
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Etapa 3 */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold">3. Campos personalizados</div>
          <Button variant="ghost" size="sm" className="text-primary h-7" onClick={addCustomField}>
            + Adicionar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Somente os campos adicionados podem ser lidos e alterados pela IA. Se nenhum estiver na lista, campos extras ficam indisponíveis para edição nesta ferramenta.
        </p>
        {customFields.length > 0 && (
          <div className="space-y-2">
            {customFields.map((f, i) => (
              <div key={i} className="rounded-md border border-border p-2 space-y-1">
                <div className="flex gap-2 items-center">
                  <Input
                    value={f.name}
                    placeholder="Nome do campo (ex: prioridade)"
                    onChange={(e) => updateCustomField(i, { name: e.target.value })}
                    className="h-8 text-[12px]"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCustomField(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={f.description}
                  placeholder="Descrição/uso para a IA"
                  onChange={(e) => updateCustomField(i, { description: e.target.value })}
                  className="h-8 text-[12px]"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        {saving ? "Salvando…" : savedAt ? "Configuração salva ✓" : "Edite para salvar automaticamente"}
      </p>
    </>
  );
}

function AgentToolConfigPanelInnerImpl({ node, setNode }: Props) {
  const navigate = useNavigate();
  const toolName: string = node.data?.toolName || "";
  const block = findAgentToolBlock(toolName);
  const id = (node.id || "id").slice(0, 6);

  const Header = (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Ferramenta do Agente
      </div>
      <div className="text-sm font-semibold">{node.data?.label || block?.label}</div>
      {toolName && (
        <div className="text-[11px] font-mono text-muted-foreground">{toolName}</div>
      )}
    </div>
  );

  // --- MODAL 1: Chats Antigos ---
  if (toolName === "chats_antigos") {
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Histórico de Conversas" />
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          <Checkbox
            id="chats-antigos-flag"
            checked={node.data?.chatsAntigos !== false}
            onCheckedChange={(c) => setData(node, setNode, { chatsAntigos: !!c })}
          />
          <Label htmlFor="chats-antigos-flag" className="cursor-pointer">
            Chats de Atendimentos Antigos
          </Label>
        </div>
        <InfoBlock>
          Esta tool permite acessar chats antigos do lead. Não possui configurações adicionais —
          basta conectar ao agente para que ele possa consultar o histórico de conversas quando
          necessário.
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 2: Produtos ---
  if (toolName === "buscar_produtos") {
    const limit = node.data?.limit ?? 5;
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Produtos"
          placeholder="Retorna Produtos e Serviços da empresa"
        />
        <div>
          <Label>Limite de produtos: {limit}</Label>
          <Slider
            min={1}
            max={100}
            step={1}
            value={[limit]}
            onValueChange={(v) => setData(node, setNode, { limit: v[0] })}
            className="mt-2"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Este limite se refere à quantidade de produtos que retornam da consulta da base de
            conhecimento durante a execução do agente.
          </p>
        </div>
        <ProductsPreview node={node} setNode={setNode} />
        <FuncList
          items={[
            { name: `products_${id}_search`, desc: "busca produtos por nome ou descrição, com paginação e retorno de detalhes como preço, estoque, imagens e link de compra." },
            { name: `products_${id}_list`, desc: "lista simplificada de produtos para varredura rápida (id, código, nome e preço), com suporte a paginação." },
            { name: `products_${id}_search_details`, desc: "consulta detalhes completos de um produto específico por código ou nome." },
          ]}
        />
        <Button variant="outline" className="w-full" onClick={() => navigate("/produtos")}>
          <Package className="h-4 w-4 mr-2" /> Gerenciar base de produtos
        </Button>
      </>
    );
  }

  // --- MODAL 3: Políticas e Regras ---
  if (toolName === "politicas_regras") {
    const limit = node.data?.limit ?? 5;
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Políticas de Uso"
          placeholder="Retorna Informações, Regras e Políticas da Empresa"
        />
        <div>
          <Label>Limite de regras e políticas: {limit}</Label>
          <Slider
            min={1}
            max={100}
            step={1}
            value={[limit]}
            onValueChange={(v) => setData(node, setNode, { limit: v[0] })}
            className="mt-2"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Este limite se refere à quantidade de Regras e Políticas que retornam da consulta da
            base de conhecimento durante a execução do agente.
          </p>
        </div>
        <FuncList
          items={[
            { name: `policies_${id}_search`, desc: "retorna regras, políticas e informações da empresa (ex: horário, endereço, regras de venda e parcelamento), com suporte a busca por texto e paginação." },
          ]}
        />
        <PoliciesManager />
      </>
    );
  }

  // --- MODAL 4: Transações ---
  if (toolName === "consultar_transacoes") {
    const lookupBy = node.data?.lookupBy || "phone";
    const includeExternal = node.data?.includeExternal !== false;
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Transações" placeholder="" />
        <div className="rounded-lg border border-border p-4 text-center space-y-2">
          <Receipt className="h-8 w-8 mx-auto text-primary" />
          <div className="font-semibold">Ferramenta de Transações</div>
          <p className="text-[12px] text-muted-foreground">
            O agente consulta as compras do lead em atendimento. Busca primeiro nas transações do
            Gateway interno e, se nada for encontrado, consulta também os registros vindos das
            integrações externas conectadas via webhook.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Buscar transações por</Label>
          <Select value={lookupBy} onValueChange={(v) => setData(node, setNode, { lookupBy: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">Telefone do lead</SelectItem>
              <SelectItem value="email">E-mail do lead</SelectItem>
              <SelectItem value="document">CPF / CNPJ do lead</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 rounded-md border p-2">
          <Checkbox
            id="include-external-tx"
            checked={includeExternal}
            onCheckedChange={(c) => setData(node, setNode, { includeExternal: !!c })}
          />
          <Label htmlFor="include-external-tx" className="cursor-pointer text-xs">
            Incluir transações vindas das integrações externas (fallback)
          </Label>
        </div>

        <FuncList
          items={[
            { name: `transactions_${id}_list`, desc: "lista as transações/compras do cliente (50 por página), retornando campos como id, transaction_id, status, payment_date, payment_method, gateway, product_id, product_name, transaction_value e currency." },
            { name: `transactions_${id}_get_by_id`, desc: "busca detalhes completos de uma transação específica pelo transaction_id, incluindo campos como url e expiration_date." },
          ]}
        />
      </>
    );
  }

  // --- MODAL 5: Extrair Dados ---
  if (toolName === "extrair_dados") {
    return <ExtrairDadosPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 6: Enviar transação ---
  if (toolName === "enviar_transacao") {
    const DEFAULT_AWAITING =
      "Olá {lead.name}! 👋\n\nSegue o PIX para *{transaction.product_name}* no valor de *{transaction.transaction_value}*.\n\n📲 Código copia-e-cola:\n{pix.qrcode_pix}\n\nID da transação: {transaction.transaction_id}\n\nAssim que o pagamento for confirmado eu te aviso por aqui. 😉";
    const DEFAULT_OTHER =
      "Atualização do seu pedido *{transaction.product_name}* ({transaction.transaction_value}):\n\nStatus atual: *{transaction.status}*\n\nQualquer dúvida estou à disposição!";
    const DEFAULT_CHARGE_MSG =
      "Pronto {lead.name}! ✅\n\nAqui está o PIX no valor de *{charge.amount}* para {charge.description}.\n\n📲 Código copia-e-cola:\n{charge.brcode}\n\nID: {charge.id}\n\nAssim que o pagamento cair eu te confirmo por aqui. 😉";
    const textAwaiting = node.data?.textAwaiting ?? DEFAULT_AWAITING;
    const textOther = node.data?.textOther ?? DEFAULT_OTHER;
    const chargeMessageTemplate = node.data?.chargeMessageTemplate ?? DEFAULT_CHARGE_MSG;
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta" />
        <InfoBlock>
          <p>
            Envia ao cliente a mensagem de pagamento ou atualização de status com base no
            <code className="mx-1">transaction_id</code> informado pela IA. Os dados da transação
            são carregados na hora do envio.
          </p>
          <ul className="list-disc pl-4 space-y-0.5 mt-1">
            <li>Parâmetro obrigatório: <code>transaction_id</code></li>
            <li>Aguardando pagamento: usa normalização <code>order_details</code> (PIX ou link)</li>
            <li>Outros status: usa <code>order_status</code> (pago, cancelado, etc.)</li>
          </ul>
        </InfoBlock>
        <div>
          <Label>Quando a IA deve usar esta ferramenta</Label>
          <Textarea
            value={node.data?.whenToUse || ""}
            onChange={(e) => setData(node, setNode, { whenToUse: e.target.value })}
            placeholder="Ex: Quando o cliente pedir o link de pagamento, boleto, PIX ou status da compra..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold">Chave PIX para envio oficial</div>
          <p className="text-[11px] text-muted-foreground">
            Usada para gerar o pix_dynamic_code no WhatsApp oficial.
          </p>
          <Label>PIX_KEY_TYPE</Label>
          <Select
            value={node.data?.pixKeyType || ""}
            onValueChange={(v) => setData(node, setNode, { pixKeyType: v })}
          >
            <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CPF">CPF</SelectItem>
              <SelectItem value="CNPJ">CNPJ</SelectItem>
              <SelectItem value="EMAIL">E-mail</SelectItem>
              <SelectItem value="PHONE">Telefone</SelectItem>
              <SelectItem value="EVP">Aleatória (EVP)</SelectItem>
            </SelectContent>
          </Select>
          <Label>PIX_KEY</Label>
          <Input
            value={node.data?.pixKey || ""}
            onChange={(e) => setData(node, setNode, { pixKey: e.target.value })}
            placeholder="Ex: 39580525000189"
          />
          <Label>MERCHANT_NAME</Label>
          <Input
            value={node.data?.merchantName || ""}
            onChange={(e) => setData(node, setNode, { merchantName: e.target.value })}
            placeholder="Ex: Minha Loja LTDA"
          />
          <p className="text-[11px] text-muted-foreground">
            Nome do recebedor exibido no fluxo de pagamento PIX.
          </p>
        </div>
        <div>
          <Label>Texto — aguardando pagamento</Label>
          <Textarea
            value={textAwaiting}
            onChange={(e) => setData(node, setNode, { textAwaiting: e.target.value })}
            rows={8}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Variáveis: {"{lead.name}"}, {"{transaction.product_name}"},
            {" {transaction.transaction_value}"}, {"{transaction.transaction_id}"},
            {" {pix.qrcode_pix}"}
          </p>
        </div>
        <div>
          <Label>Texto — outros status</Label>
          <Textarea
            value={textOther}
            onChange={(e) => setData(node, setNode, { textOther: e.target.value })}
            rows={5}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Variáveis: {"{transaction.product_name}"}, {"{transaction.transaction_value}"},
            {" {transaction.status}"}, {"{transaction.gateway}"}
          </p>
        </div>

        {/* --- Cobrança via Gateway --- */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="charge-enabled"
              checked={!!node.data?.chargeEnabled}
              onCheckedChange={(c) => setData(node, setNode, { chargeEnabled: !!c })}
            />
            <Label htmlFor="charge-enabled" className="cursor-pointer font-semibold">
              Permitir gerar cobrança via Gateway
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground pl-6">
            Quando ativo, a IA pode criar uma nova cobrança PIX em nome do usuário
            (usa o gateway configurado no seu perfil) e devolver o QR Code / código
            copia-e-cola ao cliente. Útil quando o cliente decide comprar pela conversa.
          </p>

          {node.data?.chargeEnabled && (
            <div className="space-y-3 pl-6">
              <div>
                <Label className="text-xs">Origem do valor</Label>
                <Select
                  value={node.data?.chargeAmountSource || "product"}
                  onValueChange={(v) => setData(node, setNode, { chargeAmountSource: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Preço do produto selecionado pela IA</SelectItem>
                    <SelectItem value="ai">Valor livre — IA define o amount</SelectItem>
                    <SelectItem value="fixed">Valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {node.data?.chargeAmountSource === "fixed" && (
                <div>
                  <Label className="text-xs">Valor fixo (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={node.data?.chargeFixedAmount ?? ""}
                    onChange={(e) =>
                      setData(node, setNode, { chargeFixedAmount: e.target.value })
                    }
                    placeholder="Ex: 49.90"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Descrição padrão da cobrança</Label>
                <Input
                  value={node.data?.chargeDescription || ""}
                  onChange={(e) => setData(node, setNode, { chargeDescription: e.target.value })}
                  placeholder="Ex: Pedido via atendimento IA"
                />
              </div>

              <div>
                <Label className="text-xs">Mensagem ao enviar a cobrança gerada</Label>
                <Textarea
                  value={chargeMessageTemplate}
                  onChange={(e) =>
                    setData(node, setNode, { chargeMessageTemplate: e.target.value })
                  }
                  rows={7}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Variáveis: {"{lead.name}"}, {"{charge.amount}"}, {"{charge.brcode}"},{" "}
                  {"{charge.qrcode_image}"}, {"{charge.id}"}, {"{charge.description}"}
                </p>
              </div>

              <div className="rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">Função exposta à IA</div>
                <div>
                  <code>gateway_create_charge</code> — gera uma cobrança PIX usando o gateway
                  configurado e retorna <code>brcode</code>, <code>qrcode_image</code>,{" "}
                  <code>id</code> e <code>amount</code>.
                </div>
                <div>
                  Parâmetros: <code>amount</code> (centavos, opcional se origem = produto/fixo),{" "}
                  <code>product_id</code> (opcional), <code>description</code> (opcional).
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // --- MODAL 7: Gerenciar Ticket CRM ---
  if (toolName === "gerenciar_ticket_crm") {
    return <GerenciarTicketCrmPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 8: Ler anexo ---
  if (toolName === "ler_anexo") {
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Ler anexo (PDF/TXT/planilhas)"
        />
        <InfoBlock>
          <p className="flex gap-2"><Paperclip className="h-4 w-4 shrink-0" /> Baixa o arquivo pela URL do anexo (normalmente aparece no histórico como [Arquivo: ...] url: ...).</p>
          <p>Nome da função no modelo: <code>read_attachment_{id}</code>. Na descrição da ferramenta peça ao agente usar essa função quando existir arquivo com URL no contexto da conversa.</p>
          <p><strong>Formatos suportados:</strong> PDF, Excel (.xls, .xlsx), CSV, texto/tabular como .txt, .md, .json, .xml, .log, .tsv</p>
          <p><strong>Limites:</strong> até ~15 MB por arquivo; texto extraído pode ser truncado se for muito extenso.</p>
          <p>Não inclui Word (.doc/.docx), PowerPoint ou arquivos compactados. Para imagens, use a ferramenta de interpretação/busca por imagem do fluxo, se existir.</p>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 9: Adicionar tag ---
  if (toolName === "adicionar_tag") {
    return <AdicionarTagPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 10: Listar usuários da equipe ---
  if (toolName === "listar_equipe") {
    return <ListarEquipePanel node={node} setNode={setNode} Header={Header} id={id} />;
  }

  // --- MODAL 11: Finalizar Atendimento ---
  if (toolName === "finalizar_atendimento") {
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Finalizar Atendimento"
          placeholder="Ex: quando o cliente confirmar que a dúvida foi resolvida ou pedir para encerrar..."
        />
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
            <span>Finalizar atendimento (tool)</span>
          </div>
          <p className="text-[12px] text-foreground/90 leading-relaxed">
            Quando o agente chamar esta ferramenta, o atendimento será encerrado imediatamente.
            Use a descrição acima para orientar quando a IA deve finalizar (ex: após resolver a
            dúvida, quando o cliente confirmar que não precisa de mais nada).
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[12px] font-medium mb-2">Comportamento:</div>
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground">
            <li>O agente decide quando chamar com base na descrição da ferramenta</li>
            <li>O atendimento é encerrado e o lead sai da fila</li>
            <li>Nenhuma mensagem adicional é enviada automaticamente</li>
            <li>O fluxo do grafo continua após a tool (diferente do bloco Finalizar Atendimento)</li>
          </ul>
        </div>
      </>
    );
  }

  // --- MODAL 12: Agenda ---
  if (toolName === "agenda_eventos") {
    return <AgendaPanel node={node} setNode={setNode} Header={Header} id={id} />;
  }

  // --- MODAL 13: Atualizar Memória Atendimento ---
  if (toolName === "atualizar_memoria") {
    return <MemoriaAtendimentoPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 14: Consulta API (IA) ---
  if (toolName === "consulta_api_ia") {
    return <ConsultaApiPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 15: Acessar Links ---
  if (toolName === "acessar_links") {
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Consultar Links" />
        <InfoBlock>
          <div className="flex gap-2">
            <Link2 className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Esta ferramenta permite buscar e acessar os links compartilhados durante a conversa
              no chat. Não requer configurações adicionais.
            </p>
          </div>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 16: Criar tarefa CRM no lead ---
  if (toolName === "criar_tarefa_crm") {
    return (
      <>
        {Header}
        <div>
          <Label>
            Descrição da ferramenta — Criar tarefa CRM no lead{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={node.data?.description || ""}
            onChange={(e) =>
              setNode({ ...node, data: { ...node.data, description: e.target.value } })
            }
            placeholder="Ex: quando o cliente pedir retorno ou der uma data, registrar com título e prazo..."
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Obrigatório. Descreva quando o agente deve acionar esta ferramenta e qual ação ele
            executa.
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] space-y-1">
          <div className="font-semibold">Lembrete ou tarefa para quem você está falando agora</div>
          <p>
            A tarefa fica sempre ligada à pessoa (o contato desta conversa). Se no atendimento já
            apareceram dados de uma oportunidade, um chamado ou um compromisso na agenda da
            própria pessoa, o assistente pode amarrar o lembrete a um deles — só quando esse
            registro já tiver sido visto antes na conversa, para não misturar com outra pessoa.
          </p>
        </div>
        <InfoBlock>
          <div className="font-semibold text-[11px] uppercase tracking-wider text-primary mb-1">
            O assistente vai pedir pelo menos...
          </div>
          <ul className="list-disc pl-4 space-y-1 text-[11px]">
            <li>Um nome claro para o que precisa ser feito.</li>
            <li>Quando (dia e hora combinados ou pedidos na conversa).</li>
          </ul>
          <p className="text-[11px] mt-2">
            <strong>Se combinar</strong>, dá para incluir detalhes, tipo de pendência (ligação,
            e-mail, reunião ou lembrete), urgência, tamanho aproximado do esforço e quem deve
            executar. Se mencionar algo que já apareceu como número de oportunidade, chamado ou
            compromisso, o assistente pode usar esse id como contexto.
          </p>
          <p className="text-[11px] mt-2">
            Quem você é nesse projeto e o contexto do atendimento costumam ser preenchidos
            automaticamente. Use a descrição da ferramenta no topo do modal para indicar em que
            situação criar uma tarefa e o que não pode ficar em branco.
          </p>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 17: Gerenciar Negócio CRM ---
  if (toolName === "gerenciar_negocio_crm") {
    const perms = node.data?.dealPerms || {};
    const setPerm = (k: string, v: boolean) =>
      setData(node, setNode, { dealPerms: { ...perms, [k]: v } });
    const permItems = [
      {
        k: "list",
        label: "Listar negócios",
        desc: "Ativa assim que você definir o kanban e ao menos uma coluna na etapa 1.",
        locked: true,
      },
      {
        k: "move",
        label: "Mover entre colunas",
        desc: "Altera o estágio do negócio no mesmo kanban; destinos permitidos aparecem na descrição da ferramenta.",
      },
      {
        k: "edit",
        label: "Editar dados do negócio",
        desc: "Permite atualizar nome, descrição e valor do card quando o modelo precisa ajustar o registro.",
      },
      {
        k: "notes",
        label: "Registrar observações",
        desc: "Grava observações/comentários no histórico do card, visíveis para a equipe no CRM.",
      },
      {
        k: "create",
        label: "Criar novo negócio (card)",
        desc: "Defina ao menos uma coluna em escopo na etapa 1 para habilitar a criação de cards.",
      },
    ];
    const activeCount = permItems.filter((p) => p.locked || !!perms[p.k]).length;

    return (
      <>
        {Header}
        <div>
          <Label>
            Descrição da ferramenta — Gerenciar Negócio CRM{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={node.data?.description || ""}
            onChange={(e) =>
              setNode({ ...node, data: { ...node.data, description: e.target.value } })
            }
            placeholder="Ex: use os IDs da listagem; confirme antes de mudar valor ou estágio..."
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Obrigatório. Descreva quando o agente deve acionar esta ferramenta e qual ação ele
            executa.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-0.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Briefcase className="h-4 w-4 text-primary" />
            Gerenciar Negócio (CRM / Kanban)
          </div>
          <p className="text-[11px] text-muted-foreground pl-6">
            Configure em três etapas: escopo no quadro, permissões da IA e campos extras.
          </p>
        </div>

        {/* Etapa 1 */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="text-[12px] font-semibold">1. Onde esta IA atua</div>
          <p className="text-[11px] text-muted-foreground">
            Somente negócios (cards) deste kanban e que estiverem em pelo menos uma das colunas
            abaixo entrarão no escopo desta ferramenta.
          </p>
          <div className="flex items-center justify-between pt-1">
            <Label className="text-[12px]">Kanban de negócios</Label>
            <Button variant="outline" size="sm">+ Adicionar kanban</Button>
          </div>
          <p className="text-[11px] text-muted-foreground italic">Nenhum kanban selecionado</p>
        </div>

        {/* Etapa 2 */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            2. O que a IA pode fazer
            <span className="text-[10px] font-normal text-muted-foreground">
              ({activeCount} ativa{activeCount === 1 ? "" : "s"})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Conclua a etapa 1 (kanban e ao menos uma coluna em escopo) para liberar a listagem e
            poder ativar mais ações.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {permItems.map((p) => {
              const checked = p.locked || !!perms[p.k];
              return (
                <label
                  key={p.k}
                  className={`flex gap-2 items-start rounded-md border p-2.5 cursor-pointer transition-colors ${
                    checked
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={p.locked}
                    onCheckedChange={(c) => setPerm(p.k, !!c)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-medium">{p.label}</span>
                      {p.locked && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                          Sempre ativo
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Etapa 3 */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold">3. Campos personalizados</div>
            <Button variant="outline" size="sm">+ Adicionar</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Somente os campos adicionados podem ser lidos e alterados pela IA. Se nenhum estiver na
            lista, campos extras ficam indisponíveis nesta ferramenta.
          </p>
        </div>
      </>
    );
  }

  // --- MODAL 18: Consultar dados do CRM pela IA ---
  if (toolName === "consultar_crm_ia") {
    const qty = node.data?.crmQty ?? 10;
    const resourceOptions: Array<{ v: string; label: string; desc: string }> = [
      { v: "deals", label: "Negócios", desc: "Cards do pipeline de vendas (kanban)" },
      { v: "companies", label: "Empresas", desc: "Empresas vinculadas ao lead" },
      { v: "tickets", label: "Tickets", desc: "Tickets de suporte abertos pelo lead" },
      { v: "agenda", label: "Eventos de Agenda", desc: "Compromissos e agendamentos do lead" },
      { v: "transactions", label: "Transações", desc: "Histórico de compras e pagamentos" },
      { v: "chats", label: "Atendimentos", desc: "Histórico de conversas em chat" },
      { v: "emails", label: "E-mails", desc: "Troca de e-mails com o lead" },
      { v: "notes", label: "Notas e Observações", desc: "Anotações e observações do lead" },
    ];
    const currentResource = node.data?.crmResource || "companies";
    const currentResourceMeta = resourceOptions.find((r) => r.v === currentResource) || resourceOptions[1];
    return (
      <>
        {Header}
        <div className="space-y-1.5">
          <Label className="text-sm">
            Descrição da ferramenta — Consultar dados do CRM pela IA{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={node.data?.description || ""}
            onChange={(e) => setData(node, setNode, { description: e.target.value })}
            placeholder="Descreva quando e como a IA deve usar esta listagem do CRM..."
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground">
            Obrigatório: Descreva quando o agente deve acionar esta ferramenta e qual ação ele executa.
          </p>
        </div>
        <InfoBlock>
          <div className="font-semibold mb-1">Listagem ampla do CRM</div>
          <p className="text-[11px]">
            Para negócios ou tickets num pipeline com colunas e permissões claras, prefira as tools
            <strong> Gerenciar Negócio CRM (pipeline)</strong> e <strong>Gerenciar Ticket CRM (pipeline)</strong>. Para agenda com calendários e regras
            próprias, use o bloco de <strong>Agenda</strong> do construtor quando sentido — esta listagem
            genérica fica menos adequada para esses três casos.
          </p>
        </InfoBlock>
        <div className="space-y-2">
          <Label>Tipo de recurso padrão</Label>
          <Select
            value={currentResource}
            onValueChange={(v) => setData(node, setNode, { crmResource: v })}
          >
            <SelectTrigger className="h-auto py-2">
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">{currentResourceMeta.label}</span>
                <span className="text-[11px] text-muted-foreground">{currentResourceMeta.desc}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {resourceOptions.map((opt) => (
                <SelectItem key={opt.v} value={opt.v}>
                  <div className="flex flex-col">
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            A IA pode alterar o tipo em runtime se necessário.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Quantidade</Label>
              <div className="text-xs px-2 py-1 rounded bg-muted min-w-[2.5rem] text-center">{qty}</div>
            </div>
            <Slider
              min={1}
              max={50}
              step={1}
              value={[qty]}
              onValueChange={(v) => setData(node, setNode, { crmQty: v[0] })}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>1</span><span>25</span><span>50</span>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Ordenação</Label>
            <Select
              value={node.data?.crmOrder || "recent"}
              onValueChange={(v) => setData(node, setNode, { crmOrder: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes primeiro</SelectItem>
                <SelectItem value="oldest">Mais antigos primeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <InfoBlock>
          <div className="font-semibold text-[11px] uppercase tracking-wider text-primary mb-1">
            Como funciona
          </div>
          <ul className="list-disc pl-4 text-[11px] space-y-0.5">
            <li>A IA decide quando consultar os dados do CRM durante a conversa.</li>
            <li>Tipo padrão: <strong>{currentResourceMeta.label}</strong> (a IA pode alterar).</li>
            <li>Retorna até {qty} registros por consulta.</li>
            <li>Nesta tool genérica continuam disponíveis, entre outros: empresas, transações, chats, emails e notas, negócios, tickets e agenda aqui são legados — prefira as tools dedicadas para esses três.</li>
          </ul>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 19: MCP ---
  if (toolName === "mcp_connect") {
    return <McpPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 20: Horário Atual ---
  if (toolName === "horario_atual") {
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Horário Atual" />
        <InfoBlock>
          <div className="flex gap-2">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Retorna a data e horário atuais, o fuso horário e o dia da semana com base no fuso
              da estratégia. Basta conectar ao agente — a ferramenta será chamada automaticamente
              sempre que a IA precisar saber o horário atual.
            </p>
          </div>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 21: Transferir para Fila ---
  if (toolName === "transferir_fila") {
    return <TransferirFilaPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 21b: Transferir para Estratégia ---
  if (toolName === "transferir_estrategia") {
    return <TransferirEstrategiaPanel node={node} setNode={setNode} Header={Header} />;
  }

  // --- MODAL 22: Agente Tool ---
  if (toolName === "agente_tool") {
    const extras = SubAgentExtras({ node, setNode });
    return (
      <>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Sub-agente como ferramenta
                </div>
                <div className="text-sm font-semibold">Agente Tool</div>
              </div>
            </div>
            {extras.headerButtons}
          </div>
        </div>
        <div>
          <Label>Descrição da Ferramenta</Label>
          <Textarea
            value={node.data?.description || ""}
            onChange={(e) => setData(node, setNode, { description: e.target.value })}
            placeholder="Ex: Especialista em consultar produtos e preços do catálogo"
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Defina quando este sub-agente deve ser utilizado pelo agente principal. Essa descrição
            será exibida como contexto para o modelo de IA decidir qual ferramenta usar.
          </p>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="mission">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center justify-between w-full pr-2">
                <span>Missão / System Prompt — Clique para configurar...</span>
                <span className="text-[10px] text-muted-foreground">0 tokens</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Textarea
                value={node.data?.systemPrompt || ""}
                onChange={(e) => setData(node, setNode, { systemPrompt: e.target.value })}
                placeholder="Defina a missão deste sub-agente..."
                rows={6}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <ModelSelectClaude node={node} setNode={setNode} />
        <div className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
          <div>
            <Label htmlFor="agent-time" className="cursor-pointer">Incluir horário atual no contexto</Label>
            <p className="text-[11px] text-muted-foreground">
              Quando ativo, o sub-agente recebe data/hora atual da execução.
            </p>
          </div>
          <Switch
            id="agent-time"
            checked={!!node.data?.includeTime}
            onCheckedChange={(c) => setData(node, setNode, { includeTime: c })}
          />
        </div>
        {extras.skillsBlock}
        {extras.dialogs}
      </>
    );
  }

  // --- MODAL 23: Expert Tool ---
  if (toolName === "expert_tool") {
    const extras = SubAgentExtras({ node, setNode });
    return (
      <>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Sub-expert estruturado
                </div>
                <div className="text-sm font-semibold">Expert Tool</div>
              </div>
            </div>
            {extras.headerButtons}
          </div>
        </div>
        <div>
          <Label>Descrição da Ferramenta</Label>
          <Textarea
            value={node.data?.description || ""}
            onChange={(e) => setData(node, setNode, { description: e.target.value })}
            placeholder="Ex: Especialista em analisar dados financeiros e retornar relatório estruturado"
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Defina quando este sub-expert deve ser utilizado pelo agente principal. Essa descrição
            será exibida como contexto para o modelo de IA decidir qual ferramenta usar.
          </p>
        </div>
        <Accordion type="multiple">
          <AccordionItem value="input">
            <AccordionTrigger className="text-sm">
              <div className="text-left">
                <div>Estrutura de Dados de Entrada (JSON Schema)</div>
                <div className="text-[10px] text-muted-foreground font-mono">{"{ instruction: string }"}</div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Textarea
                value={node.data?.inputSchema || ""}
                onChange={(e) => setData(node, setNode, { inputSchema: e.target.value })}
                placeholder='{ "type": "object", "properties": { "instruction": { "type": "string" } } }'
                rows={5}
                className="font-mono text-xs"
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="mission">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center justify-between w-full pr-2">
                <span>Missão / System Prompt — Clique para configurar...</span>
                <span className="text-[10px] text-muted-foreground">0 tokens</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Textarea
                value={node.data?.systemPrompt || ""}
                onChange={(e) => setData(node, setNode, { systemPrompt: e.target.value })}
                placeholder="Defina a missão deste sub-expert..."
                rows={6}
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="output">
            <AccordionTrigger className="text-sm">
              <div className="text-left">
                <div>Estrutura de Dados de Saída (JSON Schema)</div>
                <div className="text-[10px] text-muted-foreground font-mono">{"{ msg: string }"}</div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Textarea
                value={node.data?.outputSchema || ""}
                onChange={(e) => setData(node, setNode, { outputSchema: e.target.value })}
                placeholder='{ "type": "object", "properties": { "msg": { "type": "string" } } }'
                rows={5}
                className="font-mono text-xs"
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <ModelSelectClaude node={node} setNode={setNode} />
        <div className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
          <div>
            <Label htmlFor="expert-time" className="cursor-pointer">Incluir horário atual no contexto</Label>
            <p className="text-[11px] text-muted-foreground">
              Quando ativo, o sub-expert recebe data/hora atual da execução.
            </p>
          </div>
          <Switch
            id="expert-time"
            checked={!!node.data?.includeTime}
            onCheckedChange={(c) => setData(node, setNode, { includeTime: c })}
          />
        </div>
        {extras.skillsBlock}
        {extras.dialogs}
      </>
    );
  }

  // --- MODAL 24: RAG ---
  if (toolName === "enviar_prova_social") {
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Prévia / Prova Social"
          placeholder="Quando o lead pedir depoimentos, prévia, prints ou prova social..."
        />
        <SocialProofManager />
      </>
    );
  }
  if (toolName === "rag_documentos") {
    // handled below
  }
  if (toolName === "entregaveis") {
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Entregáveis"
          placeholder="Quando o pagamento do lead for confirmado, envie os entregáveis cadastrados..."
        />
        <DeliverablesManager />
      </>
    );
  }
  if (toolName === "rag_documentos") {
    const limit = node.data?.ragLimit ?? 5;
    const rag = RagControls({ node, setNode });
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — RAG (Base de Conhecimento)"
          placeholder="Retornar informações relevantes sobre..."
        />
        <div>
          <Label>Limite de informações: {limit}</Label>
          <Slider
            min={0}
            max={500}
            step={1}
            value={[limit]}
            onValueChange={(v) => setData(node, setNode, { ragLimit: v[0] })}
            className="mt-2"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Este limite se refere à quantidade de pedaços de informações que retornam da consulta
            da base de conhecimento durante a execução do agente.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => rag.openAdd()}>
            <BookOpen className="h-4 w-4 mr-2" /> + Adicionar informações
          </Button>
          <Button variant="outline" size="sm" onClick={() => rag.openLink()}>
            <Link2 className="h-4 w-4 mr-2" /> Vincular RAG existente
          </Button>
        </div>
        {rag.linkedBlock}
        {rag.dialogs}
      </>
    );
  }

  // --- DEFAULT: original generic form for tools without dedicated modal ---
  return (
    <>
      {Header}
      <div>
        <Label>Nome exibido</Label>
        <Input
          value={node.data?.label || ""}
          onChange={(e) => setData(node, setNode, { label: e.target.value })}
          placeholder="Ex: Consultar Pedido"
        />
      </div>
      <DescField
        node={node}
        setNode={setNode}
        label="Descrição"
        placeholder="O que esta ferramenta faz e quando o agente deve usá-la"
      />
      <div>
        <Label>Instruções para o agente</Label>
        <Textarea
          value={node.data?.instructions || ""}
          onChange={(e) => setData(node, setNode, { instructions: e.target.value })}
          placeholder="Detalhes de como, quando e com quais parâmetros chamar esta ferramenta"
          rows={4}
        />
      </div>
      <div>
        <Label>Parâmetros (JSON opcional)</Label>
        <Textarea
          value={node.data?.parameters || ""}
          onChange={(e) => setData(node, setNode, { parameters: e.target.value })}
          placeholder='{"campo": "valor"}'
          rows={3}
          className="font-mono text-xs"
        />
      </div>
    </>
  );
}