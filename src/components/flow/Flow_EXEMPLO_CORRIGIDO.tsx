// src/components/flow/Flow_EXEMPLO_CORRIGIDO.tsx
/**
 * EXEMPLO DE COMPONENTE FLOW CORRIGIDO
 * 
 * Este é um modelo de como estruturar seu componente Flow
 * para que os blocos funcionem corretamente.
 */

import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ✅ IMPORTAR O MAPEAMENTO DE TIPOS
import { nodeTypes } from './nodeTypes';

// ✅ IMPORTAR DADOS DE EXEMPLO
import { EXEMPLO_BLOCOS, validarNode } from './exemploBlocos';

// Dados iniciais de exemplo
const initialNodes: Node[] = [
  EXEMPLO_BLOCOS.inicio,
  EXEMPLO_BLOCOS.gatilho,
  EXEMPLO_BLOCOS.conteudoTexto,
  EXEMPLO_BLOCOS.condicaoSplit,
  EXEMPLO_BLOCOS.acao,
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'node-inicio', target: 'node-gatilho' },
  { id: 'e2-3', source: 'node-gatilho', target: 'node-texto' },
  { id: 'e3-4', source: 'node-texto', target: 'node-split' },
];

export function FlowExemploCorrigido() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // ✅ Conexão entre nós
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // ✅ Quando um nó é clicado
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      
      // DEBUG: Ver dados do nó no console
      console.log('Nó selecionado:', {
        id: node.id,
        type: node.type,
        data: node.data,
        position: node.position,
      });

      // Validar nó
      const { valido, erros } = validarNode(node);
      if (!valido) {
        console.warn('⚠️ Problemas no nó:', erros);
      } else {
        console.log('✅ Nó válido');
      }
    },
    []
  );

  // ✅ Adicionar novo nó
  const handleAddNode = useCallback(
    (type: string) => {
      const novoNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: {
          x: Math.random() * 500,
          y: Math.random() * 500,
        },
        data: {
          label: `Novo ${type}`,
          // Dados mínimos necessários
          ...(type === 'condicao' && { branches: [] }),
          ...(type === 'conteudo' && { contentType: 'text' }),
          ...(type === 'agenteIA' && { model: 'claude-3-5-sonnet-latest' }),
        },
      };

      // Validar antes de adicionar
      const { valido, erros } = validarNode(novoNode);
      if (!valido) {
        console.error('❌ Nó inválido, não pode ser adicionado:', erros);
        return;
      }

      setNodes((nds) => [...nds, novoNode]);
      console.log('✅ Nó adicionado:', novoNode.id);
    },
    [setNodes]
  );

  // ✅ Deletar nó selecionado
  const handleDeleteNode = useCallback(() => {
    if (!selectedNode) return;

    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
      )
    );
    setSelectedNode(null);
    console.log('✅ Nó deletado:', selectedNode.id);
  }, [selectedNode, setNodes, setEdges]);

  // ✅ Atualizar dados de um nó
  const handleUpdateNodeData = useCallback(
    (updates: any) => {
      if (!selectedNode) return;

      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, ...updates } }
            : n
        )
      );
      setSelectedNode(null);
      console.log('✅ Nó atualizado:', updates);
    },
    [selectedNode, setNodes]
  );

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex' }}>
      {/* Canvas do ReactFlow */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes} // ✅ FUNDAMENTAL!
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Painel lateral - Informações e controles */}
      <div
        style={{
          width: '300px',
          borderLeft: '1px solid #ccc',
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: '#f5f5f5',
        }}
      >
        <h3>Ferramentas</h3>

        {/* Botões para adicionar novos blocos */}
        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => handleAddNode('inicio')} style={{ display: 'block', marginBottom: '10px', width: '100%' }}>
            + Início
          </button>
          <button onClick={() => handleAddNode('gatilho')} style={{ display: 'block', marginBottom: '10px', width: '100%' }}>
            + Gatilho
          </button>
          <button onClick={() => handleAddNode('conteudo')} style={{ display: 'block', marginBottom: '10px', width: '100%' }}>
            + Conteúdo
          </button>
          <button onClick={() => handleAddNode('condicao')} style={{ display: 'block', marginBottom: '10px', width: '100%' }}>
            + Condição
          </button>
          <button onClick={() => handleAddNode('acao')} style={{ display: 'block', marginBottom: '10px', width: '100%' }}>
            + Ação
          </button>
          <button onClick={() => handleAddNode('agendamento')} style={{ display: 'block', marginBottom: '10px', width: '100%' }}>
            + Agendamento
          </button>
          <button onClick={() => handleAddNode('agenteIA')} style={{ display: 'block', marginBottom: '10px', width: '100%' }}>
            + Agente IA
          </button>
        </div>

        <hr />

        {/* Informações do nó selecionado */}
        <h3>Nó Selecionado</h3>
        {selectedNode ? (
          <>
            <div style={{ marginBottom: '10px' }}>
              <strong>ID:</strong> {selectedNode.id}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Tipo:</strong> {selectedNode.type}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Label:</strong> {selectedNode.data.label}
            </div>

            {/* Editar label */}
            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                value={selectedNode.data.label}
                onChange={(e) =>
                  handleUpdateNodeData({ label: e.target.value })
                }
                style={{ width: '100%', padding: '8px' }}
                placeholder="Novo label"
              />
            </div>

            {/* Botões de ação */}
            <button
              onClick={handleDeleteNode}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Deletar
            </button>

            {/* Debug info */}
            <hr style={{ margin: '15px 0' }} />
            <h4>Debug Info</h4>
            <pre
              style={{
                fontSize: '11px',
                backgroundColor: '#fff',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
              }}
            >
              {JSON.stringify(
                {
                  id: selectedNode.id,
                  type: selectedNode.type,
                  data: selectedNode.data,
                  position: selectedNode.position,
                },
                null,
                2
              )}
            </pre>
          </>
        ) : (
          <p style={{ color: '#666' }}>Clique em um nó para ver detalhes</p>
        )}

        <hr style={{ margin: '15px 0' }} />

        {/* Estatísticas */}
        <h3>Estatísticas</h3>
        <div>
          <strong>Total de Nós:</strong> {nodes.length}
        </div>
        <div>
          <strong>Total de Conexões:</strong> {edges.length}
        </div>
      </div>
    </div>
  );
}

export default FlowExemploCorrigido;
