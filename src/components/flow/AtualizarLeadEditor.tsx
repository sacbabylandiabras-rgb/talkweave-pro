import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, Search, User, Plus, Key } from "lucide-react";

const STORAGE_KEY = "fluxo:custom-keys";

const DEFAULT_KEYS: { key: string; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "telefone", label: "Telefone" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "pais", label: "País" },
  { key: "origem", label: "Origem" },
  { key: "empresa", label: "Empresa" },
  { key: "cargo", label: "Cargo" },
  { key: "observacoes", label: "Observações" },
];

function loadKeys(): { key: string; label: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_KEYS;
    const merged = new Map<string, { key: string; label: string }>();
    [...DEFAULT_KEYS, ...parsed].forEach((k: any) => {
      if (k && typeof k.key === "string" && k.key.trim()) {
        merged.set(k.key, { key: k.key, label: k.label || k.key });
      }
    });
    return Array.from(merged.values());
  } catch {
    return DEFAULT_KEYS;
  }
}

function saveKeys(keys: { key: string; label: string }[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {}
}

export type AtualizarLeadConfig = {
  customKey?: string;
  customKeyLabel?: string;
  updateValue?: string;
};

export function AtualizarLeadEditor({
  data,
  onChange,
}: {
  data: any;
  onChange: (patch: Partial<AtualizarLeadConfig> & { actionType?: string }) => void;
}) {
  const cfg: AtualizarLeadConfig = data?.atualizarLead || {};
  const [keys, setKeys] = useState<{ key: string; label: string }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    setKeys(loadKeys());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter(
      (k) =>
        k.key.toLowerCase().includes(q) ||
        (k.label || "").toLowerCase().includes(q),
    );
  }, [keys, query]);

  const update = (patch: Partial<AtualizarLeadConfig>) => {
    const next = { ...cfg, ...patch };
    onChange({
      actionType: "update_lead",
      atualizarLead: next as any,
      actionConfig: next.customKey ? `${next.customKey}=${next.updateValue ?? ""}` : "",
    } as any);
  };

  const selectKey = (k: { key: string; label: string }) => {
    update({ customKey: k.key, customKeyLabel: k.label });
    setPickerOpen(false);
    setQuery("");
  };

  const addNew = () => {
    const key = newKey.trim();
    if (!key) return;
    const label = newLabel.trim() || key;
    const next = [...keys.filter((k) => k.key !== key), { key, label }];
    setKeys(next);
    saveKeys(next);
    selectKey({ key, label });
    setNewKey("");
    setNewLabel("");
    setCreateOpen(false);
  };

  const insertVar = (v: string) => {
    update({ updateValue: (cfg.updateValue || "") + v });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-medium">Atualizar Lead</span>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Selecione a chave personalizada e defina o valor que será gravado no lead.
        Você pode usar um valor fixo ou uma variável dinâmica.
      </p>

      <div className="space-y-1.5">
        <Label className="text-[12px]">Chave personalizada</Label>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-left text-[12px] flex items-center justify-between hover:bg-muted/40"
        >
          {cfg.customKey ? (
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-primary/15 text-primary text-[10px] font-bold uppercase">
                {cfg.customKey.slice(0, 1)}
              </span>
              <span className="font-medium">{cfg.customKey}</span>
              {cfg.customKeyLabel && cfg.customKeyLabel !== cfg.customKey && (
                <span className="text-muted-foreground">{cfg.customKeyLabel}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione...</span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[12px]">Valor para atualização</Label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => insertVar("{{lead.nome}}")}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted/40"
              title="Inserir variável do lead"
            >
              {"{{lead}}"}
            </button>
            <button
              type="button"
              onClick={() => insertVar("{{memoria.}}")}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted/40"
              title="Inserir variável de memória"
            >
              {"{{memoria}}"}
            </button>
            <button
              type="button"
              onClick={() => update({ updateValue: "" })}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted/40"
              title="Limpar"
            >
              Limpar
            </button>
          </div>
        </div>
        <Input
          value={cfg.updateValue || ""}
          onChange={(e) => update({ updateValue: e.target.value })}
          placeholder="Valor ou {{variável}}"
        />
        <p className="text-[11px] text-muted-foreground">
          Use valor fixo ou selecione variável do lead.
        </p>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar chave personalizada</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por chave ou rótulo..."
                className="pl-8"
                autoFocus
              />
            </div>
            <ul className="max-h-[40vh] overflow-y-auto space-y-0.5">
              {filtered.length === 0 ? (
                <li className="text-[12px] text-muted-foreground text-center py-6">
                  Nenhuma chave encontrada.
                </li>
              ) : (
                filtered.map((k) => (
                  <li key={k.key}>
                    <button
                      type="button"
                      onClick={() => selectKey(k)}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/40 text-left"
                    >
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded bg-primary/15 text-primary text-[11px] font-bold uppercase">
                        {k.key.slice(0, 1)}
                      </span>
                      <span className="text-[12px] font-medium">{k.key}</span>
                      {k.label && k.label !== k.key && (
                        <span className="text-[12px] text-muted-foreground">
                          {k.label}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setPickerOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Nova chave
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova chave personalizada</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label className="text-[12px]">Chave (identificador)</Label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.replace(/\s+/g, "_").toLowerCase())}
                placeholder="ex: origem_campanha"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-[12px]">Rótulo (opcional)</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="ex: Origem da Campanha"
                onKeyDown={(e) => e.key === "Enter" && addNew()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addNew} disabled={!newKey.trim()}>
              <Key className="h-4 w-4 mr-1" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}