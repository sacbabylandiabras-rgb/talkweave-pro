import { useState } from "react";
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
        minHeight: isBuilder && positionElements.length === 0 ? "48px" : undefined,
      }}
    >
      {/* Drop indicator */}
      {isBuilder && dragOver && (
        <div className="absolute inset-0 rounded-xl border-2 border-dashed z-10 flex items-center justify-center"
          style={{ borderColor: "#FF4D2E", background: "rgba(255,77,46,0.08)" }}>
          <span className="text-xs font-medium" style={{ color: "#FF4D2E" }}>● Solte aqui</span>
        </div>
      )}

      {/* Empty state */}
      {isBuilder && positionElements.length === 0 && !dragOver && (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-3"
          style={{ borderColor: cardBorder + "80", color: textColor + "40" }}>
          <span className="text-[10px]">● {label || "Solte aqui"}</span>
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
    </div>
  );
}
