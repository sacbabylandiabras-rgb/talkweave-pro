import { Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";

export function BlocoCondicaoNode({ data }: any) {
  const operatorShort: Record<string, string> = {
    equals: "=",
    not_equals: "≠",
    contains: "contém",
    not_contains: "não contém",
    starts_with: "começa com",
    ends_with: "termina com",
    is_empty: "está vazio",
    is_not_empty: "não vazio",
    matches_regex: "regex",
    not_matches_regex: "≠ regex",
    length_equals: "tam =",
    length_greater: "tam >",
    length_less: "tam <",
    is_numeric: "é numérico",
    greater: ">",
    greater_equals: "≥",
    less: "<",
    less_equals: "≤",
    between: "entre",
    is_true: "verdadeiro",
    is_false: "falso",
    before: "antes de",
    after: "depois de",
  };
  const noValueOps = new Set([
    "is_empty", "is_not_empty", "is_numeric", "is_true", "is_false",
  ]);

  const rawConditions: any[] = Array.isArray(data.conditions)
    ? data.conditions
    : (data.variable || data.condition)
      ? [{
          variable: data.variable || "",
          dataType: data.dataType || "string",
          operator: data.operator || "equals",
          compareValue: data.compareValue ?? data.condition ?? "",
        }]
      : [];

  const ROW_H = 28;
  const HEADER_H = 44;
  const handleIdFor = (i: number) =>
    i === 0 ? "a" : i === 1 ? "b" : `if-${i}`;

  // Only the "Condição If/Else" variant uses the multi-row IF/ELSE layout.
  // Every other condition variant (Split, Decisão por Tags/Horário, Filtros, etc.)
  // keeps the original compact node design.
  const isIfElse = (data.label || "").toLowerCase().includes("if/else");

  if (!isIfElse) {
    const isSplit = (data.label || "").toLowerCase().includes("split");
    const branches: any[] = Array.isArray(data.branches) && data.branches.length > 0
      ? data.branches
      : [
          { label: "Verdadeiro", value: data.condition || "" },
          { label: "Falso", value: "" },
        ];
    const branchHandleId = (i: number) => (i === 0 ? "a" : i === 1 ? "b" : `branch-${i}`);
    const ROW = 28;
    return (
      <div className="relative pt-5 pb-2 shadow-md rounded-2xl border border-border/40 bg-card min-w-[220px] glass-card !overflow-visible z-50">
        <span className="absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal bg-primary/90 text-white rounded-md">
          Condição
        </span>
        <Handle type="target" position={Position.Left} id="target-left" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ left: -8 }} />
        <Handle type="target" position={Position.Top} id="target-top" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ top: -8 }} />
        <div className="flex items-center gap-2 px-4">
          <div className="p-1.5 rounded bg-primary/10">
            <GitBranch className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-card-foreground">
              {data.label}
            </div>
            {data.variable && (
              <div className="text-xs text-muted-foreground mt-1">
                <code className="font-mono text-primary">{data.variable}</code>
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 py-1">
          {branches.map((b: any, i: number) => (
            <div
              key={i}
              className="relative flex items-center gap-2 px-3 text-[11px] text-card-foreground/90 border-b border-border/30 last:border-0"
              style={{ height: ROW }}
            >
              <span className="inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[9px] font-bold bg-muted text-foreground">
                {i + 1}
              </span>
              <span className="truncate flex-1">
                {isSplit ? (
                  <span className="font-medium">{b.label || `Caminho ${i + 1}`}</span>
                ) : (
                  <>
                    <span className="text-muted-foreground mr-1">se =</span>
                    <span className="font-medium">"{b.value ?? ""}"</span>
                    {b.label && <span className="ml-1 text-muted-foreground">→ {b.label}</span>}
                  </>
                )}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={branchHandleId(i)}
                className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto !cursor-crosshair hover:!bg-blue-400"
                style={{ right: -8, top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          ))}
          {!isSplit && (
          <div
            className="relative flex items-center gap-2 px-3 mt-1 mx-2 mb-1 rounded-md bg-orange-500/15 border border-orange-500/40 text-[11px] text-orange-200"
            style={{ height: ROW }}
          >
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded text-[9px] font-bold bg-orange-500/80 text-white">
              ELSE (Padrão)
            </span>
            <span className="ml-auto text-[10px] text-orange-300/80">caminho padrão →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="source-bottom"
              className="!w-4 !h-4 !bg-orange-500 !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto !cursor-crosshair hover:!bg-orange-400"
              style={{ right: -16, top: "50%", transform: "translateY(-50%)" }}
            />
          </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative shadow-md rounded-2xl border border-border/40 bg-card min-w-[260px] glass-card !overflow-visible z-50">
      <Handle type="target" position={Position.Left} id="target-left" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ left: -8, top: HEADER_H / 2 }} />
      <Handle type="target" position={Position.Top} id="target-top" className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto" style={{ top: -8 }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-2xl bg-primary/90 text-white">
        <div className="p-1 rounded bg-white/15">
          <GitBranch className="h-3.5 w-3.5" />
        </div>
        <div className="text-xs font-semibold flex-1 truncate">
          {data.label || "Condição If/Else"}
        </div>
      </div>

      {/* Conditions list */}
      <div className="py-1">
        {rawConditions.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-muted-foreground">
            Sem condições configuradas
          </div>
        )}
        {rawConditions.map((c, i) => {
          const op = operatorShort[c.operator] || c.operator || "=";
          const showVal = !noValueOps.has(c.operator);
          return (
            <div
              key={i}
              className="relative flex items-center gap-2 px-3 text-[11px] text-card-foreground/90 border-b border-border/30 last:border-0"
              style={{ height: ROW_H }}
            >
              <span className="inline-flex items-center justify-center min-w-[26px] h-4 px-1 rounded text-[9px] font-bold bg-muted text-foreground">
                IF{i + 1}
              </span>
              <span className="truncate flex-1">
                <code className="font-mono text-primary">{c.variable || "—"}</code>
                <span className="mx-1 text-muted-foreground">{op}</span>
                {showVal && (
                  <span className="font-medium">"{c.compareValue ?? ""}"</span>
                )}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={handleIdFor(i)}
                className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto !cursor-crosshair hover:!bg-blue-400"
                style={{ right: -8, top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          );
        })}

        {/* ELSE row */}
        <div
          className="relative flex items-center gap-2 px-3 mt-1 mx-2 mb-2 rounded-md bg-orange-500/15 border border-orange-500/40 text-[11px] text-orange-200"
          style={{ height: ROW_H }}
        >
          <span className="inline-flex items-center justify-center h-4 px-1.5 rounded text-[9px] font-bold bg-orange-500/80 text-white">
            ELSE (Padrão)
          </span>
          <span className="ml-auto text-[10px] text-orange-300/80">caminho padrão →</span>
          <Handle
            type="source"
            position={Position.Right}
            id="source-bottom"
            className="!w-4 !h-4 !bg-orange-500 !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto !cursor-crosshair hover:!bg-orange-400"
            style={{ right: -16, top: "50%", transform: "translateY(-50%)" }}
          />
        </div>
      </div>
      <div className="px-3 pb-2 text-[9px] text-muted-foreground/70 italic">
        Arraste de cada ponto azul/laranja para conectar ao próximo bloco
      </div>
    </div>
  );
}
