import { Handle, Position } from "reactflow";
import { GitBranch, TestTube } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


export function BlocoCondicaoNode({ data }: any) {
  const handleTestPixel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para testar o Pixel");
        return;
      }

      toast.info("Enviando evento de teste do Pixel...");
      
      const { data: response, error } = await supabase.functions.invoke('webhook-zapi', {
        body: {
          test_event: true,
          test_event_code: "TEST20723",
          instanceId: "test-instance",
          phone: "5511999999999",
          moments: ["proof_of_payment"]
        }
      });

      if (error) throw error;
      
      toast.success("Evento de teste enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao testar pixel:", error);
      toast.error("Erro ao enviar evento de teste");
    }
  };

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
    const isTags = (data.label || "").toLowerCase().includes("tag");
    const isHorario = (data.label || "").toLowerCase().includes("horário") || (data.label || "").toLowerCase().includes("horario");
    const isFiltroCadastro = (data.label || "").toLowerCase().includes("filtro por cadastro");
    const isFiltroMensagem = (data.label || "").toLowerCase().includes("filtro por mensagem");
    const isFiltroStatus = (data.label || "").toLowerCase().includes("filtro por status do atendimento") || (data.label || "").toLowerCase().includes("status do atendimento");
    const isFiltroSessao = (data.label || "").toLowerCase().includes("filtro por sessão") || (data.label || "").toLowerCase().includes("filtro por sessao");
    const isFiltroFollowUp = (data.label || "").toLowerCase().includes("follow up") || (data.label || "").toLowerCase().includes("followup");
    const isProofBlock = !!data.isProofBlock;
    const filtroOperatorShort: Record<string, string> = {
      equals: "=",
      greater: ">",
      less: "<",
      is_null: "é nulo",
      is_empty: "está vazio",
    };
    const filtroNoValueOps = new Set(["is_null", "is_empty"]);
    const msgOperatorLabel: Record<string, string> = {
      equals: "Igual",
      contains: "Contém",
      starts_with: "Inicia com",
      ends_with: "Finaliza com",
    };
    const branches: any[] = Array.isArray(data.branches) && data.branches.length > 0
      ? data.branches
      : isHorario
        ? [
            { label: "Dentro do Horário", value: "in" },
            { label: "Fora do Horário", value: "out" },
          ]
        : isFiltroStatus
        ? [
            { label: "Na Fila", value: "queue" },
            { label: "Humano", value: "human" },
            { label: "Agente", value: "agent" },
            { label: "Finalizado", value: "done" },
          ]
        : isFiltroSessao
        ? [
            { label: "Sessão Aberta", value: "open" },
            { label: "Sessão Fechada", value: "closed" },
          ]
        : isFiltroFollowUp
        ? [
            { label: "Follow Up", value: "followup" },
            { label: "Não é Follow Up", value: "not_followup" },
          ]
        : isProofBlock
        ? [
            { label: "Comprovante Recebido", value: "[media:" },
          ]
        : [
            { label: "Verdadeiro", value: data.condition || "" },
            { label: "Falso", value: "" },
          ];
    const branchHandleId = (i: number) => (i === 0 ? "a" : i === 1 ? "b" : `branch-${i}`);
    const ROW = 28;
    return (
      <div className="relative pt-5 pb-2 shadow-md rounded-2xl border border-border/40 bg-card min-w-[220px] glass-card !overflow-visible z-50">
        <span className={`absolute -top-3 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-normal ${data.isTelegram ? 'bg-blue-600' : 'bg-primary/90'} text-white rounded-md`}>
          {data.isTelegram ? "Condição Telegram" : "Condição"}
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
                ) : isTags ? (
                  <>
                    <span className="text-muted-foreground mr-1">🏷</span>
                    <span className="font-medium">{b.value || b.label || "tag"}</span>
                  </>
                ) : isHorario ? (
                  <>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${b.value === "out" ? "bg-orange-500" : "bg-emerald-500"}`} />
                    <span className="font-medium">{b.label}</span>
                  </>
                ) : isFiltroCadastro ? (
                  <>
                    <code className="font-mono text-primary text-[10px]">{b.field || "—"}</code>
                    <span className="mx-1 text-muted-foreground">{filtroOperatorShort[b.operator] || "="}</span>
                    {!filtroNoValueOps.has(b.operator) && (
                      <span className="font-medium">"{b.value ?? ""}"</span>
                    )}
                  </>
                ) : isFiltroMensagem ? (
                  <>
                    <span className="text-muted-foreground mr-1">{msgOperatorLabel[b.operator] || "Contém"}</span>
                    <span className="font-medium">"{b.value ?? ""}"</span>
                  </>
                ) : isFiltroStatus ? (
                  <>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                      b.value === "queue" ? "bg-amber-500" :
                      b.value === "human" ? "bg-blue-500" :
                      b.value === "agent" ? "bg-violet-500" :
                      "bg-emerald-500"
                    }`} />
                    <span className="font-medium">{b.label}</span>
                  </>
                ) : isFiltroSessao ? (
                  <>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${b.value === "open" ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="font-medium">{b.label}</span>
                  </>
                ) : isFiltroFollowUp ? (
                  <>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${b.value === "followup" ? "bg-cyan-500" : "bg-slate-500"}`} />
                    <span className="font-medium">{b.label}</span>
                  </>
                ) : isProofBlock ? (
                  <div className="flex flex-col gap-2 w-full py-2 pr-1">
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">Aguardando mídia</span>
                      <span className="font-medium">→ Próximo passo</span>
                    </div>
                    <button 
                      onClick={handleTestPixel}
                      className="flex items-center justify-center gap-1.5 px-2 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded text-[10px] font-medium transition-colors border border-primary/30 w-full mt-1"
                    >
                      <TestTube className="h-3 w-3" />
                      Testar Pixel (TEST20723)
                    </button>
                  </div>
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
          {!isSplit && !isHorario && !isFiltroStatus && !isFiltroSessao && !isFiltroFollowUp && !isProofBlock && (
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
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-2xl ${data.isTelegram ? 'bg-blue-600' : 'bg-primary/90'} text-white`}>
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
