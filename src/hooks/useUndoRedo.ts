import { useState, useCallback } from 'react';
import { Node, Edge } from 'reactflow';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
}

interface UseUndoRedoReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  push: (nodes: Node[], edges: Edge[]) => void;
  history: FlowState[];
  currentIndex: number;
}

export const useUndoRedo = (maxHistory: number = 50): UseUndoRedoReturn => {
  const [history, setHistory] = useState<FlowState[]>([
    { nodes: [], edges: [], timestamp: Date.now() },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const push = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      const newState: FlowState = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        timestamp: Date.now(),
      };

      // Remove future states se estamos voltando no histórico
      let newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(newState);

      // Limita o tamanho do histórico
      if (newHistory.length > maxHistory) {
        newHistory = newHistory.slice(-maxHistory);
      }

      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
    },
    [history, currentIndex, maxHistory]
  );

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);

  return {
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    undo,
    redo,
    push,
    history,
    currentIndex,
  };
};