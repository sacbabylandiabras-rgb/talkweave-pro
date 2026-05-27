import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Bot, Sparkles, BookOpen, ArrowRightLeft, ChevronRight } from "lucide-react";
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

export function AgentToolConfigPanel({ node, setNode }: Props) {
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
        <Button variant="outline" className="w-full">
          <ShieldCheck className="h-4 w-4 mr-2" /> Gerenciar políticas e regras
        </Button>
      </>
    );
  }

  // --- MODAL 4: Transações ---
  if (toolName === "consultar_transacoes") {
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Transações" placeholder="" />
        <div className="rounded-lg border border-border p-4 text-center space-y-2">
          <Receipt className="h-8 w-8 mx-auto text-primary" />
          <div className="font-semibold">Ferramenta de Transações</div>
          <p className="text-[12px] text-muted-foreground">
            Esta ferramenta permite ao agente consultar as transações/compras do cliente atual. As
            transações são carregadas automaticamente com base no lead em atendimento.
          </p>
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
          <Label>Selecione o dado que deseja extrair</Label>
          <Select
            value={node.data?.extractField || ""}
            onValueChange={(v) => setData(node, setNode, { extractField: v })}
          >
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="address">Endereço</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
              <SelectItem value="custom">Campo personalizado</SelectItem>
            </SelectContent>
          </Select>
          <Label className="pt-2">Tipo</Label>
          <Select
            value={node.data?.extractType || "string"}
            onValueChange={(v) => setData(node, setNode, { extractType: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="string">Texto (string)</SelectItem>
              <SelectItem value="number">Número</SelectItem>
              <SelectItem value="boolean">Verdadeiro/Falso</SelectItem>
              <SelectItem value="date">Data</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  // --- MODAL 6: Enviar transação ---
  if (toolName === "enviar_transacao") {
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
            value={node.data?.textAwaiting || ""}
            onChange={(e) => setData(node, setNode, { textAwaiting: e.target.value })}
            placeholder="Olá {lead.name}! Segue o PIX para {transaction.product_name} no valor de {transaction.transaction_value}. ID: {transaction.transaction_id}"
            rows={4}
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
            value={node.data?.textOther || ""}
            onChange={(e) => setData(node, setNode, { textOther: e.target.value })}
            placeholder="Sua compra de {transaction.product_name} ({transaction.transaction_value}) está com status: {transaction.status}."
            rows={3}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Variáveis: {"{transaction.product_name}"}, {"{transaction.transaction_value}"},
            {" {transaction.status}"}, {"{transaction.gateway}"}
          </p>
        </div>
      </>
    );
  }

  // --- MODAL 7: Gerenciar Ticket CRM ---
  if (toolName === "gerenciar_ticket_crm") {
    const perms = node.data?.crmPerms || {};
    const setPerm = (k: string, v: boolean) =>
      setData(node, setNode, { crmPerms: { ...perms, [k]: v } });
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
              checked={node.data?.crmEnabled !== false}
              onCheckedChange={(c) => setData(node, setNode, { crmEnabled: !!c })}
            />
            <Label htmlFor="crm-main" className="cursor-pointer font-semibold">
              Gerenciar Ticket (CRM / Suporte)
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground pl-6">
            Configure em três etapas: escopo no quadro, permissões da IA e campos extras
            permitidos.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">
            1 — Onde esta IA atua
          </div>
          <p className="text-[11px] text-muted-foreground">
            Somente tickets desta pipeline e que estiverem em pelo menos uma das colunas abaixo
            entram no escopo desta ferramenta.
          </p>
          <Label>Pipeline de tickets</Label>
          <Input
            value={node.data?.crmPipelineId || ""}
            onChange={(e) => setData(node, setNode, { crmPipelineId: e.target.value })}
            placeholder="ID do pipeline"
          />
          <Button variant="outline" size="sm" className="w-full">+ Adicionar kanban</Button>
          <p className="text-[11px] text-muted-foreground italic">Nenhum kanban selecionado</p>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">
            2 — O que a IA pode fazer
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[
              { k: "list", label: "Listar tickets (Sempre ativo)", desc: "Consultar tickets dentro do escopo. Ativará assim que você definir pipeline e ao menos uma coluna em escopo.", locked: true },
              { k: "move", label: "Mover entre colunas", desc: "Transfere o ticket para outra coluna deste mesmo pipeline." },
              { k: "edit", label: "Editar título e descrição", desc: "Altera o assunto e o texto principal do ticket." },
              { k: "notes", label: "Registrar observações", desc: "Grava observações/comentários no histórico do ticket." },
              { k: "email", label: "E-mail do ticket", desc: "Defina pipeline e colunas em escopo na etapa 1 para validar o Ticket antes de buscar e-mail." },
              { k: "create", label: "Criar novo ticket", desc: "Defina ao menos uma coluna em escopo na etapa 1 para habilitar a criação." },
            ].map((p) => (
              <label key={p.k} className="flex gap-2 items-start rounded-md border border-border p-2 cursor-pointer">
                <Checkbox
                  checked={p.locked || !!perms[p.k]}
                  disabled={p.locked}
                  onCheckedChange={(c) => setPerm(p.k, !!c)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-[12px] font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">
            3 — Campos personalizados
          </div>
          <Button variant="outline" size="sm">+ Adicionar</Button>
          <p className="text-[11px] text-muted-foreground">
            Somente os campos adicionados podem ser lidos e alterados pela IA. Se nenhum estiver
            na lista, campos extras ficam indisponíveis para edição nesta ferramenta.
          </p>
        </div>
      </>
    );
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
    const tags: string[] = Array.isArray(node.data?.tags) ? node.data.tags : [];
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Adicionar tag" />
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1">
            {tags.length === 0 && (
              <span className="text-[11px] text-muted-foreground italic">Nenhuma tag selecionada</span>
            )}
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]">
                <Tag className="h-3 w-3" /> {t}
                <button
                  type="button"
                  className="ml-1 hover:text-destructive"
                  onClick={() => setData(node, setNode, { tags: tags.filter((x) => x !== t) })}
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Nova tag"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v && !tags.includes(v)) setData(node, setNode, { tags: [...tags, v] });
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">Pressione Enter para adicionar.</p>
        </div>
      </>
    );
  }

  // --- MODAL 10: Listar usuários da equipe ---
  if (toolName === "listar_equipe") {
    const scope = node.data?.teamScope || "all";
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
      </>
    );
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
        <div className="flex items-center gap-2 rounded-lg border border-border p-3">
          <Checkbox
            id="finalize-flag"
            checked={node.data?.finalizeEnabled !== false}
            onCheckedChange={(c) => setData(node, setNode, { finalizeEnabled: !!c })}
          />
          <Label htmlFor="finalize-flag" className="cursor-pointer">
            Finalizar atendimento (tool)
          </Label>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            Quando o agente chamar esta ferramenta, o atendimento será encerrado imediatamente.
            Use a descrição acima para orientar quando a IA deve finalizar (ex: após resolver a
            dúvida, quando o cliente confirmar que não precisa de mais nada).
          </p>
        </div>
        <InfoBlock>
          <div className="font-semibold text-[11px] uppercase tracking-wider text-primary mb-1">
            Comportamento
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li>O agente decide quando chamar com base na descrição da ferramenta.</li>
            <li>O atendimento é encerrado e o lead sai da fila.</li>
            <li>Nenhuma mensagem adicional é enviada automaticamente.</li>
            <li>O fluxo do grafo continua após a tool (diferente do bloco Finalizar Atendimento).</li>
          </ul>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 12: Agenda ---
  if (toolName === "agenda_eventos") {
    const calendars: string[] = Array.isArray(node.data?.calendars) ? node.data.calendars : [];
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Agenda" />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Agendas selecionadas</Label>
            <Button variant="outline" size="sm">+ Adicionar</Button>
          </div>
          {calendars.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma agenda selecionada</p>
          ) : (
            <ul className="text-[12px] space-y-1">
              {calendars.map((c, i) => <li key={i}>• {c}</li>)}
            </ul>
          )}
          <Button variant="outline" size="sm" className="w-full">
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
      </>
    );
  }

  // --- MODAL 13: Atualizar Memória Atendimento ---
  if (toolName === "atualizar_memoria") {
    const fields: string[] = Array.isArray(node.data?.memoryFields) ? node.data.memoryFields : [];
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — Atualizar Memória Atendimento" />
        <div className="space-y-2">
          <Label>Estrutura da Memória</Label>
          <Button variant="outline" size="sm" className="w-full">
            <Brain className="h-4 w-4 mr-2" /> Editar Estrutura da Memória de Atendimento
          </Button>
          <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
            Estrutura não definida — Clique em "Editar Estrutura" para definir os campos da memória.
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Campos que a IA pode Atualizar</Label>
            <Button variant="outline" size="sm">+ Adicionar Campo</Button>
          </div>
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
              Nenhum campo habilitado. Use o botão "Adicionar Campo" para selecionar campos que a IA poderá atualizar.
            </div>
          ) : (
            <ul className="text-[12px] space-y-1">
              {fields.map((f, i) => <li key={i}>• {f}</li>)}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px]">
          <strong>Diferença do operador "Salvar Memória":</strong> No operador, você define o valor
          fixo (ex: <code>{"{{sale_ai_output_plan}}"}</code>). Aqui na tool, a IA decide
          dinamicamente quando e com qual valor atualizar cada campo, baseado na conversa.
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="how">
            <AccordionTrigger className="text-sm">Como funciona</AccordionTrigger>
            <AccordionContent>
              <p className="text-[12px] mb-2">
                Esta tool é registrada dinamicamente no agente com os campos que você selecionar. A IA recebe:
              </p>
              <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                <li>Nome do campo como nome do parâmetro</li>
                <li>Tipo do schema (string, number, array, object...) como tipo do parâmetro</li>
                <li>Descrição do schema como description do parâmetro</li>
                <li>Quando a IA chamar a tool, os valores serão salvos na memória do atendimento em <code>{"{{memory.campo}}"}</code>.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </>
    );
  }

  // --- MODAL 14: Consulta API (IA) ---
  if (toolName === "consulta_api_ia") {
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
            Use variáveis dinâmicas: <code>{"{{lead.campo}}"}</code>, <code>{"{{node.X.response}}"}</code>, <code>{"{{memory.campo}}"}</code>
          </p>
        </div>
        <Accordion type="multiple" className="w-full">
          {[
            { v: "ai", label: "Parâmetros da IA", sub: "Campos que o agente IA deve preencher ao acionar esta tool." },
            { v: "headers", label: "Parâmetros Headers", sub: "Cabeçalhos HTTP enviados nesta requisição. Use variáveis dinâmicas ou valores fixos." },
            { v: "body", label: "Parâmetros Body", sub: "Campos do corpo quando o método permitir corpo (POST, PUT, PATCH)." },
            { v: "query", label: "Parâmetros Query", sub: "Parâmetros de query string acrescentados à URL." },
          ].map((s) => (
            <AccordionItem key={s.v} value={s.v}>
              <AccordionTrigger className="text-sm">{s.label}</AccordionTrigger>
              <AccordionContent>
                <p className="text-[11px] text-muted-foreground mb-2">{s.sub}</p>
                <Button variant="outline" size="sm">+ Adicionar</Button>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </>
    );
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
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Criar tarefa CRM no lead"
          placeholder="Ex: quando o cliente pedir retorno ou der uma data, registrar com título e prazo..."
        />
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
            <li>Se combinar, dá para incluir detalhes, tipo de pendência (ligação, e-mail, reunião ou lembrete), urgência, tamanho aproximado do esforço e quem deve executar. Se mencionar algo que já apareceu como número de oportunidade, chamado ou compromisso, o assistente pode usar esse id como contexto.</li>
            <li>Quem você é nesse projeto e o contexto do atendimento costumam ser preenchidos automaticamente. Use a descrição da ferramenta no topo do modal para indicar em que situação criar uma tarefa e o que não pode ficar em branco.</li>
          </ul>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 17: Gerenciar Negócio CRM ---
  if (toolName === "gerenciar_negocio_crm") {
    const perms = node.data?.dealPerms || {};
    const setPerm = (k: string, v: boolean) =>
      setData(node, setNode, { dealPerms: { ...perms, [k]: v } });
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Gerenciar Negócio CRM"
          placeholder="Ex: use os IDs da listagem; confirme antes de mudar valor ou estágio..."
        />
        <div className="rounded-lg border border-border p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id="deal-main"
              checked={node.data?.dealEnabled !== false}
              onCheckedChange={(c) => setData(node, setNode, { dealEnabled: !!c })}
            />
            <Label htmlFor="deal-main" className="cursor-pointer font-semibold">
              Gerenciar Negócio (CRM / Kanban)
            </Label>
          </div>
          <p className="text-[11px] text-muted-foreground pl-6">
            Configure em três etapas: escopo no quadro, permissões da IA e campos extras.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">
            1 — Onde esta IA atua
          </div>
          <p className="text-[11px] text-muted-foreground">
            Somente negócios (cards) deste kanban e que estiverem em pelo menos uma das colunas
            abaixo entram no escopo desta ferramenta.
          </p>
          <Label>Kanban de negócios</Label>
          <Input
            value={node.data?.dealKanbanId || ""}
            onChange={(e) => setData(node, setNode, { dealKanbanId: e.target.value })}
            placeholder="ID do kanban"
          />
          <Button variant="outline" size="sm" className="w-full">+ Adicionar kanban</Button>
          <p className="text-[11px] text-muted-foreground italic">Nenhum kanban selecionado</p>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">
            2 — O que a IA pode fazer
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[
              { k: "list", label: "Listar negócios (Sempre ativo)", desc: "Ativará assim que você definir o kanban e ao menos uma coluna na etapa 1.", locked: true },
              { k: "move", label: "Mover entre colunas", desc: "Altera o estágio do negócio no mesmo kanban; destinos permitidos aparecem na descrição da ferramenta." },
              { k: "edit", label: "Editar dados do negócio", desc: "Permite atualizar nome, descrição e valor do card quando o modelo precisa ajustar o registro." },
              { k: "notes", label: "Registrar observações", desc: "Grava observações/comentários no histórico do card." },
              { k: "create", label: "Criar novo negócio (card)", desc: "Defina ao menos uma coluna em escopo na etapa 1 para habilitar a criação de cards." },
            ].map((p) => (
              <label key={p.k} className="flex gap-2 items-start rounded-md border border-border p-2 cursor-pointer">
                <Checkbox
                  checked={p.locked || !!perms[p.k]}
                  disabled={p.locked}
                  onCheckedChange={(c) => setPerm(p.k, !!c)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-[12px] font-medium">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">
            3 — Campos personalizados
          </div>
          <Button variant="outline" size="sm">+ Adicionar</Button>
          <p className="text-[11px] text-muted-foreground">
            Somente os campos adicionados podem ser lidos e alterados pela IA. Se nenhum estiver
            na lista, campos extras ficam indisponíveis nesta ferramenta.
          </p>
        </div>
      </>
    );
  }

  // --- MODAL 18: Consultar dados do CRM pela IA ---
  if (toolName === "consultar_crm_ia") {
    const qty = node.data?.crmQty ?? 10;
    return (
      <>
        {Header}
        <DescField
          node={node}
          setNode={setNode}
          label="Descrição da ferramenta — Consultar dados do CRM pela IA"
          placeholder="Descreva quando e como a IA deve usar esta listagem do CRM..."
        />
        <InfoBlock>
          <div className="font-semibold mb-1">Listagem ampla do CRM</div>
          <p className="text-[11px]">
            Para negócios ou tickets num pipeline com colunas e permissões claras, prefira as tools
            Gerenciar Negócio CRM e Gerenciar Ticket CRM. Para agenda com calendários e regras
            próprias, use o bloco de Agenda do construtor — esta listagem genérica fica menos
            adequada para esses três casos.
          </p>
        </InfoBlock>
        <div className="space-y-2">
          <Label>Tipo de recurso padrão</Label>
          <Select
            value={node.data?.crmResource || "companies"}
            onValueChange={(v) => setData(node, setNode, { crmResource: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="companies">Empresas — Empresas vinculadas ao lead</SelectItem>
              <SelectItem value="transactions">Transações</SelectItem>
              <SelectItem value="chats">Chats</SelectItem>
              <SelectItem value="emails">E-mails</SelectItem>
              <SelectItem value="notes">Notas</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Negócios, tickets e eventos de agenda não podem mais ser escolhidos como padrão novo
            aqui — use as tools dedicadas. A IA pode alterar o tipo em runtime se necessário.
          </p>
        </div>
        <div>
          <Label>Quantidade: {qty}</Label>
          <Slider
            min={1}
            max={50}
            step={1}
            value={[qty]}
            onValueChange={(v) => setData(node, setNode, { crmQty: v[0] })}
            className="mt-2"
          />
        </div>
        <div>
          <Label>Ordenação</Label>
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
        <InfoBlock>
          <div className="font-semibold text-[11px] uppercase tracking-wider text-primary mb-1">
            Como funciona
          </div>
          <ul className="list-disc pl-4 text-[11px] space-y-0.5">
            <li>A IA decide quando consultar os dados do CRM durante a conversa.</li>
            <li>Tipo padrão: a IA pode alterar em runtime.</li>
            <li>Retorna até {qty} registros por consulta.</li>
            <li>Disponíveis: empresas, transações, chats, emails e notas. Negócios, tickets e agenda — prefira as tools dedicadas.</li>
          </ul>
        </InfoBlock>
      </>
    );
  }

  // --- MODAL 19: MCP ---
  if (toolName === "mcp_connect") {
    return (
      <>
        {Header}
        <DescField node={node} setNode={setNode} label="Descrição da ferramenta — MCP (Model Context Protocol)" />
        <div className="space-y-2">
          <Label>Endpoint do MCP</Label>
          <Input
            value={node.data?.mcpUrl || ""}
            onChange={(e) => setData(node, setNode, { mcpUrl: e.target.value })}
            placeholder="https://mcp.exemplo.com/endpoint"
          />
          <p className="text-[11px] text-muted-foreground">
            Use variáveis dinâmicas: <code>{"{{global.campo}}"}</code>, <code>{"{{project.campo}}"}</code>
          </p>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="headers">
            <AccordionTrigger className="text-sm">Parâmetros Headers</AccordionTrigger>
            <AccordionContent>
              <p className="text-[11px] text-muted-foreground mb-2">
                Cabeçalhos HTTP enviados na requisição ao MCP. Use variáveis dinâmicas ou valores fixos.
              </p>
              <Button variant="outline" size="sm">+ Adicionar</Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Button variant="outline" className="w-full">
          <Plug className="h-4 w-4 mr-2" /> Ativar tools do MCP
        </Button>
        <p className="text-[11px] text-muted-foreground text-center italic">
          Nenhuma tool está ativa no momento
        </p>
      </>
    );
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
    const depts: string[] = Array.isArray(node.data?.departments) ? node.data.departments : [];
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
            checked={!!node.data?.queueRandom}
            onCheckedChange={(c) => setData(node, setNode, { queueRandom: c })}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Departamento</Label>
            <Button variant="outline" size="sm">Selecionar</Button>
          </div>
          {depts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhum departamento definido</p>
          ) : (
            <ul className="text-[12px] space-y-1">
              {depts.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          )}
        </div>
        <div className="flex items-start justify-between rounded-lg border border-border p-3 gap-3">
          <div>
            <Label htmlFor="queue-end" className="cursor-pointer">Encerrar fluxo após a transferência</Label>
            <p className="text-[11px] text-muted-foreground">
              Não gera nova mensagem do agente nem segue para o próximo nó do grafo — útil quando a
              fila já responde ao cliente.
            </p>
          </div>
          <Switch
            id="queue-end"
            checked={!!node.data?.queueEndFlow}
            onCheckedChange={(c) => setData(node, setNode, { queueEndFlow: c })}
          />
        </div>
      </>
    );
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
  if (toolName === "rag_documentos") {
    const limit = node.data?.ragLimit ?? 5;
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
          <Button variant="outline" size="sm">
            <BookOpen className="h-4 w-4 mr-2" /> + Adicionar informações
          </Button>
          <Button variant="outline" size="sm">
            <Link2 className="h-4 w-4 mr-2" /> Vincular RAG existente
          </Button>
        </div>
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