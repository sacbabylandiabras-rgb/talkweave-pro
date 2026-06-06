// src/components/flow/BlocoCondicaoNode_CORRIGIDO.tsx
import { Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";

/**
 * VERSÃO CORRIGIDA - BlocoCondicaoNode
 *
 * Problemas corrigidos:
 * - Validação de dados melhorada
 * - Lógica simplificada
 * - Fallbacks para dados faltando
 * - Melhor tratamento de branches
 */
export function BlocoCondicaoNode({ data }: any) {
  // ✅ Validação segura dos dados
  const label = data?.label || "Condição";
  const isTelegram = data?.isTelegram || false;
  const variable = data?.variable || "";
  const operator = data?.operator || "equals";
  const compareValue = data?.compareValue ?? "";

  // Tipos de condição baseado no label
  const conditionType = label.toLowerCase();
  const isIfElse = conditionType.includes("if/else");
  const isSplit = conditionType.includes("split");
  const isTags = conditionType.includes("tag");
  const isTime = conditionType.includes("horário") || conditionType.includes("horario");

  // ✅ Tratamento seguro de conditions array
  const rawConditions: any[] = Array.isArray(data?.conditions)
    ? data.conditions.filter((c: any) => c) // Remove undefined
    : variable
      ? [{ variable, operator, compareValue, dataType: data?.dataType || "string" }]
      : [];

  // ✅ Tratamento seguro de branches
  const branches: any[] =
    Array.isArray(data?.branches) && data.branches.length > 0
      ? data.branches
      : isTime
        ? [
            { label: "Dentro do Horário", value: "in" },
            { label: "Fora do Horário", value: "out" },
          ]
        : isSplit
          ? [
              { label: "Caminho 1", value: "1" },
              { label: "Caminho 2", value: "2" },
            ]
          : [
              { label: "Verdadeiro", value: "true" },
              { label: "Falso", value: "false" },
            ];

  const ROW_H = 28;

  // ================================
  // RENDERIZAÇÃO - IF/ELSE (Complexo)
  // ================================
  if (isIfElse && rawConditions.length > 0) {
    return (
      <div className="relative shadow-md rounded-2xl border border-border/40 bg-card min-w-[260px] glass-card !overflow-visible z-50">
        {/* Header */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-t-2xl ${
            isTelegram ? "bg-blue-600" : "bg-primary/90"
          } text-white`}
        >
          <div className="p-1 rounded bg-white/15">
            <GitBranch className="h-3.5 w-3.5" />
          </div>
          <div className="text-xs font-semibold flex-1 truncate">{label}</div>
        </div>

        {/* Handles de entrada */}
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
          style={{ left: -8, top: 32 }}
        />
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
          style={{ top: -8 }}
        />

        {/* Condições */}
        <div className="py-1">
          {rawConditions.map((condition, index) => (
            <div
              key={index}
              className="relative flex items-center gap-2 px-3 text-[11px] text-card-foreground/90 border-b border-border/30"
              style={{ height: ROW_H }}
            >
              <span className="inline-flex items-center justify-center min-w-[26px] h-4 px-1 rounded text-[9px] font-bold bg-muted text-foreground">
                IF{index + 1}
              </span>
              <span className="truncate flex-1 font-mono text-primary text-[10px]">
                {condition.variable || "—"} {operator} "{condition.compareValue ?? ""}"
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`condition-${index}`}
                className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
                style={{ right: -8 }}
              />
            </div>
          ))}

          {/* ELSE - Padrão */}
          <div
            className="relative flex items-center gap-2 px-3 mt-1 mx-2 mb-2 rounded-md bg-orange-500/15 border border-orange-500/40 text-[11px] text-orange-200"
            style={{ height: ROW_H }}
          >
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded text-[9px] font-bold bg-orange-500/80 text-white">
              ELSE
            </span>
            <span className="ml-auto text-[10px] text-orange-300/80">padrão</span>
            <Handle
              type="source"
              position={Position.Right}
              id="source-else"
              className="!w-4 !h-4 !bg-orange-500 !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
              style={{ right: -16 }}
            />
          </div>
        </div>

        <div className="px-3 pb-2 text-[9px] text-muted-foreground/70 italic">
          Arraste dos pontos azuis/laranja para conectar
        </div>
      </div>
    );
  }

  // ================================
  // RENDERIZAÇÃO - SIMPLES (Split, Tags, Time, etc)
  // ================================
  return (
    <div className="relative pt-5 pb-2 shadow-md rounded-2xl border border-border/40 bg-card min-w-[220px] glass-card !overflow-visible z-50">
      <span
        className={`absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal ${
          isTelegram ? "bg-blue-600" : "bg-primary/90"
        } text-white rounded-md`}
      >
        {isTelegram ? "Condição Telegram" : "Condição"}
      </span>

      {/* Handles de entrada */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
        style={{ left: -8 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto"
        style={{ top: -8 }}
      />

      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-4">
        <div className="p-1.5 rounded bg-primary/10">
          <GitBranch className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-card-foreground">{label}</div>
          {variable && (
            <div className="text-xs text-muted-foreground mt-1">
              <code className="font-mono text-primary">{variable}</code>
            </div>
          )}
        </div>
      </div>

      {/* Branches */}
      <div className="mt-2 py-1">
        {branches.map((branch, index) => (
          <div
            key={index}
            className="relative flex items-center gap-2 px-3 text-[11px] text-card-foreground/90 border-b border-border/30 last:border-0"
            style={{ height: ROW_H }}
          >
            <span className="inline-flex items-center justify-center min-w-[22px] h-4 px-1 rounded text-[9px] font-bold bg-muted text-foreground">
              {index + 1}
            </span>
            <span className="truncate flex-1">
              {isSplit ? (
                <span className="font-medium">{branch.label}</span>
              ) : isTags ? (
                <>
                  <span className="text-muted-foreground mr-1">🏷</span>
                  <span className="font-medium">{branch.value || branch.label}</span>
                </>
              ) : isTime ? (
                <>
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                      branch.value === "out" ? "bg-orange-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className="font-medium">{branch.label}</span>
                </>
              ) : (
                <span className="font-medium">{branch.label}</span>
              )}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={`branch-${index}`}
              className="!w-4 !h-4 !bg-[#2563EB] !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto hover:!bg-blue-400"
              style={{ right: -8 }}
            />
          </div>
        ))}

        {/* ELSE - Padrão */}
        {!isSplit && branches.length > 0 && (
          <div
            className="relative flex items-center gap-2 px-3 mt-1 mx-2 mb-1 rounded-md bg-orange-500/15 border border-orange-500/40 text-[11px] text-orange-200"
            style={{ height: ROW_H }}
          >
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded text-[9px] font-bold bg-orange-500/80 text-white">
              ELSE
            </span>
            <span className="ml-auto text-[10px] text-orange-300/80">padrão →</span>
            <Handle
              type="source"
              position={Position.Right}
              id="source-else"
              className="!w-4 !h-4 !bg-orange-500 !border-2 !border-white shadow-xl !z-[100] !pointer-events-auto hover:!bg-orange-400"
              style={{ right: -16 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
