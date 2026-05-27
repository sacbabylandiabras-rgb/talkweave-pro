import { GripVertical } from "lucide-react";
import {
  AGENT_TOOL_BLOCKS,
  AGENT_TOOL_CATEGORIES,
  AGENT_TOOL_DRAG_KEY,
  type AgentToolBlock,
} from "./agentToolBlocks";

interface AgentToolsBarProps {
  /** Called with the reactflow node type ("agentTool") so existing onDragStart can register it. */
  onToolDragStart?: (event: React.DragEvent, nodeType: string) => void;
}

const NODE_TYPE = "agentTool";

function handleDragStart(event: React.DragEvent, block: AgentToolBlock, onToolDragStart?: AgentToolsBarProps["onToolDragStart"]) {
  event.dataTransfer.setData("application/reactflow", NODE_TYPE);
  event.dataTransfer.setData(
    AGENT_TOOL_DRAG_KEY,
    JSON.stringify({
      toolName: block.toolName,
      label: block.label,
      description: block.description,
      category: block.category,
    })
  );
  event.dataTransfer.effectAllowed = "move";
  onToolDragStart?.(event, NODE_TYPE);
}

export function AgentToolsBar({ onToolDragStart }: AgentToolsBarProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-2 border-t border-border overflow-x-auto">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0 pt-2">
        Ferramentas do Agente:
      </p>
      <div className="flex items-start gap-4">
        {AGENT_TOOL_CATEGORIES.map((cat) => {
          const items = AGENT_TOOL_BLOCKS.filter((b) => b.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="flex flex-col gap-1 shrink-0">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">
                {cat}
              </span>
              <div className="flex items-center gap-2">
                {items.map((bloco) => (
                  <div
                    key={bloco.toolName}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30 cursor-grab hover:bg-accent/50 hover:border-primary/30 transition-all active:cursor-grabbing shrink-0"
                    draggable
                    onDragStart={(e) => handleDragStart(e, bloco, onToolDragStart)}
                    title={bloco.description}
                  >
                    <div className="p-1 rounded-md bg-primary/10">
                      <bloco.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="max-w-[180px]">
                      <h3 className="font-medium text-xs truncate">{bloco.label}</h3>
                      <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                        {bloco.description}
                      </p>
                    </div>
                    <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}