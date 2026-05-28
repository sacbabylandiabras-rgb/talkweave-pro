import { useMemo, useState } from "react";
import { useStore, useViewport, Node } from "reactflow";
import { FlowLeadPosition } from "@/hooks/useFlowLeadPositions";

interface Props {
  positions: FlowLeadPosition[];
}

function colorFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h} 70% 55%)`;
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts.length || !parts[0]) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function timeSince(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}min`;
}

const STATUS_RING: Record<string, string> = {
  active: "ring-emerald-400",
  waiting: "ring-amber-400",
  error: "ring-red-500",
};

export function FlowLeadOverlay({ positions }: Props) {
  const nodeInternals = useStore((s) => s.nodeInternals);
  const { x: vx, y: vy, zoom } = useViewport();
  const [hover, setHover] = useState<string | null>(null);

  // Agrupa leads por bloco
  const grouped = useMemo(() => {
    const map = new Map<string, FlowLeadPosition[]>();
    positions.forEach((p) => {
      const list = map.get(p.block_id) || [];
      list.push(p);
      map.set(p.block_id, list);
    });
    return map;
  }, [positions]);

  const items: Array<{ node: Node; leads: FlowLeadPosition[] }> = [];
  grouped.forEach((leads, blockId) => {
    const node = nodeInternals.get(blockId) as Node | undefined;
    if (node) items.push({ node, leads });
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[5]">
      {items.map(({ node, leads }) => {
        const width = (node as any).width || 280;
        const x = node.position.x * zoom + vx + (width * zoom) / 2;
        const y = node.position.y * zoom + vy - 14 * zoom;
        const visible = leads.slice(0, 3);
        const extra = leads.length - visible.length;
        return (
          <div
            key={node.id}
            className="absolute flex items-center pointer-events-auto"
            style={{
              left: x,
              top: y,
              transform: `translate(-50%, -50%)`,
              transition: "left 300ms ease, top 300ms ease",
            }}
          >
            {visible.map((lead, i) => {
              const name = lead.contact_name || lead.phone;
              const isHover = hover === lead.id;
              return (
                <div
                  key={lead.id}
                  className="relative"
                  style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}
                  onMouseEnter={() => setHover(lead.id)}
                  onMouseLeave={() => setHover((h) => (h === lead.id ? null : h))}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-offset-1 ring-offset-background shadow-md ${
                      STATUS_RING[lead.status] || "ring-emerald-400"
                    }`}
                    style={{ background: colorFromName(name) }}
                  >
                    {initials(name)}
                  </div>
                  {isHover && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 whitespace-nowrap rounded-md bg-popover border border-border px-2.5 py-1.5 text-[11px] text-foreground shadow-lg pointer-events-none">
                      <div className="font-medium">{name}</div>
                      <div className="text-muted-foreground">{lead.phone}</div>
                      <div className="text-muted-foreground">No bloco há {timeSince(lead.entered_at)}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {extra > 0 && (
              <div
                className="w-7 h-7 rounded-full bg-muted text-foreground text-[10px] font-semibold flex items-center justify-center ring-2 ring-offset-1 ring-offset-background ring-border shadow-md"
                style={{ marginLeft: -10, zIndex: 1 }}
              >
                +{extra}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}