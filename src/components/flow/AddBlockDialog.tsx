import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, type LucideIcon } from "lucide-react";
import {
  AGENT_TOOL_BLOCKS,
  AGENT_TOOL_CATEGORIES,
} from "./agentToolBlocks";

export interface BaseBlockOption {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface AddBlockSelection {
  type: string;
  label: string;
  description?: string;
  extraData?: Record<string, unknown>;
}

interface AddBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseBlocks: BaseBlockOption[];
  onSelect: (selection: AddBlockSelection) => void;
  showAgentTools?: boolean;
}

export function AddBlockDialog({ open, onOpenChange, baseBlocks, onSelect, showAgentTools = false }: AddBlockDialogProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredBase = useMemo(
    () =>
      baseBlocks.filter((b) =>
        !normalizedQuery ||
        b.label.toLowerCase().includes(normalizedQuery) ||
        b.description.toLowerCase().includes(normalizedQuery)
      ),
    [baseBlocks, normalizedQuery]
  );

  const filteredToolsByCategory = useMemo(() => {
    return AGENT_TOOL_CATEGORIES.map((cat) => ({
      category: cat,
      items: AGENT_TOOL_BLOCKS.filter(
        (b) =>
          b.category === cat &&
          (!normalizedQuery ||
            b.label.toLowerCase().includes(normalizedQuery) ||
            b.description.toLowerCase().includes(normalizedQuery) ||
            b.toolName.toLowerCase().includes(normalizedQuery))
      ),
    })).filter((c) => c.items.length > 0);
  }, [normalizedQuery]);

  const handleSelectBase = (b: BaseBlockOption) => {
    onSelect({ type: b.type, label: b.label, description: b.description });
    onOpenChange(false);
  };

  const handleSelectTool = (toolName: string, label: string, description: string, category: string) => {
    const block = AGENT_TOOL_BLOCKS.find((b) => b.toolName === toolName);
    onSelect({
      type: "agentTool",
      label,
      description,
      extraData: {
        toolName,
        label,
        description,
        category,
        instructions: block?.instructions ?? "",
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar bloco ao fluxo</DialogTitle>
          <DialogDescription>
            Escolha um bloco padrão ou uma ferramenta do agente para inserir no fluxo.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar bloco ou ferramenta..."
            className="pl-9"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2">
          <div className="space-y-6 pb-2">
            {!showAgentTools && filteredBase.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Blocos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredBase.map((b) => (
                    <button
                      key={b.type}
                      type="button"
                      onClick={() => handleSelectBase(b)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-accent/50 hover:border-primary/40 transition-all text-left"
                    >
                      <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                        <b.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{b.label}</div>
                        <div className="text-xs text-muted-foreground leading-tight">
                          {b.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {showAgentTools && filteredToolsByCategory.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Ferramentas do Agente
                </h3>
                <div className="space-y-4">
                  {filteredToolsByCategory.map(({ category, items }) => (
                    <div key={category}>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map((b) => (
                          <button
                            key={b.toolName}
                            type="button"
                            onClick={() => handleSelectTool(b.toolName, b.label, b.description, b.category)}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-accent/50 hover:border-primary/40 transition-all text-left"
                          >
                            <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                              <b.icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{b.label}</div>
                              <div className="text-xs text-muted-foreground leading-tight line-clamp-2">
                                {b.description}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {((showAgentTools && filteredToolsByCategory.length === 0) ||
              (!showAgentTools && filteredBase.length === 0)) && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum bloco encontrado.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}