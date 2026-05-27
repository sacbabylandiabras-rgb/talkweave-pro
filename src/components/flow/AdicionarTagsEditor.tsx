import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, RefreshCw, Search, Tag, X, MinusCircle } from "lucide-react";

const BUILTIN_TAGS = [
  "abandonou-carrinho","abmex","active-campaign","aguardando-pagamento","appmax",
  "ativo-whatsapp","b4you","braip","calendly","cancelado","cartao-credito",
  "cartpanda","compra-realizada","custom","digital_guru","disputando","doppus",
  "eduzz","email","email-cold","email-hot","email-warm","estornou","evermart",
  "facebook","form","gerou-boleto","gerou-pix","greenn","grupo-whats",
  "grupo-whatsapp","herospark","hotmart","hotwebinar","importado-csv",
  "import-contact","iniciou-pagamento-cartao","irroba","iset","kirvano","kiwify",
  "lastlink","leadster","loja_integrada","manychat","melldin","monetizze","neemo",
  "notazz","nuvemshop","pagarme","payt","pepper","perfect-pay","proaluno",
  "rd_station_marketing","sacoleiroapp","sellflux","sellfront","shopify",
  "telefone","ticto","tictov2","tray","unbounce","vnda","voomp","wbuy","wix",
  "woocommerce","wordpress","yampi",
];

export function AdicionarTagsEditor({
  value,
  onChange,
  availableTags,
  loading,
  onRefresh,
  mode = "add",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  availableTags: string[];
  loading?: boolean;
  onRefresh?: () => void;
  mode?: "add" | "remove";
}) {
  const isRemove = mode === "remove";
  const title = isRemove ? "Remover Tags" : "Adicionar Tags";
  const description = isRemove
    ? "Neste bloco você configura quais tags devem ser removidas dos leads que seguirem por este fluxo. Quando o lead chegar neste bloco, as tags abaixo serão removidas do cadastro do lead."
    : "Neste bloco você configura quais tags devem ser inseridas aos leads que seguirem por este fluxo. Quando o lead chegar neste bloco, as tags abaixo serão adicionadas ao cadastro do lead.";
  const listLabel = isRemove ? "Tags para remoção" : "Tags selecionadas";
  const searchPlaceholder = isRemove
    ? "Buscar nas tags para remover..."
    : "Buscar nas tags adicionadas...";
  const emptyLabel = isRemove
    ? "Nenhuma tag selecionada para remoção."
    : "Nenhuma tag selecionada.";
  const HeaderIcon = isRemove ? MinusCircle : Tag;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const merged = useMemo(() => {
    const set = new Set<string>([...BUILTIN_TAGS, ...availableTags, ...value]);
    return Array.from(set).sort();
  }, [availableTags, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((t) => t.toLowerCase().includes(q));
  }, [merged, query]);

  const toggle = (tag: string) => {
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else onChange([...value, tag]);
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    if (!value.includes(name)) onChange([...value, name]);
    setNewName("");
    setCreateOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <HeaderIcon className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">{title}</span>
      </div>
      <p className="text-[12px] text-muted-foreground">{description}</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[12px]">{listLabel}</Label>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-left text-[12px] flex items-center justify-between hover:bg-muted/40"
              >
                <span className="text-muted-foreground">
                  {loading ? "Carregando tags..." : searchPlaceholder}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar tags..."
                  className="h-8 pl-7 text-[12px]"
                  autoFocus
                />
              </div>
              <ul className="max-h-[40vh] overflow-y-auto space-y-0.5">
                {filtered.length === 0 ? (
                  <li className="text-[12px] text-muted-foreground text-center py-4">
                    Nenhuma tag encontrada.
                  </li>
                ) : (
                  filtered.map((tag) => (
                    <li key={tag}>
                      <button
                        type="button"
                        onClick={() => toggle(tag)}
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 text-left"
                      >
                        <Checkbox checked={value.includes(tag)} />
                        <span className="text-[12px]">{tag}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            + Nova
          </Button>
        </div>

        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {value.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                <Tag className="h-3 w-3" />
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-[12px]">Nome da tag</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: cliente-vip"
              onKeyDown={(e) => e.key === "Enter" && addNew()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addNew} disabled={!newName.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}