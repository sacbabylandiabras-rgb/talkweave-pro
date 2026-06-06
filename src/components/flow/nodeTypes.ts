// src/components/flow/nodeTypes.ts
import { BlocoInicialNode } from "./BlocoInicialNode";
import { BlocoGatilhoNode } from "./BlocoGatilhoNode";
import { BlocoGatewayTriggerNode } from "./BlocoGatewayTriggerNode";
import { BlocoConteudoNode } from "./BlocoConteudoNode";
import { BlocoCondicaoNode } from "./BlocoCondicaoNode";
import { BlocoAcaoNode } from "./BlocoAcaoNode";
import { BlocoAgendamentoNode } from "./BlocoAgendamentoNode";
import { BlocoAgenteIANode } from "./BlocoAgenteIANode";
import { BlocoAgentToolNode } from "./BlocoAgentToolNode";

/**
 * Mapeamento centralizado de tipos de nó para componentes React.
 *
 * Cada componente é registrado sob DUAS chaves para compatibilidade:
 *  - chave longa legada (`blocoInicial`, `blocoConteudo`, …) usada pelos
 *    fluxos já salvos no banco;
 *  - chave curta (`inicio`, `conteudo`, …) usada em novos templates.
 */
export const nodeTypes = {
  // Legacy (chaves usadas pelos fluxos persistidos)
  blocoInicial: BlocoInicialNode,
  blocoGatilho: BlocoGatilhoNode,
  blocoConteudo: BlocoConteudoNode,
  blocoCondicao: BlocoCondicaoNode,
  blocoAcao: BlocoAcaoNode,
  blocoAgendamento: BlocoAgendamentoNode,

  // Chaves curtas (aliases)
  inicio: BlocoInicialNode,
  gatilho: BlocoGatilhoNode,
  gateway: BlocoGatewayTriggerNode,
  conteudo: BlocoConteudoNode,
  condicao: BlocoCondicaoNode,
  acao: BlocoAcaoNode,
  agendamento: BlocoAgendamentoNode,

  // IA
  agenteIA: BlocoAgenteIANode,
  agenteTool: BlocoAgentToolNode,
  agentTool: BlocoAgentToolNode, // alias retrocompatível
} as const;

export function isValidNodeType(type: string): boolean {
  return type in nodeTypes;
}

export function getNodeComponent(type: string) {
  return nodeTypes[type as keyof typeof nodeTypes] ?? null;
}