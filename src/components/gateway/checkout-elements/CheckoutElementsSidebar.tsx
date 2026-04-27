import { useState } from "react";
import { Type, ImageIcon, PlayCircle, LayoutGrid, HelpCircle, ThumbsUp, Shield, Star, Stars, Clock, Timer, ListOrdered, BarChart3, TrendingUp, Gift, GripVertical, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, MapPin } from "lucide-react";
import { CheckoutElement, ELEMENT_DEFINITIONS, CheckoutElementType, generateElementId, ElementPosition } from "./types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ICON_MAP: Record<string, any> = {
  Type, ImageIcon, PlayCircle, LayoutGrid, HelpCircle,
  ThumbsUp, Shield, Star, Stars, Clock,
  Timer, ListOrdered, BarChart3, TrendingUp, Gift,
};

const POSITION_LABELS: Record<ElementPosition, string> = {
  "top": "Topo",
  "above-form": "Acima do form",
  "below-form": "Abaixo do form",
  "sidebar": "Sidebar",
  "sidebar-bottom": "Sidebar inferior",
  "footer": "Rodapé",
};

interface Props {
  elements: CheckoutElement[];
  onAddElement: (type: CheckoutElementType, position: ElementPosition) => void;
  onRemoveElement: (id: string) => void;
  onToggleElement: (id: string) => void;
  onSelectElement: (id: string) => void;
  onMoveElement: (id: string, direction: "up" | "down") => void;
  selectedElementId: string | null;
  onDragStart?: (type: CheckoutElementType) => void;
}

const CATEGORIES = [
  { key: "basic" as const, label: "Elementos Básicos" },
  { key: "trust" as const, label: "Elementos de Confiança" },
  { key: "conversion" as const, label: "Elementos de Conversão" },
];

export default function CheckoutElementsSidebar({
  elements,
  onAddElement,
  onRemoveElement,
  onToggleElement,
  onSelectElement,
  onMoveElement,
  selectedElementId,
  onDragStart,
}: Props) {
  const [selectedPosition, setSelectedPosition] = useState<ElementPosition>("below-form");

  return (
    <div className="space-y-4">
      {/* Elementos adicionados */}
      {elements.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Elementos ativos ({elements.length})</p>
          <div className="space-y-1">
            {elements
              .sort((a, b) => a.order - b.order)
              .map((el, idx) => {
                const def = ELEMENT_DEFINITIONS.find(d => d.type === el.type);
                const IconComp = ICON_MAP[def?.icon || "Type"] || Type;
                return (
                  <div
                    key={el.id}
                    className="flex items-center gap-1.5 p-2 rounded-lg border transition-all cursor-pointer group"
                    style={{
                      borderColor: selectedElementId === el.id ? "#a78bfa" : "hsl(var(--border))",
                      background: selectedElementId === el.id ? "rgba(255,77,46,0.08)" : "transparent",
                      opacity: el.visible ? 1 : 0.5,
                    }}
                    onClick={() => onSelectElement(el.id)}
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                    <IconComp className="w-3.5 h-3.5 shrink-0" style={{ color: "#a78bfa" }} />
                    <span className="text-[11px] font-medium flex-1 truncate">{def?.label || el.type}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{POSITION_LABELS[el.position as ElementPosition] || el.position}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onMoveElement(el.id, "up"); }} className="p-0.5 hover:bg-muted rounded" disabled={idx === 0}>
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onMoveElement(el.id, "down"); }} className="p-0.5 hover:bg-muted rounded" disabled={idx === elements.length - 1}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onToggleElement(el.id); }} className="p-0.5 hover:bg-muted rounded">
                        {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onRemoveElement(el.id); }} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Position selector */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Posição ao adicionar
        </p>
        <Select value={selectedPosition} onValueChange={(v) => setSelectedPosition(v as ElementPosition)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(POSITION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Catálogo de elementos */}
      {CATEGORIES.map(cat => {
        const defs = ELEMENT_DEFINITIONS.filter(d => d.category === cat.key);
        return (
          <div key={cat.key} className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {defs.map(def => {
                const IconComp = ICON_MAP[def.icon] || Type;
                return (
                  <button
                    key={def.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("element-type", def.type);
                      onDragStart?.(def.type);
                    }}
                    onClick={() => onAddElement(def.type, selectedPosition)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/5 transition-all cursor-pointer"
                  >
                    <IconComp className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] font-medium">{def.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
