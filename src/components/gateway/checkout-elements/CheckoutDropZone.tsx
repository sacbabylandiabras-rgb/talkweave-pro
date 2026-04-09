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

export default function CheckoutDropZone({
  position, elements, primaryColor, textColor, cardBg, cardBorder,
  isBuilder, onSelectElement, selectedElementId, onDrop, label,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const positionElements = elements.filter(el => el.position === position).sort((a, b) => a.order - b.order);

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
      style={{
        minHeight: isBuilder && positionElements.length === 0 ? "56px" : undefined,
      }}
    >
      {/* Drop indicator */}
      {isBuilder && dragOver && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed z-10 flex items-center justify-center"
          style={{ borderColor: "#FF4D2E", background: "rgba(255,77,46,0.08)" }}>
          <span className="text-xs font-medium" style={{ color: "#FF4D2E" }}>● Solte aqui</span>
        </div>
      )}

      {/* Empty state — visible clickable zone */}
      {isBuilder && positionElements.length === 0 && !dragOver && (
        <div
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 cursor-pointer transition-all hover:border-[#FF4D2E]/60 hover:bg-[#FF4D2E]/5"
          style={{ borderColor: "#FF4D2E40", color: "#FF4D2E" }}
          onClick={() => {
            // Default to adding a "text" element when clicking the empty zone
            if (onDrop) onDrop("text" as CheckoutElementType, position);
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-medium">{label || POSITION_LABELS[position] || "Adicionar elemento"}</span>
        </div>
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
        <div
          className="flex items-center justify-center gap-1.5 mt-2 py-1.5 rounded-lg border border-dashed cursor-pointer transition-all hover:border-[#FF4D2E]/60 hover:bg-[#FF4D2E]/5"
          style={{ borderColor: "#FF4D2E30", color: "#FF4D2E90" }}
          onClick={() => {
            if (onDrop) onDrop("text" as CheckoutElementType, position);
          }}
        >
          <Plus className="w-3 h-3" />
          <span className="text-[10px] font-medium">Adicionar</span>
        </div>
      )}
    </div>
  );
}
