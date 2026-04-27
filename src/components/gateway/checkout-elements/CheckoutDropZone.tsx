import { useState } from "react";
import { Plus } from "lucide-react";
import { CheckoutElement, CheckoutElementType, ElementPosition } from "./types";
import CheckoutElementRenderer from "./CheckoutElementRenderer";

interface Props {
  position: ElementPosition;
  elements: CheckoutElement[];
  primaryColor: string;
  textColor: string;
  cardBg: string;
  cardBorder: string;
  isBuilder?: boolean;
  onSelectElement?: (id: string) => void;
  selectedElementId?: string | null;
  onDrop?: (type: CheckoutElementType, position: ElementPosition) => void;
  label?: string;
}

const POSITION_LABELS: Record<ElementPosition, string> = {
  "top": "Topo",
  "above-form": "Acima do formulário",
  "below-form": "Abaixo do formulário",
  "sidebar": "Sidebar",
  "sidebar-bottom": "Sidebar inferior",
  "footer": "Rodapé",
};

const POSITION_HELPERS: Record<ElementPosition, string> = {
  "top": "Clique para adicionar elemento",
  "above-form": "Clique para adicionar elemento",
  "below-form": "Clique para adicionar elemento",
  "sidebar": "Clique para adicionar elemento",
  "sidebar-bottom": "Clique para adicionar elemento",
  "footer": "Clique para adicionar elemento",
};

export default function CheckoutDropZone({
  position, elements, primaryColor, textColor, cardBg, cardBorder,
  isBuilder, onSelectElement, selectedElementId, onDrop, label,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const positionElements = elements.filter(el => el.position === position).sort((a, b) => a.order - b.order);

  const handleAddClick = () => {
    if (onDrop) onDrop("text" as CheckoutElementType, position);
  };

  const renderAddBox = (compact = false) => (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center cursor-pointer transition-all hover:border-[hsl(var(--primary))] hover:bg-accent/30"
      style={{
        minHeight: compact ? "88px" : "120px",
        borderColor: dragOver ? primaryColor : cardBorder,
        background: dragOver ? `${primaryColor}10` : cardBg,
        color: textColor,
      }}
      onClick={handleAddClick}
    >
      <Plus className="w-4 h-4" style={{ color: primaryColor }} />
      <span className="text-sm font-medium">Clique para adicionar elemento</span>
      <span className="text-xs opacity-70">{label || POSITION_LABELS[position] || "Adicionar elemento"}</span>
    </div>
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const type = e.dataTransfer.getData("element-type") as CheckoutElementType;
    if (type && onDrop) onDrop(type, position);
  };

  if (!isBuilder && positionElements.length === 0) return null;

  return (
    <div
      onDragOver={isBuilder ? handleDragOver : undefined}
      onDragLeave={isBuilder ? handleDragLeave : undefined}
      onDrop={isBuilder ? handleDrop : undefined}
      className="relative"
      style={{ minHeight: isBuilder ? "88px" : undefined }}
    >
      {/* Drop indicator */}
      {isBuilder && dragOver && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed z-10 flex items-center justify-center"
          style={{ borderColor: "#a78bfa", background: "rgba(255,77,46,0.08)" }}>
          <span className="text-xs font-medium" style={{ color: "#a78bfa" }}>● Solte aqui</span>
        </div>
      )}

      {/* Empty state — visible clickable zone */}
      {isBuilder && positionElements.length === 0 && !dragOver && (
        renderAddBox()
      )}

      {/* Rendered elements */}
      <div className="space-y-3">
        {positionElements.map(el => (
          <CheckoutElementRenderer
            key={el.id}
            element={el}
            primaryColor={primaryColor}
            textColor={textColor}
            cardBg={cardBg}
            cardBorder={cardBorder}
            isBuilder={isBuilder}
            onClick={() => onSelectElement?.(el.id)}
            isSelected={selectedElementId === el.id}
          />
        ))}
      </div>

      {/* Add more button when elements exist */}
      {isBuilder && positionElements.length > 0 && (
        <div className="mt-3">{renderAddBox(true)}</div>
      )}
    </div>
  );
}
