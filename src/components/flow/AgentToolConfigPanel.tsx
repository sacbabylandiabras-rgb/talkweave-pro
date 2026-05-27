import { useNavigate } from "react-router-dom";
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
import { Info, Package, ShieldCheck, Receipt, Paperclip, Tag, Users } from "lucide-react";

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